-- Public, fictitious data shared by the browser PGlite and PostgreSQL server labs.
BEGIN;
DROP TABLE IF EXISTS loans, title_categories, book_copies, members, book_titles, subjects CASCADE;

CREATE TABLE subjects (
  id text PRIMARY KEY,
  label text NOT NULL,
  parent_id text REFERENCES subjects(id)
);
CREATE TABLE book_titles (
  id text PRIMARY KEY,
  title text NOT NULL CHECK (btrim(title) <> ''),
  subject_id text NOT NULL REFERENCES subjects(id),
  is_literature boolean NOT NULL DEFAULT false,
  is_recommended boolean NOT NULL DEFAULT false
);
CREATE TABLE book_copies (
  id text PRIMARY KEY,
  title_id text NOT NULL REFERENCES book_titles(id),
  label text NOT NULL
);
CREATE TABLE members (
  id text PRIMARY KEY,
  name text NOT NULL
);
CREATE TABLE loans (
  id text PRIMARY KEY,
  copy_id text NOT NULL REFERENCES book_copies(id),
  member_id text NOT NULL REFERENCES members(id),
  loan_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'returned'))
);
CREATE UNIQUE INDEX one_active_loan_per_copy ON loans(copy_id) WHERE status = 'active';
CREATE TABLE title_categories (
  title_id text NOT NULL REFERENCES book_titles(id),
  category text NOT NULL,
  PRIMARY KEY (title_id, category)
);

INSERT INTO subjects(id, label, parent_id) VALUES
  ('literature', '문학', NULL),
  ('foreign-literature', '외국 문학', 'literature'),
  ('french-literature', '프랑스 문학', 'foreign-literature'),
  ('german-literature', '독일 문학', 'foreign-literature');
INSERT INTO book_titles(id, title, subject_id, is_literature, is_recommended) VALUES
  ('little-prince', '어린 왕자', 'french-literature', true, false);
INSERT INTO book_copies(id, title_id, label) VALUES
  ('copy-one', 'little-prince', '어린 왕자 · 1번 실물'),
  ('copy-two', 'little-prince', '어린 왕자 · 2번 실물');
INSERT INTO members(id, name) VALUES ('reader-one', '독자 한 분');
INSERT INTO loans(id, copy_id, member_id, loan_date, status) VALUES
  ('loan-one', 'copy-one', 'reader-one', DATE '2026-10-01', 'active');
-- One title has two categories: a join can accidentally duplicate its copies/loans.
INSERT INTO title_categories(title_id, category) VALUES
  ('little-prince', 'literature'),
  ('little-prince', 'foreign-literature');
COMMIT;
