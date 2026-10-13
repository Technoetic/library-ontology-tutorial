import { PGlite } from '@electric-sql/pglite';
import { DataFactory, Parser, Store, Writer } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';
import seedSql from '../fixtures/library.sql?raw';
import shapesTurtle from '../fixtures/shapes.ttl?raw';
// Explicit URL imports make Vite copy every runtime artifact into the Pages build.
import postgresWasmUrl from '../node_modules/@electric-sql/pglite/dist/pglite.wasm?url';
import initdbWasmUrl from '../node_modules/@electric-sql/pglite/dist/initdb.wasm?url';
import fsBundleUrl from '../node_modules/@electric-sql/pglite/dist/pglite.data?url';

const LIB = 'https://example.org/library/';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const { namedNode, literal, quad } = DataFactory;
const resource = id => namedNode(LIB + encodeURIComponent(id));

function serializeGraph(graph) {
  return new Promise((resolve, reject) => {
    const writer = new Writer({ prefixes: { ex: LIB, rdf: RDF, rdfs: RDFS, xsd: XSD } });
    writer.addQuads([...graph]);
    writer.end((error, turtle) => error ? reject(error) : resolve(turtle));
  });
}

function buildGraph(snapshot, scenario) {
  if (!['valid', 'missing-link', 'multiple-links'].includes(scenario)) {
    throw new Error('지원하지 않는 RDF 실험입니다.');
  }
  const graph = new Store();
  const add = (id, property, value) => graph.addQuad(quad(resource(id), namedNode(property), value));
  const type = (id, className) => add(id, RDF + 'type', resource(className));
  const label = (id, value) => add(id, RDFS + 'label', literal(value, 'ko'));
  for (const title of snapshot.titles) {
    type(title.id, 'BookTitle');
    label(title.id, title.title);
    add(title.id, LIB + 'subject', resource(title.subject_id));
    if (title.is_literature) type(title.id, 'LiteratureTitle');
    if (title.is_recommended) type(title.id, 'RecommendedTitle');
  }
  for (const copy of snapshot.copies) {
    type(copy.id, 'Copy');
    label(copy.id, copy.label);
    add(copy.id, LIB + 'copyNumber', literal(copy.id, namedNode(XSD + 'string')));
    if (!(scenario === 'missing-link' && copy.id === 'copy-two')) {
      add(copy.id, LIB + 'hasTitle', resource(copy.title_id));
    }
  }
  for (const member of snapshot.members) {
    type(member.id, 'Member');
    label(member.id, member.name);
  }
  for (const loan of snapshot.loans) {
    type(loan.id, 'Loan');
    label(loan.id, `${loan.status === 'active' ? '현재 대출' : '반납한 대출'} · ${loan.id}`);
    add(loan.id, LIB + 'borrowedCopy', resource(loan.copy_id));
    add(loan.id, LIB + 'borrower', resource(loan.member_id));
    add(loan.id, LIB + 'loanStatus', literal(loan.status, namedNode(XSD + 'string')));
  }
  if (scenario !== 'valid' && !snapshot.copies.some(copy => copy.id === 'copy-two')) {
    throw new Error('실험에 필요한 2번 실물이 없습니다. 초기화 후 다시 실행해 주세요.');
  }
  if (scenario === 'multiple-links') {
    // A separate RDF experiment: this illustrative title is not inserted into SQL.
    const originalTitle = snapshot.copies.find(copy => copy.id === 'copy-two').title_id;
    const alternativeTitle = originalTitle === 'demian' ? 'shacl-second-title' : 'demian';
    if (!snapshot.titles.some(title => title.id === alternativeTitle)) {
      type(alternativeTitle, 'BookTitle');
      label(alternativeTitle, '데미안');
    }
    add('copy-two', LIB + 'hasTitle', resource(alternativeTitle));
  }
  return graph;
}

async function databaseOptions() {
  if (typeof window === 'undefined') return {};
  const [postgres, initdb, bundle] = await Promise.all(
    [postgresWasmUrl, initdbWasmUrl, fsBundleUrl].map(async url => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`SQL 실행 파일을 불러오지 못했습니다 (${response.status}).`);
      return response.arrayBuffer();
    }),
  );
  const [pgliteWasmModule, initdbWasmModule] = await Promise.all([
    WebAssembly.compile(postgres), WebAssembly.compile(initdb),
  ]);
  return { pgliteWasmModule, initdbWasmModule, fsBundle: new Blob([bundle]) };
}

