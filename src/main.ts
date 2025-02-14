import { relParser } from "rel-parser";
import { stringify as qsStringify } from "qs";
import { MicropubError } from "./lib/micropub-error.js";
import { objectToFormData } from "./lib/object-to-form-data.js";
import type { ObjectToFormDataData } from "./lib/object-to-form-data.js";
import { appendQueryString } from "./lib/append-query-string.js";
import type { QueryVars } from "./lib/append-query-string.js";
import type {
	MicroformatFormEncoded,
	MicroformatRoot,
} from "./microformats.js";
import type {
	MicropubActionRequest,
	MicropubConfigQueryResponse,
	MicropubUpdateActionRequest,
} from "./micropub.js";

interface MicropubOptions {
	[key: string]: string | undefined;
	me: string;
	scope: string;
	token: string;
	authEndpoint: string;
	tokenEndpoint: string;
	micropubEndpoint: string;
	mediaEndpoint?: string;
	state?: string;
	clientId?: string;
	redirectUri?: string;
}

const defaultSettings: MicropubOptions = {
	me: "",
	scope: "create delete update",
	token: "",
	authEndpoint: "",
	tokenEndpoint: "",
	micropubEndpoint: "",
};

interface MicropubRequestInit extends RequestInit {
	url?: string;
	timeout?: number;
	headers: Headers; // Require to always use Headers object
}

interface MicropubEndpointsReponse {
	[key: string]: string | null;
	auth: string | null;
	token: string | null;
	micropub: string | null;
}

type MicropubPostCreateFormat = "json" | "form" | "multipart";

/**
 * A micropub helper class
 */
class Micropub {
	#options: MicropubOptions = defaultSettings;

	/**
	 * Micropub class constructor
	 * @param {object} userSettings Settings supplied for this micropub client
	 */
	constructor(userSettings: Partial<MicropubOptions> = {}) {
		this.options = { ...defaultSettings, ...userSettings };
	}

	/**
	 * Sets the options for the class
	 * @param options Object of options to set.
	 */
	set options(options: Partial<MicropubOptions>) {
		this.#options = { ...this.#options, ...options };
	}

	/**
	 * Get the options object
	 * @returns {MicropubOptions} The options object
	 */
	get options(): MicropubOptions {
		return { ...this.#options };
	}

	/**
	 * Checks to see if the given options are set
	 * @param  {array} requirements An array of option keys to check
	 * @throws {MicropubError} If any of the options are missing
	 * @return {true}
	 */
	private checkRequiredOptions(requirements: string[]): true {
		const missing = [];
		for (const optionName of requirements) {
			const option = this.#options[optionName];
			if (!option) {
				missing.push(optionName);
			}
		}

		if (missing.length > 0) {
			throw new MicropubError(
				`Missing required options: ${missing.join(", ")}`,
			);
		}

		return true;
	}

	/**
	 * Helper function to get the url to fetch, defaulting to the micropub endpoint
	 * Can be extended for things like CORS proxies
	 * @param {string} url The url to fetch
	 * @returns {string} The url to fetch
	 */
	getFetchUrl(url?: string): string {
		return url ?? this.options.micropubEndpoint;
	}

	/**
	 * Helper function to handle errors, making sure to always throw a MicropubError
	 * @param err
	 */
	private handleError(
		err: Error | MicropubError | unknown,
		defaultMessage = "An unknown error occurred",
	): void {
		if (err instanceof MicropubError) {
			throw err;
		}

		if (err instanceof Error) {
			throw new MicropubError(err.message, 0, err);
		}

		throw new MicropubError(defaultMessage, 0, err);
	}

	/**
	 * Helper function to perform a fetch request, adding appropriate headers and timeout
	 * @param {MicropubRequestInit} options Url, timeout and header options for the fetch request
	 * @returns {Promise<Response>} The fetch response
	 */
	// @ts-expect-error - Error handling in a separate function
	private async fetch(options: MicropubRequestInit): Promise<Response> {
		const { url, timeout = 300000, ...request } = options;
		const { token } = this.options;

		// Add a timeout to the fetch request
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);
		request.signal = controller.signal;

		// Add authorization header if a token is set
		if (token) {
			request.headers.set("Authorization", `Bearer ${token}`);
		}

		try {
			const result = await fetch(this.getFetchUrl(url), request);
			clearTimeout(timer);
			return result;
		} catch (err) {
			clearTimeout(timer);
			this.handleError(err, "Error performing fetch request");
		}
	}

