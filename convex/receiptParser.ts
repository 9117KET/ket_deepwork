/**
 * convex/receiptParser.ts
 *
 * Convex Action: parses a receipt image using Claude claude-haiku-4-5 vision.
 * Requires ANTHROPIC_API_KEY set in Convex dashboard environment variables.
 *
 * To set: Convex Dashboard → Project Settings → Environment Variables → Add ANTHROPIC_API_KEY
 */

import { action } from "./_generated/server"
import { v } from "convex/values"

// process.env is available in Convex Node.js actions; declare for browser tsconfig compatibility
declare const process: { env: Record<string, string | undefined> }

interface ParsedReceipt {
  merchant: string | null
  date: string | null
  total: number | null
  currency: string
  category: string
  suggestedBucket: 'fixed' | 'investment' | 'savings' | 'guiltFree'
  items: Array<{ description: string; amount: number }>
  notes: string | null
}

export const parseReceipt = action({
  args: {
    imageBase64: v.string(),
    mediaType: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<ParsedReceipt> => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not configured. Add it in Convex Dashboard → Project Settings → Environment Variables.",
      )
    }

    const mediaType = (args.mediaType ?? "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp"

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: args.imageBase64,
                },
              },
              {
                type: "text",
                text: `Extract the key information from this receipt image. Return ONLY valid JSON with this exact structure, no other text:
{
  "merchant": "store or restaurant name, or null if unclear",
  "date": "YYYY-MM-DD or null if unclear",
  "total": 12.50,
  "currency": "EUR",
  "category": "one of: groceries, dining, transport, utilities, shopping, health, entertainment, subscription, other",
  "suggestedBucket": "one of: fixed, investment, savings, guiltFree",
  "items": [{ "description": "item name", "amount": 1.99 }],
  "notes": "any helpful context, or null"
}

Bucket mapping rules:
- groceries, utilities, transport (monthly pass/commute), health (insurance) → fixed
- dining, entertainment, clothing, shopping, hobbies → guiltFree
- savings goals, down payment → savings
- items is an empty array [] if the receipt is not itemized`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`Anthropic API error (${response.status}): ${body.slice(0, 200)}`)
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>
    }
    const rawText = data.content.find((c) => c.type === "text")?.text ?? ""
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/, "")
      .trim()

    try {
      return JSON.parse(cleaned) as ParsedReceipt
    } catch {
      throw new Error(`Could not parse Claude response as JSON. Preview: ${rawText.slice(0, 200)}`)
    }
  },
})
