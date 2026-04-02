/**
 * supabase/functions/travel-plan-generate/index.ts
 *
 * AI-powered travel plan generator. Fetches live destination data from free
 * public APIs (RestCountries, Open-Meteo) then calls Claude Sonnet to produce
 * a rich, personalised travel plan as structured JSON.
 *
 * Requires: ANTHROPIC_API_KEY set in Supabase Edge Function secrets.
 * Requires: signed-in user (JWT validated via requireUserId).
 */

import { requireUserId } from '../_shared/supabase.ts'
import { json, CORS_PREFLIGHT } from '../_shared/google.ts'

// ── Local type definitions ──────────────────────────────────────────────────

interface TravelPlanInput {
  origin: string
  destination: string
  purpose: string
  durationDays: number
  lifeStage: 'student' | 'professional' | 'unemployed'
  benefits?: string
  budgetPreference: 'budget' | 'moderate' | 'comfort'
  accommodationPreference: 'cheap' | 'affordable' | 'comfort'
  startDate?: string
}

interface TravelPlan {
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
}

interface CountryInfo {
  countryName: string
  capital: string
  currency: string
  languages: string[]
  timezone: string
  flagEmoji: string
}

interface WeatherData {
  maxTemps: number[]
  minTemps: number[]
  precipProbabilities: number[]
}

// ── External data helpers ───────────────────────────────────────────────────

