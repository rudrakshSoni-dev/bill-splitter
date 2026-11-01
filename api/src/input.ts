import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

type Json = Record<string, unknown>

export function fail(status: 400 | 404 | 409 | 422, message: string): never {
  throw new HTTPException(status, { message })
}

export async function jsonBody(c: Context): Promise<Json> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    fail(400, 'request body must be JSON')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    fail(400, 'request body must be a JSON object')
  }
  return body as Json
}

export function text(body: Json, field: string, maxLen = 120): string {
  const value = body[field]
  if (typeof value !== 'string' || value.trim() === '') {
    fail(422, `${field} is required`)
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLen) fail(422, `${field} is too long (max ${maxLen})`)
  return trimmed
}

// rejects "1000", 10.5, null, NaN, Infinity and anything past 2^53
export function positiveCents(body: Json, field: string): number {
  const value = body[field]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    fail(422, `${field} must be a positive whole number of cents`)
  }
  return value
}
