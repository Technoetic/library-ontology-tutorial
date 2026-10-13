const source = {
  postgres: { label: 'PostgreSQL 공식 문서', url: 'https://www.postgresql.org/docs/current/queries-with.html' },
  pglite: { label: 'PGlite 시작하기', url: 'https://pglite.dev/docs/' },
  rdf: { label: 'W3C RDF 개념', url: 'https://www.w3.org/TR/rdf11-concepts/' },
  owl: { label: 'W3C OWL 2 입문', url: 'https://www.w3.org/TR/owl2-primer/' },
  hermit: { label: 'HermiT 공식 소스', url: 'https://github.com/owlcs/hermit-reasoner' },
  shacl: { label: 'W3C SHACL 표준', url: 'https://www.w3.org/TR/shacl/' },
  validator: { label: 'rdf-validate-shacl', url: 'https://github.com/zazuko/rdf-validate-shacl/tree/master/packages/shacl' },
  n3: { label: 'N3.js 공식 소스', url: 'https://github.com/rdfjs/N3.js' },
  cube: { label: 'Cube 지표 정의', url: 'https://docs.cube.dev/reference/data-modeling/measures' },
  cubeModel: { label: 'Cube 데이터 모델', url: 'https://docs.cube.dev/reference/data-modeling/cube' },
  cubeApi: { label: 'Cube 조회 API', url: 'https://docs.cube.dev/reference/core-data-apis/rest-api' },
  pages: { label: 'GitHub Pages 실행 환경', url: 'https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages' },
};

