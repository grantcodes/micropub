import { createReadStream } from 'fs';
import test from 'ava';
import testServer from './_server/server';
import { data as serverData } from './_server/data/data';
import Micropub from '../src/main';

const baseOptions = {
  clientId: 'https://test.com',
  redirectUri: 'https://test.com/redirect',
  me: 'http://localhost:3313',
  state: 'state',
};

const fullOptions = {
  ...baseOptions,
  token: 'token',
  tokenEndpoint: serverData.endpoints.token_endpoint,
  authEndpoint: serverData.endpoints.authorization_endpoint,
  micropubEndpoint: serverData.endpoints.micropub,
  mediaEndpoint: serverData.endpoints.media,
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

test('Check required options function', async (t) => {
  const micropub = new Micropub();
  micropub.setOptions({ foo: 'bar' });

  try {
    micropub.checkRequiredOptions(['bar']);
    t.fail();
  } catch (err) {
    t.deepEqual(err, {
      error: null,
      message: 'Missing required options: bar',
      status: null,
    });
  }

  t.truthy(micropub.checkRequiredOptions(['foo']));
});

test('Get endpoints from url', async (t) => {
  const micropub = new Micropub(baseOptions);
  const endpoints = await micropub.getEndpointsFromUrl(baseOptions.me);
  t.is(endpoints.auth, fullOptions.authEndpoint);
  t.is(endpoints.token, fullOptions.tokenEndpoint);
  t.is(endpoints.micropub, fullOptions.micropubEndpoint);
});

// TODO: Test returning non json and test returning invalid response.
test('Get token', async (t) => {
  const micropub = new Micropub(fullOptions);
  const token = await micropub.getToken('code');
  t.is(token, serverData.token);
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

test('Verify token', async (t) => {
  const micropub = new Micropub(fullOptions);
  const valid = await micropub.verifyToken();
  t.truthy(valid);
  micropub.setOptions({ token: 'invalid' });
  try {
    await micropub.verifyToken();
    t.fail();
  } catch (err) {
    t.is(err.message, 'Error verifying token');
    t.is(err.status, 401);
  }
});

test('Create note json encoded', async (t) => {
  const micropub = new Micropub(fullOptions);
  const noteUrl = await micropub.create(serverData.mf2.note);
  t.is(noteUrl, serverData.mf2.note.properties.url[0]);
});

test('Create note form encoded', async (t) => {
  const micropub = new Micropub(fullOptions);
  const noteUrl = await micropub.create(
    {
      h: 'entry',
      content: serverData.mf2.note.properties.content[0],
    },
    'form',
  );
  t.is(noteUrl, serverData.mf2.note.properties.url[0]);
});

test('Update note', async (t) => {
  const micropub = new Micropub(fullOptions);
  const res = await micropub.update(serverData.mf2.note.properties.url[0], {
    replace: { content: ['Replaced content'] },
  });
  t.truthy(res);
  t.is(res, serverData.mf2.note.properties.url[0]);
});

test('Delete note', async (t) => {
  const micropub = new Micropub(fullOptions);
  const res = await micropub.delete(serverData.mf2.note.properties.url[0]);
  t.truthy(res);
});

test('Undelete note', async (t) => {
  const micropub = new Micropub(fullOptions);
  const noteUrl = serverData.mf2.note.properties.url[0];
  const undeleteUrl = await micropub.undelete(noteUrl);
  t.is(undeleteUrl, noteUrl);
});

// TODO: Test postMicropub function?
// test('Core postMicropub method', async (t) => {
//   const micropub = new Micropub(fullOptions);
//   const res = await micropub.postMicropub({}).catch(console.info);
//   t.truthy(res)
// });

test('Post media', async (t) => {
  const micropub = new Micropub(fullOptions);
  const filePath = __dirname + '/_server/static/image.png';
  const file = createReadStream(filePath);
  const url = await micropub.postMedia(file);
  t.is(url, serverData.fileUrl);
});

test('Query config', async (t) => {
  const micropub = new Micropub(fullOptions);
  const config = await micropub.query('config');
  t.deepEqual(config, serverData.micropubConfig);
});

test('Query syndication targets', async (t) => {
  const micropub = new Micropub(fullOptions);
  const targets = await micropub.query('syndicate-to');
  t.deepEqual(targets, serverData.micropubConfig['syndicate-to']);
});

test('Query handles error', async (t) => {
  const micropub = new Micropub(fullOptions);
  try {
    await micropub.query('throw-error');
    t.fail();
  } catch (err) {
    t.is(err.message, 'Error getting throw-error');
    t.truthy(err.status > 399);
  }
});

test('Query source', async (t) => {
  const micropub = new Micropub(fullOptions);
  const post = await micropub.querySource(
    serverData.mf2.note.properties.url[0],
  );
  t.deepEqual(post, serverData.mf2.note);
});

test('Query source content property', async (t) => {
  const micropub = new Micropub(fullOptions);
  const { content } = await micropub.querySource(
    serverData.mf2.note.properties.url[0],
    ['content'],
  );
  t.deepEqual(content, serverData.mf2.note.properties.content);
});

test('Query source list', async (t) => {
  const micropub = new Micropub(fullOptions);
  const { items } = await micropub.querySource();
  t.deepEqual(items, serverData.mf2.list);
});

test('Custom query source', async (t) => {
  const micropub = new Micropub(fullOptions);
  const { items } = await micropub.querySource({ 'post-type': 'note' });
  t.deepEqual(items, [serverData.mf2.note]);
});

test('Malformed query source', async (t) => {
  const micropub = new Micropub(fullOptions);
  try {
    await micropub.querySource('1');
    t.fail();
  } catch (err) {
    t.deepEqual(err, {
      error: {
        response: {
          status: 'Error with source query parameters',
        },
      },
      message: 'Error getting source',
      status: 'Error with source query parameters',
    });
  }
});

test('Query source returns error', async (t) => {
  const micropub = new Micropub(fullOptions);
  try {
    await micropub.querySource('doesnt-exist');
    t.fail();
  } catch (err) {
    t.is(err.message, 'Error getting source');
    t.is(err.status, 404);
  }
});
