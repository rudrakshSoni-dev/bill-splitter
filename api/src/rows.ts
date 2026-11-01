import { fail } from './input'

export type HomeRow = { id: string; name: string }
export type MemberRow = { id: string; home_id: string; name: string }
export type BillRow = { id: string; home_id: string; title: string; total_cents: number }
export type ShareRow = {
  id: string
  bill_id: string
  member_id: string
  amount_cents: number
  paid_at: string | null
  pay_key: string | null
}

export const member = (m: MemberRow) => ({ id: m.id, homeId: m.home_id, name: m.name })

export const share = (s: Pick<ShareRow, 'id' | 'member_id' | 'amount_cents' | 'paid_at'>) => ({
  id: s.id,
  memberId: s.member_id,
  amountCents: s.amount_cents,
  paidAt: s.paid_at,
})

export const bill = (b: BillRow, shares: ShareRow[]) => ({
  id: b.id,
  homeId: b.home_id,
  title: b.title,
  totalCents: b.total_cents,
  shares: shares.map(share),
})

export async function homeOr404(db: D1Database, homeId: string): Promise<HomeRow> {
  const home = await db
    .prepare('SELECT id, name FROM homes WHERE id = ?')
    .bind(homeId)
    .first<HomeRow>()
  if (!home) fail(404, 'home not found')
  return home
}
