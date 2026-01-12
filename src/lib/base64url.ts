export function base64UrlEncode(bytes: Uint8Array): string {
	const binaryString = String.fromCharCode(...bytes)

	return btoa(binaryString)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "")
}