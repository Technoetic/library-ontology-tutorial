# 공식 출처와 확인 범위

2026-10-13에 공식 사이트와 프로젝트 저장소를 Aside CLI로 열어 확인했다. 아래는 이 튜토리얼이 사용하는 개념과 API의 근거다. 표준 문서는 제목에 적힌 버전을 기준으로 읽었으며, 사이트의 최신 개발 표준 전체를 설명하려는 자료는 아니다. 실행 패키지의 정확한 버전은 저장소의 잠금 파일을 따른다.

| 출처 | 이 튜토리얼에서 확인한 내용 |
| --- | --- |
| [PostgreSQL: WITH Queries](https://www.postgresql.org/docs/current/queries-with.html) | 재귀 CTE의 시작·반복 부분, 경로와 순환 검사. 확인 시 `current`는 PostgreSQL 18 문서였다. |
| [PGlite](https://pglite.dev/) | PostgreSQL의 WebAssembly 빌드와 브라우저 실행. |
| [Getting started with PGlite](https://pglite.dev/docs/) | 브라우저에서의 생성, 실제 SQL 조회, 매개변수 질의와 여러 문장 실행. |
| [W3C RDF 1.1 Concepts and Abstract Syntax](https://www.w3.org/TR/rdf11-concepts/) | RDF 그래프의 삼중항, IRI·리터럴, 그래프와 텍스트 문법의 구분. |
| [N3.js 공식 저장소](https://github.com/rdfjs/N3.js) | Turtle 등 RDF 문법의 파싱·직렬화와 메모리 저장. 프로젝트의 현재 README는 RDF 1.2 지원도 설명하지만 이 실습은 기본 Turtle 삼중항만 사용한다. |
| [W3C OWL 2 Primer, Second Edition](https://www.w3.org/TR/owl2-primer/) | 클래스·관계·교집합 정의, 추론·일관성, 열린 세계 가정. |
| [HermiT: owlcs 공식 소스](https://github.com/owlcs/hermit-reasoner) | OWL 2 DL과 직접 의미론을 지원하는 추론기. 실습이 사용한 Java 실행과 결과 파일은 별도 실습 문서를 따른다. |
| [W3C Shapes Constraint Language](https://www.w3.org/TR/shacl/) | 데이터 그래프·형태 그래프, 검사 보고서, `sh:minCount`·`sh:maxCount`·`sh:class`. |
| [rdf-validate-shacl 공식 저장소](https://github.com/zazuko/rdf-validate-shacl) 및 [패키지 사용법](https://github.com/zazuko/rdf-validate-shacl/tree/master/packages/shacl) | JavaScript 검사 구현체와 보고서 API. 파싱은 별도 도구가 담당하며 SHACL-SPARQL 제약은 지원하지 않는다. |
| [Cube: Cubes](https://docs.cube.dev/reference/data-modeling/cube) | SQL 표·질의에 기반한 데이터 모델, 지표·차원·조인, YAML·JavaScript 선언. |
| [Cube: Measures](https://docs.cube.dev/reference/data-modeling/measures) | 집계 지표, 고유 값 수와 필터. 현재 문서는 `count_distinct` 표기를 사용한다. 실행 실습의 문법은 고정한 서버 버전과 실제 실행 결과로 검증한다. |
| [Cube: REST (JSON) API](https://docs.cube.dev/reference/core-data-apis/rest-api) | 공통 지표 이름을 `measures`로 요청하고 `/cubejs-api/v1/load`에서 조회하는 방식. |
| [GitHub Docs: What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) | HTML·CSS·JavaScript를 배포하는 정적 사이트 호스팅. Java 추론기나 Cube 서버 실행은 별도 런타임이 필요하다. |
| [GitHub Docs: Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) | 빌드 결과를 Pages 아티팩트로 업로드하고 별도 배포 작업에서 배포하는 공식 흐름과 작업 권한. |

Cube의 이전 `cube.dev/docs/product/...` 문서 주소는 확인 시 `docs.cube.dev/reference/...`로 이동했다. GitHub Pages의 이전 `about-github-pages` 주소는 `what-is-github-pages`로 이동했다. 위 표에는 확인된 최종 주소를 사용했다.

## 예제와 근거의 관계

《어린 왕자》의 서지 1건, 복본 2권, 대출 1건은 개념을 설명하는 가상 데이터다. 주소 `https://example.org/library/`도 실습에서 만든 식별자 공간이며 외부 도서관 서비스가 아니다.

공식 문서는 기술의 역할과 구문을 뒷받침한다. 실습의 1·2·1 같은 수치, HermiT 분류, SHACL 검사 결과, Cube 응답은 저장소의 입력 자료와 실행 기록을 근거로 확인한다. 공식 문서만으로 실습이 실행되었다고 주장하지 않는다.
