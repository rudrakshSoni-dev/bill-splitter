import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import bills from './bills'
import homes from './homes'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))
app.route('/api/homes', homes)
app.route('/api', bills)

app.notFound((c) => c.json({ error: 'not found' }, 404))

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'something went wrong' }, 500)
})

export default app
