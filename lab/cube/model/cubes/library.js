cube('Library', {
  sql: `SELECT t.id AS title_id, c.id AS copy_id, l.id AS loan_id,
               l.status AS loan_status, cat.category
        FROM book_titles t
        LEFT JOIN book_copies c ON c.title_id = t.id
        LEFT JOIN loans l ON l.copy_id = c.id
        LEFT JOIN title_categories cat ON cat.title_id = t.id`,
  refreshKey: {
    sql: `SELECT md5(concat_ws('|',
          (SELECT string_agg(id, ',' ORDER BY id) FROM book_titles),
          (SELECT string_agg(id, ',' ORDER BY id) FROM book_copies),
          (SELECT string_agg(id || ':' || status, ',' ORDER BY id) FROM loans),
          (SELECT string_agg(title_id || ':' || category, ',' ORDER BY title_id, category)
           FROM title_categories)))`
  },
  measures: {
    titles: { sql: 'title_id', type: 'countDistinct' },
    copies: { sql: 'copy_id', type: 'countDistinct' },
    activeLoans: {
      sql: 'loan_id', type: 'countDistinct',
      filters: [{ sql: `${CUBE}.loan_status = 'active'` }]
    }
  },
  dimensions: {
    titleId: { sql: 'title_id', type: 'string' },
    category: { sql: 'category', type: 'string' }
  }
});
