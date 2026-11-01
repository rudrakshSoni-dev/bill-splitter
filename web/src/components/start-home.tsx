import { type FormEvent, useState } from 'react'
import { api } from '../api'

export function StartHome({ onOpen }: { onOpen: (homeId: string) => void }) {
  const [name, setName] = useState('')
  const [people, setPeople] = useState('')
  const [existing, setExisting] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const home = await api.createHome(name)
      const names = people
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
      // one at a time on purpose, the order here is the order the split uses
      for (const n of names) await api.addMember(home.id, n)
      onOpen(home.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the home')
      setBusy(false)
    }
  }

  return (
    <div className="card stack start">
      <form className="stack" onSubmit={create}>
        <div>
          <h2>Start a home</h2>
          <p className="muted">
            Add the people who share the bills. Leftover cents go to whoever is first.
          </p>
        </div>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Flat 4B" />
        </label>
        <label>
          <span>
            Members <small>· comma separated, in order</small>
          </span>
          <input
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            placeholder="Asha, Ben, Chitra"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Create home'}
        </button>
      </form>

      <div className="divider">or open an existing one</div>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (existing.trim()) onOpen(existing.trim())
        }}
      >
        <input
          value={existing}
          onChange={(e) => setExisting(e.target.value)}
          placeholder="Paste a home id"
        />
        <button type="submit" className="ghost" disabled={!existing.trim()}>
          Open
        </button>
      </form>
    </div>
  )
}
