# 도서관 데이터 실험실

《어린 왕자》의 책 정보 1개, 실물 복본 2권, 현재 대출 1건에서 출발하는 한국어 인터랙티브 튜토리얼입니다.

**튜토리얼:** https://technoetic.github.io/library-ontology-tutorial/

책 등록·복본 추가·반납·분류 탐색·RDF 연결 오류를 직접 조작하며 PostgreSQL, 온톨로지, RDF, OWL, 재귀 CTE, HermiT, SHACL, 시맨틱 레이어, Cube Core의 역할을 구분합니다. 실제 회사 자료를 사용하지 않는 가상의 도서관 사례입니다.

## 직접 실행하는 부분

| 위치 | 도구 | 실행 내용 |
|---|---|---|
| 브라우저 | PGlite 0.5.9 | WebAssembly로 빌드된 PostgreSQL에서 실제 SQL·재귀 CTE·트랜잭션 실행 |
| 브라우저 | N3.js / rdf-validate-shacl | 현재 SQL 데이터의 명시적 RDF 매핑, 실제 Turtle 파싱·SHACL 검증 |
| 서버 실습 / CI | PostgreSQL 18 | 같은 초기 SQL 자료를 서버에 저장하고 RDF로 내보내기 |
| 서버 실습 / CI | Java HermiT 1.3.8.1099 | 실제 OWL 일관성 검사와 추천 문학 분류 추론 |
| 서버 실습 / CI | pySHACL 0.40.1 | 실제 서버 측 RDF 품질 검사 |
| 서버 실습 / CI | Cube Core 1.8.4 | PostgreSQL의 공통 지표를 실제 Cube REST API로 조회 |

GitHub Pages는 정적 호스팅입니다. 브라우저 SQL은 별도 PostgreSQL 서버 연결이 아니며, HermiT·Cube 화면은 서버 실습에서 실제 실행한 결과를 보여 줍니다. 페이지에서 변경한 브라우저 데이터가 Java·Cube 서버에 자동 전송되지는 않습니다. 서버 결과 JSON에는 엔진 버전·실행 명령·입력 파일 SHA-256이 들어 있습니다.

## 화면을 로컬에서 실행

Node.js 24와 Python 3.12 이상을 준비합니다.

```bash
npm ci
npm run dev
```

표시된 주소의 `/library-ontology-tutorial/` 경로를 엽니다. 첫 실행에는 PostgreSQL WASM 파일을 내려받습니다. 실습 DB는 메모리에 있으며 새로고침하면 초기화됩니다. 진행도만 브라우저 저장소에 남습니다.

```bash
npm test
npm run build
npm run preview
```

## 전체 기술 스택 실습

Java 17 이상, Python 3.12 이상, Docker Compose를 준비한 뒤 [서버 실습 안내](lab/README.md)를 따릅니다.

```bash
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install -r lab/requirements.txt
python lab/run_all.py --output-dir public/evidence
```

PostgreSQL → RDF 내보내기 → 실제 HermiT / pySHACL → 실제 Cube API를 검증합니다. 집계는 `1/2/1 → 2/3/2 → 2/3/1`로 변하며 SQL과 Cube 결과가 같아야 통과합니다. 분류 조인에서 생기는 중복도 검증합니다. 실습 컨테이너는 `127.0.0.1:5538`과 `127.0.0.1:4038`만 사용하고 검증 후 종료합니다. 공개된 예제 비밀번호는 이 가상 실습 전용입니다.

`npm run build`는 서버 실습 ZIP도 생성합니다. 다운로드한 ZIP에는 같은 `lab/`·`fixtures/`·실습 설명이 포함되며, 런타임 파일이나 비밀 설정은 포함되지 않습니다.

## 배포와 검증

`main`의 GitHub Actions가 브라우저 엔진 테스트, 실제 Java 추론, PostgreSQL/Cube API 검증을 모두 통과한 뒤 사이트를 빌드하고 Pages에 배포합니다. 실행 결과는 배포 사이트의 `evidence/`와 Actions의 `actual-engine-evidence` 산출물에서 확인할 수 있습니다.

- [9단계 개념 설명](docs/concepts.md)
- [공식 출처와 실행 범위](docs/sources.md)
- [실제 서버 실습](lab/README.md)
- [검증 및 배포 로그](https://github.com/Technoetic/library-ontology-tutorial/actions)

일러스트는 이 튜토리얼을 위한 가상의 도서관 장면입니다. OWL의 열린 세계 가정, SHACL의 명시적 데이터 제약, SQL의 집계 기준을 서로 구분해서 읽어 주세요. 운영 동기화에는 식별자·삭제·변경 감지·추론 및 캐시 갱신 정책을 별도로 설계해야 합니다.
