const express = require('express')
const { isWebUri } = require('valid-url')
const logger = require('../logger')
const xss = require('xss');
const BookmarksService = require('./bookmarks-service')

const bookmarksRouter = express.Router()
const bodyParser = express.json()

const serializeBookmark = bookmark => ({
  id: bookmark.id,
  title: xss(bookmark.title),
  url: bookmark.url,
  description: xss(bookmark.description),
  rating: Number(bookmark.rating),
})

bookmarksRouter
  .route('/bookmarks')
  .get((req, res, next) => {
    BookmarksService.getAllBookmarks(req.app.get('db'))
      .then(bookmarks => {
        res.json(bookmarks.map(serializeBookmark))
      })
      .catch(next)
  })
  .post(bodyParser, (req, res, next) => {
    const knexInstance = req.app.get('db');
    const { title, url, description, rating } = req.body;
    const newBookmark = { title, url, description, rating }

    for (const field of ['title', 'url', 'rating']) {
      if (!req.body[field]) {
        logger.error(`${field} is required`)
        return res.status(400).send({
          error: { message: `'${field}' is required`}
        })
      }
    }

    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      logger.error(`Invalid rating '${rating}' supplied`)
      return res.status(400).send(`'rating' must be a number between 0 and 5`)
    }

    if (!isWebUri(url)) {
      logger.error(`Invalid url '${url}' supplied`)
      return res.status(400).send(`'url' must be a valid URL`)
    }

    BookmarksService.insertBookmark(knexInstance, newBookmark)
      .then(bookmark => {
        logger.info(`Bookmark with id ${bookmark.id} created`)
        res
          .status(201)
          .location(`/bookmarks/${bookmark.id}`)
          .json(serializeBookmark(bookmark))
      })
      .catch(next)
  })

bookmarksRouter
  .route('/bookmarks/:bookmark_id')
  .all((req, res, next) => {
    const knexInstance = req.get.app('db');
    BookmarksService.getById(knexInstance, req.params.bookmark_id)
      .then(bookmark => {
        if (!bookmark) {
          return res.status(404).json({
            error: { message: `Bookmark Not Found`}
          })
        }
        res.bookmark = bookmark
        next()
      })
      .catch(next)
  })
  .get((req, res, next) => {
    res.json(serializeBookmark(res.bookmark))
  })
  .delete((req, res, next) => {
    const knexInstance = req.app.get('db')
    BookmarksService.deleteBookmark(knexInstance, req.params.bookmark_id)
      .then(() => {
        res.status(204).end()
      })
      .catch(next)
  })
  
  
  
  
  
  
  
  
  
  
  
  
  // .get((req, res, next) => {
  //   const { bookmark_id } = req.params
  //   BookmarksService.getById(req.app.get('db'), bookmark_id)
  //     .then(bookmark => {
  //       if (!bookmark) {
  //         logger.error(`Bookmark with id ${bookmark_id} not found.`)
  //         return res.status(404).json({
  //           error: { message: `Bookmark Not Found` }
  //         })
  //       }
  //       res.json(serializeBookmark(bookmark))
  //     })
  //     .catch(next)
  // })
  // .delete((req, res, next) => {
  //   const knexInstance = req.get.app('db');
  //   BookmarksService.deleteBookmark(knexInstance, req.params.bookmark_id)
  //     .then(() => {
  //       res.status(204).end()
  //     })
  //     .catch(next)
      
  //   const { bookmark_id } = req.params

  //   if (bookmarkIndex === -1) {
  //     logger.error(`Bookmark with id ${bookmark_id} not found.`)
  //     return res
  //       .status(404)
  //       .send('Bookmark Not Found')
  //   }


  //   logger.info(`Bookmark with id ${bookmark_id} deleted.`)
  //   res
  //     .status(204)
  //     .end()
  // })

module.exports = bookmarksRouter