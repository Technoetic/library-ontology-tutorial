import { afterEach, describe, expect, it } from 'vitest';
import { Parser, Store, DataFactory } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';
import { createLab } from '../src/engine.js';

const LIB = 'https://example.org/library/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const labs = [];
async function makeLab() {
  const lab = await createLab();
  labs.push(lab);
  return lab;
}
afterEach(async () => {
  for (const lab of labs.splice(0)) await lab.close();
});

describe('real library SQL lab', () => {
  it('starts with one title, two distinct physical copies and one active loan', async () => {
    const lab = await makeLab();
    const snapshot = await lab.getSnapshot();
    expect(snapshot.metrics).toEqual({ titles: 1, copies: 2, activeLoans: 1 });
    expect(snapshot.titles).toEqual([{
      id: 'little-prince', title: '어린 왕자', subject_id: 'french-literature',
      is_literature: true, is_recommended: false,
    }]);
    expect(snapshot.copies.map(copy => [copy.id, copy.title_id])).toEqual([
      ['copy-one', 'little-prince'], ['copy-two', 'little-prince'],
    ]);
    expect(snapshot.copies[0].label).not.toBe(snapshot.copies[1].label);
    expect(snapshot.members).toEqual([{ id: 'reader-one', name: '독자 한 분' }]);
    expect(snapshot.loans).toEqual([{
      id: 'loan-one', copy_id: 'copy-one', member_id: 'reader-one', status: 'active',
    }]);
  });

  it('adding a physical copy changes only the copy count', async () => {
    const lab = await makeLab();
    await lab.addCopy();
    const snapshot = await lab.getSnapshot();
    expect(snapshot.metrics).toEqual({ titles: 1, copies: 3, activeLoans: 1 });
    expect(new Set(snapshot.copies.map(copy => copy.id)).size).toBe(3);
    expect(snapshot.copies.every(copy => copy.title_id === 'little-prince')).toBe(true);
  });

  it('adding a different title does not invent a physical copy or a loan', async () => {
    const lab = await makeLab();
    await lab.addTitle();
    const snapshot = await lab.getSnapshot();
    expect(snapshot.metrics).toEqual({ titles: 2, copies: 2, activeLoans: 1 });
    expect(snapshot.titles.find(title => title.title === '데미안')).toMatchObject({
      subject_id: 'german-literature', is_literature: true, is_recommended: false,
    });
  });

  it('returning a loan keeps its record and stops counting it as active', async () => {
    const lab = await makeLab();
    await lab.returnLoan();
    await lab.returnLoan();
    const snapshot = await lab.getSnapshot();
    expect(snapshot.metrics).toEqual({ titles: 1, copies: 2, activeLoans: 0 });
    expect(snapshot.loans).toHaveLength(1);
    expect(snapshot.loans[0].status).toBe('returned');
  });

  it('rejects a copy referring to an unknown title without changing counts', async () => {
    const lab = await makeLab();
    await expect(lab.addCopy('unknown-title')).rejects.toThrow();
    expect((await lab.getSnapshot()).metrics).toEqual({ titles: 1, copies: 2, activeLoans: 1 });
  });

  it('preserves user title text as data and rejects blank or unknown-subject titles', async () => {
    const lab = await makeLab();
    await lab.addTitle("작은 이야기'); DROP TABLE book_titles; --");
    expect((await lab.getSnapshot()).titles.map(title => title.title)).toContain("작은 이야기'); DROP TABLE book_titles; --");
    await expect(lab.addTitle('   ')).rejects.toThrow();
    await expect(lab.addTitle('잘못된 분류', 'unknown-subject')).rejects.toThrow();
    expect((await lab.getSnapshot()).metrics).toEqual({ titles: 2, copies: 2, activeLoans: 1 });
  });

  it('reset restores the seed after mutations and another lab stays isolated', async () => {
    const lab = await makeLab();
    const second = await makeLab();
    await lab.addCopy();
    await lab.addTitle();
    await lab.returnLoan();
    expect((await lab.getSnapshot()).metrics).toEqual({ titles: 2, copies: 3, activeLoans: 0 });
    expect((await second.getSnapshot()).metrics).toEqual({ titles: 1, copies: 2, activeLoans: 1 });
    await lab.reset();
    expect((await lab.getSnapshot()).metrics).toEqual({ titles: 1, copies: 2, activeLoans: 1 });
  });

  it('lets actual SQL expose duplicate joins and count distinct loan identities', async () => {
    const lab = await makeLab();
    const result = await lab.query(`SELECT COUNT(*)::int AS joined_rows,
      COUNT(DISTINCT l.id)::int AS active_loans
      FROM loans l JOIN book_copies c ON c.id = l.copy_id
      JOIN title_categories t ON t.title_id = c.title_id WHERE l.status = 'active'`);
    expect(result.rows).toEqual([{ joined_rows: 2, active_loans: 1 }]);
    expect(result.fields.map(field => field.name)).toEqual(['joined_rows', 'active_loans']);
    await expect(lab.query('SELECT unknown_column FROM book_titles')).rejects.toThrow();
  });

  it('recursively traverses changed relations with depth and a path to each subject', async () => {
    const lab = await makeLab();
    await lab.query("INSERT INTO subjects VALUES ('poetry', '시', 'french-literature')");
    const rows = await lab.readSubjects();
    expect(rows.map(row => [row.id, row.depth])).toEqual([
      ['literature', 0], ['foreign-literature', 1],
      ['french-literature', 2], ['german-literature', 2], ['poetry', 3],
    ]);
    expect(rows.find(row => row.id === 'poetry')).toEqual({
      id: 'poetry', label: '시', depth: 3,
      path: ['literature', 'foreign-literature', 'french-literature', 'poetry'],
    });
    expect((await lab.readSubjects('french-literature')).map(row => row.id)).toEqual(['french-literature', 'poetry']);
    expect(await lab.readSubjects('unknown-subject')).toEqual([]);
  });

  it('terminates on a stored cycle without emitting the same subject again', async () => {
    const lab = await makeLab();
    await lab.query("UPDATE subjects SET parent_id = 'french-literature' WHERE id = 'literature'");
    const rows = await lab.readSubjects();
    expect(rows.map(row => row.id)).toEqual([
      'literature', 'foreign-literature', 'french-literature', 'german-literature',
    ]);
    expect(rows).toHaveLength(4);
  });
});

