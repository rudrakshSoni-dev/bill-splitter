import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api, type Bill, type Home, money, type Share, toCents } from '../api'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; notFound: boolean }
  | { kind: 'ready'; home: Home; bills: Bill[] }

type Person = { name: string; index: number }

const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong')

const unpaid = (shares: Share[]) =>
  shares.filter((s) => !s.paidAt).reduce((sum, s) => sum + s.amountCents, 0)

export function HomeBills({ homeId, onLeave }: { homeId: string; onLeave: () => void }) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  const load = useCallback(
    (signal?: AbortSignal) => {
      setState({ kind: 'loading' })
      Promise.all([api.home(homeId, signal), api.bills(homeId, signal)])
        .then(([home, bills]) => setState({ kind: 'ready', home, bills }))
        .catch((err: unknown) => {
          if (signal?.aborted) return
          const notFound = err instanceof ApiError && err.status === 404
          setState({ kind: 'error', message: messageOf(err), notFound })
        })
    },
    [homeId],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  // silent refresh, used when the server tells us our copy is stale (409)
  const refreshBills = useCallback(() => {
    api
      .bills(homeId)
      .then((bills) => setState((s) => (s.kind === 'ready' ? { ...s, bills } : s)))
      .catch(() => {})
  }, [homeId])

  if (state.kind === 'loading') {
    return (
      <div className="stack" role="status" aria-busy="true" aria-label="Loading bills">
        <div className="skeleton" style={{ height: 56 }} />
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 180 }} />
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="card stack notice">
        <strong>{state.notFound ? 'Home not found' : 'Could not load this home'}</strong>
        <p className="muted">{state.notFound ? 'Check the id and try again.' : state.message}</p>
        <div className="row">
          {!state.notFound && (
            <button type="button" onClick={() => load()}>
              Try again
            </button>
          )}
          <button type="button" className="ghost" onClick={onLeave}>
            Back
          </button>
        </div>
      </div>
    )
  }

  const { home, bills } = state
  const people = new Map<string, Person>(
    home.members.map((m, index) => [m.id, { name: m.name, index }]),
  )

  const owed = new Map<string, number>()
  for (const b of bills) {
    for (const s of b.shares) {
      if (!s.paidAt) owed.set(s.memberId, (owed.get(s.memberId) ?? 0) + s.amountCents)
    }
  }
  const totalOwed = bills.reduce((sum, b) => sum + unpaid(b.shares), 0)
  const settled = bills.filter((b) => unpaid(b.shares) === 0).length

  const setBills = (fn: (bills: Bill[]) => Bill[]) =>
    setState((s) => (s.kind === 'ready' ? { ...s, bills: fn(s.bills) } : s))

  return (
    <div className="stack">
      <header className="row spread">
        <div>
          <h2>{home.name}</h2>
          <CopyId id={home.id} />
        </div>
        <button type="button" className="ghost" onClick={onLeave}>
          Switch home
        </button>
      </header>

      <div className="stats">
        <div>
          <span className="muted">Outstanding</span>
          <strong>{money(totalOwed)}</strong>
        </div>
        <div>
          <span className="muted">Bills</span>
          <strong>{bills.length}</strong>
        </div>
        <div>
          <span className="muted">Settled</span>
          <strong>
            {settled}/{bills.length}
          </strong>
        </div>
      </div>

      <div className="split">
        <Members
          home={home}
          owed={owed}
          onAdded={(m) =>
            setState((s) =>
              s.kind === 'ready'
                ? { ...s, home: { ...s.home, members: [...s.home.members, m] } }
                : s,
            )
          }
        />
        <NewBill
          homeId={home.id}
          disabled={home.members.length === 0}
          onCreated={(b) => setBills((list) => [b, ...list])}
        />
      </div>

      <h3 className="section-title">Bills</h3>
      {bills.length === 0 ? (
        <div className="card empty">
          <strong>No bills yet</strong>
          <span className="muted">
            {home.members.length === 0
              ? 'Add a member, then add the first bill.'
              : 'Add a bill above and it gets split between everyone.'}
          </span>
        </div>
      ) : (
        bills.map((b) => (
          <BillCard
            key={b.id}
            bill={b}
            people={people}
            onPaid={(paid) =>
              setBills((list) =>
                list.map((x) =>
                  x.id !== b.id
                    ? x
                    : { ...x, shares: x.shares.map((s) => (s.id === paid.id ? paid : s)) },
                ),
              )
            }
            onStale={refreshBills}
          />
        ))
      )}
    </div>
  )
}

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="link"
      title="Copy the id to open this home later"
      onClick={() => {
        navigator.clipboard
          ?.writeText(id)
          .then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
          .catch(() => {})
      }}
    >
      <code>{id.slice(0, 8)}…</code> {copied ? 'copied' : 'copy id'}
    </button>
  )
}

const tints = ['#2f6f4f', '#9a5b22', '#3b5b92', '#8c3b5e', '#5b6b2f', '#6a4c93']

