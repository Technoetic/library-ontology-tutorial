"""Run real public-fixture engines; emit evidence only after contract assertions.

This program never reads environment files or discovers existing services.
Its PostgreSQL connection and Docker project are tutorial-only constants.
"""
from __future__ import annotations

import argparse
import hashlib
from importlib.metadata import version
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile

import owlready2
import psycopg
from pyshacl import validate
from rdflib import Graph, Literal, Namespace
from rdflib.namespace import RDF, RDFS, SH
from rdflib.compare import isomorphic


ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / 'lab'
EX = Namespace('https://example.org/library/')
MEASURES = ['Library.titles', 'Library.copies', 'Library.activeLoans']
PG_IMAGE = 'postgres:18@sha256:74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336'
CUBE_IMAGE = 'cubejs/cube:v1.8.4@sha256:d69f19c0e28fdfaf51abdac478979fb249115cf76cfa312e7a567e2525894c4a'
COUNTS_SQL = """
SELECT count(DISTINCT t.id) AS titles, count(DISTINCT c.id) AS copies,
       count(DISTINCT l.id) FILTER (WHERE l.status = 'active') AS active_loans
FROM book_titles t
LEFT JOIN book_copies c ON c.title_id = t.id
LEFT JOIN loans l ON l.copy_id = c.id
LEFT JOIN title_categories cat ON cat.title_id = t.id
"""


