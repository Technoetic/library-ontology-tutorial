# 같은 도서관을 실제 서버로 실행하기

이 폴더는 공개 가상 데이터로만 만든 실습입니다. 웹 화면의 SQL은 브라우저의 PGlite가 실행하고, SHACL은 브라우저의 RDF validator가 실행합니다. GitHub Pages에는 Java HermiT나 Cube 서버가 없습니다. 화면에 표시되는 HermiT와 Cube 결과는 아래 명령으로 **실제 엔진을 실행한 뒤 저장한 결과**입니다.

## 준비

- Python 3.12 이상, Java 17 이상, Docker와 Docker Compose v2
- 서버를 설치하지 않고 OWL/SHACL만 실행하려면 Python과 Java만 필요합니다.
- Java는 `PATH`에 두거나 `JAVA_HOME`으로 지정합니다. 별도의 HermiT 다운로드는 필요하지 않습니다. 고정한 `owlready2 0.51` 패키지가 HermiT `1.3.8.1099` Java JAR를 포함합니다. 실행 결과에는 실제 JAR 버전과 SHA-256이 기록됩니다.
- PostgreSQL은 `18` 이미지, Cube Core는 `1.8.4` 이미지를 각각 불변 SHA-256 digest로 고정했습니다. Compose 프로젝트 이름은 `library-ontology-lab`입니다.

저장소 최상위에서 다음을 실행합니다.

```bash
python -m venv .venv
# Linux/macOS
. .venv/bin/activate
# Windows PowerShell에서는 대신 .\.venv\Scripts\Activate.ps1
python -m pip install -r lab/requirements.txt
```

## 실제 엔진 실행

```bash
# Docker 없이도 실행: 실제 Java HermiT + Python pySHACL
python -m unittest discover -s lab/tests -v
python lab/run_all.py --semantic-only --output-dir public/evidence

# Docker 실습: 실제 PostgreSQL + Cube, PostgreSQL → RDF → HermiT/SHACL도 검증
python lab/run_all.py --stack-only --output-dir public/evidence

# 위 두 경로를 모두 한 번에 실행
python lab/run_all.py --output-dir public/evidence
```

`--stack-only`도 PostgreSQL에서 내보낸 RDF에 Java HermiT를 실행하므로 Java가 필요합니다. 스크립트는 저장소의 `fixtures/library.sql`을 읽어 실습 전용 DB를 초기화합니다. 다른 DB의 설정이나 `.env`를 찾지 않습니다. 화면과 서버가 같은 SQL fixture를 사용합니다.

실행이 통과해야 JSON 증거를 만듭니다. 기존 증거를 추정 결과로 덮어쓰지 않습니다. GitHub Actions도 같은 명령을 실행하고, 결과를 저장한 다음 정적 사이트를 빌드합니다.

## 무엇을 확인하나

| 실제 실행 | 입력 변화 | 검증할 결과 |
|---|---|---|
| HermiT | 문학 자료이고 추천 사실은 없음 | 일관적, 추천문학 소속은 도출하지 않음 |
| HermiT | 같은 자료에 추천 사실 추가 | 추천문학 소속 도출 |
| HermiT | 같은 자료를 서로 배타적인 문학/비문학 클래스로 단정 | 비일관적 |
| HermiT | 사본 하나의 기록된 `hasTitle` 링크 삭제 | 열린 세계 가정에서 여전히 일관적 |
| pySHACL | 정상 / 링크 없음 / 링크 2개 | 적합 / 최소 개수 위반 / 최대 개수 위반 |
| PostgreSQL + Cube | 기본 / 새 제목·사본·대출 추가 / 기존 대출 반납 | 제목·사본·활성 대출 `1/2/1` → `2/3/2` → `2/3/1` |

