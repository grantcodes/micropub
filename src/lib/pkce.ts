import { base64UrlEncode } from "./base64url";

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
	const randomBytes = new Uint8Array(32)
	crypto.getRandomValues(randomBytes)

	// Convert raw bytes to string and encode with base64url
	const verifier = base64UrlEncode(randomBytes)

	// Encode verifier as utf8, then digest with sha256. 
	// Convert sha256 bytes to string and encode with base64url to create challenge
	const encoder = new TextEncoder()
	const data = encoder.encode(verifier)
	const digest = await crypto.subtle.digest("SHA-256", data)
	const challenge = base64UrlEncode(new Uint8Array(digest))

	// Return generated parameters
	return {
		codeVerifier: verifier,
		codeChallenge: challenge,
	};
}
