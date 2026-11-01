import { describe, expect, it } from 'vitest'
import { splitCents } from '../src/split'
import { type Balance, type Bill, call, createBill, createHome, type Share } from './helpers'

function pay(billId: string, shareId: string, key: string) {
  return call<Share>('POST', `/api/bills/${billId}/shares/${shareId}/pay`, {
    headers: { 'Idempotency-Key': key },
  })
}

describe('splitCents', () => {
  it('handles a total smaller than the number of people', () => {
    expect(splitCents(2, 3)).toEqual([1, 1, 0])
  })

  it('never loses or adds a cent', () => {
    for (const [total, n] of [
      [1, 1],
      [7, 2],
      [999_999, 13],
      [Number.MAX_SAFE_INTEGER, 7],
    ] as const) {
      const parts = splitCents(total, n)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
      expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1)
    }
  })
})

describe('bad input', () => {
  it('answers JSON errors for broken bodies', async () => {
    const res = await exportsFetch('/api/homes', '{not json')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: expect.any(String) })
  })

  it('rejects a blank home or member name', async () => {
    expect((await call('POST', '/api/homes', { body: { name: '   ' } })).status).toBe(422)
    const { homeId } = await createHome([])
    expect((await call('POST', `/api/homes/${homeId}/members`, { body: {} })).status).toBe(422)
  })

  it.each([Number.NaN, 1e300, true, [100], { cents: 1 }])('rejects totalCents %j', async (bad) => {
    const { homeId } = await createHome(['Asha'])
    const res = await call('POST', `/api/homes/${homeId}/bills`, {
      body: { title: 'Gas', totalCents: bad },
    })
    expect(res.status).toBe(422)
  })

  it('does not create a bill when validation fails', async () => {
    const { homeId } = await createHome(['Asha'])
    await createBill(homeId, -5)
    const list = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(list.body.bills).toEqual([])
  })

  it('gives JSON for unknown routes', async () => {
    const res = await call('GET', '/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: expect.any(String) })
  })
})

describe('paying', () => {
  it('only lets one of two racing payments win', async () => {
    const { homeId } = await createHome(['Asha', 'Ben'])
    const bill = await createBill(homeId, 1000)
    const target = bill.body.shares[0] as Share

    const results = await Promise.all([
      pay(bill.body.id, target.id, 'key-a'),
      pay(bill.body.id, target.id, 'key-b'),
      pay(bill.body.id, target.id, 'key-c'),
    ])

    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409])
    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(balances.body.balances.map((b) => b.outstandingCents)).toEqual([0, 500])
  })

  it('gives the same answer to the same key sent at the same time', async () => {
    const { homeId } = await createHome(['Asha'])
    const bill = await createBill(homeId, 300)
    const target = bill.body.shares[0] as Share

    const [a, b] = await Promise.all([
      pay(bill.body.id, target.id, 'same'),
      pay(bill.body.id, target.id, 'same'),
    ])

    expect([a.status, b.status]).toEqual([200, 200])
    expect(a.body).toEqual(b.body)
  })

  it('does not let a share be paid through a different bill', async () => {
    const { homeId } = await createHome(['Asha'])
    const first = await createBill(homeId, 100)
    const second = await createBill(homeId, 200)
    const share = first.body.shares[0] as Share

    const res = await pay(second.body.id, share.id, 'k')

    expect(res.status).toBe(404)
  })
})

describe('listing bills', () => {
  it('returns the bills of a home with their shares, newest first', async () => {
    const { homeId } = await createHome(['Asha', 'Ben'])
    const older = await createBill(homeId, 100)
    const newer = await createBill(homeId, 301)

    const list = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)

    expect(list.status).toBe(200)
    expect(list.body.bills.map((b) => b.id)).toEqual([newer.body.id, older.body.id])
    expect(list.body.bills[0]?.shares.map((s) => s.amountCents)).toEqual([151, 150])
  })
})

async function exportsFetch(path: string, raw: string) {
  const { exports } = await import('cloudflare:workers')
  const res = await exports.default.fetch(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw,
    }),
  )
  return { status: res.status, body: (await res.json()) as unknown }
}