`RecommendedLiterature ≡ LiteratureTitle ∩ RecommendedTitle`은 `ontology.ttl`의 OWL 정의입니다. `LiteratureTitle`과 `NonLiteratureTitle`은 배타적입니다. `Copy ⊑ ∃hasTitle.BookTitle`은 사본의 제목이 존재한다는 논리적 조건이므로, 파일에 이름 붙인 링크가 없다는 이유만으로 모순이 되지는 않습니다. `shapes.ttl`은 **기록된 링크**가 정확히 하나인지 확인합니다.

`title_categories`에는 같은 제목의 분류가 두 행 있습니다. 조인 결과의 행을 그대로 세면 하나의 대출을 두 번 셉니다. `cube/model/cubes/library.js`는 제목 ID, 사본 ID, 활성 대출 ID를 각각 `countDistinct`로 셉니다. 상태 변경 후 조회가 갱신되도록 refresh key와 실제 Cube API의 `renewQuery`도 사용합니다. Cube가 OWL을 해석하거나 SHACL을 자동으로 실행하지는 않습니다. 연결은 `run_all.py`가 명시적으로 수행합니다.

서버 실습의 변화는 새 대출까지 추가하는 검증 시나리오입니다. 웹 화면에서 제목만 추가하면 사본이나 대출이 자동으로 생기지 않으므로, 웹의 제목 추가 버튼은 다른 중간 수치를 보여줍니다.

## 서버를 직접 살펴보기

```bash
python lab/run_all.py --stack-only --keep-running --output-dir public/evidence
docker compose -f lab/compose.yaml ps
docker compose -f lab/compose.yaml exec postgres psql -U tutorial -d library_tutorial
```

실습을 마치면 기본 데이터 `1/2/1`로 돌려 놓습니다. PostgreSQL은 `127.0.0.1:5538`, Cube는 `127.0.0.1:4038`에만 노출됩니다. `compose.yaml`의 비밀번호와 API secret은 공개된 **폐기 가능한 실습용 문자열**입니다. 실제 자료나 실제 비밀번호를 이 실습에 넣지 마세요.

Cube의 실제 공통 지표 API 요청:

```bash
curl --get 'http://127.0.0.1:4038/cubejs-api/v1/load' \
  --data-urlencode 'query={"measures":["Library.titles","Library.copies","Library.activeLoans"],"renewQuery":true}'
```

진단과 정지:

```bash
docker compose -f lab/compose.yaml logs --tail 100 postgres cube
docker compose -f lab/compose.yaml down
```

실습 전용 볼륨까지 지우고 처음부터 다시 시작:

```bash
docker compose -f lab/compose.yaml down --volumes
python lab/run_all.py --stack-only --keep-running
```

## 결과 파일

- `public/evidence/hermit-results.json`: 실제 HermiT 네 시나리오
- `public/evidence/shacl-results.json`: 실제 pySHACL 세 시나리오
- `public/evidence/cube-results.json`: 실제 PostgreSQL/Cube 공통 지표, 생성 SQL, 중복 조인 검증
- `public/evidence/postgres-export.ttl`: 같은 PostgreSQL fixture에서 내보낸 RDF
- `public/evidence/pipeline-hermit-results.json`: PostgreSQL에서 내보낸 RDF에 실제 HermiT를 실행한 결과

JSON에는 엔진 버전, 실행 명령, 입력 파일 SHA-256과 정적 호스팅의 한계가 있습니다. 로컬 경로·사용자 이름·실제 계정·환경 파일은 포함하지 않습니다. 컨테이너를 종료해도 저장한 결과를 읽는 정적 페이지는 동작합니다.

참고: [OWL 2 Primer](https://www.w3.org/TR/owl2-primer/), [SHACL](https://www.w3.org/TR/shacl/), [Owlready2 reasoning](https://owlready2.readthedocs.io/en/latest/reasoning.html), [Cube measures](https://docs.cube.dev/reference/data-modeling/measures), [PostgreSQL aggregate functions](https://www.postgresql.org/docs/18/functions-aggregate.html).
