import { Hono } from 'hono'
import { fail, jsonBody, positiveCents, text } from './input'
import { bill, homeOr404, type ShareRow, share } from './rows'
import { splitCents } from './split'

const bills = new Hono<{ Bindings: Env }>()

bills.post('/homes/:homeId/bills', async (c) => {
  const db = c.env.DB
  const home = await homeOr404(db, c.req.param('homeId'))
  const body = await jsonBody(c)
  const title = text(body, 'title', 200)
  const totalCents = positiveCents(body, 'totalCents')

  const { results: members } = await db
    .prepare('SELECT id FROM members WHERE home_id = ? ORDER BY position')
    .bind(home.id)
    .all<{ id: string }>()
  if (members.length === 0) fail(422, 'home has no members to split the bill between')

  const amounts = splitCents(totalCents, members.length)
  const billRow = { id: crypto.randomUUID(), home_id: home.id, title, total_cents: totalCents }
  const shares: ShareRow[] = members.map((m, i) => ({
    id: crypto.randomUUID(),
    bill_id: billRow.id,
    member_id: m.id,
    amount_cents: amounts[i] ?? 0,
    paid_at: null,
    pay_key: null,
  }))

  // batch = one transaction. either the bill and all its shares exist or none of it does
  await db.batch([
    db
      .prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
      .bind(billRow.id, home.id, title, totalCents),
    ...shares.map((s) =>
      db
        .prepare('INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)')
        .bind(s.id, s.bill_id, s.member_id, s.amount_cents),
    ),
  ])

  return c.json(bill(billRow, shares), 201)
})

bills.post('/bills/:billId/shares/:shareId/pay', async (c) => {
  const db = c.env.DB
  const { billId, shareId } = c.req.param()
  const key = c.req.header('Idempotency-Key')?.trim()
  if (!key) fail(400, 'Idempotency-Key header is required')
  if (key.length > 200) fail(400, 'Idempotency-Key is too long')

  // the "paid_at IS NULL" check and the write happen in one statement. D1 runs writes
  // one at a time, so if two requests race only one of them gets a row back
  const paid = await db
    .prepare(
      `UPDATE shares SET paid_at = ?, pay_key = ?
       WHERE id = ? AND bill_id = ? AND paid_at IS NULL
       RETURNING id, member_id, amount_cents, paid_at`,
    )
    .bind(new Date().toISOString(), key, shareId, billId)
    .first<ShareRow>()
  if (paid) return c.json(share(paid))

  // nothing updated: share is missing, or someone already paid it
  const existing = await db
    .prepare(
      'SELECT id, member_id, amount_cents, paid_at, pay_key FROM shares WHERE id = ? AND bill_id = ?',
    )
    .bind(shareId, billId)
    .first<ShareRow>()

  if (!existing) {
    const billExists = await db.prepare('SELECT 1 FROM bills WHERE id = ?').bind(billId).first()
    fail(404, billExists ? 'share not found' : 'bill not found')
  }
  if (existing.pay_key === key) return c.json(share(existing))
  fail(409, 'share is already paid')
})

export default bills
