# 도서관에서 개념을 익히기

같은 《어린 왕자》를 두 권 가진 가상의 도서관을 사용한다. 초기 상태는 서지 1건, 복본 2권, 현재 대출 1건이다. `book_titles`는 서지, `book_copies`는 실물, `members`는 회원, `loans`는 대출 기록이다. 대출은 2026-10-01에 시작했고 `status = 'active'`이다. 이 예제의 서지는 업무를 설명하기 위해 단순화했으며 출판·판본 전체를 모델링하지 않는다.

## 아홉 번의 작은 실험

| 장 | 직접 해 볼 일 | 얻는 구분 |
| --- | --- | --- |
| 책과 복본 | 같은 서지에 실물 한 권 추가 | 서지 1건과 복본 여러 권 |
| 개념 규정집 | 서지·복본·대출의 연결 확인 | 개념의 뜻과 실제 기록 |
| 관계 카드 | 두 복본이 가리키는 서지 비교 | 대상의 식별자와 관계 |
| 분류 따라가기 | 문학·프랑스 문학에서 시작해 깊이 비교 | 저장된 관계와 재귀 탐색 |
| 논리로 분류하기 | 추천 사실의 유무 비교 | 등록된 사실과 논리적 결론 |
| 빠진 기록 찾기 | 서지 연결 누락 검사 | 업무 기준 위반과 논리 모순 |
| 무엇을 셀까 | 조인 결과를 중복 없이 집계 | 기록의 행 수와 지표의 단위 |
| 공통 조회 창구 | Cube 공통 지표와 실행 기록 확인 | 지표 정의와 조회 API |
| 전체 흐름 | 복본 추가·반납 후 결과 비교 | 현재 실행과 과거 실행 기록 |

## 관계를 저장하는 표와 관계의 뜻

