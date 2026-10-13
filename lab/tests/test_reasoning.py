"""Acceptance test: catch false closed-world OWL claims and unchecked SHACL links."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from lab.run_all import data_graph, hermit_evidence


ROOT = Path(__file__).resolve().parents[2]


class RealReasoningContract(unittest.TestCase):
    def test_actual_reasoners_distinguish_inference_consistency_and_validation(self):
        with tempfile.TemporaryDirectory() as output:
            run = subprocess.run(
                [sys.executable, str(ROOT / 'lab' / 'run_all.py'),
                 '--semantic-only', '--output-dir', output],
                text=True, capture_output=True, cwd=ROOT,
            )
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
            hermit = json.loads((Path(output) / 'hermit-results.json').read_text('utf-8'))
            self.assertEqual(hermit['engine']['name'], 'HermiT')
            self.assertIn('--semantic-only', hermit['command'])
            cases = hermit['cases']
            self.assertTrue(cases['baseline']['consistent'])
            self.assertFalse(cases['baseline']['recommendedLiteratureEntailed'])
            self.assertTrue(cases['recommended']['consistent'])
            self.assertTrue(cases['recommended']['recommendedLiteratureEntailed'])
            self.assertFalse(cases['conflict']['consistent'])
            self.assertIsNone(cases['conflict']['recommendedLiteratureEntailed'])
            self.assertTrue(cases['missing-link']['consistent'])
            self.assertFalse(cases['missing-link']['recommendedLiteratureEntailed'])
            shacl = json.loads((Path(output) / 'shacl-results.json').read_text('utf-8'))
            self.assertTrue(shacl['cases']['valid']['conforms'])
            self.assertFalse(shacl['cases']['missing-link']['conforms'])
            self.assertFalse(shacl['cases']['multiple-link']['conforms'])
            self.assertEqual(shacl['cases']['missing-link']['violations'][0]['focus'], 'https://example.org/library/copy-two')
            self.assertEqual(shacl['cases']['multiple-link']['violations'][0]['focus'], 'https://example.org/library/copy-two')
            self.assertIn('MinCountConstraintComponent', shacl['cases']['missing-link']['violations'][0]['constraint'])
            self.assertIn('MaxCountConstraintComponent', shacl['cases']['multiple-link']['violations'][0]['constraint'])

    def test_supplied_graph_reasoning_records_the_stack_reproduction_command(self):
        # Exercise the actual Java engine using the public graph passed through
        # the same boundary as PostgreSQL export. No reasoner result is mocked.
        result = hermit_evidence(data_graph())
        self.assertIn('--stack-only', result['command'])
        self.assertNotIn('--semantic-only', result['command'])
        self.assertIn('lab/compose.yaml', result['inputSha256'])
        self.assertTrue(result['cases']['baseline']['consistent'])
        self.assertFalse(result['cases']['baseline']['recommendedLiteratureEntailed'])


if __name__ == '__main__':
    unittest.main()
