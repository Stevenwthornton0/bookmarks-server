const BookmarksServices = {
  getAllBookmarks(knex) {
    return knex.select('*').from('bookmarks_table')
  },

  getById(knex, id) {
    return knex
      .select('*')
      .where('id', id)
      .from('bookmarks_table')
  }
}