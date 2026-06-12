import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { getUserId } from "./_shared/auth"

// process.env is available in Convex Node.js actions; declare for browser tsconfig compatibility
declare const process: { env: Record<string, string | undefined> }
import {
  buildClaudePrompt,
  buildPackingItems,
  DEFAULT_PREP_TASKS,
  buildPreTripTasks,
  buildPreTripTasksPrompt,
  parseAITaskSpecs,
  groupTasksByDate,
  buildHabitAdvisorPrompt,
  parseHabitAdvice,
  buildFallbackAdviceList,
  buildTripSystemPrompt,
  buildApiMessages,
} from "./travelLogic"
import type { CountryInfo, WeatherData, HabitDefinition, TripContext } from "./travelLogic"

// ── Queries ──────────────────────────────────────────────────────────────────

/** Returns lightweight trip info for the active trip on a given date, or null.
 *  Intentionally excludes generatedPlan/dailyPlan/packingList to stay well
 *  under Convex's 1 MB query-response limit.
 */
export const getActiveOnDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const userId = getUserId(identity.subject)
    const trips = await ctx.db
      .query("travelTrips")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    const trip = trips.find((t) => {
      if (!t.startDate) return false
      if (args.date < t.startDate) return false
      if (t.endDate && args.date > t.endDate) return false
      return true
    })
    if (!trip) return null
    return {
      _id: trip._id,
      name: trip.name,
      destination: trip.destination,
      durationDays: trip.durationDays,
      budgetPreference: trip.budgetPreference,
      startDate: trip.startDate,
      endDate: trip.endDate,
      status: trip.status,
    }
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const userId = getUserId(identity.subject)
    return await ctx.db
      .query("travelTrips")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
  },
})

export const get = query({
  args: { id: v.id("travelTrips") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const trip = await ctx.db.get(args.id)
    if (!trip || trip.userId !== getUserId(identity.subject)) return null
    return trip
  },
})

// ── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    destination: v.string(),
    origin: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    durationDays: v.number(),
    purpose: v.string(),
    lifeStage: v.string(),
    budgetPreference: v.string(),
    accommodationPreference: v.string(),
    benefits: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    if (args.durationDays < 1 || args.durationDays > 365) throw new Error("durationDays must be 1-365")
    if (args.name.length > 200) throw new Error("name exceeds 200 character limit")
    if (args.destination.length > 200) throw new Error("destination exceeds 200 character limit")
    return await ctx.db.insert("travelTrips", {
      ...args,
      userId: getUserId(identity.subject),
      status: "planning",
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("travelTrips"),
    name: v.optional(v.string()),
    destination: v.optional(v.string()),
    origin: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    durationDays: v.optional(v.number()),
    purpose: v.optional(v.string()),
    lifeStage: v.optional(v.string()),
    budgetPreference: v.optional(v.string()),
    accommodationPreference: v.optional(v.string()),
    benefits: v.optional(v.string()),
    generatedPlan: v.optional(v.any()),
    dailyPlan: v.optional(v.array(v.any())),
    budget: v.optional(v.any()),
    packingList: v.optional(v.array(v.any())),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("planning"), v.literal("active"), v.literal("completed"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const trip = await ctx.db.get(args.id)
    if (!trip || trip.userId !== getUserId(identity.subject)) throw new Error("Not found")
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const remove = mutation({
  args: { id: v.id("travelTrips") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const trip = await ctx.db.get(args.id)
    if (!trip || trip.userId !== getUserId(identity.subject)) throw new Error("Not found")
    await ctx.db.delete(args.id)
  },
})

export const applyGeneratedPlan = internalMutation({
  args: {
    id: v.id("travelTrips"),
    generatedPlan: v.any(),
    dailyPlan: v.array(v.any()),
    packingList: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      generatedPlan: args.generatedPlan,
      dailyPlan: args.dailyPlan,
      packingList: args.packingList,
    })
  },
})

// ── AI generation action ─────────────────────────────────────────────────────

export const generatePlan = action({
  args: {
    id: v.id("travelTrips"),
    origin: v.string(),
    destination: v.string(),
    purpose: v.string(),
    durationDays: v.number(),
    lifeStage: v.string(),
    budgetPreference: v.string(),
    accommodationPreference: v.string(),
    benefits: v.optional(v.string()),
    startDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const trip = await ctx.runQuery(internal.travel.getTripInternal, { id: args.id, userId: getUserId(identity.subject) })
    if (!trip) throw new Error("Not found")

    const cityQuery = args.destination.includes(",")
      ? args.destination.split(",")[0]!.trim()
      : args.destination.trim()

    const [countryInfo, coords] = await Promise.all([
      fetchCountryInfo(args.destination),
      fetchCoordinates(cityQuery),
    ])

    const weather = coords ? await fetchWeatherForecast(coords.lat, coords.lon) : null

    const prompt = buildClaudePrompt(args, countryInfo, weather)
    const plan = await callClaude(prompt)

    await ctx.runMutation(internal.travel.applyGeneratedPlan, {
      id: args.id,
      generatedPlan: plan,
      dailyPlan: plan.dailyPlan ?? [],
      packingList: buildPackingItems(plan.packingList as string[]),
    })
  },
})

// ── Pre-trip planner injection ───────────────────────────────────────────────

export const getPlannerDay = internalQuery({
  args: { userId: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("plannerDays")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
      .unique()
  },
})

export const upsertPlannerDayWithTasks = internalMutation({
  args: {
    userId: v.string(),
    date: v.string(),
    newTasks: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("plannerDays")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
      .unique()
    if (existing) {
      const merged = [...(existing.tasks as unknown[]), ...args.newTasks]
      await ctx.db.patch(existing._id, { tasks: merged })
    } else {
      await ctx.db.insert("plannerDays", {
        userId: args.userId,
        date: args.date,
        tasks: args.newTasks,
        deepWorkSessions: [],
      })
    }
  },
})

export const injectPreTripTasks = action({
  args: {
    tripId: v.id("travelTrips"),
    destination: v.string(),
    purpose: v.string(),
    durationDays: v.number(),
    lifeStage: v.string(),
    startDate: v.string(),
    useAI: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ injectedCount: number; datesAffected: number }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = getUserId(identity.subject)

    const trip = await ctx.runQuery(internal.travel.getTripInternal, { id: args.tripId, userId })
    if (!trip) throw new Error("Not found")

    const today = new Date().toISOString().slice(0, 10)

    let specs = DEFAULT_PREP_TASKS

    if (args.useAI) {
      try {
        const prompt = buildPreTripTasksPrompt(
          args.destination,
          args.purpose,
          args.durationDays,
          args.lifeStage,
          args.startDate,
        )
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (apiKey) {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 1024,
              messages: [{ role: "user", content: prompt }],
            }),
          })
          if (res.ok) {
            const data = await res.json() as { content: Array<{ type: string; text: string }> }
            const rawText = data.content.find((c) => c.type === "text")?.text ?? ""
            const parsed = parseAITaskSpecs(rawText)
            if (parsed.length >= 4) specs = parsed
          }
        }
      } catch {
        // Fall back to default tasks if AI call fails
      }
    }

    const tasks = buildPreTripTasks(specs, args.startDate, today)
    const byDate = groupTasksByDate(tasks)

    for (const [date, dateTasks] of Object.entries(byDate)) {
      await ctx.runMutation(internal.travel.upsertPlannerDayWithTasks, {
        userId,
        date,
        newTasks: dateTasks,
      })
    }

    return { injectedCount: tasks.length, datesAffected: Object.keys(byDate).length }
  },
})

// ── Habit continuation advisor ───────────────────────────────────────────────

export const getHabitAdvice = action({
  args: {
    destination: v.string(),
    purpose: v.string(),
    durationDays: v.number(),
  },
  handler: async (ctx, args): Promise<Array<{ habitId: string; label: string; verdict: string; reason: string }>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = getUserId(identity.subject)

    const settings = await ctx.runQuery(internal.travel.getUserSettings, { userId })
    const habits: HabitDefinition[] = (settings?.habitDefinitions ?? []) as HabitDefinition[]

    if (habits.length === 0) return []

    const prompt = buildHabitAdvisorPrompt(habits, args.destination, args.purpose, args.durationDays)

    try {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return buildFallbackAdviceList(habits)

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      })

      if (!res.ok) return buildFallbackAdviceList(habits)

      const data = await res.json() as { content: Array<{ type: string; text: string }> }
      const rawText = data.content.find((c) => c.type === "text")?.text ?? ""
      return parseHabitAdvice(rawText, habits)
    } catch {
      return buildFallbackAdviceList(habits)
    }
  },
})

export const getUserSettings = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique()
  },
})

