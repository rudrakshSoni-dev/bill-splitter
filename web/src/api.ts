export type Member = { id: string; homeId: string; name: string }
export type Home = { id: string; name: string; members: Member[] }
export type Share = { id: string; memberId: string; amountCents: number; paidAt: string | null }
export type Bill = {
  id: string
  homeId: string
  title: string
  totalCents: number
  shares: Share[]
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

const TIMEOUT_MS = 10_000

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout

  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      signal,
      headers: { 'content-type': 'application/json', ...init.headers },
    })
  } catch (err) {
    if (timeout.aborted) throw new ApiError('The server is taking too long. Try again.', 0)
    if (init.signal?.aborted) throw err
    throw new ApiError('Could not reach the server. Check your connection.', 0)
  }

  // a 500 from a proxy or a crashed worker might be html or empty, so don't trust the body
  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${res.status})`
    throw new ApiError(msg, res.status)
  }
  return data as T
}

const post = (body: unknown, headers?: Record<string, string>): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers,
})

export const api = {
  home: (id: string, signal?: AbortSignal) => request<Home>(`/api/homes/${id}`, { signal }),
  bills: (homeId: string, signal?: AbortSignal) =>
    request<{ bills: Bill[] }>(`/api/homes/${homeId}/bills`, { signal }).then((r) => r.bills),

  createHome: (name: string) => request<{ id: string; name: string }>('/api/homes', post({ name })),
  addMember: (homeId: string, name: string) =>
    request<Member>(`/api/homes/${homeId}/members`, post({ name })),
  createBill: (homeId: string, title: string, totalCents: number) =>
    request<Bill>(`/api/homes/${homeId}/bills`, post({ title, totalCents })),

  pay: (billId: string, shareId: string, key: string) =>
    request<Share>(
      `/api/bills/${billId}/shares/${shareId}/pay`,
      post({}, { 'Idempotency-Key': key }),
    ),
}

export const money = (cents: number) =>
  (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })

// "12.5" -> 1250. returns null for anything that isn't a positive amount with <= 2 decimals
export function toCents(input: string): number | null {
  const m = input.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!m) return null
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}
