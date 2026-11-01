import { createFileRoute } from '@tanstack/react-router'
import { HomeBills } from '../components/home-bills'
import { StartHome } from '../components/start-home'

type Search = { home?: string }

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search.home === 'string' && search.home ? { home: search.home } : {},
  component: Page,
})

function Page() {
  const { home } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <main>
      <div className="topbar">
        <h1>Bill Splitter</h1>
        <span>split shared bills, cent by cent</span>
      </div>
      {home ? (
        <HomeBills key={home} homeId={home} onLeave={() => navigate({ search: {} })} />
      ) : (
        <StartHome onOpen={(id) => navigate({ search: { home: id } })} />
      )}
    </main>
  )
}
