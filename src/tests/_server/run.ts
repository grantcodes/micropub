import { createServer } from './server.js'

const port = process.env.PORT ?? 3313

const app = createServer()

app.listen(process.env.PORT ?? 3313, () => {
  console.log(
    `Running Micropub test server in standalone mode on http://localhost:${port}`
  )
})