async function fetchCountryInfo(destination: string): Promise<CountryInfo | null> {
  // Extract country portion from "City, Country" — fall back to full string
  const countryQuery = destination.includes(',')
    ? destination.split(',').pop()!.trim()
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
      capital: c.capital?.[0] ?? 'unknown',
      currency: currencyEntry
        ? `${currencyEntry[1].name} (${currencyEntry[0]}, ${currencyEntry[1].symbol})`
        : 'unknown',
      languages: c.languages ? Object.values(c.languages) : [],
      timezone: c.timezones?.[0] ?? 'UTC',
      flagEmoji: c.flags?.emoji ?? '',
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

// ── Claude prompt builder ───────────────────────────────────────────────────

function buildClaudePrompt(
  input: TravelPlanInput,
  countryInfo: CountryInfo | null,
  weather: WeatherData | null,
): string {
  // Weather block
  let weatherBlock = 'No weather data available for this destination.'
  if (weather && weather.maxTemps.length > 0) {
    const avgMax = (weather.maxTemps.reduce((a, b) => a + b, 0) / weather.maxTemps.length).toFixed(1)
    const avgMin = (weather.minTemps.reduce((a, b) => a + b, 0) / weather.minTemps.length).toFixed(1)
    const maxPrecip = Math.max(...weather.precipProbabilities)
    weatherBlock = `7-day forecast: average high ${avgMax}°C, average low ${avgMin}°C, max precipitation probability ${maxPrecip}%. Daily highs: ${weather.maxTemps.map(t => t.toFixed(0)).join(', ')}°C.`
  }

  // Country block
  let countryBlock = `Destination: ${input.destination} (country data unavailable).`
  if (countryInfo) {
    countryBlock = `Country: ${countryInfo.countryName} ${countryInfo.flagEmoji}
Capital: ${countryInfo.capital}
Currency: ${countryInfo.currency}
Official languages: ${countryInfo.languages.join(', ')}
Timezone: ${countryInfo.timezone}`
  }

  const lifeStageDesc: Record<string, string> = {
    student: 'a student (tight budget, prioritises experiences and value, has flexible time)',
    professional: 'a working professional (moderate-to-higher budget, values efficiency and comfort)',
    unemployed: 'currently unemployed (very budget-conscious, has flexible time, needs lowest-cost options)',
  }
  const budgetDesc: Record<string, string> = {
    budget: 'budget traveller — hostels, street food, free attractions, public transit only',
    moderate: 'moderate budget — mid-range hotels, local restaurants, a mix of paid and free activities',
    comfort: 'comfort traveller — quality hotels, curated dining, private transfers acceptable',
  }
  const accDesc: Record<string, string> = {
    cheap: 'cheapest possible accommodation (hostels, capsule hotels, guesthouses)',
    affordable: 'affordable mid-range accommodation (3-star hotels, well-reviewed B&Bs)',
    comfort: 'comfortable accommodation (4-star hotels, boutique stays, serviced apartments)',
  }

  const startDateLine = input.startDate
    ? `Trip start date: ${input.startDate}`
    : 'Trip start date: not specified — plan for general/typical conditions'

  const currencyName = countryInfo?.currency ?? 'local currency'

  return `You are an expert travel planner with deep local knowledge. Return ONLY valid JSON — no markdown, no prose, no code fences, no commentary before or after the JSON.

TRIP CONTEXT:
- Traveller profile: ${lifeStageDesc[input.lifeStage] ?? input.lifeStage}
- Budget tier: ${budgetDesc[input.budgetPreference] ?? input.budgetPreference}
- Accommodation preference: ${accDesc[input.accommodationPreference] ?? input.accommodationPreference}
- Origin: ${input.origin || 'not specified'}
- Destination: ${input.destination}
- Trip purpose: ${input.purpose}
- Duration: ${input.durationDays} day${input.durationDays !== 1 ? 's' : ''}
- ${startDateLine}${input.benefits ? `\n- Special circumstances: ${input.benefits}` : ''}

DESTINATION DATA:
${countryBlock}

WEATHER DATA:
${weatherBlock}

INSTRUCTIONS — each field must be specific, not generic:

packingList: 10–15 items. Include weather-appropriate clothing based on the forecast temperatures above. Include purpose-specific items (laptop for work trips, study materials for study trips). Tailor to the budget tier (budget travellers need lightweight/multi-use gear).

placesToVisit: 5–7 specific, real named locations in ${input.destination} (neighbourhoods, landmarks, parks, markets, districts). Each description should explain WHY it suits this specific traveller's purpose (${input.purpose}) and budget tier.

thingsToDo: 4–6 concrete, actionable tips. At least one must address the weather conditions above. At least one must include a specific cost saving tip for the ${input.budgetPreference} budget tier. Tips must be specific to ${input.destination} (e.g. name a specific transit card, a specific market, a specific free attraction).

gettingAround: Specific transport options in ${input.destination} with realistic costs in ${currencyName}. Name relevant apps or transit passes.

contingencies: Practical emergency information for ${input.destination}: local emergency number, recommended travel insurance level for ${input.budgetPreference} budget, safety notes, common tourist scams if any.

accommodationRecommendation: 1–2 specific districts or neighbourhoods in ${input.destination} best for this traveller's accommodation preference, with reasons (transport links, safety, atmosphere).

summary: 2–3 punchy sentences summarising this trip.

weatherSummary: 1–2 sentences on what the forecast means practically — what to wear, what activities to plan around the weather.

currencyInfo: The currency, typical payment culture (cash vs card in ${input.destination}), ATM availability, and 1–2 money tips specific to the ${input.budgetPreference} budget tier.

visaInfo: Brief entry requirements note. If origin is known (${input.origin || 'unknown'}), tailor to that passport. Always note that official verification is recommended.

budgetBreakdown: Realistic daily cost estimate in ${currencyName} AND approximate USD equivalent, broken into: accommodation, food, transport, activities — for the ${input.budgetPreference} budget tier in ${input.destination}.

Return this EXACT JSON shape (all 11 fields required):

{
  "packingList": ["string"],
  "accommodationRecommendation": "string",
  "placesToVisit": [{ "name": "string", "description": "string" }],
  "thingsToDo": ["string"],
  "gettingAround": "string",
  "contingencies": "string",
  "summary": "string",
  "weatherSummary": "string",
  "currencyInfo": "string",
  "visaInfo": "string",
  "budgetBreakdown": "string"
}`
}

// ── Claude API call ─────────────────────────────────────────────────────────

async function callClaude(prompt: string): Promise<TravelPlan> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured in edge function secrets')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(no body)')
    throw new Error(`Claude API error (${res.status}): ${errBody.slice(0, 300)}`)
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>
  }

  const rawText = data.content.find((c) => c.type === 'text')?.text ?? ''
  // Strip markdown code fences defensively
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim()

  try {
    return JSON.parse(cleaned) as TravelPlan
  } catch {
    throw new Error(`Claude returned invalid JSON. Preview: ${rawText.slice(0, 300)}`)
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return CORS_PREFLIGHT()
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

    // Require sign-in — prevents anonymous callers from consuming the API key
    await requireUserId(req)

    const input = await req.json() as TravelPlanInput

    if (!input.destination?.trim()) {
      return json({ error: 'destination is required' }, { status: 400 })
    }
    if (!input.durationDays || input.durationDays < 1) {
      return json({ error: 'durationDays must be at least 1' }, { status: 400 })
    }

    // City name for geocoding: "Tokyo, Japan" → "Tokyo"
    const cityQuery = input.destination.includes(',')
      ? input.destination.split(',')[0]!.trim()
      : input.destination.trim()

    // Fetch country info and city coordinates in parallel
    const [countryInfo, coords] = await Promise.all([
      fetchCountryInfo(input.destination),
      fetchCoordinates(cityQuery),
    ])

    // Weather requires coordinates — sequential after the parallel fetch
    const weather = coords ? await fetchWeatherForecast(coords.lat, coords.lon) : null

    console.log(
      '[travel-plan-generate]',
      'destination:', input.destination,
      '| country:', countryInfo?.countryName ?? 'not found',
      '| coords:', coords ? `${coords.lat},${coords.lon}` : 'not found',
      '| weather:', weather ? 'fetched' : 'unavailable',
    )

    const prompt = buildClaudePrompt(input, countryInfo, weather)
    const plan = await callClaude(prompt)

    return json(plan)
  } catch (e) {
    console.error('[travel-plan-generate] error:', (e as Error).message)
    return json({ error: (e as Error).message ?? 'Unknown error' }, { status: 400 })
  }
})
