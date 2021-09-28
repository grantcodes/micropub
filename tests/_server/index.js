const express = require('express');
const multer = require('multer');
const data = require('./data');

const { micropubConfig, endpoints, mf2, token, fileUrl } = data;

const storage = multer.memoryStorage();
const upload = multer({ storage });

function createServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('*', express.static('static'));

  app.post('/token', (req, res) => {
    return res.json({
      me: 'http://localhost:3313',
      scope: 'create update delete',
      access_token: token,
    });
  });

  app.get('/micropub', (req, res) => {
    // Plain get request - so check token
    if (Object.keys(req.query).length === 0) {
      if (req.headers.authorization === `Bearer ${token}`) {
        return res.sendStatus(200);
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Config query.
    if (req?.query?.q === 'config') {
      return res.json(micropubConfig);
    }

    // Specific source query
    if (req?.query?.q === 'source' && req?.query?.url) {
      if (req.query.url !== mf2.note.properties.url[0]) {
        return res.status(404).json({ error: 'Not found' });
      }
      if (req.query.properties) {
        const values = {};
        for (const key of req.query.properties) {
          values[key] = mf2.note.properties[key];
        }
        return res.json(values);
      } else {
        return res.json(mf2.note);
      }
    }

    // Source list query
    if (req?.query?.q === 'source') {
      // Support note post type query
      if (req.query['post-type'] === 'note') {
        return res.json({ items: [mf2.note] });
      }

      // Don't support other source queries
      if (Object.keys(req.query).length > 1) {
        console.warn('Unhandled source query', req.query);
        return res.status(501).json({
          error: 'Unsupported source query',
        });
      }

      // Plain source query return list of items
      return res.json({ items: mf2.list });
    }

    // Other type of query
    if (req?.query?.q && micropubConfig[req.query.q]) {
      return res.json(micropubConfig[req.query.q]);
    }

    console.warn('Unhandled query', req.query);

    res.status(500).json({ error: 'Probably an invalid micropub request' });
  });

  app.post('/micropub', (req, res) => {
    // Action handler
    if (req.body.action) {
      const { action, url } = req.body;

      if (action === 'delete' && url) {
        return res.sendStatus(200);
      }

      if (action === 'undelete' && url) {
        return res
          .status(201)
          .header('Location', mf2.note.properties.url[0])
          .json(mf2.note);
      }

      if (action === 'update') {
        if (
          url === mf2.note.properties.url[0] &&
          (req.body.replace || req.body.add || req.body.delete)
        ) {
          return res
            .status(200)
            .header('Location', mf2.note.properties.url[0])
            .json(mf2.note);
        } else {
          return res.status(500).json({
            error: 'Micropub update appears to be invalid',
          });
        }
      }

      console.log('Unhandled action', req.body);

      return res.status(501).json({
        error: 'Micropub action ' + req.body.action + ' not supported',
      });
    }

    // Create json
    if (req.headers['content-type'] === 'application/json') {
      if (JSON.stringify(mf2.note) !== JSON.stringify(req.body)) {
        return res
          .status(400)
          .json({ error: 'Test server only accepts the note as a new post' });
      }

      return res
        .status(200)
        .header('Location', mf2.note.properties.url[0])
        .json(mf2.note);
    }

    // Create form encoded
    if (
      req.headers['content-type'].startsWith(
        'application/x-www-form-urlencoded',
      )
    ) {
      if (
        req.body.h !== 'entry' ||
        req.body.content !== mf2.note.properties.content[0]
      ) {
        return res
          .status(400)
          .json({ error: 'Test server only accepts the note as a new post' });
      }

      return res
        .status(201)
        .header('Location', mf2.note.properties.url[0])
        .json(mf2.note);
    }

    console.log('Error creating post', {
      body: req.body,
      headers: req.headers,
    });

    return res.status(500).json({ error: 'Error creating post' });
  });

  app.post('/media', upload.single('file'), (req, res) => {
    // Make sure file is valid.
    if (!req.file || req.file.truncated || !req.file.buffer) {
      return res.status(500).json({ error: 'Invalid media file' });
    }

    return res.status(201).header('Location', fileUrl).json({ url: fileUrl });
  });

  app.get('/', (req, res) => {
    res.sendFile('./static/index.html', { root: __dirname });
  });

  app.listen(3313);

  return app;
}

module.exports = createServer;
