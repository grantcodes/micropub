const express = require('express');
const data = require('./data');

const { micropubConfig, endpoints, mf2, token } = data;

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
    // Config query.
    if (req?.query?.q === 'config') {
      return res.json(micropubConfig);
    }

    // Specific source query
    if (
      req?.query?.q === 'source' &&
      req?.query?.url === mf2.note.properties.url[0]
    ) {
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
        return res.status(201).header('Location', mf2.note.properties.url[0]);
      }

      console.log('Action', req.body);

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

      return res.status(200).header('Location', mf2.note.properties.url[0]);
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

      return res.status(201).header('Location', mf2.note.properties.url[0]);
    }

    console.log(req.body, req.headers);

    return res.status(500).json({ error: 'Error creating post' });
  });

  app.get('/', (req, res) => {
    res.sendFile('./static/index.html', { root: __dirname });
  });

  app.listen(3313);

  return app;
}

module.exports = createServer;
