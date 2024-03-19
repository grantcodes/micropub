import test from 'node:test'
import assert from 'node:assert/strict'
import { FormData } from 'formdata-polyfill/esm.min.js'
import { objectToFormData } from '../../lib/object-to-form-data.js'

/* eslint-disable @typescript-eslint/no-floating-promises */

// TODO: These tests aren't really that great, they don't check what is contained in the FormData response.

test('Basic form data', () => {
  const params = {
    array: ['foo', 'bar'],
    number: 202,
    longString: 'This is a long string :)'
  }
  const res = objectToFormData(params)
  assert.ok(res instanceof FormData)
})

test('Add to existing form data', () => {
  const existing = new FormData()
  existing.append('existing', 'exists')
  const params = {
    array: ['foo', 'bar'],
    number: 202,
    longString: 'This is a long string :)'
  }
  const res = objectToFormData(params, existing)
  assert.ok(res instanceof FormData)
})

test('Add to existing with a custom name', () => {
  const existing = new FormData()
  const params = {
    array: ['foo', 'bar'],
    number: 202,
    longString: 'This is a long string :)'
  }
  const res = objectToFormData(params, existing, 'keyname')
  assert.ok(res instanceof FormData)
})
