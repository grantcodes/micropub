import test from 'ava';
import { appendQueryString } from '../../src/lib/append-query-string';

test('Append to basic url', async (t) => {
  const url = 'https://example.com';
  const params = {
    array: ['foo', 'bar'],
    number: 202,
    longString: 'This is a long string :)',
  };
  const actual = appendQueryString(url, params);
  const expect =
    'https://example.com?array[]=foo&array[]=bar&number=202&longString=This%20is%20a%20long%20string%20%3A)';
  t.is(actual, expect);
});

test('Append to url with existing params', async (t) => {
  const url = 'https://example.com?existing=exists';
  const params = {
    array: ['foo', 'bar'],
    number: 202,
    longString: 'This is a long string :)',
  };
  const actual = appendQueryString(url, params);
  const expect =
    'https://example.com?existing=exists&array[]=foo&array[]=bar&number=202&longString=This%20is%20a%20long%20string%20%3A)';
  t.is(actual, expect);
});
