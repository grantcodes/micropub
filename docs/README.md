# Micropub.js

A [micropub](https://micropub.net/) helper library for JavaScript.

## Usage

### Installation

```bash
npm install micropub-helper
```

or

```bash
yarn add micropub-helper
```

### Setup

The library is setup as an es6 class, and is initialized by passing an object of options. The minimum requirements are `clientId`, `redirectUri` and `me`.

```js
import Micropub from 'micropub-helper';
const micropub = new Micropub({
  clientId: 'https://mymicropubclientapp.com',
  redirectUri: 'https://mymicropubclientapp.com/indieauthhandler',
  me: 'https://userindiewebsite.com',
  state: 'This should be secret or randomly generated per user',
});
```

If you already have other information stored such as the token and micropub endpoint you want to use you can also pass those in. The available options are:

- `me` - The url of the user you are authenticating with
- `clientId` - The url of your micropub client
- `redirectUri` - The redirect url of your micropub client from indieauth. This is the page where you will get the code to exchange for an access token.
- `state` - A custom identifier to validate a response from the auth endpoint
- `scope` - The scope of the micropub client. Defaults to "post create delete update"
- `token` - The authorization token
- `authEndpoint` - The authorization endpoint
- `tokenEndpoint` - The token endpoint to receive the access toke from
- `micropubEndpoint` - The micropub endpoint
- `mediaEndpoint` - The media endpoint

You can get and set the options on an instantiated class with the `options` getters and setters:

```js
// Get the user domain
const { me } = micropub.options;

// Change the token
micropub.options = { token: 'newtoken' };
```

### Getting site endpoints

You can get the various endpoints for a website - either from headers or `link` tags.

It returns an object with `auth`, `token`, and `micropub` properties with the urls of the endpoints.

This method will also automatically set the endpoint options in the current instance so you can read `micropub.options.micropubEndpoint` etc.

```js
const { auth, token, micropub } = await micropub.getEndpointsFromUrl(
  'http://example.com',
);
```

Note: This is also run by the `getAuthUrl` method so chances are you will not need to use this method.

### Getting authorization url

The first step is likely to be getting the authorization url to direct the user to.

```js
const url = await micropub.getAuthUrl();
const { micropubEndpoint } = micropub.options;
// You should probably store micropubEndpoint here
// and then handle directing user to this url to authenticate
```

Because this method also calls the `getEndpointsFromUrl` method the instance will also hold the found endpoints. You will probably want to store at least the micropub endpoint somehow.

### Exchange your code for an access token

The next step would be to exchange your code for an access token. You first need to initialize the library with the details you used to get the auth code and then pass the code to the auth token method:

```js
const token = await micropub.getToken('auth_code');
// Here you will probably want to save the token for future use
```

### Querying the micropub endpoint

Once you have your token, you can send queries to the micropub endpoint. The most likely queries are the `config` and `syndicate-to` query. The result is retrieved as an object.

```js
const res = await micropub.query('config');
// Handle the result of the query
```

#### Syndication targets

To receive the syndication targets for a site you can run:

```js
const { targets: 'syndicate-to' } = await micropub.query('syndicate-to')
```

#### The `source` query

If the micropub endpoint supports it you can query individual posts. Since it is slightly different to a basic query there is a different method to query about a post.

You can query all data on a post:

```js
const res = await micropub.querySource('post_url');
```

Or you can specify certain properties you wish to query:

```js
const res = await micropub.querySource('post_url', ['content', 'category']);
```

You can also query for lists of posts if your server supports it by passing an object to the `querySource` method:

```js
const res = await micropub.querySource({ 'post-type': 'note' });
```

### Creating posts

You can run a create request with the microformats object for a post.

```js
const url = await micropub.create({
  type: ['h-entry'],
  properties: {
    content: ['This is a post'],
  },
});
```

You can also create posts using form or multipart encoding instead of the default json

#### Form encoded

```js
const url = await micropub.create(
  {
    h: 'entry',
    content: 'This is a post',
  },
  'form',
);
```

#### Multipart encoded

```js
const url = await micropub.create(
  {
    h: 'entry',
    content: 'This is a post',
  },
  'multipart',
);
```

Multipart encoding also has the benefit of being able to upload media files. On the frontend you can pass a `File` object to the appropriate property (e.g. `photo`). With node you can pass a readable stream, using `fs.createReadStream` for example.

### Deleting and undeleting posts

To send a request to delete or undelete a post just send run the appropriate method with the post url:

```js
const deleteRes = await micropub.delete('post_url');

const undeleteRes = await micropub.undelete('post_url');
```

### Updating posts

Update requests require the url of the post and the update data:

```js
const res = await micropub.update('post_url', {
  replace: {
    content: ['replaced content'],
  },
});
```

See [https://www.w3.org/TR/micropub/#update](https://www.w3.org/TR/micropub/#update) for more details of the different types of update requests you can make.

### Posting to the media endpoint

In order to post to the media endpoint you must first discover it by querying the micropub endpoint. Then you can set the `mediaEndpoint` option and use the `postMedia` method to send a media file.

The file should either be passed as a `File` or `Blob` object.

```js
const { mediaEndpoint: 'media-endpoint' } = await micropub.query('config')
if (mediaEndpoint) {
  micropub.options = { mediaEndpoint };
  const fileUrl = await micropub.postMedia(file)
}
```

### Error handling

If there are any errors then the methods will reject with a `MicropubError` class:

```js
{
  message: 'Human readable string',
  status: null or the http status code,
  error: null or further error information,
}
```

Generally if there is a `status` code that means the micropub endpoint returned an http error.
And if there is `error` then there was an error sending the request at your end.
This might not be 100% accurate as there are a lot of potential errors.

### Client side useage

Although this library is intended to be usable client side you will likely run into [CORS](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) issues so be careful about that.

If you really need to use micropub client side you have a couple of options:
1. If it's just for your own website, then setup all your services to allow cross-origin requests
2. If you expect others to use your micropub client you can setup a CORs proxy and extend the `Micropub` class to use the proxy:
    ```js
    class MicropubWithCorsProxy extends Micropub {
      constructor(options) {
        super(options)
      }

      getFetchUrl(url) {
        url = super.getFetchUrl(url)
        return `https://mycorsproxy.com/?${encodeURIComponent(url)}`
      }
    }
    ```

## Breaking Changes

### v2

The v2 version is a complete rewrite using typescript and native JavaScript fetch (instead of the axios library).

Usage of the library is very similar to the previous version with a couple of breaking changes:

- **Setting options**: In v2 there is an options setter, so instead of manually setting each property `micropub.options.token="token"` you must set it as an object eg. `micropub.options = { token: "token" }`. This is additive, it will not unset other options.
- **Return types**: In v2 the `create` method would return `true` if it was successful, but could not retrieve a url, now it will return an empty string.
- **Error class**: Instead of a error object, thrown errors are now a simple `MicropubError` objects which extend the default `Error`.
- **Media handling**: Media uploads are slightly changed to accept native `File` or `Buffer` objects (`File` is reccomended if possible.
- **Node.js version**: Version 20+ is required now.

## Thanks

- [sknebel](https://github.com/sknebel) - For helping with the rel scraping function
- [Zegnat](https://github.com/Zegnat) - For helping with the rel scraping function
- [myfreeweb](https://github.com/myfreeweb) - For fixing Link header handling and help with Accept headers
- [00dani](https://github.com/00dani) - For fixing base tag support in the rel scraper
- [pstuifzand](https://github.com/pstuifzand) - For fixing form encoded arrays

## Links

- [Source code](https://github.com/grantcodes/micropub/)
- [Bug tracker](https://github.com/grantcodes/micropub/issues/)
