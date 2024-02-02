import axios, { AxiosRequestConfig, AxiosError } from 'axios'
import { relParser } from 'rel-parser'
import { parse as qsParse, stringify as qsStringify } from 'qs'
import { objectToFormData } from './lib/object-to-form-data.js'
import { appendQueryString } from './lib/append-query-string.js'

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
  micropubEndpoint: '',
}

interface MicropubEndpointsReponse {
  [key: string]: string | null
  auth: string | null
  token: string | null
  micropub: string | null
}

// interface Expected

type MicropubPostCreateType = 'json' | 'form' | 'multipart'

type MicropubResponse = null | string | any

class MicropubError extends Error {
  status: number | null
  error: any

  constructor (message: string, status: number = 0, error: any = null) {
    super(message)
    this.name = 'MicropubError'
    this.status = status === 0 ? null : status
    this.error = error
  }
}

/**
 * A micropub helper class
 */
class Micropub {
  #options: MicropubOptions

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
  setOptions (options: Partial<MicropubOptions>) {
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
      if (!option) {
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
      // Fetch the given url
      const res = await axios({
        url,
        method: 'get',
        responseType: 'text',
        headers: {
          accept: 'text/html,application/xhtml+xml',
        },
        timeout: 30000,
      })

      // Get rel links
      const rels = await relParser(baseUrl, res.data, {
        ...(res.headers as any),
      })

      // Save necessary endpoints.
      this.setOptions({ me: url })

      const endpoints: MicropubEndpointsReponse = {
        micropub: rels?.micropub?.[0] ?? null,
        auth: rels?.authorization_endpoint?.[0] ?? null,
        token: rels?.token_endpoint?.[0] ?? null,
      }

      if (endpoints.micropub && endpoints.auth && endpoints.token) {
        this.setOptions({
          micropubEndpoint: endpoints.micropub,
          tokenEndpoint: endpoints.token,
          authEndpoint: endpoints.auth,
        })
        return endpoints
      }

      throw new MicropubError('Error getting required endpoints from url')
    } catch (err: any) {
      throw new MicropubError(
        'Error fetching url',
        err?.response?.status ?? 0,
        err,
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
      'tokenEndpoint',
    ])

    const { me, clientId, redirectUri, tokenEndpoint } = this.getOptions()

    try {
      const data = {
        grant_type: 'authorization_code',
        me,
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
      }

      const request: AxiosRequestConfig = {
        url: tokenEndpoint,
        method: 'POST',
        data: qsStringify(data),
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          accept: 'application/json, application/x-www-form-urlencoded',
        },
        timeout: 30000,
      }
      // This could maybe use the postMicropub method
      const res = await axios(request)
      let result = res.data
      // Parse the response from the indieauth server
      if (typeof result === 'string') {
        result = qsParse(result)
      }
      if (result.error_description) {
        throw new MicropubError(result.error_description)
      } else if (result.error) {
        throw new MicropubError(result.error)
      }
      if (!result.me || !result.scope || !result.access_token) {
        throw new MicropubError(
          'The token endpoint did not return the expected parameters',
        )
      }
      // Check "me" values have the same hostname
      const urlResult = new URL(result.me)
      const urlOptions = new URL(me)
      if (urlResult.hostname != urlOptions.hostname) {
        throw new MicropubError('The me values do not share the same hostname')
      }
      // Successfully got the token
      this.setOptions({ token: result.access_token })
      return result.access_token
    } catch (err: any | AxiosError) {
      throw new MicropubError(
        'Error requesting token endpoint',
        err?.response?.status ?? 0,
        err,
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
        'redirectUri',
      ])

      const { clientId, redirectUri, scope, state, authEndpoint } =
        this.getOptions()

      const authParams = {
        me,
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        state,
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
      const request: AxiosRequestConfig = {
        url: micropubEndpoint,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
        },
        timeout: 30000,
      }

