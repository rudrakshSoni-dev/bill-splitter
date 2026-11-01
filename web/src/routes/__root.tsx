import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => <Outlet />,
  // last line of defence: a render bug shows this instead of a white screen
  errorComponent: ({ error, reset }) => (
    <main>
      <h1>Bill Splitter</h1>
      <div className="card stack">
        <p className="error">
          Something broke: {error instanceof Error ? error.message : String(error)}
        </p>
        <button type="button" onClick={reset}>
          Reload
        </button>
      </div>
    </main>
  ),
})
