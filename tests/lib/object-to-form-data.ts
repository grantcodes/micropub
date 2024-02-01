import test from 'ava'
import { FormData } from 'formdata-polyfill/esm.min.js'
import { objectToFormData } from '../../src/lib/object-to-form-data.js'

// TODO: These tests aren't really that great, they don't check what is contained in the FormData response.

test('Basic form data', async t => {
  const params = {
    array: ['foo', 'bar'],
    number: 202,
    longString: 'This is a long string :)',
  }
  const res = objectToFormData(params)
  t.truthy(res instanceof FormData)
})

test('Add to existing form data', async t => {
  const existing = new FormData()
  existing.append('existing', 'exists')
  const params = {
    array: ['foo', 'bar'],
    number: 202,
    longString: 'This is a long string :)',
  }
  const res = objectToFormData(params, existing)
  t.truthy(res instanceof FormData)
})

test('Add to existing with a custom name', async t => {
  const existing = new FormData()
  const params = {
    array: ['foo', 'bar'],
    number: 202,
    longString: 'This is a long string :)',
  }
  const res = objectToFormData(params, existing, 'keyname')
  t.truthy(res instanceof FormData)
})
