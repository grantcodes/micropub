import { TextEncoder } from "node:util";
import { stringToBase64URL } from "./base64url";

export interface PkceParameters {
	codeVerifier: string;
	codeChallenge: string;
}

/**
 * Creates a randomly generated 32-byte array and encodes it using base64url.
 * Generates the SHA256 hash value of the generated string, and returns both
 * to be used as PKCE parameters.
 *
 * @returns {Promise<PkceParameters>} The generated PKCE parameters
 */
export async function generatePkceParameters(): Promise<PkceParameters> {
	// Generate 32 random bytes
	const randomBytes = new Uint8Array(32);
	crypto.getRandomValues(randomBytes);

	// Convert raw bytes to string and encode with base64url
	let verifier = "";
	for (const byte of randomBytes) {
		verifier += String.fromCharCode(byte);
	}

	verifier = stringToBase64URL(verifier);

	// Encode verifier as utf8, then digest with sha256. Convert sha256
	// bytes to string and encode with base64url as before
	const utf8 = new Uint8Array(new TextEncoder().encode(verifier)); // wrapping required for TS
	const digest = await crypto.subtle.digest("SHA-256", utf8);

	let challenge = "";
	for (const byte of new Uint8Array(digest)) {
		challenge += String.fromCharCode(byte);
	}

	challenge = stringToBase64URL(challenge);

	// Return generated parameters
	return {
		codeVerifier: verifier,
		codeChallenge: challenge,
	};
}
