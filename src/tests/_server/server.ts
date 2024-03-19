import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import multer from 'multer'
import { data } from './data/data.js'

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(fileURLToPath(import.meta.url))

const { micropubConfig, mf2, token, fileUrl } = data

function createServer (): express.Application {
  const storage = multer.memoryStorage()
  const upload = multer({ storage })

  const app = express()

  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  // app.get('/js/main.global.js', (req, res) => res.sendFile('main.global.js', { root: __dirname + '/' }))
  app.use('/', express.static(__dirname + '/static'))

  app.post('/token', (req, res) => {
    return res.json({
      me: 'http://localhost:3313',
      scope: 'create update delete',
      access_token: token
    })
  })

  app.get('/micropub', (req, res) => {
    // Plain get request - so check token
    if (Object.keys(req.query).length === 0) {
      if (req.headers.authorization === `Bearer ${token}`) {
        return res.sendStatus(200)
      }
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Config query.
    if (req?.query?.q === 'config') {
      return res.json(micropubConfig)
    }

    // Specific source query
    if (req?.query?.q === 'source' && req?.query?.url !== undefined) {
      if (req.query.url !== mf2.note.properties.url[0]) {
        return res.status(404).json({ error: 'Not found' })
      }
      if (req.query.properties !== undefined && typeof req.query.properties === 'object') {
        const values: any = {}
        // @ts-expect-error
        for (const key of req.query.properties) {
          // @ts-expect-error
          values[key] = mf2.note.properties[key]
        }
        return res.json(values)
      } else {
        return res.json(mf2.note)
      }
    }

    // Source list query
    if (req?.query?.q === 'source') {
      // Support note post type query
      if (req.query['post-type'] === 'note') {
        return res.json({ items: [mf2.note] })
      }

      // Don't support other source queries
      if (Object.keys(req.query).length > 1) {
        console.warn('Unhandled source query', req.query)
        return res.status(501).json({
          error: 'Unsupported source query'
        })
      }

      // Plain source query return list of items
      return res.json({ items: mf2.list })
    }

    // Other type of query
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (req?.query?.q && typeof req.query.q === 'string' && req.query.q in micropubConfig) {
      // @ts-expect-error
      return res.json(micropubConfig[req.query.q])
    }

    res.status(500).json({ error: 'Probably an invalid micropub request' })
  })

  app.post('/micropub', (req, res) => {
    // Action handler
    if (req.body.action !== undefined) {
      const { action, url } = req.body

      if (action === 'delete' && url !== undefined) {
        return res.sendStatus(204)
      }

      if (action === 'undelete' && url !== undefined) {
        return res
          .status(201)
          .header('Location', mf2.note.properties.url[0])
          .json(mf2.note)
      }

      if (action === 'update') {
        if (
          url === mf2.note.properties.url[0] &&
          (req.body.replace as boolean || req.body.add as boolean || req.body.delete as boolean)

        ) {
          return res
            .status(200)
            .header('Location', mf2.note.properties.url[0])
            .json(mf2.note)
        } else {
          return res.status(500).json({
            error: 'Micropub update appears to be invalid'
          })
        }
      }

      console.log('Unhandled action', req.body)

      const actionString: string = typeof req.body.action === 'string' ? req.body.action : 'unknown'

      return res.status(501).json({
        error: 'Micropub action ' + actionString + ' not supported'
      })
    }

    // Create json
    if (req.headers['content-type'] === 'application/json') {
      if (JSON.stringify(mf2.note) !== JSON.stringify(req.body)) {
        return res
          .status(400)
          .json({ error: 'Test server only accepts the note as a new post' })
      }

      return res
        .status(200)
        .header('Location', mf2.note.properties.url[0])
        .json(mf2.note)
    }

    // Create form encoded
    const contentType = req?.headers?.['content-type'] ?? ''
    if (
      contentType.startsWith(
        'application/x-www-form-urlencoded'
      )
    ) {
      if (
        req.body.h !== 'entry' ||
        req.body.content !== mf2.note.properties.content[0]
      ) {
        return res
          .status(400)
          .json({ error: 'Test server only accepts the note as a new post' })
      }

      return res
        .status(201)
        .header('Location', mf2.note.properties.url[0])
        .json(mf2.note)
    }

    console.log('Error creating post', {
      body: req.body,
      headers: req.headers
    })

    return res.status(500).json({ error: 'Error creating post' })
  })

  app.post('/media', upload.single('file'), (req, res) => {
    // Make sure file is valid.
    if (req?.file?.buffer === undefined || req?.file?.mimetype === undefined) {
      return res.status(500).json({ error: 'Invalid media file' })
    }

    return res.status(201).header('Location', fileUrl).json({ url: fileUrl })
  })

  app.get('/', (req, res) => {
    res.sendFile('index.html', {
      root: __dirname
    })
  })

  return app
}

export { createServer }
