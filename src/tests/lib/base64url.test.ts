import assert from "node:assert";
import { describe, it } from "node:test";
import { base64UrlEncode } from "../../lib/base64url";

describe("base64UrlEncode", () => {
    const toBytes = (str: string) => new TextEncoder().encode(str)
    const fromArr = (arr: number[]) => new Uint8Array(arr)

    // https://datatracker.ietf.org/doc/html/rfc4648
    // specifically section 5
    it('handles RFC 4648 test vectors correctly', () => {
        assert.strictEqual(base64UrlEncode(toBytes('')), '')
        assert.strictEqual(base64UrlEncode(toBytes('f')), 'Zg')
        assert.strictEqual(base64UrlEncode(toBytes('foo')), 'Zm9v')
        assert.strictEqual(base64UrlEncode(toBytes('foobar')), 'Zm9vYmFy')
    })

    it('strips padding characters (=)', () => {
        assert.doesNotMatch(base64UrlEncode(toBytes('f')), /=+$/g)
        assert.strictEqual(base64UrlEncode(toBytes('fo')), 'Zm8') // Zm8= in standard base64
    })

    it('replaces + with -', () => {
        const input = fromArr([251])
        assert.strictEqual(base64UrlEncode(input), '-w') // +w in standard base64
    })

    it('replaces / with _', () => {
        const input = fromArr([0xFB, 0xF0, 0xFF])
        assert.strictEqual(base64UrlEncode(input), '-_D_') // +/D/ in standard base64
    })
})