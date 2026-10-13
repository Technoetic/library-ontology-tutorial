import './styles.css';
import './layout.css';
import { Parser } from 'n3';
import { createLab } from './engine.js';
import { lessons, glossary } from './lessons.js';

const base = import.meta.env.BASE_URL;
const repo = 'https://github.com/Technoetic/library-ontology-tutorial';
const root = document.querySelector('#app');
const ids = lessons.map(lesson => lesson.id);
const initialId = location.hash.slice(1);
const state = {
  step: Math.max(0, ids.indexOf(initialId)), lab: null, snapshot: null,
  busy: false, startupError: '', message: '', error: false, seen: new Set(),
  rdf: '', rdfCopy: 'copy-one', tree: [], treeRoot: 'literature',
  shaclScenario: 'valid', shacl: null, owlScenario: 'baseline',
  hermit: null, cube: null, evidenceErrors: [], comparison: null, pipeline: null,
  sqlInput: "SELECT title FROM book_titles;", sqlResult: null, sqlOpen: false,
};
// Progress is local to this browser; the actual SQL database is reset on reload.
try { for (const id of JSON.parse(localStorage.getItem('library-lab-seen') || '[]')) if (ids.includes(id)) state.seen.add(id); } catch { /* Storage is optional. */ }
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const asset = path => `${base}${path}`;
const button = (label, action, extra = '') => `<button type="button" class="button ${extra}" data-action="${action}" data-needs-lab ${!state.lab || state.busy ? 'disabled' : ''}>${esc(label)}</button>`;
const storedButton = (label, action, selected) => `<button type="button" class="button ${selected ? 'selected' : ''}" data-action="${action}" ${state.busy ? 'disabled' : ''} aria-pressed="${selected}">${esc(label)}</button>`;
const callout = text => `<div class="callout"><p>${text}</p></div>`;
function table(rows) {
  if (!rows?.length) return '<p class="muted">결과 행이 없습니다.</p>';
  const keys = Object.keys(rows[0]);
  return `<div class="table-wrap"><table><thead><tr>${keys.map(key => `<th scope="col">${esc(key)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 100).map(row => `<tr>${keys.map(key => `<td>${esc(typeof row[key] === 'object' ? JSON.stringify(row[key]) : row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length > 100 ? '<p class="muted">처음 100행을 표시합니다.</p>' : ''}`;
}
function markSeen() {
  state.seen.add(ids[state.step]);
  try { localStorage.setItem('library-lab-seen', JSON.stringify([...state.seen])); } catch { /* Storage is optional. */ }
}
function metrics() {
  const current = state.snapshot?.metrics;
  return `<div class="metrics" aria-label="현재 브라우저 데이터의 집계">${[
    ['titles', '책 정보', '서로 다른 서지 기록', '종'],
    ['copies', '실물 복본', '도서관이 보유한 실물', '권'],
    ['activeLoans', '현재 대출', '아직 반납되지 않은 기록', '건'],
  ].map(([key, title, subtitle, unit]) => `<div class="metric"><strong data-metric="${key}">${current ? current[key] : '–'}</strong><span>${title}<small>${subtitle}</small></span><small class="unit">${unit}</small></div>`).join('')}</div>`;
}
function records() {
  const snapshot = state.snapshot;
  return `<div class="controls">${button('어린 왕자 실물 1권 추가', 'add-copy', 'primary')}${button('데미안 책 정보 등록', 'add-title')}${button('어린 왕자 반납 처리', 'return-loan')}</div>
    <div class="record-grid">
      <div class="record-group"><h4>책 정보 · 서지 기록</h4>${snapshot.titles.map(title => `<div class="record"><strong>《${esc(title.title)}》</strong><small>실물 수와 별개인 책 제목의 기록</small></div>`).join('')}</div>
      <div class="record-group"><h4>실물 복본 · 각각의 물건</h4>${snapshot.copies.map(copy => `<div class="record"><strong>${esc(copy.label)}</strong><small>${snapshot.loans.some(loan => loan.copy_id === copy.id && loan.status === 'active') ? '현재 대출 중' : '대출 중인 기록 없음'}</small></div>`).join('')}</div>
      <div class="record-group"><h4>대출 · 발생한 사건</h4>${snapshot.loans.map(loan => `<div class="record"><strong>${esc(snapshot.copies.find(copy => copy.id === loan.copy_id)?.label || loan.copy_id)}</strong><small>${loan.status === 'active' ? '독자 한 분에게 대출 중' : '반납 완료 · 이력은 유지'}</small></div>`).join('')}</div>
    </div>${callout('《데미안》의 책 정보만 등록하면 보유 실물은 늘지 않습니다. 반납 처리하면 현재 대출만 줄고, 대출 이력과 책 정보는 남습니다.')}`;
}
function ontology() {
  return `<div class="graph" aria-label="서지 정보, 실물, 대출 사건의 관계"><div class="graph-node"><strong>책 정보</strong><small>《어린 왕자》<br>《데미안》 같은 제목의 기록</small></div><div class="graph-arrow" aria-hidden="true">←</div><div class="graph-node"><strong>실물 복본</strong><small>“어떤 책 정보에 속하나”<br>각 실물을 하나씩 구별</small></div><div class="graph-arrow" aria-hidden="true">←</div><div class="graph-node"><strong>대출 사건</strong><small>“어떤 실물이 대출됐나”<br>독자·시점·반납 상태</small></div></div>
    <p class="graph-legend">← 연결을 읽는 방향: 대출은 실물을 참조하고, 실물은 책 정보를 참조합니다.</p>
    <div class="result-box"><p><strong>온톨로지가 정하는 것</strong></p><p>책 정보·실물·대출은 서로 다른 개념이며, 각각의 연결에는 의미가 있다는 약속입니다.</p><p class="muted">현재 데이터: 서지 ${state.snapshot.metrics.titles}개 · 실물 ${state.snapshot.metrics.copies}개 · 대출 이력 ${state.snapshot.loans.length}개</p></div>
    ${callout('온톨로지는 개념과 관계를 정의합니다. “현재 대출 수를 어떤 기간과 상태로 셀 것인가”는 뒤의 시맨틱 레이어에서 결정합니다. 두 설계는 서로 맞추어 반복해서 다듬을 수 있습니다.')}`;
}
function friendlyTerm(term) {
  const value = term.value;
  const local = value.split(/[\/#]/).pop();
  const title = state.snapshot.titles.find(row => value === `https://example.org/library/${encodeURIComponent(row.id)}`);
  if (title) return `《${title.title}》의 책 정보`;
  const copy = state.snapshot.copies.find(row => value === `https://example.org/library/${encodeURIComponent(row.id)}`);
  if (copy) return copy.label;
  const labels = {hasTitle:'어떤 책의 실물인가', copyNumber:'실물 식별번호', type:'유형', Copy:'실물 복본', BookTitle:'책 정보', label:'이름', title:'제목', LiteratureTitle:'문학 작품', RecommendedTitle:'추천 도서', RecommendedLiterature:'추천 문학'};
  return labels[local] || (term.termType === 'Literal' ? value : local);
}
function rdfCards() {
  const quads = new Parser().parse(state.rdf);
  const subject = `https://example.org/library/${encodeURIComponent(state.rdfCopy)}`;
  const selected = quads.filter(quad => quad.subject.value === subject);
  return `<div class="controls">${state.snapshot.copies.map(copy => storedButton(copy.label, `rdf:${copy.id}`, state.rdfCopy === copy.id)).join('')}</div>
    <div class="result-box"><p><strong>실제 RDF에서 읽은 관계 카드</strong></p>${selected.map(quad => `<div class="rdf-row"><div class="rdf-cell">${esc(friendlyTerm(quad.subject))}</div><div class="rdf-cell predicate">${esc(friendlyTerm(quad.predicate))}</div><div class="rdf-cell">${esc(friendlyTerm(quad.object))}</div></div>`).join('') || '<p class="rdf-empty">이 식별자를 주어로 한 문장이 없습니다.</p>'}</div>
    <details class="source-proof"><summary>식별자와 실제 Turtle 보기</summary><p>사람에게는 책 이름을, 프로그램에는 충돌하지 않는 IRI를 씁니다. 같은 제목의 두 실물은 서로 다른 IRI를 갖습니다.</p><pre><code>${esc(state.rdf)}</code></pre></details>
    ${callout('이 실습의 SQL → RDF 매핑은 코드에 직접 정의되어 있습니다. 식별자 규칙·동기화 시점·삭제 이력의 정책은 별도로 설계해야 하며, WITH RECURSIVE가 이 정책을 자동으로 만들어 주지는 않습니다.')}`;
}
function recursive() {
  return `<div class="controls"><label for="tree-root">시작 분류 <select id="tree-root" data-control="tree-root"><option value="literature" ${state.treeRoot === 'literature' ? 'selected' : ''}>문학</option><option value="foreign-literature" ${state.treeRoot === 'foreign-literature' ? 'selected' : ''}>외국 문학</option><option value="french-literature" ${state.treeRoot === 'french-literature' ? 'selected' : ''}>프랑스 문학</option></select></label>${button('재귀 SQL 실행', 'walk', 'primary')}</div>
    <div class="result-box"><p><strong>기록된 하위 분류를 따라간 결과</strong></p><ul class="tree-list">${state.tree.map(row => `<li style="padding-left:${10 + row.depth * 21}px">${row.depth ? '↳ ' : ''}${esc(row.label)}<span class="tree-depth">시작점에서 ${row.depth}단계</span></li>`).join('')}</ul></div>
    ${callout('분류 목록을 손으로 끝까지 펼치는 일을 SQL이 반복합니다. 이미 지나간 식별자를 경로에 저장해 순환을 멈춥니다. 이것은 저장된 연결의 탐색이며, OWL 논리를 추론하는 HermiT의 역할과 구별됩니다.')}`;
}
function proof(data, filename) {
  return `<div class="source-proof">${esc(data.engine.name)} ${esc(data.engine.version)}<br>실제 실행 명령: <code>${esc(data.command)}</code><br><a href="${asset(`evidence/${filename}`)}" target="_blank" rel="noopener">실행 결과 JSON과 입력 해시</a> · <a href="${repo}/actions" target="_blank" rel="noopener">실행한 CI 로그</a></div>`;
}
function hermit() {
  const data = state.hermit;
  const names = {baseline:'추천 사실 없음',recommended:'추천 사실 등록',conflict:'배타적인 유형 충돌','missing-link':'실물의 책 정보 연결 누락'};
  const interpretations = {baseline:'문학이라는 사실만 있습니다. 추천 사실이 없으므로 추천 문학이라는 결론은 아직 증명되지 않았습니다.',recommended:'문학이면서 추천이라는 두 사실이 등록되어, 추천 문학이라는 논리적 정의를 만족합니다.',conflict:'같은 책 정보를 서로 배타적인 문학과 비문학에 동시에 속한다고 선언했습니다.', 'missing-link':'OWL은 연결된 책 정보가 아직 기록되지 않은 채 존재할 가능성을 허용하므로, 연결 누락만으로 모순이 되지 않습니다.'};
  const current = data?.cases[state.owlScenario];
  return `<div class="controls">${Object.entries(names).map(([key, label]) => storedButton(label, `owl:${key}`, state.owlScenario === key)).join('')}</div>
    ${current ? `<div class="result-box" data-hermit-case="${state.owlScenario}"><p><strong>${esc(names[state.owlScenario])}</strong></p><p>OWL 모순 여부: <strong class="${current.consistent ? 'result-good' : 'result-bad'}">${current.consistent ? '일관성 있음' : '모순 발견'}</strong></p><p>추천 문학 분류: <strong>${current.recommendedLiteratureEntailed === null ? '모순 상태에서 판정하지 않음' : current.recommendedLiteratureEntailed ? '논리적으로 도출됨' : '현재 사실만으로 도출되지 않음'}</strong></p><p class="muted">${esc(interpretations[state.owlScenario])}</p></div>${proof(data, 'hermit-results.json')}` : evidenceMessage('hermit-results.json')}
    ${callout('여기서는 고정된 네 가지 입력에 대한 <strong>실제 HermiT 실행 결과</strong>를 비교합니다. 이 페이지가 Java 추론기를 실행하거나, 위의 브라우저 DB 변경을 HermiT에 자동으로 보내지는 않습니다. 책 정보 연결이 없다는 사실은 OWL의 열린 세계 가정에서 바로 모순이 되지 않습니다.')}`;
}
function shacl() {
  const options = [['valid','정상 연결'],['missing-link','2번 실물의 책 정보 연결 삭제'],['multiple-links','2번 실물을 두 책 정보에 연결']];
  const report = state.shacl;
  return `<div class="controls">${options.map(([value, label]) => storedButton(label, `shacl:${value}`, state.shaclScenario === value)).join('')}${button('SHACL 검사 실행', 'validate', 'primary')}</div>
    ${report ? `<div class="result-box" data-shacl-conforms="${report.conforms}"><p class="${report.conforms ? 'result-good' : 'result-bad'}">${report.conforms ? '통과 · 필수 연결과 실물 번호가 규칙에 맞습니다.' : `실패 · ${report.results.length}개의 검증 결과가 있습니다.`}</p>${report.results.map(result => `<p><strong>${esc(result.path?.split(/[\/#]/).pop() || '노드 조건')}</strong> · ${esc(result.message)}<br><small class="muted">${esc(result.focusNode)}</small></p>`).join('')}</div>` : '<div class="result-box">조건을 선택한 뒤 검사를 실행해 보세요.</div>'}
    ${report ? `<details class="source-proof"><summary>검사에 실제 사용한 RDF와 SHACL 양식</summary><p>현재 SQL 데이터에서 만든 RDF의 복사본에 선택한 오류를 적용합니다. 원본 SQL 기록은 바뀌지 않습니다.</p><pre><code>${esc(report.turtle)}</code></pre><p>검증 규칙</p><pre><code>${esc(report.shapes)}</code></pre></details>` : ''}
    ${callout('이 검사는 브라우저의 <strong>rdf-validate-shacl</strong>이 실제 RDF에 실행합니다. “실물은 책 정보를 정확히 하나 가져야 한다”는 데이터 품질 규칙입니다. HermiT의 모순 검사와 목적이 다릅니다.')}`;
}
function semantic() {
  const result = state.comparison;
  return `<div class="controls">${button('두 가지 집계 SQL 비교', 'compare', 'primary')}${button('실물 1권 추가 후 비교', 'add-compare')}</div>
    ${result ? `<div class="comparison"><div class="comparison-card"><h4>분류를 조인한 뒤 모든 행을 셈</h4><strong>${result.naive}</strong><p>같은 실물이 두 분류와 연결되어 여러 행으로 나타납니다.</p></div><div class="comparison-card"><h4>실물 식별자를 중복 제거하고 셈</h4><strong class="result-good">${result.distinct}</strong><p>COUNT(DISTINCT ...)로 실물 하나를 한 번 셉니다.</p></div></div><div class="result-box" style="margin-top:12px"><p><strong>실제로 조인된 행</strong></p>${table(result.rows)}</div>` : '<div class="result-box">집계 비교 버튼을 누르면 실제 SQL의 결과가 나타납니다.</div>'}
    ${callout('같은 데이터라도 “분류별 연결 행”, “보유 실물”, “현재 대출”은 다른 지표입니다. 시맨틱 레이어는 집계 단위·중복 제거·상태 필터·기간 기준을 공통 정의합니다. 이 예제의 현재 대출은 status = active인 모든 기록이며 별도 기간 필터는 적용하지 않습니다.')}`;
}
function cube() {
  const data = state.cube;
  return `<div class="result-box"><p><strong>SQL로 정한 기준을 공통 지표로 공개</strong></p><p>Library.titles → 책 정보 수<br>Library.copies → 보유 실물 수<br>Library.activeLoans → status가 active인 대출 수</p></div>
    ${data ? `<div class="result-box" style="margin-top:12px"><p><strong>실제 PostgreSQL과 Cube API를 각각 조회한 결과</strong></p>${table(Object.entries(data.cases).map(([name, result]) => ({'입력 상태':({'baseline':'처음','mutated':'데미안·실물·대출 추가','returned':'기존 어린 왕자 대출 반납'})[name] || name,'SQL 책 정보':result.postgres.titles,'Cube 책 정보':result.cube.titles,'SQL 실물':result.postgres.copies,'Cube 실물':result.cube.copies,'SQL 현재 대출':result.postgres.activeLoans,'Cube 현재 대출':result.cube.activeLoans})))}</div>${proof(data, 'cube-results.json')}` : evidenceMessage('cube-results.json')}
    ${callout('이 표는 <strong>서버 실습에서 실제 조회한 결과</strong>입니다. 위의 브라우저 DB와 별도의 입력 상태를 사용합니다. GitHub Pages가 Cube 서버를 호스팅하지는 않습니다. 이 실습은 JavaScript로 Cube 모델을 정의하며, RDF/OWL 모델을 자동으로 가져오지는 않습니다. Cube는 YAML 모델도 지원합니다.')}`;
}
function evidenceMessage(filename) {
  const failure = state.evidenceErrors.find(message => message.startsWith(filename));
  return failure ? `<div class="message error" role="alert">실제 실행 결과를 가져오지 못했습니다: ${esc(failure)}<br>새로고침하거나 <a href="${repo}/actions" target="_blank" rel="noopener">실행 로그</a>를 확인하세요.</div>` : '<div class="loading-panel">실제 엔진 실행 결과를 불러오는 중입니다.</div>';
}
function pipeline() {
  const result = state.pipeline;
  return `<div class="controls">${button('현재 데이터의 연결 과정 실행', 'pipeline', 'primary')}${button('실물 1권 추가 후 다시 실행', 'add-pipeline')}</div>
    ${result ? `<div class="pipeline"><div class="pipeline-stage"><span class="stage-number">01 · SQL</span><strong>기록 확인</strong><small>서지 ${result.metrics.titles} · 실물 ${result.metrics.copies}<br>현재 대출 ${result.metrics.activeLoans}</small></div><div class="pipeline-stage"><span class="stage-number">02 · RDF</span><strong>관계 문장 생성</strong><small>명시한 매핑으로<br>${result.triples}개 RDF 문장</small></div><div class="pipeline-stage"><span class="stage-number">03 · SHACL</span><strong>필수 조건 검사</strong><small>${result.conforms ? '현재 데이터 통과' : '검증 오류 발견'}<br>실제 브라우저 검사</small></div><div class="pipeline-stage"><span class="stage-number">04 · 지표 SQL</span><strong>공통 기준 집계</strong><small>중복 제거 실물 ${result.distinctCopies}<br>조인 행 ${result.joinedCopies}개</small></div></div><p class="source-proof">실행 시각: ${esc(result.at)} · 각 단계는 지금 브라우저의 같은 SQL 데이터를 사용합니다.</p>` : '<div class="result-box">현재 DB → RDF → 검증 → 집계를 한 번에 실행해 보세요.</div>'}
    ${callout('브라우저 단계는 위 버튼으로 직접 연결해 실행합니다. 별도 서버 실습은 같은 초기 자료를 PostgreSQL에서 RDF로 내보내고, HermiT·pySHACL·Cube API까지 실제로 검증합니다. 운영 시스템의 자동 동기화에는 변경 감지·삭제 정책·추론 및 캐시 갱신 시점을 추가로 정해야 합니다.')}
    <div class="controls" style="margin-top:17px"><a class="button primary" href="${asset('downloads/library-server-lab.zip')}" download>실제 서버 실습 내려받기</a><a class="button" href="${repo}/tree/main/lab" target="_blank" rel="noopener">실습 코드와 실행 방법</a></div>`;
}
const experiments = {books:records,ontology,rdf:rdfCards,recursive,owl:hermit,shacl,semantic,cube,pipeline};
function render() {
  const lesson = lessons[state.step];
  const stored = ['owl','cube'].includes(lesson.id);
  const readyText = state.startupError ? `실행 엔진 초기화 실패: ${state.startupError}` : state.lab ? '브라우저 PostgreSQL 준비 완료 · 이 탭의 실습 데이터만 변경됩니다. 새로고침하면 초기 상태로 돌아갑니다.' : '브라우저 PostgreSQL을 준비하고 있습니다. 첫 실행에는 SQL 엔진 파일을 내려받아 잠시 걸릴 수 있습니다.';
  const experiment = state.lab || stored ? experiments[lesson.id]() : '<div class="loading-panel">실행 엔진이 준비되면 조작할 수 있습니다. 개념 설명과 실제 코드는 먼저 읽어 보세요.</div>';
  root.innerHTML = `<header class="site-header"><div class="header-inner"><a class="brand" href="${base}"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 6v14"/></svg></span>도서관 데이터 실험실</a><div class="header-links"><a class="github-link" href="${repo}" target="_blank" rel="noopener">GitHub ↗</a><a class="outline-link" href="${asset('downloads/library-server-lab.zip')}" download>서버 실습 내려받기 ↓</a></div></div></header>
    <section class="hero" aria-labelledby="page-title"><div><p class="eyebrow">A LIBRARY, NINE CONNECTED IDEAS</p><h1 id="page-title">같은 책,<span>다른 질문.</span></h1><p class="hero-description">《어린 왕자》 한 권에서 시작해 데이터의 구조, 의미, 검증과 집계를 배웁니다. 기록을 직접 바꾸고 실제 SQL과 RDF 결과를 확인해 보세요.</p><div class="hero-meta"><span>9단계 인터랙티브 튜토리얼</span><span>브라우저 SQL · RDF 검증</span><span>실제 서버 실습 포함</span></div></div><div class="hero-visual"><img src="${asset('illustrations/01.png')}" alt="어린 왕자 책 정보 하나와 실물 두 권, 현재 대출 하나를 나누어 세는 도서관" width="1672" height="941" fetchpriority="high"><div class="hero-caption"><strong>처음 상태 · 책 정보 1 / 실물 2 / 현재 대출 1</strong><span>THE LIBRARY LAB</span></div></div></section>
    <div class="status-bar ${state.lab ? 'ready' : ''} ${state.startupError ? 'error' : ''}" role="status" data-ready="${Boolean(state.lab)}"><span class="status-dot" aria-hidden="true"></span><span class="status-text">${esc(readyText)}</span><button class="reset-button" data-action="reset" ${!state.lab || state.busy ? 'disabled' : ''}>초기 상태로 ↺</button></div>
    <div class="workspace"><aside class="sidebar" aria-label="학습 단계"><div class="sidebar-top"><span>LEARNING PATH</span><span>${state.seen.size} / 9 살펴봄</span></div><div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${state.seen.size / 9 * 100}%"></div></div><nav class="lesson-nav">${lessons.map((item, index) => `<button class="nav-button ${state.step === index ? 'active' : ''}" data-step="${index}" ${state.step === index ? 'aria-current="step"' : ''}><span class="nav-number">${String(index + 1).padStart(2,'0')}</span><span class="nav-copy"><strong>${esc(item.title)}</strong><small>${esc(item.tool)}</small></span></button>`).join('')}</nav><div class="sidebar-note">실생활 비유로 이해하고,<br>실제 코드로 확인합니다.<br>운영 자료가 아닌 가상의 도서관 기록을 사용합니다.<br><a href="#glossary">약어와 용어 모아 보기 ↓</a></div></aside>
    <main class="main">${metrics()}${state.message ? `<div class="message ${state.error ? 'error' : ''}" role="${state.error ? 'alert' : 'status'}">${esc(state.message)}</div>` : ''}
    <article class="lesson-card" id="lesson" tabindex="-1"><div class="lesson-heading"><div class="chapter-tag">CHAPTER ${String(state.step + 1).padStart(2,'0')} / ${esc(lesson.tool)}</div><h2>${esc(lesson.title)}</h2><p class="analogy">${esc(lesson.analogy)}</p></div><div class="lesson-intro"><figure class="lesson-figure"><img src="${asset(lesson.figure)}" alt="${esc(lesson.alt)}" width="1672" height="941" loading="lazy"><figcaption>같은 도서관 사례로 각 도구의 역할을 연결합니다.</figcaption></figure><div class="explanation">${lesson.explanation.map(text => `<p>${esc(text)}</p>`).join('')}</div></div><section class="experiment" aria-label="직접 해보는 실습"><div class="experiment-header"><h3>직접 확인해 보세요</h3><span class="engine-badge ${stored ? 'stored' : ''}">${stored ? '실제 실행 결과 · 저장된 증거' : lesson.id === 'shacl' ? '브라우저에서 실제 SHACL 실행' : ['rdf','ontology'].includes(lesson.id) ? '현재 SQL 데이터에서 생성' : '브라우저에서 실제 SQL 실행'}</span></div><p class="challenge">${esc(lesson.challenge)}</p>${experiment}</section><div class="code-section"><details><summary>실제 코드와 공식 문서 펼치기</summary><p class="code-label">${esc(lesson.language)} · 아래 코드는 실습 저장소에서도 확인할 수 있습니다.</p><pre><code>${esc(lesson.code)}</code></pre><div class="source-links">${lesson.sources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)} ↗</a>`).join('')}</div></details></div></article>
    <details class="sql-console" ${state.sqlOpen ? 'open' : ''}><summary>SQL 자유 실습 <small>PGlite · WebAssembly로 실행되는 PostgreSQL</small></summary><p>실제 SQL을 실행합니다. 여러 문장은 한 번에 실행할 수 없습니다. 예제 데이터가 바뀌어 실습이 막히면 “초기 상태로”를 누르세요.</p><label class="code-label" for="sql-input">SQL 입력</label><textarea class="sql-input" id="sql-input" spellcheck="false">${esc(state.sqlInput)}</textarea><div class="controls">${button('SQL 실행', 'sql', 'primary')}${button('예제 집계 SQL', 'sql-example')}</div><div class="sql-results result-box" ${state.sqlResult ? '' : 'hidden'}>${state.sqlResult ? table(state.sqlResult.rows) : ''}</div></details>
    <div class="lesson-footer">${state.step ? `<button class="button" data-step="${state.step - 1}">← 이전 단계</button>` : '<span>책 정보부터 차근차근 시작하세요.</span>'}<span>${state.step + 1} / 9</span>${state.step < 8 ? `<button class="button primary" data-step="${state.step + 1}">다음 단계 →</button>` : `<a class="button primary" href="${repo}" target="_blank" rel="noopener">실제 코드로 이어가기 ↗</a>`}</div>
    <section class="glossary" id="glossary"><h3>약어와 용어 모아 보기</h3><div class="glossary-grid">${glossary.map(item => `<div class="glossary-item"><strong>${esc(item.term)}</strong><small>${esc(item.fullName)}</small><p>${esc(item.meaning)}</p></div>`).join('')}</div></section></main></div>
    <footer class="footer"><div>GitHub Pages는 정적 사이트입니다. PGlite·SHACL은 브라우저에서 실행하고, HermiT·Cube는 실제 실행한 증거와 재현 가능한 서버 실습으로 제공합니다.</div><a href="${repo}/blob/main/docs/sources.md" target="_blank" rel="noopener">공식 출처와 실행 범위 ↗</a></footer>`;
}

async function compare() {
  const result = await state.lab.query(`SELECT COUNT(c.id)::int AS naive, COUNT(DISTINCT c.id)::int AS distinct
    FROM book_copies c JOIN title_categories tc ON tc.title_id = c.title_id`);
  const rows = await state.lab.query(`SELECT c.label AS "실물", tc.category AS "분류 식별자"
    FROM book_copies c JOIN title_categories tc ON tc.title_id = c.title_id ORDER BY c.id, tc.category`);
  state.comparison = {...result.rows[0],rows:rows.rows};
}
async function runPipeline() {
  const snapshot = await state.lab.getSnapshot();
  const rdf = await state.lab.getRdf();
  const report = await state.lab.validateRdf('valid');
  await compare();
  state.pipeline = {metrics:snapshot.metrics,triples:new Parser().parse(rdf.turtle).length,conforms:report.conforms,distinctCopies:state.comparison.distinct,joinedCopies:state.comparison.naive,at:new Date().toLocaleString('ko-KR')};
}
async function prepare() {
  if (!state.lab) return;
  if (ids[state.step] === 'rdf') state.rdf = (await state.lab.getRdf()).turtle;
  if (ids[state.step] === 'recursive') state.tree = await state.lab.readSubjects(state.treeRoot);
  if (ids[state.step] === 'semantic') await compare();
}
async function refreshSnapshot() {
  state.snapshot = await state.lab.getSnapshot();
  state.shacl = null; state.pipeline = null;
  if (!state.snapshot.copies.some(copy => copy.id === state.rdfCopy)) state.rdfCopy = 'copy-one';
  await prepare();
}
async function action(actionName) {
  if (state.busy) return;
  state.busy = true; state.message = ''; state.error = false;
  root.querySelectorAll('[data-needs-lab]').forEach(element => { element.disabled = true; });
  try {
    if (actionName.startsWith('owl:')) state.owlScenario = actionName.slice(4);
    else if (actionName.startsWith('rdf:')) state.rdfCopy = actionName.slice(4);
    else if (actionName.startsWith('shacl:')) { state.shaclScenario = actionName.slice(6); state.shacl = null; }
    else if (!state.lab) throw new Error('SQL 실행 엔진이 아직 준비되지 않았습니다.');
    else if (actionName === 'reset') {
      await state.lab.reset(); state.shaclScenario = 'valid'; state.sqlResult = null;
      state.comparison = null; await refreshSnapshot(); state.message = '처음 상태로 돌아왔습니다. 책 정보 1개 · 실물 2권 · 현재 대출 1건입니다.';
    } else if (['add-copy','add-compare','add-pipeline'].includes(actionName)) {
      await state.lab.addCopy(); await refreshSnapshot();
      if (actionName === 'add-compare') await compare();
      if (actionName === 'add-pipeline') await runPipeline();
      state.message = '《어린 왕자》 실물 1권을 추가했습니다. 책 정보 수는 그대로입니다.';
    } else if (actionName === 'add-title') {
      if (state.snapshot.titles.some(title => title.title === '데미안')) state.message = '《데미안》의 책 정보는 이미 등록되어 있습니다.';
      else { await state.lab.addTitle(); await refreshSnapshot(); state.message = '《데미안》의 책 정보를 등록했습니다. 실물은 아직 추가하지 않았습니다.'; }
    } else if (actionName === 'return-loan') {
      await state.lab.returnLoan(); await refreshSnapshot(); state.message = '《어린 왕자》 대출을 반납 처리했습니다. 이력은 남고 현재 대출 수가 줄었습니다.';
    } else if (actionName === 'walk') state.tree = await state.lab.readSubjects(state.treeRoot);
    else if (actionName === 'validate') state.shacl = await state.lab.validateRdf(state.shaclScenario);
    else if (actionName === 'compare') await compare();
    else if (actionName === 'pipeline') await runPipeline();
    else if (actionName === 'sql') {
      const sql = root.querySelector('#sql-input').value;
      state.sqlOpen = true; state.sqlInput = sql; state.sqlResult = await state.lab.query(sql); await refreshSnapshot();
      state.message = `SQL 실행 완료 · ${state.sqlResult.rows.length}행을 반환했습니다.`;
    } else if (actionName === 'sql-example') {
      state.sqlOpen = true; state.sqlInput = "SELECT COUNT(c.id) AS joined_rows,\n       COUNT(DISTINCT c.id) AS copies\nFROM book_copies c\nJOIN title_categories tc ON tc.title_id = c.title_id;";
    }
  } catch (error) {
    state.message = error.message || String(error); state.error = true;
  } finally {
    state.busy = false; render();
    root.querySelector(`[data-action="${CSS.escape(actionName)}"]`)?.focus({preventScroll:true});
  }
}
root.addEventListener('click', async event => {
  const navigation = event.target.closest('[data-step]');
  if (navigation && !state.busy) {
    state.busy = true;
    state.step = Number(navigation.dataset.step); state.message = ''; state.sqlResult = null;
    history.replaceState(null,'',`${location.pathname}${location.search}#${ids[state.step]}`); markSeen();
    try { await prepare(); } catch (error) { state.message = error.message; state.error = true; }
    state.busy = false; render(); root.querySelector('#lesson').focus({preventScroll:true});
    if (navigation.closest('.lesson-footer')) root.querySelector('#lesson').scrollIntoView({behavior:'smooth',block:'start'});
  }
  const control = event.target.closest('[data-action]');
  if (control && !control.disabled) await action(control.dataset.action);
});
root.addEventListener('change', event => {
  if (event.target.dataset.control === 'tree-root') state.treeRoot = event.target.value;
  if (event.target.id === 'sql-input') state.sqlInput = event.target.value;
});
root.addEventListener('input', event => {
  if (event.target.id === 'sql-input') state.sqlInput = event.target.value;
});
root.addEventListener('toggle', event => {
  if (event.target.matches('.sql-console') && event.target.isConnected) state.sqlOpen = event.target.open;
}, true);
window.addEventListener('hashchange', async () => {
  const step = ids.indexOf(location.hash.slice(1));
  if (step < 0 || step === state.step || state.busy) return;
  state.busy = true; state.step = step; markSeen();
  try { await prepare(); } catch (error) { state.message = error.message; state.error = true; }
  finally { state.busy = false; render(); }
});
markSeen(); render();
async function loadEvidence(filename) {
  try {
    const response = await fetch(asset(`evidence/${filename}`));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.execution !== 'actual-engine-run') throw new Error('실제 실행 증거 형식이 아닙니다.');
    return data;
  } catch (error) {
    throw new Error(`${filename}: ${error.message || String(error)}`);
  }
}
// These are executed artifacts, deliberately separate from the live browser DB.
Promise.allSettled([loadEvidence('hermit-results.json'),loadEvidence('cube-results.json')]).then(results => {
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') state[index === 0 ? 'hermit' : 'cube'] = result.value;
    else state.evidenceErrors.push(result.reason.message);
  }
  render();
});
try {
  const lab = await createLab(); const snapshot = await lab.getSnapshot();
  state.lab = lab; state.snapshot = snapshot; await prepare(); render();
} catch (error) { state.startupError = error.message || String(error); render(); }
