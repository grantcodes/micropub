# Micropub.js

A [micropub](https://micropub.net/) helper library for JavaScript.

## Usage

### Client side useage

Although this library is intended to be usable client side you will likely run into [CORS](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) issues so be careful about that.

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

You can directly retrieve and modify the options on an instantiated class with the `options` property:

```js
// Get the user domain
const me = micropub.options.me;

// Change the token
micropub.options.token = 'newtoken';
```

### Getting site endpoints

You can get the various endpoints for a website - either from headers or `link` tags.

It returns an object with `auth`, `token`, and `micropub` properties with the urls of the endpoints.

This method will also automatically set the endpoint options in the current instance so you can read `micropub.options.micropubEndpoint` etc.

```js
micropub
  .getEndpointsFromUrl('http://example.com')
  .then(endpoints => {
    const { auth, token, micropub } = endpoints;
  })
  .catch(err => console.log(err));
```

Note: This is also run by the `getAuthUrl` method so chances are you will not need to use this method.

### Getting authorization url

The first step is likely to be getting the authorization url to direct the user to.

```js
micropub
  .getAuthUrl()
  .then(url => {
    // You should probably store micropub.options.micropubEndpoint here
    // and then handle directing user to this url to authenticate
  })
  .catch(err => console.log(err));
```

Because this method also calls the `getEndpointsFromUrl` method the instance will also hold the found endpoints. You will probably want to store at least the micropub endpoint somehow.

### Exchange your code for an access token

The next step would be to exchange your code for an access token. You first need to initialize the library with the details you used to get the auth code and then pass the code to the auth token method:

```js
micropub
  .getToken('auth_code')
  .then(token => {
    // Here you will probably want to save the token for future use
  })
  .catch(err => console.log(err));
```

### Querying the micropub endpoint

Once you have your token, you can send queries to the micropub endpoint. The most likely queries are the `config` and `syndicate-to` query. The result is retrieved as an object.

```js
micropub
  .query('config')
  .then(res => {
    // Handle the result of the query
  })
  .catch(err => console.log(err));
```

#### Syndication targets

To receive the syndication targets for a site you can run:

```js
micropub
  .query('syndicate-to')
  .then(res => {
    const targets = res['syndicate-to'];
  })
  .catch(err => console.log(err));
```

#### The `source` query

If the micropub endpoint supports it you can query individual posts. Since it is slightly different to a basic query there is a different method to query about a post.

You can query all data on a post:

```js
micropub
  .querySource('post_url')
  .then(res => {
    // Handle the result
  })
  .catch(err => console.log(err));
```

Or you can specify certain properties you wish to query:

```js
micropub
  .querySource('post_url', ['content', 'category'])
  .then(res => {
    // Handle the result
  })
  .catch(err => console.log(err));
```

You can also query for lists of posts if your server supports it by passing an object to the `querySource` method:

```js
micropub
  .querySource({ 'post-type': 'note' })
  .then(res => {
    // Handle the result
  })
  .catch(err => console.log(err));
```

### Creating posts

You can run a create request with the microformats object for a post.

```js
micropub
  .create({
    type: ['h-entry'],
    properties: {
      content: ['This is a post'],
    },
  })
  .then(url => {
    // Returns the url of the created post on success
  })
  .catch(err => console.log(err));
```

You can also create posts using form or multipart encoding instead of the default json

#### Form encoded

```js
micropub
  .create(
    {
      h: 'entry',
      content: 'This is a post',
    },
    'form',
  )
  .then(url => {
    // Returns the url of the created post on success
  })
  .catch(err => console.log(err));
```

#### Multipart encoded

```js
micropub
  .create(
    {
      h: 'entry',
      content: 'This is a post',
    },
    'multipart',
  )
  .then(url => {
    // Returns the url of the created post on success
  })
  .catch(err => console.log(err));
```

Multipart encoding also has the benefit of being able to upload media files. On the frontend you can pass a `File` object to the appropriate property (e.g. `photo`). With node you can pass a readable stream, using `fs.createReadStream` for example.

### Deleting and undeleting posts

To send a request to delete or undelete a post just send run the appropriate method with the post url:

```js
micropub
  .delete('post_url')
  .then(res => {
    // Handle the result
  })
  .catch(err => console.log(err));

micropub
  .undelete('post_url')
  .then(res => {
    // Handle the result
  })
  .catch(err => console.log(err));
```

### Updating posts

Update requests require the url of the post and the update data:

```js
micropub
  .update('post_url', {
    replace: {
      content: ['replaced content'],
    },
  })
  .then(res => {
    // Handle the result
  })
  .catch(err => console.log(err));
```

See [https://www.w3.org/TR/micropub/#update](https://www.w3.org/TR/micropub/#update) for more details of the different types of update requests you can make.

### Posting to the media endpoint

In order to post to the media endpoint you must first discover it by querying the micropub endpoint. Then you can set the `mediaEndpoint` option and use the `postMedia` method to send a media file.

The file should either be passed as a `File` object using frontend JavaScript or a readable stream using node.

```js
micropub
  .query('config')
  .then(res => {
    if (res && res['media-endpoint']) {
      micropub.options.mediaEndpoint = res['media-endpoint'];
      micropub
        .postMedia(file)
        .then(url => {
          // Do something with the file url here
        })
        .catch(err => console.log(err));
    }
  })
  .catch(err => console.log(err));
```

### Error handling

As of version `1.2.0` error handling is greatly improved.

If there are any errors then the methods will reject with an object:

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

## Thanks

- [sknebel](https://github.com/sknebel) - For helping with the rel scraping function
- [Zegnat](https://github.com/Zegnat) - For helping with the rel scraping function
- [myfreeweb](https://github.com/myfreeweb) - For fixing Link header handling and help with Accept headers
- [00dani](https://github.com/00dani) - For fixing base tag support in the rel scraper
- [pstuifzand](https://github.com/pstuifzand) - For fixing form encoded arrays

## Links

- [Source code](https://github.com/grantcodes/micropub/)
- [Bug tracker](https://github.com/grantcodes/micropub/issues/)