// ── Mid-trip chat ────────────────────────────────────────────────────────────

export const chat = action({
  args: {
    tripId: v.id("travelTrips"),
    history: v.array(v.object({ role: v.union(v.literal("user"), v.literal("assistant")), content: v.string() })),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const trip = await ctx.runQuery(internal.travel.getTripInternal, { id: args.tripId, userId: getUserId(identity.subject) })
    if (!trip) throw new Error("Trip not found")

    const tripCtx: TripContext = {
      name: trip.name as string,
      destination: trip.destination as string,
      purpose: trip.purpose as string,
      durationDays: trip.durationDays as number,
      startDate: trip.startDate as string | undefined,
      budgetPreference: trip.budgetPreference as string,
    }

    const today = new Date().toISOString().slice(0, 10)
    const systemPrompt = buildTripSystemPrompt(tripCtx, (trip.dailyPlan ?? []) as never, today)
    const messages = buildApiMessages(args.history, args.message)

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured")

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: systemPrompt,
        messages,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => "(no body)")
      throw new Error(`Claude API error (${res.status}): ${errBody.slice(0, 200)}`)
    }

    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    return data.content.find((c) => c.type === "text")?.text ?? ""
  },
})

export const getTripInternal = internalQuery({
  args: { id: v.id("travelTrips"), userId: v.string() },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.id)
    if (!trip || trip.userId !== args.userId) return null
    return trip
  },
})

// ── External data fetchers ───────────────────────────────────────────────────

async function fetchCountryInfo(destination: string): Promise<CountryInfo | null> {
  const countryQuery = destination.includes(",")
    ? destination.split(",").pop()!.trim()
    : destination.trim()
  const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(countryQuery)}?fields=name,capital,currencies,languages,timezones,flags`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json() as Array<{
      name: { common: string }
      capital?: string[]
      currencies?: Record<string, { name: string; symbol: string }>
      languages?: Record<string, string>
      timezones?: string[]
      flags?: { emoji?: string }
    }>
    if (!data.length) return null
    const c = data[0]
    const currencyEntry = c.currencies ? Object.entries(c.currencies)[0] : null
    return {
      countryName: c.name.common,
      capital: c.capital?.[0] ?? "unknown",
      currency: currencyEntry
        ? `${currencyEntry[1].name} (${currencyEntry[0]}, ${currencyEntry[1].symbol})`
        : "unknown",
      languages: c.languages ? Object.values(c.languages) : [],
      timezone: c.timezones?.[0] ?? "UTC",
      flagEmoji: c.flags?.emoji ?? "",
    }
  } catch {
    return null
  }
}

async function fetchCoordinates(city: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json() as { results?: Array<{ latitude: number; longitude: number }> }
    const r = data.results?.[0]
    return r ? { lat: r.latitude, lon: r.longitude } : null
  } catch {
    return null
  }
}

async function fetchWeatherForecast(lat: number, lon: number): Promise<WeatherData | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_mean&timezone=auto&forecast_days=7`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json() as {
      daily?: {
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        precipitation_probability_mean: number[]
      }
    }
    if (!data.daily) return null
    return {
      maxTemps: data.daily.temperature_2m_max,
      minTemps: data.daily.temperature_2m_min,
      precipProbabilities: data.daily.precipitation_probability_mean,
    }
  } catch {
    return null
  }
}

// ── Claude API call ──────────────────────────────────────────────────────────

interface GeneratedPlan {
  packingList: string[]
  accommodationRecommendation: string
  placesToVisit: Array<{ name: string; description?: string }>
  thingsToDo: string[]
  gettingAround: string
  contingencies: string
  summary?: string
  weatherSummary?: string
  currencyInfo?: string
  visaInfo?: string
  budgetBreakdown?: string
  dailyPlan?: Array<{
    day: number
    theme: string
    activities: Array<{
      time: string
      name: string
      type: string
      durationMinutes: number
      notes?: string
    }>
  }>
}

async function callClaude(prompt: string): Promise<GeneratedPlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured")

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => "(no body)")
    throw new Error(`Claude API error (${res.status}): ${errBody.slice(0, 300)}`)
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const rawText = data.content.find((c) => c.type === "text")?.text ?? ""
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim()

  try {
    return JSON.parse(cleaned) as GeneratedPlan
  } catch {
    throw new Error(`Claude returned invalid JSON. Preview: ${rawText.slice(0, 300)}`)
  }
}