export const lessons = [
  {
    id: 'books',
    title: '책과 복본',
    tool: 'PostgreSQL · 이 화면에서는 PGlite로 SQL 실행',
    analogy: '도서 목록 한 줄과 책장에 꽂힌 두 권',
    explanation: [
      '《어린 왕자》의 서지는 1건입니다. 같은 책을 두 권 샀으므로 실물인 복본은 2권이고, 그중 한 권이 대출 중입니다.',
      '제목을 관리하는 표, 실물을 관리하는 표, 대출을 기록하는 표를 나누면 “책이 몇 개?”라는 질문에 단위를 붙일 수 있습니다.',
      '여기서는 PostgreSQL을 브라우저용으로 만든 PGlite가 실제 SQL을 실행합니다. 별도 PostgreSQL 서버에 접속하는 화면은 아닙니다.',
    ],
    challenge: '같은 책의 복본을 한 권 추가하세요. 서지·복본·현재 대출 중 어느 수가 바뀌나요?',
    figure: 'illustrations/01.png',
    alt: '도서관의 책과 기록을 함께 보여 주는 흑백 삽화',
    language: 'sql',
    code: `SELECT
  (SELECT COUNT(*) FROM book_titles) AS 서지_건수,
  (SELECT COUNT(*) FROM book_copies) AS 복본_수,
  (SELECT COUNT(*) FROM loans
   WHERE status = 'active') AS 현재_대출_건수;

-- 처음에는 서지 1건, 복본 2권, 현재 대출 1건`,
    sources: [source.pglite],
  },
  {
    id: 'ontology',
    title: '개념 규정집',
    tool: '온톨로지 · 개념과 관계의 뜻 정하기',
    analogy: '직원들이 함께 보는 도서관 용어집',
    explanation: [
      '먼저 “서지”, “복본”, “회원”, “대출”의 뜻을 맞춥니다. 복본은 한 실물이고, 대출은 그 실물과 회원을 잇는 기록입니다.',
      '온톨로지는 이런 개념과 관계를 명시하는 규정집입니다. 표의 열 이름만으로는 드러나지 않는 뜻을 설명합니다.',
      '“등록된 복본은 서지와 연결되어야 한다”는 업무 규칙도 필요합니다. 그 연결이 실제 기록에 있는지는 뒤의 검사에서 확인합니다.',
    ],
    challenge: '서지 1건, 복본 2권, 대출 1건을 살펴보세요. 각 기록이 무엇을 가리키는지 연결해 보세요.',
    figure: 'illustrations/03.png',
    alt: '도서관의 개념과 관계를 정리하는 규정집 삽화',
    language: 'turtle',
    code: `@prefix ex: <https://example.org/library/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:BookTitle a owl:Class .  # 서지
ex:Copy      a owl:Class .  # 복본
ex:Member    a owl:Class .  # 회원
ex:Loan      a owl:Class .  # 대출

ex:hasTitle a owl:ObjectProperty ;
  rdfs:domain ex:Copy ;
  rdfs:range ex:BookTitle .`,
    sources: [source.owl],
  },
  {
    id: 'rdf',
    title: '관계 카드',
    tool: 'RDF · N3.js로 관계 기록 읽기',
    analogy: '“이 복본 — 서지는 — 어린 왕자”라고 적은 카드',
    explanation: [
      'RDF는 “대상 — 관계 — 값” 세 칸으로 사실을 적습니다. 관계 카드를 이어 붙이면 표에 나뉜 기록도 하나의 그래프로 볼 수 있습니다.',
      '두 복본은 서로 다른 실물이지만 같은 서지를 가리킵니다. 대출은 제목 자체가 아니라 빌려 간 복본을 가리킵니다.',
      '긴 주소인 IRI는 대상을 구별하는 이름입니다. N3.js는 아래 Turtle 글을 실제 RDF 데이터로 읽습니다. SQL에서 RDF로 옮기는 규칙은 이 예제가 직접 작성했습니다.',
    ],
    challenge: '두 복본을 각각 골라 관계 카드를 읽으세요. 서로 다른 실물이 같은 서지에 연결되어 있나요?',
    figure: 'illustrations/04.png',
    alt: '대상과 관계를 카드로 이어 놓은 RDF 삽화',
    language: 'turtle',
    code: `@prefix ex: <https://example.org/library/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:little-prince a ex:BookTitle, ex:LiteratureTitle ;
  rdfs:label "어린 왕자" .
ex:copy-one a ex:Copy ;
  ex:copyNumber "copy-one" ;
  rdfs:label "어린 왕자 · 1번 실물" ;
  ex:hasTitle ex:little-prince .
ex:copy-two a ex:Copy ;
  ex:copyNumber "copy-two" ;
  rdfs:label "어린 왕자 · 2번 실물" ;
  ex:hasTitle ex:little-prince .
ex:reader-one a ex:Member ; rdfs:label "독자 한 분" .
ex:loan-one a ex:Loan ;
  ex:borrowedCopy ex:copy-one ;
  ex:borrower ex:reader-one ;
  ex:loanStatus "active" .`,
    sources: [source.rdf, source.n3],
  },
  {
    id: 'recursive',
    title: '분류 따라가기',
    tool: 'PostgreSQL 재귀 CTE · PGlite에서 실행',
    analogy: '문학 표지판에서 하위 서가로 내려가기',
    explanation: [
      '《어린 왕자》는 프랑스 문학에 놓여 있습니다. 프랑스 문학은 외국 문학 아래, 외국 문학은 문학 아래에 있습니다.',
      '재귀 CTE는 저장된 상위·하위 관계를 한 번씩 이어 따라갑니다. “문학에 속하는 책”을 물으면 하위 분류의 책도 찾을 수 있습니다.',
      '이 예제는 이미 방문한 분류를 다시 따라가지 않아 순환에서도 끝납니다. RDF 변환 방식이나 삭제 후 동기화 규칙은 별도로 정해야 합니다.',
    ],
    challenge: '문학과 프랑스 문학을 각각 시작점으로 고르세요. 프랑스 문학까지 몇 단계인지 비교하세요.',
    figure: 'illustrations/06.png',
    alt: '상위 분류에서 하위 분류의 책을 찾아 내려가는 삽화',
    language: 'sql',
    code: `WITH RECURSIVE subject_tree AS (
  SELECT id, label, 0 AS depth, ARRAY[id] AS path
  FROM subjects WHERE id = 'literature'
  UNION ALL
  SELECT s.id, s.label, t.depth + 1, t.path || s.id
  FROM subjects s
  JOIN subject_tree t ON s.parent_id = t.id
  WHERE NOT s.id = ANY(t.path)
), unique_subjects AS (
  SELECT DISTINCT ON (id) id, label, depth, path
  FROM subject_tree ORDER BY id, depth, path
)
SELECT id, label, depth, path
FROM unique_subjects ORDER BY depth, path;`,
    sources: [source.postgres],
  },
  {
    id: 'owl',
    title: '논리로 분류하기',
    tool: 'OWL 2 + HermiT · 실제 실험의 저장된 결과',
    analogy: '등록된 사실과 규정으로 분류표 채우기',
    explanation: [
      '“추천 문학은 문학이면서 추천으로 등록된 서지”라고 정의합니다. 두 사실이 모두 있으면 HermiT가 추천 문학이라는 분류를 도출합니다.',
      '추천 여부는 사람이 등록하는 사실입니다. 추천 사실이 빠졌다면 OWL의 열린 세계 가정에서는 아직 모르는 상태로 남습니다.',
      '이 화면은 실제 HermiT 실행 결과를 불러옵니다. 브라우저에서 Java 추론기를 새로 실행하지는 않습니다. 같은 실험을 다시 실행할 수 있는 서버 실습이 함께 있습니다.',
    ],
    challenge: '추천 사실이 없는 경우와 등록된 경우를 비교하세요. 어느 경우에 추천 문학이라는 결론이 나오나요?',
    figure: 'illustrations/07.png',
    alt: '규정과 등록된 사실로 책의 분류를 판단하는 삽화',
    language: 'turtle',
    code: `@prefix ex: <https://example.org/library/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

ex:LiteratureTitle a owl:Class .
ex:RecommendedTitle a owl:Class .
ex:RecommendedLiterature a owl:Class ;
  owl:equivalentClass [ a owl:Class ;
    owl:intersectionOf
      (ex:LiteratureTitle ex:RecommendedTitle) ] .

ex:little-prince a ex:LiteratureTitle .
# 추천을 등록한 경우에만 다음 사실을 추가합니다.
# ex:little-prince a ex:RecommendedTitle .`,
    sources: [source.owl, source.hermit],
  },
  {
    id: 'shacl',
    title: '빠진 기록 찾기',
    tool: 'SHACL Core · rdf-validate-shacl로 실제 검사',
    analogy: '복본 등록 카드의 필수 칸 점검',
    explanation: [
      '우리 도서관은 복본마다 서지 연결을 정확히 하나 기록하기로 정했습니다. SHACL은 이런 검사 규칙을 적는 표준입니다.',
      'rdf-validate-shacl은 그 규칙을 읽고 현재 RDF를 검사하는 구현체입니다. 서지 연결이 없거나 두 개이면 어떤 복본의 어느 칸이 문제인지 보고합니다.',
      '연결 누락은 등록 기준 위반입니다. OWL에서는 알려지지 않은 연결이 있을 수 있으므로, 누락만으로 논리 모순이라고 결론 내리지는 않습니다.',
    ],
    challenge: '한 복본의 서지 연결을 지우고 검사하세요. 다시 연결을 넣으면 검사 결과가 어떻게 달라지나요?',
    figure: 'illustrations/08.png',
    alt: '필수 관계가 빠진 복본 기록을 점검하는 삽화',
    language: 'turtle',
    code: `@prefix ex: <https://example.org/library/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

ex:CopyShape a sh:NodeShape ;
  sh:targetClass ex:Copy ;
  sh:property [
    sh:path ex:hasTitle ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:class ex:BookTitle ;
    sh:message "복본에는 서지 연결이 정확히 하나 필요합니다."@ko
  ] .`,
    sources: [source.shacl, source.validator],
  },
  {
    id: 'semantic',
    title: '무엇을 셀까',
    tool: '시맨틱 레이어 · 단위와 집계 조건 합의',
    analogy: '매달 같은 뜻으로 작성하는 도서관 통계',
    explanation: [
      '“책 수”는 서지 수일 수도, 복본 수일 수도 있습니다. 현재 대출은 status가 active인 대출 기록을 셉니다. 기간 누적 대출과는 다른 질문입니다.',
      '《어린 왕자》에는 분류 두 개가 붙어 있습니다. 분류까지 표를 결합하면 한 복본이 두 행에 나타날 수 있으므로 복본 식별자로 중복을 제거합니다.',
      '시맨틱 레이어는 이렇게 단위·기간·상태·중복 처리의 뜻을 맞춥니다. 개념의 논리 정의와 집계 기준은 함께 다듬을 수 있습니다.',
    ],
    challenge: '분류를 결합한 행 수와 중복을 제거한 복본 수를 비교하세요. 같은 실물이 두 번 보이는 이유를 찾아보세요.',
    figure: 'illustrations/09.png',
    alt: '같은 도서관 기록을 서로 다른 집계 기준으로 세는 삽화',
    language: 'sql',
    code: `SELECT
  COUNT(c.id) AS 결합된_복본_행수,
  COUNT(DISTINCT c.id) AS 복본_수
FROM book_copies c
JOIN title_categories cat ON cat.title_id = c.title_id;

-- 초기 기록: 결합된 복본 행은 4개, 실물 복본은 2권`,
    sources: [source.cube],
  },
  {
    id: 'cube',
    title: '공통 조회 창구',
    tool: 'Cube Core · 실제 서버 실험의 저장된 결과',
    analogy: '같은 통계 정의로 답하는 도서관 안내 창구',
    explanation: [
      'Cube 모델에 서지 수·복본 수·현재 대출 수를 한 번 정의하면 여러 화면이 같은 지표 이름으로 조회할 수 있습니다.',
      '이 실습은 JavaScript로 작성한 Cube 모델이 SQL 표를 읽고 식별자로 중복을 제거합니다. OWL 분류를 사용하려면 결과를 어떤 SQL 기록에 넣을지 직접 연결해야 합니다.',
      '아래는 Cube 서버의 /cubejs-api/v1/load에 보내는 조회 본문입니다. 여기서는 실제 서버 실험의 저장된 응답을 읽으며, 브라우저 기록의 변경은 이 응답에 반영되지 않습니다.',
    ],
    challenge: '공통 지표 세 개의 이름과 서버 실험 결과를 확인하세요. “서지”와 “복본”의 집계 기준이 어떻게 다른가요?',
    figure: 'illustrations/11.png',
    alt: '공통 지표 정의로 여러 조회에 답하는 도서관 창구 삽화',
    language: 'json',
    code: `{
  "measures": [
    "Library.titles",
    "Library.copies",
    "Library.activeLoans"
  ]
}`,
    sources: [source.cubeModel, source.cube, source.cubeApi],
  },
  {
    id: 'pipeline',
    title: '전체 흐름',
    tool: '기록 → 관계 → 검사·추론 → 공통 지표',
    analogy: '등록 데스크에서 통계 안내 창구까지',
    explanation: [
      'SQL은 기록을 저장하고 조회합니다. 변환 코드가 그 기록을 RDF 관계로 옮깁니다. SHACL은 등록 기준을 검사하고, OWL과 HermiT는 논리적 분류를 확인합니다.',
      '지표 정의는 무엇을 셀지 정하고, Cube는 SQL 모델로 그 정의를 공통 조회에 제공합니다. 각 연결과 결과 반영은 사람이 작성한 코드와 정책에 따릅니다.',
      '이 페이지의 SQL·RDF·SHACL은 현재 브라우저 기록으로 실행됩니다. HermiT·Cube는 별도 실험의 저장된 기록입니다. 이 학습 순서를 모든 시스템의 개발 순서로 정할 필요는 없습니다.',
    ],
    challenge: '복본을 추가하거나 대출을 반납한 뒤 변화를 확인하세요. 현재 브라우저 결과와 저장된 서버 실행 기록을 구분해 보세요.',
    figure: 'illustrations/14.png',
    alt: '도서관 기록에서 관계와 검사, 공통 통계로 이어지는 전체 흐름 삽화',
    language: 'sql',
    code: `-- 관계로 옮길 원본 기록: 복본별 서지 연결
SELECT c.id AS copy_id, c.label, t.id AS title_id, t.title
FROM book_copies c
JOIN book_titles t ON t.id = c.title_id;

-- 반납을 기록하면 현재 대출 지표가 달라집니다.
UPDATE loans
SET status = 'returned'
WHERE id = 'loan-one' AND status = 'active';

SELECT COUNT(DISTINCT id) AS 현재_대출_건수
FROM loans WHERE status = 'active';`,
    sources: [source.pglite, source.shacl, source.hermit, source.cubeModel, source.pages],
  },
];