온톨로지는 “복본은 실물이고 서지는 그 책을 설명하는 기록”처럼 개념의 뜻과 관계를 명시한다. SQL 외래 키는 `book_copies.title_id`가 실제 `book_titles.id`를 가리키도록 돕는다. 두 설명은 서로 다른 질문을 다룬다. OWL/RDFS의 `domain`과 `range`는 관계를 보고 연결 양쪽의 타입을 추론하는 뜻을 가진다. 필수 칸의 누락이나 잘못된 입력을 SQL 제약처럼 거부하는 선언은 아니다. 이 실습의 SQL → RDF 변환은 복본의 `title_id`를 `hasTitle` 관계로 내보내는 코드를 직접 작성한다. 온톨로지 선언만으로 표의 기록이 자동 변환되지는 않는다. [W3C OWL 2 입문](https://www.w3.org/TR/owl2-primer/)

RDF의 기본 단위는 대상·관계·값 세 칸이다. 두 복본의 대상은 각각 `copy-one`, `copy-two`이며 모두 `little-prince` 서지를 가리킨다. `copyNumber`에는 같은 식별번호를 문자열로 저장하고, `rdfs:label`에는 “어린 왕자 · 1번 실물”처럼 사람이 읽는 이름을 저장한다. 주소 형태의 IRI와 읽기 쉬운 이름을 함께 사용한다. Turtle은 관계를 글로 적는 문법이고, N3.js는 그 글을 읽고 쓰는 구현체다. [W3C RDF 개념](https://www.w3.org/TR/rdf11-concepts/), [N3.js](https://github.com/rdfjs/N3.js)

## 기존 분류를 따라가기

`subjects.parent_id`에는 문학 → 외국 문학 → 프랑스 문학이라는 관계가 저장되어 있다. 재귀 CTE는 시작 분류를 찾은 다음 이미 찾은 분류의 하위 분류를 반복해서 찾는다. 예제 쿼리는 경로에 방문한 식별자를 담고 다시 방문하는 분기를 멈춘다. `depth`는 시작점에서 몇 단계를 내려왔는지 보여 준다. 같은 분류를 여러 경로에서 찾는 일반적인 그래프라면 중복 처리가 필요하며, 예제의 `DISTINCT ON (id)`는 분류별로 가장 짧은 경로 하나를 선택한다. 이 탐색으로 데이터 변환·삭제 전파·모델 동기화 정책까지 결정되는 것은 아니다. [PostgreSQL WITH·재귀 질의·순환 검사](https://www.postgresql.org/docs/current/queries-with.html)

## 논리적 분류와 기록 검사

OWL에서는 추천 문학을 문학 서지와 추천 서지의 교집합으로 정의한다. HermiT는 《어린 왕자》에 두 타입이 등록되어 있을 때 추천 문학이라는 분류를 도출한다. 추천 사실은 입력 데이터에서 등록한다. HermiT는 독자의 취향을 판단하거나 새로운 추천 사실을 만들어 주는 도구가 아니다. [W3C OWL 2 입문](https://www.w3.org/TR/owl2-primer/), [HermiT 공식 소스](https://github.com/owlcs/hermit-reasoner)

OWL은 열린 세계 가정을 사용한다. 복본의 서지 연결이 기록에 없더라도 아직 알려지지 않은 연결이 있을 수 있다. `Copy ⊑ ∃hasTitle.BookTitle`이라는 논리 규정과 “현재 RDF에는 서지 연결이 정확히 한 개 있어야 한다”는 등록 기준은 구분한다. 전자는 누락만으로 모순을 뜻하지 않는다. 반면 같은 서지에 서로 배타적이라고 정의한 `LiteratureTitle`과 `NonLiteratureTitle`을 모두 주장하면 논리 모순을 검사할 수 있다. 이 예제에서 추천 불리언이 `false`인 SQL 행은 추천 타입을 RDF에 추가하지 않는 방식으로 변환된다. RDF 타입의 부재 자체가 부정 사실을 뜻하지는 않는다. [W3C OWL 2 입문](https://www.w3.org/TR/owl2-primer/)

SHACL은 현재 RDF가 정한 등록 기준을 만족하는지 검사하는 언어다. 복본의 `hasTitle` 관계에 `minCount 1`과 `maxCount 1`을 적용하면 누락과 복수 연결을 찾는다. 검사 실패와 OWL의 논리 모순은 같은 판정이 아니다. SHACL 표준은 검사 규칙을 정의하고, `rdf-validate-shacl`은 이를 실행하는 JavaScript 구현체다. 이 실습은 SHACL Core를 사용한다. 이 구현체가 지원하지 않는 SHACL-SPARQL 제약은 사용하지 않는다. [W3C SHACL](https://www.w3.org/TR/shacl/), [검사 구현체의 사용법과 제한](https://github.com/zazuko/rdf-validate-shacl/tree/master/packages/shacl)

## 단위·기간·상태·중복 처리

시맨틱 레이어는 집계하는 값의 뜻을 맞춘다. 이 예제의 계약은 다음과 같다.

| 지표 | 세는 단위 | 상태·기간 | 중복 처리 |
| --- | --- | --- | --- |
| 서지 수 | `book_titles.id` | 현재 등록된 전체 서지 | 서지 식별자별 한 번 |
| 복본 수 | `book_copies.id` | 현재 등록된 전체 실물 | 복본 식별자별 한 번 |
| 현재 대출 수 | `loans.id` | `status = 'active'`, 시작일 범위 제한 없음 | 대출 식별자별 한 번 |

현재 대출 수는 “이번 달에 시작한 대출 수”나 “특정 과거 시점의 대출 수”와 다르다. 기간 지표를 만들려면 `loan_date` 범위와 시간대, 기간 경계를 합의해야 한다. 과거 시점의 상태를 복원하려면 반납 시각 등 추가 기록도 필요하다. 지금의 `status`와 대출 시작일만으로 과거 상태 전체를 알 수는 없다.

서지가 문학과 외국 문학 두 분류에 연결되면 분류 표를 결합한 뒤 한 복본이 두 행으로 보인다. 초기 데이터에서 복본 2권이 각각 두 분류와 연결되어 조인 행 수는 4개다. `COUNT(DISTINCT book_copies.id)`로 중복을 제거하면 보유 복본은 2권이다. 대출 지표도 같은 원리로 대출 식별자를 사용한다. 어떤 분류를 묶어 보여 줄지에 따라 같은 실물이 여러 분류에 나타날 수 있고, 분류별 수를 더한 값은 전체 중복 제거 수와 달라질 수 있다. [Cube 지표 정의](https://docs.cube.dev/reference/data-modeling/measures)

개념의 논리 규정과 집계 계약은 서로를 참고하며 다듬는다. OWL을 끝낸 뒤에만 지표를 설계해야 한다는 고정 개발 순서는 없다.

## 공통 지표를 조회하는 Cube

Cube 모델은 SQL 기반 데이터에 지표·차원·연결을 정의해 공통 API로 조회하게 한다. 모델은 YAML이나 JavaScript로 작성할 수 있으며, 이 실습은 `lab/cube/model/cubes/library.js`의 JavaScript 모델을 사용한다. `Library.titles`, `Library.copies`, `Library.activeLoans`는 각 식별자를 중복 제거해 센다. OWL이나 SHACL 문서를 Cube에 넣는 것만으로 이 모델이 자동 생성되는 흐름은 구현하지 않았다. 추론 결과를 지표에 사용하려면 결과를 SQL에 적재하는 규칙, 갱신 시점과 중복 처리도 작성해야 한다. [Cube 데이터 모델](https://docs.cube.dev/reference/data-modeling/cube), [지표](https://docs.cube.dev/reference/data-modeling/measures), [조회 API](https://docs.cube.dev/reference/core-data-apis/rest-api)

## 이 페이지에서 실제 실행되는 것

| 작업 | 실행 위치와 결과 |
| --- | --- |
| SQL 조회·복본 추가·반납·재귀 검색 | 브라우저의 PGlite가 현재 실습 기록에 실제 실행 |
| RDF 읽기·쓰기 | 브라우저의 N3.js가 현재 기록의 변환 결과에 실행 |
| SHACL Core 검사 | 브라우저의 rdf-validate-shacl이 현재 RDF에 실행 |
| HermiT 추론 | 별도 Java 실험에서 생성한 실제 결과를 읽음 |
| PostgreSQL·Cube 조회 | 별도 서버 실험에서 생성한 실제 결과를 읽음 |

PGlite는 WebAssembly로 만든 PostgreSQL을 페이지 안에서 실행한다. 일반 PostgreSQL 서버에 연결했다는 뜻은 아니다. HermiT와 Cube의 기록에는 입력과 실행 출처가 있으며 같은 실험을 재현하는 실습을 제공한다. 브라우저 기록을 바꿔도 저장된 서버 실행 기록은 자동 갱신되지 않는다. GitHub Pages는 정적 파일을 호스팅하므로 이 공개 페이지 자체가 Java나 Cube 서버를 운영하는 환경은 아니다. [PGlite](https://pglite.dev/), [시작하기](https://pglite.dev/docs/), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

이 도구들은 각자 맡은 일을 하고, 그 사이의 변환·실행·결과 반영은 애플리케이션 코드가 잇는다. 화면의 장 순서는 개념을 하나씩 익히기 위한 학습 동선이다.