	/**
	 * Get the various endpoints needed from the given url
	 * @param  {string} url The url to scrape
	 * @throws {MicropubError} If the endpoints are not found
	 * @return {Promise<MicropubEndpointsReponse>}    Passes an object of endpoints on success: auth, token and micropub
	*/
	// @ts-expect-error - Error handling in a separate function
	async getEndpointsFromUrl(url: string): Promise<MicropubEndpointsReponse> {
		try {
			const res = await this.fetch({
				url,
				headers: new Headers({
					accept: "text/html,application/xhtml+xml",
				}),
				method: "GET",
			});

			const resHtml = await res.text();
			const rels = await relParser(
				url,
				resHtml,
				Object.fromEntries(res.headers),
			);

			const endpoints: MicropubEndpointsReponse = {
				micropub: rels?.micropub?.[0] ?? null,
				auth: rels?.authorization_endpoint?.[0] ?? null,
				token: rels?.token_endpoint?.[0] ?? null,
			};

			if (!endpoints.micropub || !endpoints.auth || !endpoints.token) {
				throw new MicropubError("Required endpoints not found");
			}

			this.options = {
				me: url,
				micropubEndpoint: endpoints.micropub,
				tokenEndpoint: endpoints.token,
				authEndpoint: endpoints.auth,
			};

			return endpoints;
		} catch (err) {
			this.handleError(err, "Error getting endpoints from url");
		}
	}

	/**
	 * Exchanges a code for an access token
	 * @param {string} code A code received from the auth endpoint
	 * @throws {MicropubError} If the token request fails
	 * @return {Promise<string>} Promise which resolves with the access token on success
	 */
	// @ts-expect-error - Error handling in a separate function
	async getToken(code: string): Promise<string> {
		this.checkRequiredOptions([
			"me",
			"clientId",
			"redirectUri",
			"tokenEndpoint",
		]);

		const { me, clientId, redirectUri, tokenEndpoint } = this.options;

		try {
			const data = {
				grant_type: "authorization_code",
				me,
				code,
				client_id: clientId,
				redirect_uri: redirectUri,
			};

			const res = await this.fetch({
				url: tokenEndpoint,
				method: "POST",
				body: qsStringify(data),
				headers: new Headers({
					"content-type": "application/x-www-form-urlencoded;charset=UTF-8",
					accept: "application/json",
				}),
			});

			if (!res.ok) {
				throw new MicropubError("Token request failed", res.status, res);
			}

			const result = await res.json();

			if (!result.me || !result.scope || !result.access_token) {
				throw new MicropubError("Invalid token response");
			}

			const urlResult = new URL(result.me);
			const urlOptions = new URL(me);
			if (urlResult.hostname !== urlOptions.hostname) {
				throw new MicropubError("The me values do not share the same hostname");
			}

			this.options = { token: result.access_token };
			return result.access_token;
		} catch (err) {
			this.handleError(err, "Error requesting token endpoint");
		}
	}

	/**
	 * Get the authentication url based on the set options
	 * @throws {MicropubError} If the options are not set
	 * @return {Promise<string>} The authentication url or false on missing options
	 */
	// @ts-expect-error - Error handling in a separate function
	async getAuthUrl(): Promise<string> {
		this.checkRequiredOptions(["me", "state"]);
		try {
			const { me } = this.options;
			await this.getEndpointsFromUrl(me);

			this.checkRequiredOptions([
				"me",
				"state",
				"scope",
				"clientId",
				"redirectUri",
			]);

			const { clientId, redirectUri, scope, state, authEndpoint } =
				this.options;

			const authParams = {
				me,
				client_id: clientId,
				redirect_uri: redirectUri,
				response_type: "code",
				scope,
				state,
			};

			return appendQueryString(authEndpoint, authParams as QueryVars);
		} catch (err) {
			this.handleError(err, "Error getting auth url");
		}
	}