def run(command: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(command, check=True, capture_output=True, text=True, **kwargs)


def input_hashes(paths: list[str]) -> dict[str, str]:
    return {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in paths}


def provenance(kind: str, paths: list[str]) -> dict:
    # Deliberately omit dates, machine paths, usernames and unrelated environment.
    return {
        'schemaVersion': 1,
        'execution': 'actual-engine-run',
        'hosting': 'precomputed artifact; GitHub Pages does not run this engine',
        'fixture': 'public, fictitious library data only',
        'command': f'python lab/run_all.py --{kind}-only --output-dir public/evidence',
        'inputSha256': input_hashes(list(dict.fromkeys(paths + ['lab/run_all.py', 'lab/requirements.txt']))),
    }


def write_evidence(output: Path, name: str, value: dict) -> None:
    output.mkdir(parents=True, exist_ok=True)
    (output / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def data_graph(case: str = 'baseline', baseline: Graph | None = None) -> Graph:
    graph = Graph()
    if baseline is None:
        graph.parse(LAB / 'data.ttl', format='turtle')
    else:
        graph += baseline
    if case == 'recommended':
        graph.add((EX['little-prince'], RDF.type, EX.RecommendedTitle))
    elif case == 'conflict':
        graph.add((EX['little-prince'], RDF.type, EX.NonLiteratureTitle))
    elif case == 'missing-link':
        graph.remove((EX['copy-two'], EX.hasTitle, None))
    elif case == 'multiple-link':
        graph.add((EX.demian, RDF.type, EX.BookTitle))
        graph.add((EX['copy-two'], EX.hasTitle, EX.demian))
    elif case not in ('baseline', 'valid'):
        raise ValueError(f'Unknown public fixture case: {case}')
    return graph


def java_executable() -> str:
    home = os.environ.get('JAVA_HOME')
    candidate = Path(home) / 'bin' / ('java.exe' if os.name == 'nt' else 'java') if home else None
    executable = str(candidate) if candidate and candidate.is_file() else shutil.which('java')
    if not executable:
        raise RuntimeError('Java 17+ is required. Put a public JRE on PATH or set JAVA_HOME.')
    return executable


def hermit_evidence(baseline: Graph | None = None) -> dict:
    owlready2.JAVA_EXE = java_executable()
    java = run([owlready2.JAVA_EXE, '-version'])
    java_version = (java.stderr or java.stdout).splitlines()[0]
    jar = Path(owlready2.__file__).parent / 'hermit' / 'HermiT.jar'
    with zipfile.ZipFile(jar) as archive:
        manifest = archive.read('META-INF/MANIFEST.MF').decode('utf-8')
    match = re.search(r'Implementation-Version:\s*([^\r\n]+)', manifest)
    if not match:
        raise RuntimeError('Bundled HermiT version was not identifiable; evidence withheld.')
    result = provenance('semantic', ['lab/ontology.ttl', 'lab/data.ttl', 'fixtures/library.sql'])
    result['engine'] = {
        'name': 'HermiT', 'version': match.group(1),
        'wrapper': f'owlready2 {version("owlready2")}',
        'java': java_version,
        'jarSha256': hashlib.sha256(jar.read_bytes()).hexdigest(),
        'method': 'owlready2.sync_reasoner invokes the bundled Java HermiT CLI',
    }
    result['baselineSource'] = 'lab/data.ttl' if baseline is None else 'actual PostgreSQL export of fixtures/library.sql'
    result['cases'] = {}
    for case in ('baseline', 'recommended', 'conflict', 'missing-link'):
        graph = Graph().parse(LAB / 'ontology.ttl', format='turtle')
        graph += data_graph(case, baseline)
        world = owlready2.World()
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'library.rdf'
            graph.serialize(source, format='xml')
            # Owlready2's URI-to-path conversion drops a Windows drive prefix.
            # A file object works identically on Windows and Linux.
            with source.open('rb') as file:
                world.get_ontology(str(EX)).load(fileobj=file)
            consistent = True
            entailed = None
            try:
                # Real Java execution, with no SQL/JS approximation or mocked result.
                owlready2.sync_reasoner(world, infer_property_values=True, debug=0)
                title = world[str(EX['little-prince'])]
                target = world[str(EX.RecommendedLiterature)]
                entailed = target in title.INDIRECT_is_a
            except owlready2.OwlReadyInconsistentOntologyError:
                consistent = False
            finally:
                world.close()
        result['cases'][case] = {
            'consistent': consistent,
            'recommendedLiteratureEntailed': entailed,
            'interpretation': {
                'baseline': 'No recommendation assertion: membership is unproved, not disproved.',
                'recommended': 'LiteratureTitle and RecommendedTitle imply RecommendedLiterature.',
                'conflict': 'The same title is asserted in two disjoint classes; ontology inconsistent.',
                'missing-link': 'An existential OWL restriction allows an unnamed title; the absent recorded link is not an inconsistency.',
            }[case],
        }
        print(f'HermiT {case}: consistent={consistent}, recommendedLiteratureEntailed={entailed}')
    expected = {'baseline': (True, False), 'recommended': (True, True),
                'conflict': (False, None), 'missing-link': (True, False)}
    for name, pair in expected.items():
        actual = result['cases'][name]
        assert (actual['consistent'], actual['recommendedLiteratureEntailed']) == pair, (name, actual)
    return result


def shacl_evidence() -> dict:
    result = provenance('semantic', ['lab/data.ttl', 'lab/shapes.ttl', 'fixtures/library.sql'])
    result['engine'] = {'name': 'pySHACL', 'version': version('pyshacl'), 'rdflib': version('rdflib')}
    result['cases'] = {}
    shapes = Graph().parse(LAB / 'shapes.ttl', format='turtle')
    for case in ('valid', 'missing-link', 'multiple-link'):
        conforms, report, _ = validate(data_graph(case), shacl_graph=shapes, inference='none')
        violations = []
        for node in report.subjects(RDF.type, SH.ValidationResult):
            violations.append({
                'focus': str(report.value(node, SH.focusNode)),
                'path': str(report.value(node, SH.resultPath)),
                'constraint': str(report.value(node, SH.sourceConstraintComponent)),
            })
        violations.sort(key=lambda v: (v['focus'], v['path'], v['constraint']))
        result['cases'][case] = {'conforms': bool(conforms), 'violations': violations}
        print(f'pySHACL {case}: conforms={bool(conforms)}, violations={len(violations)}')
    assert result['cases']['valid']['conforms']
    assert not result['cases']['missing-link']['conforms']
    assert not result['cases']['multiple-link']['conforms']
    return result


def compose(*arguments: str) -> subprocess.CompletedProcess:
    if not shutil.which('docker'):
        raise RuntimeError('Docker is unavailable. Run --semantic-only locally or the full lab on a Docker host/CI.')
    return run(['docker', 'compose', '-f', str(LAB / 'compose.yaml'), *arguments], cwd=ROOT)


def cube_request(route: str, query: dict) -> dict:
    url = 'http://127.0.0.1:4038/cubejs-api/v1/' + route + '?' + urllib.parse.urlencode({'query': json.dumps(query)})
    with urllib.request.urlopen(url, timeout=30) as response:
        payload = json.load(response)
    if payload.get('error'):
        raise RuntimeError('Cube returned: ' + str(payload['error']))
    return payload


def cube_counts(wait: bool = False) -> tuple[dict, dict]:
    query = {'measures': MEASURES, 'renewQuery': True}
    deadline = time.monotonic() + (180 if wait else 60)
    last_error = None
    while time.monotonic() < deadline:
        try:
            payload = cube_request('load', query)
            if len(payload.get('data', [])) != 1:
                raise RuntimeError('Cube did not return one aggregate row: ' + str(payload))
            row = payload['data'][0]
            counts = {name: int(row[member]) for name, member in zip(('titles', 'copies', 'activeLoans'), MEASURES)}
            return counts, payload
        except (OSError, ValueError, RuntimeError) as error:
            last_error = error
            time.sleep(2)
    raise RuntimeError(f'Cube did not become ready: {last_error}')


def postgres_graph(connection) -> Graph:
    """Export SQL identities into the same RDF vocabulary, with no private source."""
    graph = Graph()
    graph.bind('ex', EX)
    for identity, title, literature, recommended in connection.execute(
            'SELECT id, title, is_literature, is_recommended FROM book_titles ORDER BY id'):
        node = EX[identity]
        graph.add((node, RDF.type, EX.BookTitle))
        graph.add((node, RDFS.label, Literal(title)))
        if literature:
            graph.add((node, RDF.type, EX.LiteratureTitle))
        if recommended:
            graph.add((node, RDF.type, EX.RecommendedTitle))
    for identity, title_id, label in connection.execute('SELECT id, title_id, label FROM book_copies ORDER BY id'):
        graph.add((EX[identity], RDF.type, EX.Copy))
        graph.add((EX[identity], EX.hasTitle, EX[title_id]))
        graph.add((EX[identity], EX.copyNumber, Literal(identity)))
        graph.add((EX[identity], RDFS.label, Literal(label)))
    for identity, name in connection.execute('SELECT id, name FROM members ORDER BY id'):
        graph.add((EX[identity], RDF.type, EX.Member))
        graph.add((EX[identity], RDFS.label, Literal(name)))
    for identity, copy_id, member_id, status in connection.execute('SELECT id, copy_id, member_id, status FROM loans ORDER BY id'):
        graph.add((EX[identity], RDF.type, EX.Loan))
        graph.add((EX[identity], EX.borrowedCopy, EX[copy_id]))
        graph.add((EX[identity], EX.borrower, EX[member_id]))
        graph.add((EX[identity], EX.loanStatus, Literal(status)))
    return graph


def stack_evidence(output: Path, keep_running: bool = False) -> dict:
    started = False
    try:
        compose('up', '-d', '--wait', '--wait-timeout', '180')
        started = True
        # Deliberately hardcoded disposable tutorial credentials; no .env loaded.
        with psycopg.connect('postgresql://tutorial:tutorial-only-password@127.0.0.1:5538/library_tutorial', autocommit=True) as db:
            assert db.execute('SELECT current_database()').fetchone()[0] == 'library_tutorial'
            db.execute((ROOT / 'fixtures/library.sql').read_text('utf-8'))
            postgres_version = db.execute('SHOW server_version').fetchone()[0]
            assert int(postgres_version.split('.')[0]) == 18, postgres_version
            cube_version = compose('exec', '-T', 'cube', 'node', '-p',
                                   "require('@cubejs-backend/server/package.json').version").stdout.strip()
            assert cube_version == '1.8.4', cube_version
            result = provenance('stack', ['fixtures/library.sql', 'lab/compose.yaml', 'lab/cube/model/cubes/library.js', 'lab/shapes.ttl'])
            result['engine'] = {'name': 'Cube Core', 'version': cube_version, 'image': CUBE_IMAGE,
                                'database': {'name': 'PostgreSQL', 'version': postgres_version, 'image': PG_IMAGE},
                                'psycopg': version('psycopg')}
            result['cases'] = {}
            baseline_rdf = postgres_graph(db)
            assert isomorphic(baseline_rdf, data_graph()), 'SQL export differs from the shared standalone RDF fixture.'
            shapes = Graph().parse(LAB / 'shapes.ttl', format='turtle')
            valid, _, _ = validate(baseline_rdf, shacl_graph=shapes, inference='none')
            assert valid, 'The actual PostgreSQL baseline export must conform to the SHACL shapes.'
            (output / 'postgres-export.ttl').parent.mkdir(parents=True, exist_ok=True)
            baseline_rdf.serialize(output / 'postgres-export.ttl', format='turtle')
            result['postgresRdfExport'] = {'conforms': bool(valid), 'triples': len(baseline_rdf),
                                           'artifact': 'postgres-export.ttl', 'matchesStandaloneFixture': True}
            # Verify the connected SQL -> RDF -> OWL/SHACL pipeline, with Java
            # reasoning on this actual database export rather than a SQL stub.
            pipeline_hermit = hermit_evidence(baseline_rdf)
            write_evidence(output, 'pipeline-hermit-results.json', pipeline_hermit)
            result['postgresHermitBaseline'] = pipeline_hermit['cases']['baseline']
            for name, expected in (
                    ('baseline', {'titles': 1, 'copies': 2, 'activeLoans': 1}),
                    ('mutated', {'titles': 2, 'copies': 3, 'activeLoans': 2}),
                    ('returned', {'titles': 2, 'copies': 3, 'activeLoans': 1})):
                if name == 'mutated':
                    db.execute("INSERT INTO book_titles VALUES ('demian', '데미안', 'german-literature', true, true)")
                    db.execute("INSERT INTO book_copies VALUES ('copy-three', 'demian', '데미안 · 1번 사본')")
                    db.execute("INSERT INTO title_categories VALUES ('demian', 'literature'), ('demian', 'foreign-literature')")
                    db.execute("INSERT INTO loans VALUES ('loan-two', 'copy-three', 'reader-one', DATE '2026-10-02', 'active')")
                elif name == 'returned':
                    db.execute("UPDATE loans SET status='returned' WHERE id='loan-one'")
                row = db.execute(COUNTS_SQL).fetchone()
                postgres = dict(zip(('titles', 'copies', 'activeLoans'), row))
                cube, raw = cube_counts(wait=name == 'baseline')
                assert postgres == expected, (name, 'PostgreSQL', postgres, expected)
                assert cube == expected, (name, 'Cube', cube, expected)
                result['cases'][name] = {'postgres': postgres, 'cube': cube, 'cubeData': raw['data']}
                print(f'PostgreSQL/Cube {name}: {cube}')
            duplicate = db.execute("""SELECT count(*) FROM loans l JOIN book_copies c ON c.id=l.copy_id
                JOIN title_categories tc ON tc.title_id=c.title_id WHERE l.id='loan-two'""").fetchone()[0]
            assert duplicate == 2, duplicate
            result['deduplication'] = {'categoryRowsPerTitle': 2, 'joinedRowsForOneLoan': duplicate,
                                       'countingUnit': 'distinct title/copy/active-loan identity'}
            sql_payload = cube_request('sql', {'measures': MEASURES})
            result['cubeGeneratedSql'] = sql_payload['sql']['sql']
            # Restore the common baseline so a learner who keeps services sees 1/2/1.
            db.execute((ROOT / 'fixtures/library.sql').read_text('utf-8'))
            restored, _ = cube_counts()
            assert restored == {'titles': 1, 'copies': 2, 'activeLoans': 1}, restored
            result['baselineRestored'] = True
            return result
    finally:
        if started and not keep_running:
            compose('down')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--semantic-only', action='store_true', help='Run actual Java HermiT and Python SHACL only.')
    mode.add_argument('--stack-only', action='store_true', help='Run actual Docker PostgreSQL and Cube only.')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'public' / 'evidence')
    parser.add_argument('--keep-running', action='store_true', help='Leave tutorial containers running after assertions.')
    args = parser.parse_args()
    if not args.stack_only:
        hermit = hermit_evidence()
        shacl = shacl_evidence()
        write_evidence(args.output_dir, 'hermit-results.json', hermit)
        write_evidence(args.output_dir, 'shacl-results.json', shacl)
    if not args.semantic_only:
        stack = stack_evidence(args.output_dir, args.keep_running)
        write_evidence(args.output_dir, 'cube-results.json', stack)
    print('Verified evidence written to the selected public output directory.')


if __name__ == '__main__':
    main()
