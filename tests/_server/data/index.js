const endpoints = require('./endpoints');
const micropubConfig = require('./micropub-config');
const note = require('./note');
const article = require('./article');

module.exports = {
  endpoints,
  micropubConfig,
  mf2: {
    note,
    article,
    list: [note, article],
  },
  token: 'token',
  fileUrl: 'http://localhost:3313/media/image.jpg',
};
