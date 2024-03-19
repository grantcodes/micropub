import { relParser } from 'rel-parser'
import { stringify as qsStringify } from 'qs'
import { MicropubError } from './lib/micropub-error.js'
import { objectToFormData } from './lib/object-to-form-data.js'
import { appendQueryString } from './lib/append-query-string.js'
import { getTimeoutAbortController } from './lib/get-timeout-abort-controller.js'

interface MicropubOptions {
  [key: string]: string | undefined
  me: string
  scope: string
  token: string
  authEndpoint: string
  tokenEndpoint: string
  micropubEndpoint: string
  mediaEndpoint?: string
  state?: string
  clientId?: string
  redirectUri?: string
}

const defaultSettings: MicropubOptions = {
  me: '',
  scope: 'create delete update',
  token: '',
  authEndpoint: '',
  tokenEndpoint: '',
  micropubEndpoint: ''
}

interface MicropubEndpointsReponse {
  [key: string]: string | null
  auth: string | null
  token: string | null
  micropub: string | null
}

// interface Expected

type MicropubPostCreateFormat = 'json' | 'form' | 'multipart'

// TODO: This response format should be better defined
type MicropubResponse = null | string | any

/**
 * A micropub helper class
 */
class Micropub {
  #options: MicropubOptions = defaultSettings

  /**
   * Micropub class constructor
   * @param {object} userSettings Settings supplied for this micropub client
   */
  constructor (userSettings: Partial<MicropubOptions> = {}) {
    this.setOptions({ ...defaultSettings, ...userSettings })
  }

  /**
   * Sets the options for the class
   * @param options Object of options to set.
   */
  setOptions (options: Partial<MicropubOptions>): void {
    this.#options = { ...this.#options, ...options }
  }

  /**
   * Get the options object
   * @returns {MicropubOptions} The options object
   */
  getOptions (): MicropubOptions {
    return { ...this.#options }
  }

  /**
   * Checks to see if the given options are set
   * @param  {array} requirements An array of option keys to check
   * @return {object}             An object with boolean pass property and array missing property listing missing options
   */
  checkRequiredOptions (requirements: string[]): true {
    const missing = []
    let pass = true
    for (const optionName of requirements) {
      const option = this.#options[optionName]
      if (typeof option === 'undefined' || option === null || option === '') {
        pass = false
        missing.push(optionName)
      }
    }

    if (!pass) {
      throw new MicropubError('Missing required options: ' + missing.join(', '))
    }

    return true
  }

  /**
   * Get the various endpoints needed from the given url
   * @param  {string} url The url to scrape
   * @return {Promise}    Passes an object of endpoints on success: auth, token and micropub
   */
  async getEndpointsFromUrl (url: string): Promise<MicropubEndpointsReponse> {
    try {
      // Get the base url from the given url
      const baseUrl = url
      const abortController = getTimeoutAbortController(30000)
      // Fetch the given url
      const res = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml'
        },
        method: 'GET',
        mode: 'cors',
        signal: abortController.signal
      })

      const resHtml = await res.text()

      // Get rel links
      const rels = await relParser(baseUrl, resHtml, {
        ...(res.headers as any)
      })

      // Save necessary endpoints.
      this.setOptions({ me: url })

      const endpoints: MicropubEndpointsReponse = {
        micropub: rels?.micropub?.[0] ?? null,
        auth: rels?.authorization_endpoint?.[0] ?? null,
        token: rels?.token_endpoint?.[0] ?? null
      }

      if (endpoints.micropub === null || endpoints.micropub === '') {
        throw new MicropubError('No micropub endpoint found')
      }

      if (endpoints.auth === null || endpoints.auth === '') {
        throw new MicropubError('No auth endpoint found')
      }

      if (endpoints.token === null || endpoints.token === '') {
        throw new MicropubError('No token endpoint found')
      }

      this.setOptions({
        micropubEndpoint: endpoints.micropub,
        tokenEndpoint: endpoints.token,
        authEndpoint: endpoints.auth
      })