      const res = await axios(request)
      if (res.status === 200) {
        return true
      }
      throw res
    } catch (err: AxiosError | any) {
      throw new MicropubError(
        'Error verifying token',
        err?.response?.status ?? 0,
        err,
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
    type: MicropubPostCreateType = 'json',
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
      url,
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
      url,
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
      url,
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
    type: MicropubPostCreateType = 'json',
  ): Promise<MicropubResponse> {
    this.checkRequiredOptions(['token', 'micropubEndpoint'])

    const { token, micropubEndpoint } = this.getOptions()

    try {
      const request: AxiosRequestConfig = {
        url: micropubEndpoint,
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + token,
        },
        timeout: 30000,
      }

      if (type == 'json') {
        request.data = JSON.stringify(object)
        request.headers['content-type'] = 'application/json'
      } else if (type == 'form') {
        request.data = qsStringify(object, { arrayFormat: 'brackets' })
        request.headers['content-type'] =
          'application/x-www-form-urlencoded;charset=UTF-8'
        request.headers.accept =
          'application/json, application/x-www-form-urlencoded'
      } else if (type == 'multipart') {
        request.data = objectToFormData(object)
        if (request.data.getHeaders) {
          request.headers = {
            ...request.headers,
            ...request.data.getHeaders(),
          }
        }
        request.headers.accept =
          'application/json, application/x-www-form-urlencoded'
      }

      const result = await axios(request)

      if (result.headers.location) {
        return result.headers.location
      }
      if (typeof result.data === 'string') {
        result.data = qsParse(result.data)
      }
      if (result.data.error_description) {
        throw result.data.error_description
      } else if (result.data.error) {
        throw result.data.error
      } else if (result.data.location) {
        return result.data.location
      } else {
        if (
          Object.keys(result.data).length === 0 &&
          result.data.constructor === Object
        ) {
          return null
        }
        return result.data
      }
    } catch (err: AxiosError | any) {
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

    try {
      const request: AxiosRequestConfig = {
        url: mediaEndpoint,
        method: 'POST',
        data: objectToFormData({ file }),
        headers: {
          accept: '*/*',
          authorization: 'Bearer ' + token,
          'content-type': 'multipart/form-data',
        },
        timeout: 60000,
      }

      if (request.data.getHeaders) {
        request.headers = {
          ...request.headers,
          ...request.data.getHeaders(),
        }
      }

      const res = await axios(request)
      if (res.status !== 201) {
        throw res
      }
      const location = res.headers.location
      if (location) {
        return location
      } else {
        throw 'Media endpoint did not return a location'
      }
    } catch (err: AxiosError | any) {
      throw new MicropubError(
        typeof err === 'string' ? err : 'Error creating media',
        err?.response?.status ?? 0,
        err,
      )
    }
  }

  /**
   * Querys the micropub endpoint, for the config for example
   * @param {string} type The type passed the the micropub q parameter
   * @return {promise} Resolves with the object that the server replied with
   */
  async query (type: string): Promise<MicropubResponse> {
    this.checkRequiredOptions(['token', 'micropubEndpoint'])

    const { token, micropubEndpoint } = this.getOptions()

    try {
      const url = appendQueryString(micropubEndpoint, {
        q: type,
      })

      const request: AxiosRequestConfig = {
        url,
        method: 'GET',
        headers: {
          authorization: 'Bearer ' + token,
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          accept: 'application/json',
        },
        timeout: 30000,
      }

      const res = await axios(request)
      return res.data
    } catch (err: AxiosError | any) {
      throw new MicropubError(
        'Error getting ' + type,
        err?.response?.status ?? 0,
        err,
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
    properties: string[] = [],
  ): Promise<MicropubResponse> {
    this.checkRequiredOptions(['token', 'micropubEndpoint'])

    const { token, micropubEndpoint } = this.getOptions()

    try {
      if (typeof url === 'object') {
        // Querying for a list of posts
        url = appendQueryString(micropubEndpoint, {
          q: 'source',
          ...url,
        })
      } else if (typeof url === 'string' && url) {
        // querying a single post
        url = appendQueryString(micropubEndpoint, {
          q: 'source',
          url,
          properties,
        })
      } else if (!url) {
        url = appendQueryString(micropubEndpoint, {
          q: 'source',
        })
      } else {
        throw { response: { status: 'Error with source query parameters' } }
      }
      const request: AxiosRequestConfig = {
        url,
        method: 'GET',
        headers: {
          authorization: 'Bearer ' + token,
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          accept: 'application/json',
        },
        timeout: 30000,
      }

      const res = await axios(request)
      return res.data
    } catch (err: AxiosError | any) {
      throw new MicropubError(
        'Error getting source',
        err?.response?.status ?? 0,
        err,
      )
    }
  }
}

export default Micropub
