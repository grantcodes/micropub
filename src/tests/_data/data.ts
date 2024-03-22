import endpoints from './endpoints.js'
import micropubConfig from './micropub-config.js'
import note from './note.js'
import article from './article.js'
import { pageHtml } from './page-html.js'

export const data = {
  endpoints,
  micropubConfig,
  mf2: {
    note,
    article,
    list: [note, article]
  },
  token: 'token',
  fileUrl: 'http://localhost:3313/media/image.jpg',
  pageHtml
}
