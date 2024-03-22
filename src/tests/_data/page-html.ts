const pageHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Test Micropub Site</title>
      <link rel="micropub" href="http://localhost:3313/micropub" />
      <link rel="microsub" href="http://localhost:3313/microsub" />
      <link rel="authorization_endpoint" href="http://localhost:3313/auth" />
      <link rel="token_endpoint" href="http://localhost:3313/token" />
    </head>
    <body>
      <h1>Test Micropub Site</h1>
    </body> 
  </html>
`

export { pageHtml }
