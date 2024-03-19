import { it, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'node:http'
import { createServer } from './_server/server.js'
import { data as serverData } from './_server/data/data.js'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MicropubError } from '../lib/micropub-error.js'
import Micropub from '../main.js'

/* eslint-disable @typescript-eslint/no-floating-promises */

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(fileURLToPath(import.meta.url))

const baseOptions = {
  clientId: 'https://test.com',
  redirectUri: 'https://test.com/redirect',
  me: 'http://localhost:3313',
  state: 'state'
}

const fullOptions = {
  ...baseOptions,
  token: 'token',
  tokenEndpoint: serverData.endpoints.token_endpoint,
  authEndpoint: serverData.endpoints.authorization_endpoint,
  micropubEndpoint: serverData.endpoints.micropub,
  mediaEndpoint: serverData.endpoints.media
}

let testServerInstance: null | Server = null

describe('Micropub', () => {
  before(() => {
    const testServer = createServer()
    testServerInstance = testServer.listen(3313)
  })

  after(async () => {
    if (testServerInstance !== null) {
      await testServerInstance.close()
      testServerInstance = null
    }
  })

  /**
   * Tests that a method will throw an error if the required options are not set
   */
  it('Basic required fields', async t => {
    const micropub = new Micropub()

    try {
      await micropub.getAuthUrl()
      throw new Error('Test failed, did not throw expected error')
    } catch (err: MicropubError | any) {
      assert.equal(err.message, 'Missing required options: me, state')
    }
  })

  it('Check required options function', async t => {
    const micropub = new Micropub()
    micropub.setOptions({ foo: 'bar' })

    try {
      micropub.checkRequiredOptions(['bar'])
    } catch (err: MicropubError | any) {
      assert.equal(err.error, null)
      assert.equal(err.message, 'Missing required options: bar')
      assert.equal(err.status, null)
    }

    assert.ok(micropub.checkRequiredOptions(['foo']))
  })

  it('Get endpoints from url', async t => {
    const micropub = new Micropub(baseOptions)
    const endpoints = await micropub.getEndpointsFromUrl(baseOptions.me)
    assert.equal(endpoints.auth, fullOptions.authEndpoint)
    assert.equal(endpoints.token, fullOptions.tokenEndpoint)
    assert.equal(endpoints.micropub, fullOptions.micropubEndpoint)
  })

  // TODO: Test returning non json and test returning invalid response.
  it('Get token', async t => {
    const micropub = new Micropub(fullOptions)
    const token = await micropub.getToken('code')
    assert.equal(token, serverData.token)
  })

  it('Get auth endpoint', async t => {
    const micropub = new Micropub(baseOptions)
    const authUrlRes = await micropub.getAuthUrl()
    const parsedUrl = new URL(authUrlRes)

    assert.equal(parsedUrl.host, 'localhost:3313')
    assert.equal(parsedUrl.pathname, '/auth')
    assert.equal(parsedUrl.searchParams.get('me'), baseOptions.me)
    assert.equal(parsedUrl.searchParams.get('client_id'), baseOptions.clientId)
    assert.equal(parsedUrl.searchParams.get('redirect_uri'), baseOptions.redirectUri)
    assert.equal(parsedUrl.searchParams.get('state'), baseOptions.state)
    assert.equal(parsedUrl.searchParams.get('response_type'), 'code')
    assert.equal(parsedUrl.searchParams.get('scope'), 'create delete update')
  })

  it('Verify token', async t => {
    const micropub = new Micropub(fullOptions)
    const valid = await micropub.verifyToken()
    assert.ok(valid)
    micropub.setOptions({ token: 'invalid' })
    try {
      await micropub.verifyToken()
      throw new Error('Test failed, did not throw expected error')
    } catch (err: MicropubError | any) {
      assert.equal(err.message, 'Error verifying token')
      assert.equal(err.status, 401)
    }
  })

  it('Create note json encoded', async t => {
    const micropub = new Micropub(fullOptions)
    const noteUrl = await micropub.create(serverData.mf2.note)
    assert.equal(noteUrl, serverData.mf2.note.properties.url[0])
  })

  it('Create note form encoded', async t => {
    const micropub = new Micropub(fullOptions)
    const noteUrl = await micropub.create(
      {
        h: 'entry',
        content: serverData.mf2.note.properties.content[0]
      },
      'form'
    )
    assert.equal(noteUrl, serverData.mf2.note.properties.url[0])
  })

  it('Update note', async t => {
    const micropub = new Micropub(fullOptions)
    const res = await micropub.update(serverData.mf2.note.properties.url[0], {
      replace: { content: ['Replaced content'] }
    })
    assert.ok(res)
    assert.equal(res, serverData.mf2.note.properties.url[0])
  })

  it('Delete note', async t => {
    const micropub = new Micropub(fullOptions)
    const res = await micropub.delete(serverData.mf2.note.properties.url[0])
    assert.ok(res)
  })

  it('Undelete note', async t => {
    const micropub = new Micropub(fullOptions)
    const noteUrl = serverData.mf2.note.properties.url[0]
    const undeleteUrl = await micropub.undelete(noteUrl)
    assert.equal(undeleteUrl, noteUrl)
  })

  it('Post media', async t => {
    const micropub = new Micropub(fullOptions)
    const filePath = __dirname + '/../image.png'
    const buffer = readFileSync(filePath)
    const url = await micropub.postMedia(new Blob([buffer]))
    assert.equal(url, serverData.fileUrl)
  })

  it('Query config', async t => {
    const micropub = new Micropub(fullOptions)
    const config = await micropub.query('config')
    assert.deepEqual(config, serverData.micropubConfig)
  })

  it('Query syndication targets', async t => {
    const micropub = new Micropub(fullOptions)
    const targets = await micropub.query('syndicate-to')
    assert.deepEqual(targets, serverData.micropubConfig['syndicate-to'])
  })

  it('Query handles error', async t => {
    const micropub = new Micropub(fullOptions)
    try {
      await micropub.query('throw-error')
      throw new Error('Test failed, did not throw expected error')
    } catch (err: MicropubError | any) {
      assert.equal(err.message, 'Error getting throw-error')
      assert.ok(err.status > 399)
    }
  })

  it('Query source', async t => {
    const micropub = new Micropub(fullOptions)
    const post = await micropub.querySource(serverData.mf2.note.properties.url[0])
    assert.deepEqual(post, serverData.mf2.note)
  })

  it('Query source content property', async t => {
    const micropub = new Micropub(fullOptions)
    const { content } = await micropub.querySource(
      serverData.mf2.note.properties.url[0],
      ['content']
    )
    assert.deepEqual(content, serverData.mf2.note.properties.content)
  })

  it('Query source list', async t => {
    const micropub = new Micropub(fullOptions)
    const { items } = await micropub.querySource()
    assert.deepEqual(items, serverData.mf2.list)
  })

  it('Custom query source', async t => {
    const micropub = new Micropub(fullOptions)
    const { items } = await micropub.querySource({ 'post-type': 'note' })
    assert.deepEqual(items, [serverData.mf2.note])
  })

  it('Malformed query source', async t => {
    const micropub = new Micropub(fullOptions)
    try {
      await micropub.querySource('1')
      throw new Error('Test failed, did not throw expected error')
    } catch (err: MicropubError | any) {
      assert.equal(err.message, 'Error getting source')
      assert.equal(err.status, 404)
    }
  })

  it('Query source returns error', async t => {
    const micropub = new Micropub(fullOptions)
    try {
      await micropub.querySource('doesnt-exist')
      throw new Error('Test failed, did not throw expected error')
    } catch (err: MicropubError | any) {
      assert.equal(err.message, 'Error getting source')
      assert.equal(err.status, 404)
    }
  })
})
