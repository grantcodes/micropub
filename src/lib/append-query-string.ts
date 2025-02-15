type QueryVarsAppend = string | number | boolean;

export interface QueryVars {
	[key: string]: QueryVarsAppend | QueryVarsAppend[];
}

/**
 * Helper function to append query string to a URL
 * @param {string} url The original URL
 * @param {QueryVars} queryVars Object containing the query string variables
 * @returns {string} The URL with the query string appended
 */
function appendQueryString(url: string, queryVars: QueryVars): string {
	const firstSeperator = !url.includes("?") ? "?" : "&";
	const queryStringParts = [];
	for (const key in queryVars) {
		const queryVar = queryVars[key];
		if (Array.isArray(queryVar)) {
			for (const val of queryVar) {
				const encodedVal = encodeURIComponent(val);
				queryStringParts.push(`${key}[]=${encodedVal}`);
			}
		} else {
			const encodedVal = encodeURIComponent(queryVar);
			queryStringParts.push(`${key}=${encodedVal}`);
		}
	}
	const queryString = queryStringParts.join("&");
	return url + firstSeperator + queryString;
}

export { appendQueryString };
