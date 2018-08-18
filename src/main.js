import * as dependencies from './dependencies';
import axios from 'axios';
const qsParse = dependencies.qsParse;
const relScraper = dependencies.relScraper;
const qsStringify = dependencies.qsStringify;
const objectToFormData = dependencies.objectToFormData;
const appendQueryString = dependencies.appendQueryString;
const linkHeaderParser = dependencies.li.parse;
if (dependencies.FormData && !global.FormData) {
  global.FormData = dependencies.FormData;
}
if (dependencies.DOMParser && !global.DOMParser) {
  global.DOMParser = dependencies.DOMParser;
}
if (dependencies.URL && !global.URL) {
  global.URL = dependencies.URL;
}

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
    for (var i = 0; i < requirements.length; i++) {
      const optionName = requirements[i];
      const option = this.options[optionName];
      if (!option) {
        pass = false;
        missing.push(optionName);
      }
    }
    return {
      pass: pass,
      missing: missing,
    };
  }

  /**
   * Get the various endpoints needed from the given url
   * @param  {string} url The url to scrape
   * @return {Promise}    Passes an object of endpoints on success: auth, token and micropub
   */
  getEndpointsFromUrl(url) {
    return new Promise((fulfill, reject) => {
      let endpoints = {
        micropub: null,
        authorization_endpoint: null,
        token_endpoint: null,
      };
      // Get the base url from the given url
      let baseUrl = url;
      // Fetch the given url
      axios({ url, method: 'get', responseType: 'text' })
        .then(res => {
          // Check for endpoints in headers
          const linkHeaders = res.headers.link;
          if (linkHeaders) {
            const links = linkHeaderParser(linkHeaders);
            Object.keys(endpoints).forEach(key => {
              if (links[key]) {
                endpoints[key] = links[key];
              }
            });
          }

          const html = res.data;

          // Get rel links
          const rels = relScraper(html, baseUrl);

          // Save necessary endpoints.
          this.options.me = url;
          if (rels) {
            Object.keys(endpoints).forEach(key => {
              if (rels[key] && rels[key][0]) {
                endpoints[key] = rels[key][0];
              }
            });
          }

          if (
            endpoints.micropub &&
            endpoints.authorization_endpoint &&
            endpoints.token_endpoint
          ) {
            this.options.micropubEndpoint = endpoints.micropub;
            this.options.tokenEndpoint = endpoints.token_endpoint;
            this.options.authEndpoint = endpoints.authorization_endpoint;
            return fulfill({
              auth: this.options.authEndpoint,
              token: this.options.tokenEndpoint,
              micropub: this.options.micropubEndpoint,
            });
          }

          return reject(micropubError('Error getting microformats data'));
        })
        .catch(err =>
          reject(micropubError('Error fetching url', err.response.status, err)),
        );
    });
  }

  /**
   * Exchanges a code for an access token
   * @param {string} code A code received from the auth endpoint
   * @return {promise} Promise which resolves with the access token on success
   */
  getToken(code) {
    return new Promise((fulfill, reject) => {
      const requirements = this.checkRequiredOptions([
        'me',
        'clientId',
        'redirectUri',
        'tokenEndpoint',
      ]);
      if (!requirements.pass) {
        return reject(
          micropubError(
            'Missing required options: ' + requirements.missing.join(', '),
          ),
        );
      }

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
      };
      // This could maybe use the postMicropub method
      axios(request)
        .then(res => {
          let result = res.data;
          // Parse the response from the indieauth server
          if (typeof result === 'string') {
            result = qsParse(result);
          }
          if (result.error_description) {
            return reject(micropubError(result.error_description));
          } else if (result.error) {
            return reject(micropubError(result.error));
          }
          if (!result.me || !result.scope || !result.access_token) {
            return reject(
              micropubError(
                'The token endpoint did not return the expected parameters',
              ),
            );
          }
          // Check me is the same (removing any trailing slashes)
          if (
            result.me &&
            result.me.replace(/\/+$/, '') !==
              this.options.me.replace(/\/+$/, '')
          ) {
            return reject(micropubError('The me values did not match'));
          }
          // Check scope matches (not reliable)
          // console.log(result.scope);
          // console.log(this.options.scope);
          // if (result.scope && result.scope !== this.options.scope) {
          //   reject('The scope values did not match');
          // }
          // Successfully got the token
          this.options.token = result.access_token;
          fulfill(result.access_token);
        })
        .catch(err =>
          reject(
            micropubError(
              'Error requesting token endpoint',
              err.response.status,
              err,
            ),
          ),
        );
    });
  }

  /**
   * Get the authentication url based on the set options
   * @return {string|boolean} The authentication url or false on missing options
   */
  getAuthUrl() {
    return new Promise((fulfill, reject) => {
      let requirements = this.checkRequiredOptions(['me', 'state']);
      if (!requirements.pass) {
        return reject(
          micropubError(
            'Missing required options: ' + requirements.missing.join(', '),
          ),
        );
      }
      this.getEndpointsFromUrl(this.options.me)
        .then(() => {
          let requirements = this.checkRequiredOptions([
            'me',
            'state',
            'scope',
            'clientId',
            'redirectUri',
          ]);
          if (!requirements.pass) {
            return reject(
              micropubError(
                'Missing required options: ' + requirements.missing.join(', '),
              ),
            );
          }
          const authParams = {
            me: this.options.me,
            client_id: this.options.clientId,
            redirect_uri: this.options.redirectUri,
            response_type: 'code',
            scope: this.options.scope,
            state: this.options.state,
          };

          fulfill(this.options.authEndpoint + '?' + qsStringify(authParams));
        })
        .catch(err =>
          reject(micropubError('Error getting auth url', null, err)),
        );
    });
  }

  /**
   * Verify the stored access token
   * @return {promise} A promise that resolves true or rejects
   */
  verifyToken() {
    return new Promise((fulfill, reject) => {
      const requirements = this.checkRequiredOptions([
        'token',
        'micropubEndpoint',
      ]);
      if (!requirements.pass) {
        return reject(
          micropubError(
            'Missing required options: ' + requirements.missing.join(', '),
          ),
        );
      }

      const request = {
        url: this.options.micropubEndpoint,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + this.options.token,
        },
      };

      axios(request)
        .then(res => {
          return fulfill(true);
        })
        .catch(err =>
          reject(
            micropubError('Error verifying token', err.response.status, err),
          ),
        );
    });
  }

  /**
   * Creates a micropub post
   * @param {object} post Micropub post data
   * @param {string} type The type of form encoding to use
   * @return {promise} Resolves on success with the url of the post or null if could not read the location header.
   */
  create(post, type = 'json') {
    return this.postMicropub(post, type);
  }

  /**
   * Updates a micropub post
   * @param {string} url The url of the post to update
   * @param {object} update The micropub update object
   * @return {promise} Resolves on success with the url of the post or null if could not read the location header.
   */
  update(url, update) {
    return this.postMicropub(
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
  delete(url) {
    return this.postMicropub({
      action: 'delete',
      url: url,
    });
  }

  /**
   * Undeletes a post
   * @param {string} url The url of a post to undelete
   *  @return {promise} Resolves on successful undeletion
   */
  undelete(url) {
    return this.postMicropub({
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
  postMicropub(object, type = 'json') {
    return new Promise((fulfill, reject) => {
      const requirements = this.checkRequiredOptions([
        'token',
        'micropubEndpoint',
      ]);
      if (!requirements.pass) {
        return reject(
          micropubError(
            'Missing required options: ' + requirements.missing.join(', '),
          ),
        );
      }

      let request = {
        url: this.options.micropubEndpoint,
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + this.options.token,
        },
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
        request.headers.accept =
          'application/json, application/x-www-form-urlencoded';
      }

      axios(request)
        .then(result => {
          if (result.headers.location) {
            return fulfill(result.headers.location);
          }
          if (typeof result.data === 'string') {
            result.data = qsParse(result.data);
          }
          if (result.data.error_description) {
            return reject(micropubError(result.data.error_description));
          } else if (result.data.error) {
            return reject(micropubError(result.data.error));
          } else {
            if (
              Object.keys(result.data).length === 0 &&
              result.data.constructor === Object
            ) {
              return fulfill(null);
            }
            return fulfill(result.data);
          }
        })
        .catch(err =>
          reject(
            micropubError('Error sending request', err.response.status, err),
          ),
        );
    });
  }

  /**
   * Posts a file to the media endpoint
   * @param {Buffer|ReadableStream} file The file to post
   * @return {promise} Resolves on success with the url of the created file, or null if could not read location
   */
  postMedia(file) {
    return new Promise((fulfill, reject) => {
      const requirements = this.checkRequiredOptions([
        'token',
        'mediaEndpoint',
      ]);
      if (!requirements.pass) {
        return reject(
          micropubError(
            'Missing required options: ' + requirements.missing.join(', '),
          ),
        );
      }

      let request = {
        url: this.options.mediaEndpoint,
        method: 'POST',
        data: objectToFormData({ file: file }),
        headers: {
          authorization: 'Bearer ' + this.options.token,
          accept: '*/*',
        },
      };

      axios(request)
        .then(res => {
          if (res.status !== 201) {
            return reject(micropubError('Error creating media', res.status));
          }
          const location = res.headers.location;
          if (location) {
            return fulfill(location);
          } else {
            return reject(
              micropubError(
                'Media endpoint did not return a location',
                res.status,
              ),
            );
          }
        })
        .catch(err =>
          reject(
            micropubError('Error sending request', err.response.status, err),
          ),
        );
    });
  }

  /**
   * Querys the micropub endpoint, for the config for example
   * @param {string} type The type passed the the micropub q parameter
   * @return {promise} Resolves with the object that the server replied with
   */
  query(type) {
    return new Promise((fulfill, reject) => {
      const requirements = this.checkRequiredOptions([
        'token',
        'micropubEndpoint',
      ]);
      if (!requirements.pass) {
        return reject(
          micropubError(
            'Missing required options: ' + requirements.missing.join(', '),
          ),
        );
      }

      const url = appendQueryString(this.options.micropubEndpoint, { q: type });

      const request = {
        url,
        method: 'GET',
        headers: {
          authorization: 'Bearer ' + this.options.token,
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          accept: 'application/json',
        },
      };

      axios(request)
        .then(res => fulfill(res.data))
        .catch(err =>
          reject(
            micropubError('Error getting ' + type, err.response.status, err),
          ),
        );
    });
  }

  /**
   * Query for the source of a post
   * @param {string} url The url of the post to query
   * @param {array} properties An array of properties to query for
   * @return {promise} A promise which resolves with the returned mf2 json / properties
   */
  querySource(url, properties = []) {
    return new Promise((fulfill, reject) => {
      const requirements = this.checkRequiredOptions([
        'token',
        'micropubEndpoint',
      ]);
      if (!requirements.pass) {
        return reject(
          micropubError(
            'Missing required options: ' + requirements.missing.join(', '),
          ),
        );
      }

      url = appendQueryString(this.options.micropubEndpoint, {
        q: 'source',
        url: url,
        properties: properties,
      });

      const request = {
        url,
        method: 'GET',
        headers: {
          authorization: 'Bearer ' + this.options.token,
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          accept: 'application/json',
        },
      };

      axios(request)
        .then(res => fulfill(res.data))
        .catch(err =>
          reject(
            micropubError('Error getting source', err.response.status, err),
          ),
        );
    });
  }
}

export default Micropub;
