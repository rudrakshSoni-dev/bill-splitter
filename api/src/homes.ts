import { Hono } from 'hono'
import { jsonBody, text } from './input'
import { type BillRow, bill, homeOr404, type MemberRow, member, type ShareRow } from './rows'

const homes = new Hono<{ Bindings: Env }>()

homes.post('/', async (c) => {
  const name = text(await jsonBody(c), 'name')
  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(id, name).run()
  return c.json({ id, name }, 201)
})

homes.get('/:homeId', async (c) => {
  const home = await homeOr404(c.env.DB, c.req.param('homeId'))
  const { results } = await c.env.DB.prepare(
    'SELECT id, home_id, name FROM members WHERE home_id = ? ORDER BY position',
  )
    .bind(home.id)
    .all<MemberRow>()
  return c.json({ ...home, members: results.map(member) })
})

homes.post('/:homeId/members', async (c) => {
  const home = await homeOr404(c.env.DB, c.req.param('homeId'))
  const name = text(await jsonBody(c), 'name')
  const id = crypto.randomUUID()

  // position is worked out inside the same statement, so two members added at the
  // same time can't both read the same MAX and grab the same slot
  await c.env.DB.prepare(
    `INSERT INTO members (id, home_id, name, position)
     SELECT ?1, ?2, ?3, COALESCE(MAX(position), 0) + 1 FROM members WHERE home_id = ?2`,
  )
    .bind(id, home.id, name)
    .run()

  return c.json({ id, homeId: home.id, name }, 201)
})

homes.get('/:homeId/bills', async (c) => {
  const home = await homeOr404(c.env.DB, c.req.param('homeId'))
  const [bills, shares] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT id, home_id, title, total_cents FROM bills
       WHERE home_id = ? ORDER BY created_at DESC, rowid DESC`,
    ).bind(home.id),
    c.env.DB.prepare(
      `SELECT s.id, s.bill_id, s.member_id, s.amount_cents, s.paid_at
       FROM shares s
       JOIN bills b ON b.id = s.bill_id
       JOIN members m ON m.id = s.member_id
       WHERE b.home_id = ?
       ORDER BY m.position`,
    ).bind(home.id),
  ])

  const byBill = new Map<string, ShareRow[]>()
  for (const s of (shares?.results ?? []) as ShareRow[]) {
    const list = byBill.get(s.bill_id) ?? []
    list.push(s)
    byBill.set(s.bill_id, list)
  }

  const rows = (bills?.results ?? []) as BillRow[]
  return c.json({ bills: rows.map((b) => bill(b, byBill.get(b.id) ?? [])) })
})

homes.get('/:homeId/balances', async (c) => {
  const home = await homeOr404(c.env.DB, c.req.param('homeId'))
  const { results } = await c.env.DB.prepare(
    `SELECT m.id AS memberId, m.name,
            COALESCE(SUM(CASE WHEN s.paid_at IS NULL THEN s.amount_cents END), 0) AS outstandingCents
     FROM members m
     LEFT JOIN shares s ON s.member_id = m.id
     WHERE m.home_id = ?
     GROUP BY m.id
     ORDER BY m.position`,
  )
    .bind(home.id)
    .all<{ memberId: string; name: string; outstandingCents: number }>()

  return c.json({ balances: results })
})

export default homes