	/**
	 * Verify the stored access token
	 * @throws {MicropubError} If the token verification fails
	 * @return {Promise<boolean>} A promise that resolves true or rejects
	 */
	// @ts-expect-error - Error handling in a separate function
	async verifyToken(): Promise<boolean> {
		this.checkRequiredOptions(["token", "micropubEndpoint"]);

		try {
			const res = await this.fetch({
				method: "GET",
				headers: new Headers(),
			});

			if (!res.ok) {
				throw new MicropubError("Token verification failed", res.status);
			}

			return true;
		} catch (err) {
			this.handleError(err, "Error verifying token");
		}
	}

	/**
	 * Creates a micropub post
	 * @param {MicroformatRoot | MicroformatFormEncoded} post Micropub post data
	 * @param {MicropubPostCreateFormat} type The type of form encoding to use
	 * @throws {MicropubError} If the post fails
	 * @return {Promise<string>} Resolves on success with the url of the post or null if could not read the location header.
	 */
	async create(
		post: MicroformatRoot | MicroformatFormEncoded,
		type: MicropubPostCreateFormat = "json",
	): Promise<string> {
		return await this.postMicropub(post, type);
	}

	/**
	 * Updates a micropub post
	 * @param {string} url The url of the post to update
	 * @param {Pick<MicropubUpdateActionRequest, "replace" | "add" | "delete">} update The micropub update object
	 * @throws {MicropubError} If the update fails
	 * @return {Promise<string>} Resolves on success with the url of the post or null if could not read the location header.
	 */
	async update(
		url: string,
		update: Pick<MicropubUpdateActionRequest, "replace" | "add" | "delete">,
	): Promise<string> {
		return await this.postMicropub({ ...update, action: "update", url });
	}

	/**
	 * Deletes a micropub post
	 * @param {string} url The url of a post to delete
	 * @throws {MicropubError} If the delete fails
	 * @return {Promise<string>} Resolves on successful deletion
	 */
	async delete(url: string): Promise<string> {
		return await this.postMicropub({ action: "delete", url });
	}

	/**
	 * Undeletes a post
	 * @param {string} url The url of a post to undelete
	 * @throws {MicropubError} If the undelete fails
	 * @return {Promise<string>} Resolves on successful undeletion
	 */
	async undelete(url: string): Promise<string> {
		return await this.postMicropub({ action: "undelete", url });
	}

	/**
	 * Posts a micropub object
	 * @param {MicroformatRoot | MicroformatFormEncoded | MicropubActionRequest} object A micropub post
	 * @param {MicropubPostCreateFormat} format The type of form encoding for the post
	 * @throws {MicropubError} If the post fails
	 * @return {Promise<string>} Resolves with the returned location header or null on success
	 */
	async postMicropub(
		object: MicroformatRoot | MicroformatFormEncoded | MicropubActionRequest,
		format: MicropubPostCreateFormat = "json",
		// @ts-expect-error - Error handling in a separate function
	): Promise<string> {
		this.checkRequiredOptions(["token", "micropubEndpoint"]);

		try {
			const request: MicropubRequestInit = {
				method: "POST",
				headers: new Headers(),
			};

			if (format === "json") {
				request.body = JSON.stringify(object);
				request.headers.set("Content-Type", "application/json");
			} else if (format === "form") {
				request.body = qsStringify(object, { arrayFormat: "brackets" });
				request.headers.set(
					"Content-Type",
					"application/x-www-form-urlencoded;charset=UTF-8",
				);
				request.headers.set(
					"Accept",
					"application/json, application/x-www-form-urlencoded",
				);
			} else if (format === "multipart") {
				request.body = objectToFormData(object as ObjectToFormDataData);
				request.headers.set(
					"Accept",
					"application/json, application/x-www-form-urlencoded",
				);
			}

			const result = await this.fetch(request);

			const location = result.headers.get("location");
			if (location) {
				return location;
			}

			if (result.ok) {
				return "";
			}

			throw new MicropubError(
				"Micropub endpoint did not return a location header",
			);
		} catch (err) {
			this.handleError(err, "Error posting to micropub endpoint");
		}
	}

