'use strict';

require('isomorphic-fetch');
const qs = require('qs');
const FormData = require('form-data');
// const Microformats = require('microformat-shiv');
const Microformats = require('microformat-node');
const objectToFormData = require('./lib/object-to-form-data');

const defaultSettings = {
  me: '',
  scope: 'post create delete update',
  token: '',
  authEndpoint: '',
  tokenEndpoint: '',
  micropubEndpoint: '',
};

class Micropub {
  constructor(userSettings = {}) {
    this.options = Object.assign(defaultSettings, userSettings);

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
    }
  }

  /**
   * Get the various endpoints needed from the given url
   * @param  {string} url The url to scrape
   * @return {Promise}    Passes an object of endpoints on success: auth, token and micropub
   */
  getEndpointsFromUrl(url) {
    return new Promise((fulfill, reject) => {
      // Fetch the given url
      fetch(url)
        .then((res) => res.text())
        .then((html) => {
          // Parse the microformats data
          Microformats.get({
            html: html,
          }, (err, mfData) => {
            if (err) {
              reject('Error parsing microformats data');
            }

            // Save necessary endpoints.
            if (mfData && mfData.rels && mfData.rels.authorization_endpoint && mfData.rels.token_endpoint && mfData.rels.micropub) {
              this.options.me = url;
              this.options.authEndpoint = mfData.rels.authorization_endpoint[0];
              this.options.tokenEndpoint = mfData.rels.token_endpoint[0];
              this.options.micropubEndpoint = mfData.rels.micropub[0];

              fulfill({
                auth: this.options.authEndpoint,
                token: this.options.tokenEndpoint,
                micropub: this.options.micropubEndpoint,
              });
            }

            reject('Error getting microformats data');
          });
        })
        .catch((err) => reject('Error fetching url'));
    });
  }

  getToken(code) {
    return new Promise((fulfill, reject) => {
      const requirements = this.checkRequiredOptions(['me', 'state', 'scope', 'clientId', 'redirectUri', 'tokenEndpoint']);
      if (!requirements.pass) {
        reject('Missing required options: ' + requirements.missing.join(', '));
      }

      const data = {
        grant_type: 'authorization_code',
        me: this.options.me,
        code: code,
        scope: this.options.scope,
        state: this.options.state,
        client_id: this.options.clientId,
        redirect_uri: this.options.redirectUri,
      };

      let form = new FormData();
      form.append('grant_type', 'authorization_code');
      form.append('me', this.options.me);
      form.append('code', code);
      form.append('scope', this.options.scope);
      form.append('state', this.options.state);
      form.append('client_id', this.options.clientId);
      form.append('redirect_uri', this.options.redirectUri);

      const request = {
        method: 'POST',
        body: form,
        // body: JSON.stringify(data),
        // headers: new Headers({
        //   'Content-Type': 'application/json',
        //   'Accept': 'application/json',
        // }),
        // mode: 'cors',
      };
      // This could maybe use the postMicropub method
      fetch(this.options.tokenEndpoint, request)
        .then((res) => {
          const contentType = res.headers.get('Content-Type');
          if (contentType.indexOf('application/json') === 0) {
            return res.json()
          } else {
            return res.text();
          }
        })
        .then((result) => {
          // Parse the response from the indieauth server
          if (typeof result === 'string') {
            result = qs.parse(result);
          }
          if (result.error_description) {
            reject(result.error_description);
          } else if (result.error) {
            reject(result.error);
          }
          if (!result.me || !result.scope || !result.access_token) {
            reject('The token endpoint did not return the expected parameters');
          }
          // Check me is the same (removing any trailing slashes)
          if (result.me && result.me.replace(/\/+$/, '') !== this.options.me.replace(/\/+$/, '')) {
            reject('The me values did not match');
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
        .catch((err) => reject('Error requesting token endpoint'));
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
        reject('Missing required options: ' + requirements.missing.join(', '));
      }
      this.getEndpointsFromUrl(this.options.me)
        .then(() => {
          let requirements = this.checkRequiredOptions(['me', 'state', 'scope', 'clientId', 'redirectUri']);
          if (!requirements.pass) {
            reject('Missing required options: ' + requirements.missing.join(', '));
          }
          const authParams = {
            me: this.options.me,
            client_id: this.options.clientId,
            redirect_uri: this.options.redirectUri,
            response_type: 'code',
            scope: this.options.scope,
            state: this.options.state,
          };

          fulfill(this.options.authEndpoint + '?' + qs.stringify(authParams));
        })
        .catch((err) => reject(err));
    });
  }

  create(post, type = 'json') {
    return this.postMicropub(post, type);
  }

  update(url, update) {
    return this.postMicropub(Object.assign({
      action: 'update',
      url: url,
    }, update));
  }

  delete(url) {
    return this.postMicropub({
      action: 'delete',
      url: url,
    })
  }

  undelete(url) {
    return this.postMicropub({
      action: 'undelete',
      url: url,
    })
  }

  postMicropub(object, type = 'json') {
    return new Promise((fulfill, reject) => {
      const requirements = this.checkRequiredOptions(['token', 'micropubEndpoint']);
      if (!requirements.pass) {
        reject('Missing required options: ' + requirements.missing.join(', '));
      }



      let request = {
        method: 'POST',
      };

      if (type == 'json') {
        request.body = JSON.stringify(object);
        request.headers = new Headers({
          'Authorization': 'Bearer ' + this.options.token,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        });
      } else if (type == 'form') {
        request.body = qs.stringify(object);
        request.headers = new Headers({
          'Authorization': 'Bearer ' + this.options.token,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': 'application/json',
        });
      } else if (type == 'multipart') {
        request.body = objectToFormData(object);
        request.headers = new Headers({
          'Authorization': 'Bearer ' + this.options.token,
          'Content-Type': undefined,
          'Accept': 'application/json',
        });
      }

      fetch(this.options.micropubEndpoint, request)
        .then((res) => {
          const location = res.headers.get('Location');
          if (location) {
            fulfill(location);
          }
          const contentType = res.headers.get('Content-Type');
          if (contentType.indexOf('application/json') === 0) {
            return res.json()
          } else {
            return res.text();
          }
        })
        .then((result) => {
          if (typeof result === 'string') {
            result = qs.parse(result);
          }
          if (result.error_description) {
            reject(result.error_description);
          } else if (result.error) {
            reject(result.error);
          } else {
            fulfill(result);
          }
        })
        .catch((err) => reject('Error sending request'));
    });
  }

  postMedia(file) {
    return new Promise((fulfill, reject) => {
      const requirements = this.checkRequiredOptions(['token', 'mediaEndpoint']);
      if (!requirements.pass) {
        reject('Missing required options: ' + requirements.missing.join(', '));
      }

      let request = {
        method: 'POST',
        body: objectToFormData({file: file}),
        headers: new Headers({
          'Authorization': 'Bearer ' + this.options.token,
          'Content-Type': undefined,
          'Accept': 'application/json',
        }),
      };

      fetch(this.options.mediaEndpoint, request)
        .then((res) => {
          const location = res.headers.get('Location');
          if (location) {
            fulfill(location);
          }
          const contentType = res.headers.get('Content-Type');
          if (contentType.indexOf('application/json') === 0) {
            return res.json()
          } else {
            return res.text();
          }
        })
        .then((result) => {
          if (typeof result === 'string') {
            result = qs.parse(result);
          }
          if (result.error_description) {
            reject(result.error_description);
          } else if (result.error) {
            reject(result.error);
          } else {
            fulfill(result);
          }
        })
        .catch((err) => reject('Error sending request'));
    });
  }

  query(type) {
    return new Promise((fulfill, reject) => {
      const requirements = this.checkRequiredOptions(['token', 'micropubEndpoint']);
      if (!requirements.pass) {
        reject('Missing required options: ' + requirements.missing.join(', '));
      }

      let url = this.options.micropubEndpoint.replace(/\/+$/, '');
      url += '?q=' + type;

      const request = {
        method: 'GET',
        headers: new Headers({
          'Authorization': 'Bearer ' + this.options.token,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': 'application/json',
        }),
        // mode: 'cors',
      };

      fetch(url, request)
        .then((res) => res.json())
        .then((json) => fulfill(json))
        .catch((err) => reject('Error getting ' + type));
    });
  }

  querySource(url, properties = []) {
    return new Promise((fulfill, reject) => {
      const requirements = this.checkRequiredOptions(['token', 'micropubEndpoint']);
      if (!requirements.pass) {
        reject('Missing required options: ' + requirements.missing.join(', '));
      }

      url = this.options.micropubEndpoint.replace(/\/+$/, '') + '?q=source&url=' + url;
      for (var i = 0; i < properties.length; i++) {
        url += '&properties[]=' + properties[i];
      }

      const request = {
        method: 'GET',
        headers: new Headers({
          'Authorization': 'Bearer ' + this.options.token,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': 'application/json',
        }),
        // mode: 'cors',
      };

      fetch(url, request)
        .then((res) => res.json())
        .then((json) => fulfill(json))
        .catch((err) => reject('Error getting source'));
    });
  }
}

module.exports = Micropub;
