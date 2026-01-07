import { describe, it } from "node:test";
import { generatePkceParameters } from "../../lib/pkce";
import assert from "node:assert";
import { stringToBase64URL } from "../../lib/base64url";

describe("generatePkceParameters", () => {
	it("Generates correct parameters", async () => {
		const params = await generatePkceParameters();

		// Check types
		assert.strictEqual(typeof params.codeChallenge, "string");
		assert.strictEqual(typeof params.codeVerifier, "string");

		// Check length of verifier for spec compliance
		assert.ok(
			params.codeVerifier.length >= 43 && params.codeVerifier.length <= 128,
		);

		// Check length for challenge (sha256 string as base64url)
		assert.strictEqual(params.codeChallenge.length, 43);

		// Make sure they are not the same value
		assert.notStrictEqual(params.codeChallenge, params.codeVerifier);

		// Make sure challenge the correct hashed value of verifier
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new Uint8Array(new TextEncoder().encode(params.codeVerifier)),
		);

		let expectChallenge = "";
		for (const byte of new Uint8Array(digest)) {
			expectChallenge += String.fromCharCode(byte);
		}

		expectChallenge = stringToBase64URL(expectChallenge);
		assert.strictEqual(params.codeChallenge, expectChallenge);
	});

	it("Generates unique parameters", async () => {
		const one = await generatePkceParameters();
		const two = await generatePkceParameters();
		assert.notStrictEqual(one.codeVerifier, two.codeVerifier);
		assert.notStrictEqual(one.codeChallenge, two.codeChallenge);
	});
});
