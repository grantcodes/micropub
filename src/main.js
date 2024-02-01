const axios = require('axios');
const relScraper = require('rel-parser');
const { parse: qsParse, stringify: qsStringify } = require('qs');
const objectToFormData = require('./lib/object-to-form-data');
const appendQueryString = require('./lib/append-query-string');

const defaultSettings = {
  me: '',
  scope: 'create delete update',
  token: '',
  authEndpoint: '',
  tokenEndpoint: '',
  micropubEndpoint: '',
};

/**
 * Creates an error object
 * @param {string} message A human readable error message
 * @param {int} status A http response status from the micropub endpoint
 * @param {object} error A full error object if available
 * @return {object} A consistently formatted error object
 */
const micropubError = (message, status = null, error = null) => {
  return {
    message: message,
    status: status,
    error: error,
  };
};

/**
 * A micropub helper class
 */
class Micropub {
  /**
   * Micropub class constructor
   * @param {object} userSettings Settings supplied for this micropub client
   */
  constructor(userSettings = {}) {
    this.options = Object.assign({}, defaultSettings, userSettings);

    // Bind all the things
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
    this.undelete = this.undelete.bind(this);
    this.postMicropub = this.postMicropub.bind(this);
    this.checkRequiredOptions = this.checkRequiredOptions.bind(this);
    this.getAuthUrl = this.getAuthUrl.bind(this);
    this.getEndpointsFromUrl = this.getEndpointsFromUrl.bind(this);
  }

  /**
   * Checks to see if the given options are set
   * @param  {array} requirements An array of option keys to check
   * @return {object}             An object with boolean pass property and array missing property listing missing options
   */
  checkRequiredOptions(requirements) {
    let missing = [];
    let pass = true;
    for (const optionName of requirements) {
      const option = this.options[optionName];
      if (!option) {
        pass = false;
        missing.push(optionName);
      }
    }

    if (!pass) {
      throw micropubError('Missing required options: ' + missing.join(', '));
    }

    return true;
  }

  /**
   * Get the various endpoints needed from the given url
   * @param  {string} url The url to scrape
   * @return {Promise}    Passes an object of endpoints on success: auth, token and micropub
   */
  async getEndpointsFromUrl(url) {
    try {
      let endpoints = {
        micropub: null,
        authorization_endpoint: null,
        token_endpoint: null,
      };
      // Get the base url from the given url
      let baseUrl = url;
      // Fetch the given url
      const res = await axios({
        url,
        method: 'get',
        responseType: 'text',
        headers: {
          accept: 'text/html,application/xhtml+xml',
        },
        timeout: 30000,
      });
      // Get rel links
      const rels = await relScraper(baseUrl, res.data, res.headers);

      // Save necessary endpoints.
      this.options.me = url;
      if (rels) {
        for (const key of Object.keys(endpoints)) {
          if (rels[key] && rels[key][0]) {
            endpoints[key] = rels[key][0];
          }
        }
      }

      if (
        endpoints.micropub &&
        endpoints.authorization_endpoint &&
        endpoints.token_endpoint
      ) {
        this.options.micropubEndpoint = endpoints.micropub;
        this.options.tokenEndpoint = endpoints.token_endpoint;
        this.options.authEndpoint = endpoints.authorization_endpoint;
        return {
          auth: this.options.authEndpoint,
          token: this.options.tokenEndpoint,
          micropub: this.options.micropubEndpoint,
        };
      }

      throw micropubError('Error getting microformats data');
    } catch (err) {
      throw micropubError(
        'Error fetching url',
        err && err.response ? err.response.status : null,
        err,
      );
    }
  }