	/**
	 * Posts a file to the media endpoint
	 * @param {Blob} file The file to post
	 * @throws {MicropubError} If error creating media, or retrieving the uploaded media url
	 * @return {Promise<string>} Resolves on success with the url of the created file
	 */
	// @ts-expect-error - Error handling in a separate function
	async postMedia(file: Blob): Promise<string> {
		this.checkRequiredOptions(["token", "mediaEndpoint"]);

		const { mediaEndpoint } = this.options;

		if (!mediaEndpoint) {
			throw new MicropubError("No media endpoint set");
		}

		try {
			const res = await this.fetch({
				url: mediaEndpoint,
				method: "POST",
				body: objectToFormData({ file }),
				headers: new Headers(),
				timeout: 3 * 60 * 1000, // 3 minute timeout for media uploads.
			});

			if (!res.ok) {
				throw new MicropubError("Media endpoint returned an error", res.status);
			}

			const location = res.headers.get("location");
			if (location) {
				return location;
			}

			throw new MicropubError(
				"Media endpoint did not return a location",
				res.status,
			);
		} catch (err) {
			this.handleError(err, "Error posting media");
		}
	}

	/**
	 * Queries the micropub endpoint, for the config for example
	 * @param {string} queryType The queryType passed the the micropub q parameter
	 * @throws {MicropubError} If the query fails
	 * @return {Promise<MicropubConfigQueryResponse>} Resolves with the object that the server replied with
	 */
	// @ts-expect-error - Error handling in a separate function
	async query(queryType: string): Promise<MicropubConfigQueryResponse> {
		this.checkRequiredOptions(["token", "micropubEndpoint"]);

		const { micropubEndpoint } = this.options;

		try {
			const url = appendQueryString(micropubEndpoint, { q: queryType });

			const res = await this.fetch({
				url,
				method: "GET",
				headers: new Headers({
					"content-type": "application/x-www-form-urlencoded;charset=UTF-8",
					accept: "application/json",
				}),
			});

			if (!res.ok) {
				throw new MicropubError(
					"Query did not return successfully",
					res.status,
					await res.text(),
				);
			}

			return await res.json();
		} catch (err) {
			this.handleError(err, `Error querying ${queryType}`);
		}
	}

	/**
	 * Query for the source of a post
	 * @param {string | object} url The url of the post to query or an object of query variables to get a list of posts
	 * @param {string[]} properties An array of properties to query for
	 * @throws {MicropubError} If the source query fails
	 * @return {Promise<any>} A promise which resolves with the returned mf2 json / properties
	 */
	async querySource(
		url?: string | object,
		properties: string[] = [],
		// biome-ignore lint/suspicious/noExplicitAny: Could be anything returned from the source query
	): Promise<any> {
		this.checkRequiredOptions(["token", "micropubEndpoint"]);

		const { micropubEndpoint } = this.options;

		try {
			let queryUrl: string;
			if (typeof url === "object") {
				queryUrl = appendQueryString(micropubEndpoint, { q: "source", ...url });
			} else if (typeof url === "string" && url) {
				queryUrl = appendQueryString(micropubEndpoint, {
					q: "source",
					url,
					properties,
				});
			} else {
				queryUrl = appendQueryString(micropubEndpoint, { q: "source" });
			}

			const res = await this.fetch({
				url: queryUrl,
				method: "GET",
				headers: new Headers({
					"content-type": "application/x-www-form-urlencoded;charset=UTF-8",
					accept: "application/json",
				}),
			});

			if (!res.ok) {
				throw new MicropubError(
					"Query source did not return successfully",
					res.status,
					await res.text(),
				);
			}

			return await res.json();
		} catch (err) {
			this.handleError(err, "Error querying source");
		}
	}
}

export type {
	MicropubError,
	MicropubOptions,
	MicropubRequestInit,
	MicropubEndpointsReponse,
	MicropubPostCreateFormat,
};

export default Micropub;
export { Micropub };