      return endpoints
    } catch (err: any) {
      throw new MicropubError(
        'Error fetching url',
        err?.response?.status ?? 0,
        err
      )
    }
  }

  /**
   * Exchanges a code for an access token
   * @param {string} code A code received from the auth endpoint
   * @return {promise} Promise which resolves with the access token on success
   */
  async getToken (code: string): Promise<string> {
    this.checkRequiredOptions([
      'me',
      'clientId',
      'redirectUri',
      'tokenEndpoint'
    ])

    const { me, clientId, redirectUri, tokenEndpoint } = this.getOptions()

    try {
      const data = {
        grant_type: 'authorization_code',
        me,
        code,
        client_id: clientId,
        redirect_uri: redirectUri
      }

      const abortController = getTimeoutAbortController(30000)

      const request: RequestInit = {
        method: 'POST',
        body: qsStringify(data),
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          accept: 'application/json'
        },
        signal: abortController.signal
      }
      // This could maybe use the postMicropub method
      const res = await fetch(tokenEndpoint, request)

      interface GetTokenSuccessResponse {
        access_token: string
        me: string
        scope: string
        expires_in?: number
        refresh_token?: string
        profile?: {
          name?: string
          url?: string
          photo?: string
          email?: string
        }
      }

      const result = await res.json() as GetTokenSuccessResponse

      if (typeof result.me === 'undefined' || result.me === '') {
        throw new MicropubError('The token endpoint did not return a "me" value')
      }

      if (typeof result.scope === 'undefined' || result.scope === '') {
        throw new MicropubError('The token endpoint did not return a "scope" value')
      }

      if (typeof result.access_token === 'undefined' || result.access_token === '') {
        throw new MicropubError('The token endpoint did not return an "access_token" value')
      }

      // Check "me" values have the same hostname
      const urlResult = new URL(result.me)
      const urlOptions = new URL(me)
      if (urlResult.hostname !== urlOptions.hostname) {
        throw new MicropubError('The me values do not share the same hostname')
      }
      // Successfully got the token
      this.setOptions({ token: result.access_token })
      return result.access_token
    } catch (err: any | Error) {
      throw new MicropubError(
        'Error requesting token endpoint',
        err?.response?.status ?? 0,
        err
      )
    }
  }

  /**
   * Get the authentication url based on the set options
   * @return {string|boolean} The authentication url or false on missing options
   */
  async getAuthUrl (): Promise<string> {
    this.checkRequiredOptions(['me', 'state'])
    try {
      const { me } = this.getOptions()
      await this.getEndpointsFromUrl(me)

      this.checkRequiredOptions([
        'me',
        'state',
        'scope',
        'clientId',
        'redirectUri'
      ])

      const { clientId, redirectUri, scope, state, authEndpoint } =
        this.getOptions()

      const authParams = {
        me,
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        state
      }

      return appendQueryString(authEndpoint, authParams)
    } catch (err) {
      throw new MicropubError('Error getting auth url', 0, err)
    }
  }

  /**
   * Verify the stored access token
   * @return {promise} A promise that resolves true or rejects
   */
  async verifyToken (): Promise<boolean> {
    this.checkRequiredOptions(['token', 'micropubEndpoint'])

    const { token, micropubEndpoint } = this.getOptions()

    try {
      const abortController = getTimeoutAbortController(30000)
      const request: RequestInit = {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token
        },
        signal: abortController.signal
      }

      const res = await fetch(micropubEndpoint, request)

      if (res.ok) {
        return true
      }

      throw new MicropubError('Token verification failed', res.status)
    } catch (err: Error | any) {
      throw new MicropubError(
        'Error verifying token',
        err?.response?.status ?? 0,
        err
      )
    }
  }

  /**
   * Creates a micropub post
   * @param {object} post Micropub post data
   * @param {string} type The type of form encoding to use
   * @return {promise} Resolves on success with the url of the post or null if could not read the location header.
   */
  async create (
    post: any,
    type: MicropubPostCreateFormat = 'json'
  ): Promise<MicropubResponse> {
    return await this.postMicropub(post, type)
  }

  /**
   * Updates a micropub post
   * @param {string} url The url of the post to update
   * @param {object} update The micropub update object
   * @return {promise} Resolves on success with the url of the post or null if could not read the location header.
   */
  async update (url: string, update: any): Promise<MicropubResponse> {
    return await this.postMicropub({
      ...update,
      action: 'update',
      url
    })
  }

  /**
   * Deletes a micropub post
   * @param {string} url The url of a post to delete
   * @return {promise} Resolves on successful deletion
   */
  async delete (url: string): Promise<MicropubResponse> {
    return await this.postMicropub({
      action: 'delete',
      url
    })
  }

  /**
   * Undeletes a post
   * @param {string} url The url of a post to undelete
   *  @return {promise} Resolves on successful undeletion
   */
  async undelete (url: string): Promise<MicropubResponse> {
    return await this.postMicropub({
      action: 'undelete',
      url
    })
  }

  /**
   * Posts a micropub object
   * @param {object} object A micropub post
   * @param {string} type The type of form encoding for the post
   * @return {promise} Resolves with the returned location header or null on success
   */
  async postMicropub (
    object: any,
    format: MicropubPostCreateFormat = 'json'
  ): Promise<MicropubResponse> {
    this.checkRequiredOptions(['token', 'micropubEndpoint'])

    const { token, micropubEndpoint } = this.getOptions()

    try {
      const abortController = getTimeoutAbortController(30000)
      const request: RequestInit = {
        method: 'POST',
        signal: abortController.signal
      }
      const requestHeaders = new Headers({
        authorization: 'Bearer ' + token
      })

      if (format === 'json') {
        request.body = JSON.stringify(object)
        requestHeaders.set('Content-Type', 'application/json')
      } else if (format === 'form') {
        request.body = qsStringify(object, { arrayFormat: 'brackets' })
        requestHeaders.set('Content-Type',
          'application/x-www-form-urlencoded;charset=UTF-8')
        requestHeaders.set('Accept',
          'application/json, application/x-www-form-urlencoded')
      } else if (format === 'multipart') {
        request.body = objectToFormData(object)
        requestHeaders.set('Accept',
          'application/json, application/x-www-form-urlencoded')
      }

      request.headers = requestHeaders

      const result = await fetch(micropubEndpoint, request)

      // Check for a location header.
      const location = result.headers.get('location')
      if (location !== null && location !== '') {
        return location
      }

      if (result.ok) {
        return true
      }

      throw new MicropubError('Micropub endpoint did not return a location header')
    } catch (err: Error | any) {
      let message = 'Error sending request'
      if (typeof err === 'string') {
        message = err
      }
      throw new MicropubError(message, err?.response?.status ?? 0, err)
    }
  }

  /**
   * Posts a file to the media endpoint
   * @param {Blob} file The file to post
   * @return {promise} Resolves on success with the url of the created file, or null if could not read location
   */
  async postMedia (file: Blob): Promise<MicropubResponse> {
    this.checkRequiredOptions(['token', 'mediaEndpoint'])

    const { token, mediaEndpoint } = this.getOptions()

    if (typeof mediaEndpoint === 'undefined' || mediaEndpoint === '') {
      throw new MicropubError('No media endpoint set')
    }

    try {
      const abortController = getTimeoutAbortController(60000)
      const request: RequestInit = {
        method: 'POST',
        body: objectToFormData({ file }),
        headers: {
          accept: '*/*',
          authorization: 'Bearer ' + token
        },
        signal: abortController.signal
      }

      const res = await fetch(mediaEndpoint, request)

      if (!res.ok) {
        throw new MicropubError('Media endpoint returned an error', res.status)
      }

      const location = res.headers.get('location')

      if (location !== null && location !== '') {
        return location
      } else {
        throw new MicropubError('Media endpoint did not return a location', res.status)
      }
    } catch (err: Error | any) {
      throw new MicropubError(
        'Error creating media',
        err?.response?.status ?? 0,
        err
      )
    }
  }

  /**
   * Querys the micropub endpoint, for the config for example
   * @param {string} queryType The queryType passed the the micropub q parameter
   * @return {promise} Resolves with the object that the server replied with
   */
  async query (queryType: string): Promise<MicropubResponse> {
    this.checkRequiredOptions(['token', 'micropubEndpoint'])

    const { token, micropubEndpoint } = this.getOptions()

    try {
      const url = appendQueryString(micropubEndpoint, {
        q: queryType
      })

      const abortController = getTimeoutAbortController(30000)

      const request: RequestInit = {
        method: 'GET',
        headers: {
          authorization: 'Bearer ' + token,
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          accept: 'application/json'
        },
        signal: abortController.signal
      }

      const res = await fetch(url, request)

      if (!res.ok) {
        throw new MicropubError('Query did not return successfully', res.status, await res.text())
      }

      return await res.json()
    } catch (err: Error | any) {
      throw new MicropubError(
        'Error getting ' + queryType,
        err?.response?.status ?? 0,
        err
      )
    }
  }

  /**
   * Query for the source of a post
   * @param {string|object} url The url of the post to query or an object of query variables to get a list of posts
   * @param {array} properties An array of properties to query for
   * @return {promise} A promise which resolves with the returned mf2 json / properties
   */
  async querySource (
    url?: string | object,
    properties: string[] = []
  ): Promise<MicropubResponse> {
    this.checkRequiredOptions(['token', 'micropubEndpoint'])

    const { token, micropubEndpoint } = this.getOptions()

    try {
      if (typeof url === 'object') {
        // Querying for a list of posts
        url = appendQueryString(micropubEndpoint, {
          q: 'source',
          ...url
        })
      } else if (typeof url === 'string' && url !== '') {
        // querying a single post
        url = appendQueryString(micropubEndpoint, {
          q: 'source',
          url,
          properties
        })
      } else if (typeof url === 'undefined' || url === '') {
        // If no urls is set then use the micropub endpoint
        url = appendQueryString(micropubEndpoint, {
          q: 'source'
        })
      } else {
        throw new MicropubError('Unsupported source query parameters')
      }
      const abortController = getTimeoutAbortController(30000)
      const request: RequestInit = {
        method: 'GET',
        headers: {
          authorization: 'Bearer ' + token,
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          accept: 'application/json'
        },
        signal: abortController.signal
      }

      const res = await fetch(url, request)

      if (!res.ok) {
        throw new MicropubError('Query source did not return successfully', res.status, await res.text())
      }

      return await res.json()
    } catch (err: Error | any) {
      throw new MicropubError(
        'Error getting source',
        err?.response?.status ?? 0,
        err
      )
    }
  }
}

export default Micropub
export { Micropub }
