function appendQueryString (url: string, queryVars: any): string {
  const firstSeperator = !url.includes('?') ? '?' : '&'
  const queryStringParts = []
  for (const key in queryVars) {
    if (Array.isArray(queryVars[key])) {
      for (const val of queryVars[key]) {
        queryStringParts.push(key + '[]=' + encodeURIComponent(val))
      }
    } else {
      queryStringParts.push(key + '=' + encodeURIComponent(queryVars[key]))
    }
  }
  const queryString = queryStringParts.join('&')
  return url + firstSeperator + queryString
}

export { appendQueryString }
