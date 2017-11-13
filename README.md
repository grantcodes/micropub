# Micropub.js

A [micropub](https://micropub.net/) helper library for JavaScript.

## Usage

### Client side useage

Although this library is intended to be usable client side you will likely run into [CORS](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) issues so be careful about that.

### Setup

The library is setup as an es6 class, and is initalized by passinging an object of options. The minimum requirements are `clientId`, `redirectUri` and `me`.

```js
import Micropub from 'micropub';
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
- `micropubEndpoint` - The micropub enpoint

### Getting authorization url

The first step is likely to be getting the authorization url to direct the user to.

```js
micropub.getAuthUrl()
  .then((url) => {
    // Handle directing user to this url to authenticate
  })
  .catch((err) => console.log(err));
```

### Exchange your code for an access token

The next step would be to exchange your code for an access token. You first need to initialize the library with the details you used to get the auth code and then pass the code to the auth token method:

```js
micropub.getToken('auth_code')
  .then(token => {
    // Here you will probably want to save the token for future use
  })
  .catch(err => console.log(err));
```

### Querying the micropub endpoint

Once you have your token, you can send queries to the micropub endpoint. The most likely queries are the `config` and `syndicate-to` query. The result is retreived as an object.

```js
micropub.query('config')
  .then((res) => {
    // Handle the result of the query
  })
  .catch((err) => console.log(err));
```

#### The `source` query

If the micropub endpoint supports it you can query individual posts. Since it is slighty different to a basic query there is a different method to query about a post.

You can query all data on a post:

```js
micropub.querySource('post_url')
  .then((res) => {
    // Handle the result
  })
  .catch((err) => console.log(err));
```

Or you can specify certain properties you wish to query:

```js
micropub.querySource('post_url', ['content', 'category'])
  .then((res) => {
    // Handle the result
  })
  .catch((err) => console.log(err));
```

### Creating posts

You can run a create request with the microformats object for a post.

```js
micropub.create({
  type: ['h-entry'],
  properties: {
    content: ['This is a post'],
  }
})
  .then((url) => {
    // Returns the url of the created post on success
  })
  .catch((err) => console.log(err));
```

### Deleting and undeleting posts

To send a request to delete or undelete a post just send run the appropriate method with the post url:

```js
micropub.delete('post_url')
  .then((res) => {
    // Handle the result
  })
  .catch((err) => console.log(err));

micropub.undelete('post_url')
  .then((res) => {
    // Handle the result
  })
  .catch((err) => console.log(err));
```

### Updating posts

Update requests require the url of the post and the update data:

```js
micropub.update('post_url', {
  replace: {
    content: ['replaced content'],
  }
})
  .then((res) => {
    // Handle the result
  })
  .catch((err) => console.log(err));
```

### Error handling

As of version `1.2.0` error handling is greatly improved.

If there are any errors you catch will come in an object: 

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