function Avatar({ person }: { person: Person | undefined }) {
  const bg = person ? tints[person.index % tints.length] : '#999'
  return (
    <span className="avatar" style={{ background: bg }} aria-hidden="true">
      {person?.name.slice(0, 1).toUpperCase() ?? '?'}
    </span>
  )
}

function Members(props: {
  home: Home
  owed: Map<string, number>
  onAdded: (m: Home['members'][number]) => void
}) {
  const { home } = props
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      props.onAdded(await api.addMember(home.id, name))
      setName('')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stack">
      <h3>Members</h3>
      {home.members.length === 0 ? (
        <p className="muted">No members yet. A bill needs at least one person.</p>
      ) : (
        <ul className="people">
          {home.members.map((m, index) => {
            const owes = props.owed.get(m.id) ?? 0
            return (
              <li key={m.id}>
                <Avatar person={{ name: m.name, index }} />
                <span>{m.name}</span>
                <span className={owes ? 'owes' : 'muted'}>{owes ? money(owes) : 'all paid'}</span>
              </li>
            )
          })}
        </ul>
      )}
      <form className="row" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a member" />
        <button type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  )
}

function NewBill(props: { homeId: string; disabled: boolean; onCreated: (b: Bill) => void }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const cents = toCents(amount)
    if (cents === null) {
      setError('Enter an amount like 12 or 12.50')
      return
    }
    setBusy(true)
    setError(null)
    try {
      props.onCreated(await api.createBill(props.homeId, title, cents))
      setTitle('')
      setAmount('')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h3>Add a bill</h3>
      <label>
        What for
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Electricity" />
      </label>
      <label>
        Amount
        <span className="money-input">
          <span>$</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
          />
        </span>
      </label>
      <button type="submit" disabled={busy || props.disabled || !title.trim() || !amount}>
        {busy ? 'Adding…' : 'Split it'}
      </button>
      {props.disabled && <small className="muted">Add a member first.</small>}
      {error && <p className="error">{error}</p>}
    </form>
  )
}

function BillCard(props: {
  bill: Bill
  people: Map<string, Person>
  onPaid: (s: Share) => void
  onStale: () => void
}) {
  const { bill, people } = props
  const [paying, setPaying] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  // one key per share, kept until the server gives a definite answer. if a request times
  // out and the user retries, the same key goes again so the server can't charge twice
  const keys = useRef(new Map<string, string>())

  async function pay(shareId: string) {
    let key = keys.current.get(shareId)
    if (!key) {
      key = crypto.randomUUID()
      keys.current.set(shareId, key)
    }
    setPaying((p) => ({ ...p, [shareId]: true }))
    setErrors(({ [shareId]: _, ...rest }) => rest)

    try {
      const paid = await api.pay(bill.id, shareId, key)
      keys.current.delete(shareId)
      props.onPaid(paid)
    } catch (err) {
      let msg = messageOf(err)
      if (err instanceof ApiError && err.status === 409) {
        msg = 'Someone else already paid this share.'
        keys.current.delete(shareId)
        props.onStale()
      } else if (err instanceof ApiError && err.status === 404) {
        keys.current.delete(shareId)
      }
      setErrors((e) => ({ ...e, [shareId]: msg }))
    } finally {
      setPaying((p) => ({ ...p, [shareId]: false }))
    }
  }

  const left = unpaid(bill.shares)
  const paidCount = bill.shares.filter((s) => s.paidAt).length
  const pct = bill.totalCents ? Math.round(((bill.totalCents - left) / bill.totalCents) * 100) : 0

  return (
    <section className={`card bill${left === 0 ? ' done' : ''}`}>
      <div className="row spread">
        <div>
          <h3>{bill.title}</h3>
          <small className="muted">
            {paidCount} of {bill.shares.length} paid
          </small>
        </div>
        <strong className="total">{money(bill.totalCents)}</strong>
      </div>
      <div
        className="bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <ul className="shares">
        {bill.shares.map((s) => {
          const person = people.get(s.memberId)
          return (
            <li key={s.id}>
              <div className="row spread">
                <span className="row">
                  <Avatar person={person} />
                  {person?.name ?? 'Unknown member'}
                </span>
                <span className="row">
                  <span className="amount">{money(s.amountCents)}</span>
                  {s.paidAt ? (
                    <span className="pill" title={new Date(s.paidAt).toLocaleString()}>
                      ✓ Paid
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="small"
                      onClick={() => pay(s.id)}
                      disabled={paying[s.id]}
                    >
                      {paying[s.id] ? 'Paying…' : errors[s.id] ? 'Retry' : 'Pay'}
                    </button>
                  )}
                </span>
              </div>
              {errors[s.id] && <p className="error">{errors[s.id]}</p>}
            </li>
          )
        })}
      </ul>
      <small className={left === 0 ? 'settled' : 'muted'}>
        {left === 0 ? 'Settled' : `${money(left)} still owed`}
      </small>
    </section>
  )
}