describe('RDF identity and actual SHACL validation', () => {
  const term = value => DataFactory.namedNode(value.startsWith('http') ? value : LIB + value);
  const triples = (store, subject, predicate, object = null) =>
    store.getQuads(subject ? term(subject) : null, term(predicate), object ? term(object) : null, null);
  const parse = turtle => new Store(new Parser().parse(turtle));

  it('represents one bibliographic title, two copies and a separate loan as RDF identities', async () => {
    const lab = await makeLab();
    const graph = parse((await lab.getRdf()).turtle);
    expect(triples(graph, null, RDF_TYPE, 'BookTitle').map(quad => quad.subject.value)).toEqual([LIB + 'little-prince']);
    expect(triples(graph, null, RDF_TYPE, 'Copy')).toHaveLength(2);
    expect(triples(graph, null, RDF_TYPE, 'Loan')).toHaveLength(1);
    expect(triples(graph, 'copy-one', 'hasTitle')[0].object.value).toBe(LIB + 'little-prince');
    expect(triples(graph, 'copy-two', 'hasTitle')[0].object.value).toBe(LIB + 'little-prince');
    expect(triples(graph, 'loan-one', 'borrowedCopy')[0].object.value).toBe(LIB + 'copy-one');
    expect(triples(graph, 'loan-one', 'borrower')[0].object.value).toBe(LIB + 'reader-one');
    expect(triples(graph, 'copy-one', 'copyNumber')[0].object.datatype.value).toBe('http://www.w3.org/2001/XMLSchema#string');
  });

  it('RDF follows SQL mutations instead of returning a fixed baseline string', async () => {
    const lab = await makeLab();
    await lab.addCopy();
    await lab.returnLoan();
    const graph = parse((await lab.getRdf()).turtle);
    expect(triples(graph, null, RDF_TYPE, 'Copy')).toHaveLength(3);
    expect(triples(graph, 'loan-one', 'loanStatus').map(quad => quad.object.value)).toEqual(['returned']);
  });

  it('the correctly linked graph conforms to the shared SHACL shapes', async () => {
    const lab = await makeLab();
    const report = await lab.validateRdf();
    expect(report.conforms).toBe(true);
    expect(report.results).toEqual([]);
    expect(parse(report.turtle).size).toBeGreaterThan(0);
    expect(parse(report.shapes).size).toBeGreaterThan(0);
  });

  it('a missing title link reports the copy and SHACL minCount constraint', async () => {
    const lab = await makeLab();
    const report = await lab.validateRdf('missing-link');
    expect(report.conforms).toBe(false);
    expect(report.results).toHaveLength(1);
    expect(report.results[0]).toMatchObject({
      focusNode: LIB + 'copy-two', path: LIB + 'hasTitle',
      component: 'http://www.w3.org/ns/shacl#MinCountConstraintComponent',
    });
    expect(report.results[0].message.length).toBeGreaterThan(0);
    expect(triples(parse(report.turtle), 'copy-two', 'hasTitle')).toHaveLength(0);
    expect((await lab.getSnapshot()).metrics).toEqual({ titles: 1, copies: 2, activeLoans: 1 });
  });

  it('two links to two real title nodes report SHACL maxCount, not missing class data', async () => {
    const lab = await makeLab();
    const report = await lab.validateRdf('multiple-links');
    expect(report.conforms).toBe(false);
    expect(report.results).toHaveLength(1);
    expect(report.results[0]).toMatchObject({
      focusNode: LIB + 'copy-two', path: LIB + 'hasTitle',
      component: 'http://www.w3.org/ns/shacl#MaxCountConstraintComponent',
    });
    const graph = parse(report.turtle);
    const targets = triples(graph, 'copy-two', 'hasTitle').map(quad => quad.object.value);
    expect(new Set(targets).size).toBe(2);
    for (const target of targets) expect(triples(graph, target, RDF_TYPE, 'BookTitle')).toHaveLength(1);
    expect((await lab.getSnapshot()).metrics).toEqual({ titles: 1, copies: 2, activeLoans: 1 });
  });

  it('the multiple-link experiment still creates distinct links after SQL changes the original title', async () => {
    const lab = await makeLab();
    await lab.query("INSERT INTO book_titles VALUES ('demian', '데미안', 'german-literature', true, false)");
    await lab.query("UPDATE book_copies SET title_id = 'demian' WHERE id = 'copy-two'");
    const report = await lab.validateRdf('multiple-links');
    expect(report.conforms).toBe(false);
    expect(report.results[0].component).toBe('http://www.w3.org/ns/shacl#MaxCountConstraintComponent');
    expect(triples(parse(report.turtle), 'copy-two', 'hasTitle')).toHaveLength(2);
  });

  it.each([
    ['missing copy number', 'MinCountConstraintComponent'],
    ['two copy numbers', 'MaxCountConstraintComponent'],
    ['numeric copy number', 'DatatypeConstraintComponent'],
    ['title link pointing to a member', 'ClassConstraintComponent'],
  ])('the exported shared shapes reject %s', async (example, constraint) => {
    const lab = await makeLab();
    const baseline = await lab.validateRdf();
    const graph = parse(baseline.turtle);
    const property = example === 'title link pointing to a member' ? 'hasTitle' : 'copyNumber';
    if (example !== 'two copy numbers') graph.removeQuads(triples(graph, 'copy-two', property));
    if (example === 'two copy numbers') graph.addQuad(term('copy-two'), term(property), DataFactory.literal('another-number'));
    if (example === 'numeric copy number') graph.addQuad(term('copy-two'), term(property), DataFactory.literal('2', term('http://www.w3.org/2001/XMLSchema#integer')));
    if (example === 'title link pointing to a member') graph.addQuad(term('copy-two'), term(property), term('reader-one'));
    const report = await new SHACLValidator(parse(baseline.shapes)).validate(graph);
    expect(report.conforms).toBe(false);
    expect(report.results.some(result => result.sourceConstraintComponent.value === 'http://www.w3.org/ns/shacl#' + constraint)).toBe(true);
  });

  it('recommendation registers and removes a fact without changing loan metrics', async () => {
    const lab = await makeLab();
    await lab.setRecommendation(true);
    expect((await lab.getSnapshot()).titles[0].is_recommended).toBe(true);
    expect(triples(parse((await lab.getRdf()).turtle), 'little-prince', RDF_TYPE, 'RecommendedTitle')).toHaveLength(1);
    await lab.setRecommendation(false);
    expect(triples(parse((await lab.getRdf()).turtle), 'little-prince', RDF_TYPE, 'RecommendedTitle')).toHaveLength(0);
    await expect(lab.setRecommendation('false')).rejects.toThrow();
    expect((await lab.getSnapshot()).metrics).toEqual({ titles: 1, copies: 2, activeLoans: 1 });
  });

  it('unknown RDF scenarios fail explicitly instead of being reported as valid', async () => {
    const lab = await makeLab();
    await expect(lab.getRdf('typo')).rejects.toThrow();
    await expect(lab.validateRdf('typo')).rejects.toThrow();
  });
});
