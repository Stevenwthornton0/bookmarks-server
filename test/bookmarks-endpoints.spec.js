require('dotenv').config();
const { expect } = require('chai');
const knex = require('knex');
const app = require('../src/app');
const { makeBookmarksArray, makeMaliciousBookmark } = require('./bookmarks-fixtures');


describe('Bookmarks Endpoints', () => {
  let db;

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    })
    app.set('db', db)
  })

  after('disconnect from db', () => db.destroy())

  before('cleanup', () => db('bookmarks').truncate())

  afterEach('cleanup', () => db('bookmarks').truncate())

  describe(`Unauthorized requests`, () => {
    it(`responds with 401 Unauthorized for GET /bookmarks`, () => {
      return supertest(app)
        .get('/bookmarks')
        .expect(401, { error: 'Unauthorized request' })
    })

    it(`responds with 401 Unauthorized for POST /bookmarks`, () => {
      return supertest(app)
        .post('/bookmarks')
        .send({ title: 'test-title', url: 'http://some.thing.com', rating: 1 })
        .expect(401, { error: 'Unauthorized request' })
    })

    it(`responds with 401 Unauthorized for GET /bookmarks/:id`, () => {
      const bookmarkId = 2;
      return supertest(app)
        .get(`/bookmarks/${bookmarkId}`)
        .expect(401, { error: 'Unauthorized request' })
    })

    it(`responds with 401 Unauthorized for DELETE /bookmarks/:id`, () => {
      const aBookmark = 2
      return supertest(app)
        .delete(`/bookmarks/${aBookmark}`)
        .expect(401, { error: 'Unauthorized request' })
    })
  })

  describe('GET /bookmarks', () => {
    context(`Given no bookmarks`, () => {
      it(`responds with 200 and an empty list`, () => {
        return supertest(app)
          .get('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, [])
      })
    })

    context('Given there are bookmarks in the database', () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach('insert bookmarks', () => {
        return db
          .into('bookmarks')
          .insert(testBookmarks)
      })

      it('gets the bookmarks from the database', () => {
        return supertest(app)
          .get('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, testBookmarks)
      })
    })

    context('Given an XSS attack bookmark', () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();

      beforeEach('insert malicious bookmark', () => {
        return db
          .into('bookmarks')
          .insert([ maliciousBookmark ])
      })

      it(`removes XSS attack bookmark`, () => {
        return supertest(app)
          .get('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .expect(res => {
            expect(res.body[0].title).to.eql(expectedBookmark.title)
            expect(res.body[0].description).to.eql(expectedBookmark.description)
          })
      })
    })
  })

  describe('GET /bookmarks/:id', () => {
    context(`Given no bookmarks`, () => {
      it(`responds 404 whe bookmark doesn't exist`, () => {
        return supertest(app)
          .get(`/bookmarks/123`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, {
            error: { message: `Bookmark Not Found` }
          })
      })
    })

    context('Given there are bookmarks in the database', () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach('insert bookmarks', () => {
        return db
          .into('bookmarks')
          .insert(testBookmarks)
      })

      it('responds with 200 and the specified bookmark', () => {
        const bookmarkId = 2
        const expectedBookmark = testBookmarks[bookmarkId - 1]
        return supertest(app)
          .get(`/bookmarks/${bookmarkId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, expectedBookmark)
      })
    })

    context('Given an XSS attack bookmark', () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();

      beforeEach('insert malicious bookmark', () => {
        return db
          .into('bookmarks')
          .insert( maliciousBookmark )
      })

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/bookmarks/${maliciousBookmark.id}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .expect(res => {
            expect(res.body.title).to.eql(expectedBookmark.title)
            expect(res.body.description).to.eql(expectedBookmark.description)
          })
      })
    })
  })

  describe('DELETE /bookmarks/:id', () => {
    context('Given no bookmarks', () => {
      it(`returns 404 when bookmark doesn't exist`, () => {
        const bookmarkId = 12345
        return supertest(app)
          .delete(`/bookmarks/${bookmarkId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, {
            error: { message: 'Bookmark Not Found' }
          })
      })
    })

    context('Given there are bookmarks in the db', () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach('Insert bookmarks', () => {
        return db
          .into('bookmarks')
          .insert(testBookmarks)
      })

      it('Responds with 204 and deletes the bookmark', () => {
        const idToRemove = 1;
        const expectedBookmarks = testBookmarks.filter(bookmark => bookmark.id !== idToRemove);
        return supertest(app)
          .delete(`/bookmarks/${idToRemove}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(204)
          .then(res => {
            supertest(app)
              .get('/bookmarks')
              .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
              .expect(expectedBookmarks)
          })
      })
    })
  })


  describe('POST /bookmarks', () => {
    context('Testing for acceptable fields', () => {
      const requiredFields = ['title', 'url', 'rating'];

      requiredFields.forEach(field => {
        const newBookmark = {
          title: 'new title',
          url: 'www.newurl.com',
          description: 'new description',
          rating: 3
        }
  
        it(`responds with an error message when the ${field} is missing`, () => {
          delete newBookmark[field];
          return supertest(app)
            .post('/bookmarks')
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .send(newBookmark)
            .expect(400, {
              error: { message: `'${field}' is required`}
            })
        })
      })
  
      it(`responds with 400 invalid 'rating' if not between 0 and 5`, () => {
        const newBookmarkInvalidRating = {
          title: 'test-title',
          url: 'https://test.com',
          rating: 'invalid',
        }
        return supertest(app)
          .post(`/bookmarks`)
          .send(newBookmarkInvalidRating)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(400, `'rating' must be a number between 0 and 5`)
      })
  
      it(`responds with 400 invalid 'url' if not a valid URL`, () => {
        const newBookmarkInvalidUrl = {
          title: 'test-title',
          url: 'htp://invalid-url',
          rating: 1,
        }
        return supertest(app)
          .post(`/bookmarks`)
          .send(newBookmarkInvalidUrl)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(400, `'url' must be a valid URL`)
      })
    })
    
    context('Posting to the DB', () => {
      it('Removes an XSS attack bookmark', () => {
        const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();
        return supertest(app)
          .post('/bookmarks')
          .send(maliciousBookmark)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(201)
          .expect(res => {
            expect(res.body.title).to.eql(expectedBookmark.title)
            expect(res.body.description).to.eql(expectedBookmark.description)
          })
      })

      it('adds a new bookmark to the store', function() {
        this.retries(3)
        const newBookmark = {
          title: 'test-title',
          url: 'https://test.com',
          description: 'test description',
          rating: 1,
        }
        return supertest(app)
          .post(`/bookmarks`)
          .send(newBookmark)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(201)
          .expect(res => {
            expect(res.body.title).to.eql(newBookmark.title)
            expect(res.body.url).to.eql(newBookmark.url)
            expect(res.body.description).to.eql(newBookmark.description)
            expect(res.body.rating).to.eql(newBookmark.rating)
            expect(res.body).to.have.property('id')
          })
          .then(res => {
            supertest(app)
              .get(`/bookmarks/${res.body.id}`)
              .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
              .expect(res.body)
          })
      })
    })
  })
})