export async function createLab() {
  const db = await PGlite.create(await databaseOptions());
  try {
    await db.exec(seedSql);
  } catch (error) {
    await db.close();
    throw error;
  }
  let nextCopyNumber = 3;
  let nextTitleNumber = 2;

  async function getSnapshot() {
    return db.transaction(async tx => {
      const titles = await tx.query('SELECT id, title, subject_id, is_literature, is_recommended FROM book_titles ORDER BY id');
      const copies = await tx.query('SELECT id, title_id, label FROM book_copies ORDER BY id');
      const members = await tx.query('SELECT id, name FROM members ORDER BY id');
      const loans = await tx.query('SELECT id, copy_id, member_id, status FROM loans ORDER BY id');
      const counts = await tx.query(`SELECT
        (SELECT COUNT(*)::int FROM book_titles) AS titles,
        (SELECT COUNT(*)::int FROM book_copies) AS copies,
        (SELECT COUNT(*)::int FROM loans WHERE status = 'active') AS "activeLoans"`);
      return { titles: titles.rows, copies: copies.rows, members: members.rows, loans: loans.rows, metrics: counts.rows[0] };
    });
  }

  async function getRdf(scenario = 'valid') {
    return { turtle: await serializeGraph(buildGraph(await getSnapshot(), scenario)) };
  }

  async function validateRdf(scenario = 'valid') {
    const { turtle } = await getRdf(scenario);
    const parser = new Parser();
    const data = new Store(parser.parse(turtle));
    const shapes = new Store(parser.parse(shapesTurtle));
    const report = await new SHACLValidator(shapes).validate(data);
    return {
      conforms: report.conforms,
      results: report.results.map(result => ({
        focusNode: result.focusNode?.value ?? '',
        path: result.path?.value ?? '',
        message: result.message.map(term => term.value).join(' '),
        component: result.sourceConstraintComponent?.value ?? '',
      })),
      turtle,
      shapes: shapesTurtle,
    };
  }

  return {
    getSnapshot,
    query: sql => db.query(sql),
    getRdf,
    validateRdf,
    async setRecommendation(recommended) {
      if (typeof recommended !== 'boolean') throw new Error('추천 여부는 true 또는 false로 지정해 주세요.');
      const result = await db.query(`UPDATE book_titles SET is_recommended = $1
        WHERE id = 'little-prince' RETURNING id`, [recommended]);
      if (!result.rows.length) throw new Error('추천 여부를 바꿀 어린 왕자 기록이 없습니다.');
      return getSnapshot();
    },
    async addCopy(titleId = 'little-prince') {
      await db.transaction(async tx => {
        const title = await tx.query('SELECT title FROM book_titles WHERE id = $1', [titleId]);
        if (!title.rows.length) throw new Error('실물을 연결할 책 제목이 없습니다.');
        let id;
        do { id = `copy-${nextCopyNumber++}`; }
        while ((await tx.query('SELECT id FROM book_copies WHERE id = $1', [id])).rows.length);
        const count = await tx.query('SELECT COUNT(*)::int AS n FROM book_copies WHERE title_id = $1', [titleId]);
        await tx.query('INSERT INTO book_copies(id, title_id, label) VALUES ($1, $2, $3)',
          [id, titleId, `${title.rows[0].title} · ${count.rows[0].n + 1}번 실물`]);
      });
      return getSnapshot();
    },
    async addTitle(title = '데미안', subjectId = 'german-literature') {
      if (typeof title !== 'string' || !title.trim()) throw new Error('책 제목을 입력해 주세요.');
      await db.transaction(async tx => {
        const ancestors = await tx.query(`WITH RECURSIVE ancestry AS (
          SELECT id, parent_id, ARRAY[id] AS path FROM subjects WHERE id = $1
          UNION ALL
          SELECT s.id, s.parent_id, a.path || s.id FROM subjects s
          JOIN ancestry a ON s.id = a.parent_id WHERE NOT s.id = ANY(a.path)
        ) SELECT id FROM ancestry`, [subjectId]);
        if (!ancestors.rows.length) throw new Error('등록된 주제 분류를 선택해 주세요.');
        let id;
        do { id = `title-${nextTitleNumber++}`; }
        while ((await tx.query('SELECT id FROM book_titles WHERE id = $1', [id])).rows.length);
        const categories = ancestors.rows.map(row => row.id);
        await tx.query(`INSERT INTO book_titles(id, title, subject_id, is_literature, is_recommended)
          VALUES ($1, $2, $3, $4, false)`, [id, title.trim(), subjectId, categories.includes('literature')]);
        for (const category of categories.filter(value => ['literature', 'foreign-literature'].includes(value))) {
          await tx.query('INSERT INTO title_categories(title_id, category) VALUES ($1, $2)', [id, category]);
        }
      });
      return getSnapshot();
    },
    async returnLoan(loanId = 'loan-one') {
      const result = await db.query("UPDATE loans SET status = 'returned' WHERE id = $1 RETURNING id", [loanId]);
      if (!result.rows.length) throw new Error('반납할 대출 기록이 없습니다.');
      return getSnapshot();
    },
    async reset() {
      await db.exec(seedSql);
      nextCopyNumber = 3;
      nextTitleNumber = 2;
      return getSnapshot();
    },
    async readSubjects(rootId = 'literature') {
      const result = await db.query(`WITH RECURSIVE subject_tree AS (
        SELECT id, label, 0 AS depth, ARRAY[id] AS path FROM subjects WHERE id = $1
        UNION ALL
        SELECT s.id, s.label, t.depth + 1, t.path || s.id
        FROM subjects s JOIN subject_tree t ON s.parent_id = t.id
        WHERE NOT s.id = ANY(t.path)
      ), unique_subjects AS (
        SELECT DISTINCT ON (id) id, label, depth, path FROM subject_tree
        ORDER BY id, depth, path
      ) SELECT id, label, depth, path FROM unique_subjects ORDER BY depth, path`, [rootId]);
      return result.rows;
    },
    async close() { if (!db.closed) await db.close(); },
  };
}