export const glossary = [
  { term: '서지', fullName: '책 제목과 설명을 관리하는 기록', meaning: '이 예제에서는 《어린 왕자》를 설명하는 book_titles의 한 행입니다.' },
  { term: '복본', fullName: '같은 서지에 연결된 개별 실물', meaning: '1번 실물과 2번 실물은 서로 다른 book_copies 기록입니다.' },
  { term: '온톨로지', fullName: '개념과 관계를 명시한 규정집', meaning: '서지·복본·회원·대출의 뜻과 관계를 정합니다.' },
  { term: 'SQL', fullName: 'Structured Query Language · 구조화 질의 언어', meaning: '표의 기록을 읽고 바꾸는 언어입니다. 이 화면의 SQL은 PGlite에서 실제 실행됩니다.' },
  { term: 'PostgreSQL', fullName: '관계형 데이터베이스 시스템', meaning: '표, 제약과 SQL을 제공합니다. 서버 실습과 브라우저 실습의 공통 SQL 기반입니다.' },
  { term: 'PGlite', fullName: '브라우저에서도 실행할 수 있는 PostgreSQL 빌드', meaning: 'WebAssembly로 만든 PostgreSQL을 이 페이지 안에서 실행합니다.' },
  { term: 'RDF', fullName: 'Resource Description Framework · 자원 기술 프레임워크', meaning: '대상·관계·값 세 칸의 사실을 연결해 그래프로 표현하는 데이터 모델입니다.' },
  { term: 'IRI', fullName: 'Internationalized Resource Identifier · 국제화 자원 식별자', meaning: '서지와 복본처럼 서로 다른 대상을 구별하는 주소 형태의 이름입니다.' },
  { term: 'Turtle', fullName: 'Terse RDF Triple Language · RDF를 적는 간결한 문법', meaning: '관계 카드를 텍스트로 적습니다. ex: 같은 접두어로 긴 IRI를 줄여 씁니다.' },
  { term: 'CTE', fullName: 'Common Table Expression · 공통 테이블 식', meaning: 'WITH로 이름 붙인 질의입니다. 재귀 CTE는 앞에서 찾은 관계를 이어 따라갑니다.' },
  { term: 'OWL', fullName: 'Web Ontology Language · 웹 온톨로지 언어', meaning: '개념과 관계의 논리 정의를 적어, 등록된 사실에서 따라 나오는 결론을 다룹니다.' },
  { term: 'HermiT', fullName: 'OWL 2 DL 추론기', meaning: 'OWL 정의와 사실의 일관성을 확인하고 논리적 분류를 도출하는 Java 도구입니다.' },
  { term: '열린 세계 가정', fullName: '빠진 사실은 아직 모를 수 있다는 해석', meaning: '추천 사실이 없다는 이유만으로 추천이 아니라고 결론 내리지 않습니다.' },
  { term: 'SHACL', fullName: 'Shapes Constraint Language · 형태 제약 언어', meaning: '현재 RDF에 필요한 연결·값이 있는지 검사하는 규칙을 적는 표준입니다.' },
  { term: 'rdf-validate-shacl', fullName: 'JavaScript SHACL 검사 구현체', meaning: '이 페이지에서 SHACL Core 규칙을 실제 검사합니다. SHACL-SPARQL 제약은 지원하지 않습니다.' },
  { term: '시맨틱 레이어', fullName: '지표의 뜻을 공유하는 계층', meaning: '세는 단위, 기간, 상태 조건과 중복 제거 기준을 함께 정의합니다.' },
  { term: 'Cube Core', fullName: '공통 데이터 모델과 조회 API를 제공하는 도구', meaning: '정의한 SQL 지표를 여러 조회에서 사용합니다. 이 페이지에서는 별도 서버 실행 기록을 확인합니다.' },
  { term: 'YAML', fullName: "YAML Ain't Markup Language · 사람이 읽기 쉬운 설정 형식", meaning: 'Cube 모델과 실습 실행 설정을 적는 데 쓸 수 있습니다. 형식 자체가 개념의 뜻을 정해 주지는 않습니다.' },
];
