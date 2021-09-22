const express = require('express');

const micropubConfig = {
  'media-endpoint': 'http://localhost:3313/media',
  'syndicate-to': [
    {
      uid: 'https://silo.example',
      name: 'Syndication Target',
    },
  ],
};

const exampleNote = {
  type: ['h-entry'],
  properties: {
    content: ['This is a post'],
  },
};

function createServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('*', express.static('static'));

  app.post('/token', (req, res) => {
    return res.json({
      me: 'http://localhost:3313',
      scope: 'create update delete',
      access_token: 'token',
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
      req?.query?.url === 'http://localhost:3313/note'
    ) {
      return res.json(exampleNote);
    }

    // Other type of query
    if (req?.query?.q && micropubConfig[req.query.q]) {
      return res.json(micropubConfig[req.query.q]);
    }

    console.warn('Unhandled query', req.query);

    res.status(500).json({ error: 'Probably an invalid micropub request' });
  });

  app.get('/', (req, res) => {
    res.sendFile('./static/index.html', { root: __dirname });
  });

  app.listen(3313);

  return app;
}

module.exports = createServer;
