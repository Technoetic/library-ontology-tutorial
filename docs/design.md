# 도서관 데이터 실험실

## Goal
Build and publish a Korean, interactive GitHub Pages tutorial that makes PostgreSQL, ontology, RDF, OWL, recursive CTE, HermiT, SHACL, semantic layers and Cube Core intuitive through one public-library story.

## Learning contract
- Start with one bibliographic record for 《어린 왕자》, two physical copies, and one active loan. Keep counting units and identity distinct.
- Let users change records and see consequences, rather than only read prose. Use nine chapters: records, ontology, RDF, recursive traversal, OWL/HermiT, SHACL, semantic definitions, Cube, and the connected pipeline.
- Korean plain-language explanations first; reveal real code and official references when useful. Use existing original library illustrations, responsive layout, keyboard access, visible loading/errors and reset.
- Browser SQL must run on actual PGlite (PostgreSQL compiled for WASM). SHACL must execute with rdf-validate-shacl against actual RDF data, parsed/serialized with N3.
- Do not label browser examples as a running PostgreSQL server, HermiT server or Cube service. HermiT and Cube require external runtimes; use results produced by their real executions with clear provenance, plus reproducible server labs.
- OWL definitions express logic; HermiT derives consequences from registered facts. Missing facts are not automatically false or inconsistent. A missing required RDF link can fail SHACL while remaining OWL-consistent.
- Recursive CTE traverses stored relations; handle cycles and multiple paths. It is not an OWL interpreter or a synchronization policy.
- Semantic definitions select units, status, period and deduplication. Cube implements common SQL metrics; it does not discover meaning or automatically ingest OWL/SHACL.
- Provide PostgreSQL + HermiT + SHACL + Cube runnable labs and an end-to-end verification on the same fictitious fixture. No company data, credentials or private notes in the public repository.
- Publish to a new public repository Technoetic/library-ontology-tutorial using GitHub Pages Actions; validate the deployed page and assets.

## Interfaces and ownership
- src/engine.js: async createLab() returning init/reset/getSnapshot/addCopy/addTitle/returnLoan/query/readSubjects/getRdf/validateRdf. SQL and SHACL are real engines. Tests own independent assertions, including changed fixtures and invalid graphs.
- src/lessons.js: nine educational chapter objects with id/title/tool/analogy/explanation/challenge/figure/code/sources, plus glossary. Shared ids: books, ontology, rdf, recursive, owl, shacl, semantic, cube, pipeline.
- lab/: portable setup, seed SQL, Turtle/OWL/shapes, real HermiT fixture generation, Cube model, Docker compose and verification. public/evidence/: reproducible, source-associated HermiT/Cube baseline outputs.
- src/app.js/src/styles.css/index.html: root owns UI, state transitions and integration. Root owns package config, assets, CI, GitHub operations and final verification.

## Completion evidence
Pass behavioral unit tests, static production build, real runtime lab checks/CI, independent content/code review, Aside desktop/mobile layout and DOM interaction checks, and a successful public Pages deployment. Record limitations precisely.
