const test = require('ava');
const express = require('express');
const Micropub = require('../src/main');

// const server = express();

// server.get('/get-endpoints-html', (req, res) =>
//   res.send(
//     '<html><link rel="micropub" href="http://localhost:3313/micropub" /></html>',
//   ),
// );

// server.listen(3313);

/**
 * Tests that a method will throw an error if the required options are not set
 */
test('Basic required fields', async (t) => {
  const micropub = new Micropub();
  try {
    await micropub.getAuthUrl();
    return t.fail();
  } catch (err) {
    if (err.message && err.message.startsWith('Missing required options')) {
      return t.pass();
    }
  }
  return t.fail();
});

// test('HTML Links', t => {
//   const micropub = new Micropub({
//     clientId: ''
//   })
// })