  /**
   * Exchanges a code for an access token
   * @param {string} code A code received from the auth endpoint
   * @return {promise} Promise which resolves with the access token on success
   */
  async getToken(code) {
    this.checkRequiredOptions([
      'me',
      'clientId',
      'redirectUri',
      'tokenEndpoint',
    ]);

    try {
      const data = {
        grant_type: 'authorization_code',
        me: this.options.me,
        code: code,
        client_id: this.options.clientId,
        redirect_uri: this.options.redirectUri,
      };

      const request = {
        url: this.options.tokenEndpoint,
        method: 'POST',
        data: qsStringify(data),
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          accept: 'application/json, application/x-www-form-urlencoded',
        },
        timeout: 30000,
      };
      // This could maybe use the postMicropub method
      const res = await axios(request);
      let result = res.data;
      // Parse the response from the indieauth server
      if (typeof result === 'string') {
        result = qsParse(result);
      }
      if (result.error_description) {
        throw micropubError(result.error_description);
      } else if (result.error) {
        throw micropubError(result.error);
      }
      if (!result.me || !result.scope || !result.access_token) {
        throw micropubError(
          'The token endpoint did not return the expected parameters',
        );
      }
      // Check "me" values have the same hostname
      let urlResult = new URL(result.me);
      let urlOptions = new URL(this.options.me);
      if (urlResult.hostname != urlOptions.hostname) {
        throw micropubError('The me values do not share the same hostname');
      }
      // Successfully got the token
      this.options.token = result.access_token;
      return result.access_token;
    } catch (err) {
      throw micropubError(
        'Error requesting token endpoint',
        err && err.response ? err.response.status : null,
        err,
      );
    }
  }

  /**
   * Get the authentication url based on the set options
   * @return {string|boolean} The authentication url or false on missing options
   */
  async getAuthUrl() {
    this.checkRequiredOptions(['me', 'state']);
    try {
      await this.getEndpointsFromUrl(this.options.me);

      this.checkRequiredOptions([
        'me',
        'state',
        'scope',
        'clientId',
        'redirectUri',
      ]);

      const authParams = {
        me: this.options.me,
        client_id: this.options.clientId,
        redirect_uri: this.options.redirectUri,
        response_type: 'code',
        scope: this.options.scope,
        state: this.options.state,
      };

      return appendQueryString(this.options.authEndpoint, authParams);
    } catch (err) {
      throw micropubError('Error getting auth url', null, err);
    }
  }

  /**
   * Verify the stored access token
   * @return {promise} A promise that resolves true or rejects
   */
  async verifyToken() {
    this.checkRequiredOptions(['token', 'micropubEndpoint']);

    try {
      const request = {
        url: this.options.micropubEndpoint,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + this.options.token,
        },
        timeout: 30000,
      };

      const res = await axios(request);
      if (res.status === 200) {
        return true;
      }
      throw res;
    } catch (err) {
      throw micropubError(
        'Error verifying token',
        err && err.response ? err.response.status : null,
        err,
      );
    }
  }

  /**
   * Creates a micropub post
   * @param {object} post Micropub post data
   * @param {string} type The type of form encoding to use
   * @return {promise} Resolves on success with the url of the post or null if could not read the location header.
   */
  async create(post, type = 'json') {
    return await this.postMicropub(post, type);
  }

  /**
   * Updates a micropub post
   * @param {string} url The url of the post to update
   * @param {object} update The micropub update object
   * @return {promise} Resolves on success with the url of the post or null if could not read the location header.
   */
  async update(url, update) {
    return await this.postMicropub(
      Object.assign(
        {
          action: 'update',
          url: url,
        },
        update,
      ),
    );
  }

  /**
   * Deletes a micropub post
   * @param {string} url The url of a post to delete
   * @return {promise} Resolves on successful deletion
   */
  async delete(url) {
    return await this.postMicropub({
      action: 'delete',
      url: url,
    });
  }

  /**
   * Undeletes a post
   * @param {string} url The url of a post to undelete
   *  @return {promise} Resolves on successful undeletion
   */
  async undelete(url) {
    return await this.postMicropub({
      action: 'undelete',
      url: url,
    });
  }

  /**
   * Posts a micropub object
   * @param {object} object A micropub post
   * @param {string} type The type of form encoding for the post
   * @return {promise} Resolves with the returned location header or null on success
   */
  async postMicropub(object, type = 'json') {
    this.checkRequiredOptions(['token', 'micropubEndpoint']);

    try {
      let request = {
        url: this.options.micropubEndpoint,
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + this.options.token,
        },
        timeout: 30000,
      };

      if (type == 'json') {
        request.data = JSON.stringify(object);
        request.headers['content-type'] = 'application/json';
      } else if (type == 'form') {
        request.data = qsStringify(object, { arrayFormat: 'brackets' });
        request.headers['content-type'] =
          'application/x-www-form-urlencoded;charset=UTF-8';
        request.headers.accept =
          'application/json, application/x-www-form-urlencoded';
      } else if (type == 'multipart') {
        request.data = objectToFormData(object);
        if (request.data.getHeaders) {
          request.headers = Object.assign(
            {},
            request.headers,
            request.data.getHeaders(),
          );
        }
        request.headers.accept =
          'application/json, application/x-www-form-urlencoded';
      }

      const result = await axios(request);

      if (result.headers.location) {
        return result.headers.location;
      }
      if (typeof result.data === 'string') {
        result.data = qsParse(result.data);
      }
      if (result.data.error_description) {
        throw result.data.error_description;
      } else if (result.data.error) {
        throw result.data.error;
      } else if (result.data.location) {
        return result.data.location;
      } else {
        if (
          Object.keys(result.data).length === 0 &&
          result.data.constructor === Object
        ) {
          return null;
        }
        return result.data;
      }
    } catch (err) {
      let message = 'Error sending request';
      if (typeof err === 'string') {
        message = err;
      }
      throw micropubError(
        message,
        err && err.response ? err.response.status : null,
        err,
      );
    }
  }

  /**
   * Posts a file to the media endpoint
   * @param {Buffer|ReadableStream} file The file to post
   * @return {promise} Resolves on success with the url of the created file, or null if could not read location
   */
  async postMedia(file) {
    this.checkRequiredOptions(['token', 'mediaEndpoint']);

    try {
      let request = {
        url: this.options.mediaEndpoint,
        method: 'POST',
        data: objectToFormData({ file }),
        headers: {
          authorization: 'Bearer ' + this.options.token,
          accept: '*/*',
        },
        timeout: 60000,
      };

      if (request.data.getHeaders) {
        request.headers = Object.assign(
          {},
          request.headers,
          request.data.getHeaders(),
        );
      }

      const res = await axios(request);
      if (res.status !== 201) {
        throw res;
      }
      const location = res.headers.location;
      if (location) {
        return location;
      } else {
        throw 'Media endpoint did not return a location';
      }
    } catch (err) {
      throw micropubError(
        typeof err === 'string' ? err : 'Error creating media',
        err && err.response ? err.response.status : null,
        err,
      );
    }
  }

  /**
   * Querys the micropub endpoint, for the config for example
   * @param {string} type The type passed the the micropub q parameter
   * @return {promise} Resolves with the object that the server replied with
   */
  async query(type) {
    this.checkRequiredOptions(['token', 'micropubEndpoint']);

    try {
      const url = appendQueryString(this.options.micropubEndpoint, { q: type });

      const request = {
        url,
        method: 'GET',
        headers: {
          authorization: 'Bearer ' + this.options.token,
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          accept: 'application/json',
        },
        timeout: 30000,
      };

      const res = await axios(request);
      return res.data;
    } catch (err) {
      throw micropubError(
        'Error getting ' + type,
        err && err.response ? err.response.status : null,
        err,
      );
    }
  }

  /**
   * Query for the source of a post
   * @param {string|object} url The url of the post to query or an object of query variables to get a list of posts
   * @param {array} properties An array of properties to query for
   * @return {promise} A promise which resolves with the returned mf2 json / properties
   */
  async querySource(url, properties = []) {
    this.checkRequiredOptions(['token', 'micropubEndpoint']);

    try {
      if (typeof url === 'object') {
        // Querying for a list of posts
        url = appendQueryString(this.options.micropubEndpoint, {
          q: 'source',
          ...url,
        });
      } else if (typeof url === 'string' && url) {
        // querying a single post
        url = appendQueryString(this.options.micropubEndpoint, {
          q: 'source',
          url,
          properties,
        });
      } else if (!url) {
        url = appendQueryString(this.options.micropubEndpoint, {
          q: 'source',
        });
      } else {
        throw { response: { status: 'Error with source query parameters' } };
      }
      const request = {
        url,
        method: 'GET',
        headers: {
          authorization: 'Bearer ' + this.options.token,
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          accept: 'application/json',
        },
        timeout: 30000,
      };

      const res = await axios(request);
      return res.data;
    } catch (err) {
      throw micropubError(
        'Error getting source',
        err && err.response ? err.response.status : null,
        err,
      );
    }
  }
}

module.exports = Micropub;
