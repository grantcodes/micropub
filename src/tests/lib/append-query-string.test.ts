import { it, describe } from 'node:test'
import assert from 'node:assert/strict'
import { appendQueryString } from '../../lib/append-query-string.js'

/* eslint-disable @typescript-eslint/no-floating-promises */

describe('appendQueryString', () => {
  it('Append to basic url', () => {
    const url = 'https://example.com'
    const params = {
      array: ['foo', 'bar'],
      number: 202,
      longString: 'This is a long string :)'
    }
    const actual = appendQueryString(url, params)
    const expect =
      'https://example.com?array[]=foo&array[]=bar&number=202&longString=This%20is%20a%20long%20string%20%3A)'
    assert.equal(actual, expect)
  })

  it('Append to url with existing params', () => {
    const url = 'https://example.com?existing=exists'
    const params = {
      array: ['foo', 'bar'],
      number: 202,
      longString: 'This is a long string :)'
    }
    const actual = appendQueryString(url, params)
    const expect =
      'https://example.com?existing=exists&array[]=foo&array[]=bar&number=202&longString=This%20is%20a%20long%20string%20%3A)'
    assert.equal(actual, expect)
  })
})
