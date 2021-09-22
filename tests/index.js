const test = require('ava');
const testServer = require('./_server');
const Micropub = require('../src/main');

const baseOptions = {
  clientId: 'https://test.com',
  redirectUri: 'https://test.com/redirect',
  me: 'http://localhost:3313',
  state: 'state',
};

const fullOptions = {
  ...baseOptions,
  token: 'token',
  tokenEndpoint: 'http://localhost:3313/token',
  authEndpoint: 'http://localhost:3313/auth',
  micropubEndpoint: 'http://localhost:3313/micropub',
  mediaEndpoint: 'http://localhost:3313/media',
};

testServer();

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

test('Get endpoints from url', async (t) => {
  const micropub = new Micropub(baseOptions);
  const endpoints = await micropub.getEndpointsFromUrl(baseOptions.me);
  t.is(endpoints.auth, fullOptions.authEndpoint);
  t.is(endpoints.token, fullOptions.tokenEndpoint);
  t.is(endpoints.micropub, fullOptions.micropubEndpoint);
});

test('Get auth endpoint', async (t) => {
  const micropub = new Micropub(baseOptions);
  const authUrlRes = await micropub.getAuthUrl();
  const parsedUrl = new URL(authUrlRes);

  t.is(parsedUrl.host, 'localhost:3313');
  t.is(parsedUrl.pathname, '/auth');
  t.is(parsedUrl.searchParams.get('me'), baseOptions.me);
  t.is(parsedUrl.searchParams.get('client_id'), baseOptions.clientId);
  t.is(parsedUrl.searchParams.get('redirect_uri'), baseOptions.redirectUri);
  t.is(parsedUrl.searchParams.get('state'), baseOptions.state);
  t.is(parsedUrl.searchParams.get('response_type'), 'code');
  t.is(parsedUrl.searchParams.get('scope'), 'create delete update');
});

// TODO: Test returning non json and test returning invalid response.
// TODO: Export this data from the fake server and compare it
test('Get token', async (t) => {
  const micropub = new Micropub(fullOptions);
  const token = await micropub.getToken('code');
  t.is(token, 'token');
});

// TODO: Export this data from the fake server and compare it
test('Query config', async (t) => {
  const micropub = new Micropub(fullOptions);
  const config = await micropub.query('config');
  t.is(typeof config, 'object');
  t.is(config['media-endpoint'], fullOptions.mediaEndpoint);
});

// TODO: Export this data from the fake server and compare it
test('Query syndication targets', async (t) => {
  const micropub = new Micropub(fullOptions);
  const targets = await micropub.query('syndicate-to');
  t.is(targets[0].uid, 'https://silo.example');
  t.is(targets[0].name, 'Syndication Target');
});

// TODO: Export this data from the fake server and compare it
test('Query source', async (t) => {
  const micropub = new Micropub(fullOptions);
  const mf2 = await micropub.querySource('http://localhost:3313/note');
  t.is(mf2.type, ['h-entry']);
  t.is(mf2.properties.content, ['This is a post']);
});
