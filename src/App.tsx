import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { activeText, blankProject, blankSegment, canParent, cardTypes, criteriaFields, descendants, duplicateProject, exportManuscript, id, importSegments, kinds, now, orderedSegments, paragraphs, pathOf, promptKinds, reviewItems, selectedSegment, snapshot, splitText, statuses, storeCandidates, type Card, type Kind, type Project, type Segment, type Workspace } from './model';
import { applyBackup, criteriaOnly, download, loadWorkspace, parseBackup, saveWorkspace, type Backup } from './storage';
import { buildPrompt, contextFresh, contextPackage, inspect, referenceScenes, searchContext } from './engine';
const tabs = ['작품 서재', '작품 기준집', '원고 서재', '확장본·후보', '검수', '맥락 검색', '프롬프트', '백업'];
const json = (x: unknown) => JSON.stringify(x, null, 2);
const fullBackup = (w: Workspace) => download('writing-studio-backup-' + new Date().toISOString().slice(0, 10) + '.json', json({ format: 'writing-studio', version: 2, kind: 'workspace', workspace: w }));
const message = (e: unknown) => e instanceof Error ? e.message : String(e);
function Field({ label, value, onChange, area = false, large = false, ...props }: {
    label: string;
    value: string;
    onChange: (s: string) => void;
    area?: boolean;
    large?: boolean;
    placeholder?: string;
}) { return <label className={'field' + (large ? ' wide' : '')}><span>{label}</span>{area ? <textarea aria-label={label} className={large ? 'manuscript' : ''} value={value} onChange={e => onChange(e.target.value)} {...props}/> : <input aria-label={label} value={value} onChange={e => onChange(e.target.value)} {...props}/>}</label>; }
function Select({ label, value, onChange, children }: {
    label: string;
    value: string;
    onChange: (s: string) => void;
    children: ReactNode;
}) { return <label className="field"><span>{label}</span><select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{children}</select></label>; }
function Empty({ children }: {
    children: ReactNode;
}) { return <div className="empty">{children}</div>; }
async function copy(text: string, setNotice: (s: string) => void) { try {
    await navigator.clipboard.writeText(text);
    setNotice('복사했습니다. 원하는 곳에 직접 붙여넣으세요.');
}
catch {
    setNotice('자동 복사를 사용할 수 없습니다. 표시된 본문을 길게 눌러 선택하고 복사하세요.');
} }
export default function App() {
    const [ws, setWs] = useState<Workspace | null>(null), [tab, setTab] = useState('작품 서재'), [notice, setNotice] = useState(''), [error, setError] = useState(''), [status, setStatus] = useState('불러오는 중');
    const revision = useRef(0), queue = useRef(Promise.resolve()), failed = useRef(false), version = useRef(0), saved = useRef(0), flush = useRef(() => {});
    const { needRefresh: [needRefresh], offlineReady: [offlineReady], updateServiceWorker } = useRegisterSW();
    useEffect(() => { let cancelled = false; loadWorkspace().then(r => { if (cancelled)
        return; revision.current = r.revision; setWs(r.workspace); if (r.migrated)
        setNotice('이전 편집실 데이터를 별도 작품으로 가져왔습니다. 이전 저장소도 그대로 보존했습니다.'); }).catch(e => { if (!cancelled) {
        failed.current = true;
        setError('저장된 자료를 읽지 못했습니다. ' + message(e));
        setStatus('불러오기 실패');
    } }); return () => { cancelled = true; }; }, []);
    useEffect(() => {
        if (!ws) return;
        const n = ++version.current;
        let enqueued = false;
        setStatus('저장 대기');
        const persist = () => {
            if (enqueued) return;
            enqueued = true;
            clearTimeout(timer);
            queue.current = queue.current.then(async () => {
                if (failed.current) return;
                setStatus('저장 중');
                try {
                    revision.current = await saveWorkspace(ws, revision.current);
                    saved.current = n;
                    if (n === version.current) setStatus('이 브라우저에 저장됨');
                } catch (e) {
                    failed.current = true;
                    setError(message(e));
                    setStatus('저장 실패');
                }
            });
        };
        const timer = setTimeout(persist, 450);
        flush.current = persist;
        return () => clearTimeout(timer);
    }, [ws]);
    useEffect(() => {
        const hidden = () => { if (document.visibilityState === 'hidden') flush.current(); };
        const pagehide = () => flush.current();
        document.addEventListener('visibilitychange', hidden);
        window.addEventListener('pagehide', pagehide);
        return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', pagehide); };
    }, []);
    useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (saved.current !== version.current) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, []);
    const change = (fn: (w: Workspace) => Workspace) => setWs(w => w ? fn(w) : w);
    const p = ws?.projects.find(p => p.id === ws.activeId);
    const update = (fn: (p: Project) => Project) => { if (!p)
        return; const pid = p.id; change(w => ({ ...w, projects: w.projects.map(x => x.id === pid ? { ...fn(x), updatedAt: now() } : x) })); };
    const act = (fn: () => void) => { try {
        fn();
    }
    catch (e) {
        setNotice(message(e));
    } };
    return <><header><div><span className="eyebrow">나의 이야기, 나의 선택</span><h1>장편 원고 편집실</h1></div><div className="header-controls">{ws && <Select label="현재 작품" value={ws.activeId} onChange={activeId => change(w => ({ ...w, activeId }))}><option value="">작품 선택</option>{ws.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}<span className={'save-status' + (error ? ' danger' : '')} role="status">{status}</span></div></header>
 <div className="privacy">원고와 설정은 현재 기기의 브라우저에만 저장됩니다. GitHub로 전송되지 않습니다. 기기를 옮길 때는 백업 JSON을 복원하세요.</div>
 {error && <div role="alert" className="alert">{error} {ws && <button onClick={() => fullBackup(ws)}>현재 작업 전체 백업</button>}<button onClick={() => location.reload()}>다시 불러오기</button>{!ws && <button onClick={() => { const raw = localStorage.getItem('writing-studio-v1'); if (raw)
        download('writing-studio-legacy-backup.json', raw);
    else
        setNotice('이전 형식의 자료가 없습니다. 브라우저 데이터를 삭제하지 말고 복구를 요청하세요.'); }}>이전 저장 자료 다운로드</button>}</div>}
 {notice && <div className="notice" role="status">{notice}<button aria-label="알림 닫기" onClick={() => setNotice('')}>닫기</button></div>}
 {needRefresh && <div className="notice">새 버전이 준비되었습니다.<button disabled={status !== '이 브라우저에 저장됨'} onClick={() => updateServiceWorker(true)}>저장 후 새 버전 열기</button></div>}
 <nav aria-label="작업 공간">{tabs.map(t => <button key={t} className={tab === t ? 'active' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>)}</nav>
 <main>{!ws ? <Empty>저장소를 불러오고 있습니다. 자료를 읽지 못했다면 위 안내를 확인하세요.</Empty> : tab === '작품 서재' ? <Library ws={ws} change={change} open={() => setTab('원고 서재')} notice={setNotice}/> : tab === '백업' ? <Backups ws={ws} change={change} notice={setNotice}/> : !p ? <Empty>작품 서재에서 새 작품을 만들거나 작품을 선택하세요.</Empty> : <ProjectPanel key={p.id} p={p} update={update} tab={tab} setTab={setTab} notice={setNotice} act={act}/>}</main>
 <footer>API 연결 없이 사용하는 개인 편집 도구 · 자동 윤문과 자동 합치기를 하지 않습니다.{offlineReady ? ' · 오프라인 준비됨' : ''}</footer></>;
}
type Change = (fn: (w: Workspace) => Workspace) => void;
function Library({ ws, change, open, notice }: {
    ws: Workspace;
    change: Change;
    open: () => void;
    notice: (s: string) => void;
}) { const [name, setName] = useState(''); return <><div className="section-heading"><div><h2>작품 서재</h2><p>작품마다 기준집과 원고를 따로 보관합니다.</p></div><span className="badge">{ws.projects.length}개 작품</span></div><form className="card inline" onSubmit={e => { e.preventDefault(); if (!name.trim())
    return; const p = blankProject(name); change(w => ({ ...w, projects: [...w.projects, p], activeId: p.id })); setName(''); notice('빈 작품을 만들었습니다. 기준집과 원고를 넣어 시작하세요.'); }}><Field label="새 작품 이름" value={name} onChange={setName}/><button className="primary" disabled={!name.trim()}>새 작품 만들기</button></form><div className="project-grid">{ws.projects.map(p => <article className="card" key={p.id}><span className="eyebrow">{p.id === ws.activeId ? '현재 작품' : '작품'}</span><h3>{p.name}</h3><p>원고 {p.segments.length}개 · 설정 카드 {p.cards.length}개</p><p className="muted">{new Date(p.updatedAt).toLocaleString('ko-KR')}</p><div className="actions"><button className="primary" onClick={() => { change(w => ({ ...w, activeId: p.id })); open(); }}>열기</button><button onClick={() => { const name = window.prompt('작품 이름', p.name); if (name?.trim())
    change(w => ({ ...w, projects: w.projects.map(x => x.id === p.id ? { ...x, name: name.trim(), updatedAt: now() } : x) })); }}>이름 수정</button><button onClick={() => { const clone = duplicateProject(p); change(w => ({ ...w, projects: [...w.projects, clone], activeId: clone.id })); }}>복제</button><button className="danger" onClick={() => { if (confirm(`“${p.name}” 작품과 모든 원고를 삭제할까요? 필요한 자료는 백업 탭에서 먼저 내려받으세요.`))
    change(w => ({ ...w, projects: w.projects.filter(x => x.id !== p.id), activeId: w.activeId === p.id ? '' : w.activeId })); }}>삭제</button></div></article>)}</div>{!ws.projects.length && <Empty>새 작품 이름을 입력해 나만의 편집실을 시작하세요. 기본 원고와 설정은 비어 있습니다.</Empty>}</>; }
type PanelProps = {
    p: Project;
    update: (fn: (p: Project) => Project) => void;
    tab: string;
    setTab: (s: string) => void;
    notice: (s: string) => void;
    act: (fn: () => void) => void;
};
function ProjectPanel({ p, update, tab, setTab, notice, act }: PanelProps) {
    const s = selectedSegment(p);
    const edit = (patch: Partial<Segment>) => update(p => ({ ...p, segments: p.segments.map(x => x.id === p.selectedId ? { ...x, ...patch, review: ['original','expanded','final'].some(k => k in patch) ? {} : (patch.review || x.review) } : x) }));
    return <><div className="section-heading"><div><span className="eyebrow">{p.name}</span><h2>{tab}</h2></div>{tab !== '작품 기준집' && <Select label="작업할 원고" value={p.selectedId} onChange={selectedId => update(p => ({ ...p, selectedId }))}><option value="">원고 선택</option>{orderedSegments(p).map(s => <option key={s.id} value={s.id}>{pathOf(p, s)}</option>)}</Select>}</div>
 {tab === '작품 기준집' ? <Criteria p={p} update={update}/> : tab === '원고 서재' ? <Manuscripts p={p} update={update} edit={edit} notice={notice} act={act}/> : !s ? <Empty>원고 서재에서 원고를 추가하세요.</Empty> : <>
 {['검수', '맥락 검색', '프롬프트'].includes(tab) && <div className="source-bar"><Select label="검토할 버전" value={p.sourceMode} onChange={sourceMode => update(p => ({ ...p, sourceMode: sourceMode as Project['sourceMode'] }))}><option value="original">원본</option><option value="expanded">AI 확장본</option><option value="final">최종본</option></Select><span>{activeText(p).length.toLocaleString()}자 · {s.title}</span></div>}
 {tab === '확장본·후보' ? <Comparison p={p} s={s} edit={edit} notice={notice}/> : tab === '검수' ? <Review p={p} s={s} edit={edit}/> : tab === '맥락 검색' ? <Context p={p} update={update} notice={notice}/> : tab === '프롬프트' ? <section className="card"><Select label="프롬프트 종류" value={p.promptKind} onChange={v => update(p => ({ ...p, promptKind: v as Project['promptKind'] }))}>{promptKinds.map(k => <option key={k}>{k}</option>)}</Select><p>기준집은 입력한 요약과 항목 원문을 포함합니다. 관련 자료는 맥락 검색에서 선택한 카드와 참고 원고만 포함합니다.</p>{!contextFresh(p) && <p className="warning">현재 원고의 맥락을 아직 선택하지 않았습니다. <button onClick={() => setTab('맥락 검색')}>맥락 검색으로 이동</button></p>}<textarea aria-label="생성된 프롬프트" className="manuscript" readOnly value={buildPrompt(p)}/><div className="actions"><button className="primary" onClick={() => copy(buildPrompt(p), notice)}>프롬프트 복사</button><button onClick={() => download('writing-studio-prompt.txt', buildPrompt(p), 'text/plain;charset=utf-8')}>TXT 다운로드</button></div><p className="muted">복사한 내용을 ChatGPT 또는 Gemini에 직접 붙여넣으세요. 붙여넣은 자료는 해당 서비스에 전달됩니다.</p></section> : null}</>}
 </>;
}
function Criteria({ p, update }: {
    p: Project;
    update: PanelProps['update'];
}) { const editCard = (id: string, patch: Partial<Card>) => update(p => ({ ...p, cards: p.cards.map(c => c.id === id ? { ...c, ...patch } : c), contextQuery: '', contextSegmentId: '' })); return <><section className="card"><h3>작품 기준집</h3><p>상담하며 정리한 자료를 항목별로 붙여넣으세요. 요약은 직접 정리한 내용을 넣습니다.</p><div className="fields">{criteriaFields.map(k => <Field key={k} label={k} area value={p.criteria[k]} onChange={v => update(p => ({ ...p, criteria: { ...p.criteria, [k]: v } }))}/>)}</div></section><section className="card"><div className="section-heading"><h3>설정 카드</h3><button onClick={() => update(p => ({ ...p, cards: [...p.cards, { id: id(), type: '인물', title: '', aliases: '', keywords: '', body: '', related: '', tone: '', avoid: '' }], contextQuery: '', contextSegmentId: '' }))}>카드 추가</button></div><p>이름·별칭·키워드가 원고에 나오면 카드를 찾습니다. 관련 카드에는 다른 카드의 제목을 쉼표로 입력하세요.</p>{p.cards.map(c => <details key={c.id} className="subcard" open={!c.title}><summary>{c.type} · {c.title || '새 카드'}</summary><div className="fields"><Select label="카드 종류" value={c.type} onChange={v => editCard(c.id, { type: v as Card['type'] })}>{cardTypes.map(k => <option key={k}>{k}</option>)}</Select>{(['title', 'aliases', 'keywords', 'related', 'tone', 'avoid', 'body'] as const).map((k, i) => <Field key={k} label={['이름 또는 제목', '별칭 (쉼표 구분)', '검색 키워드 (쉼표 구분)', '관련 카드 제목', '말투·관계 기준', '피할 표현 (쉼표 구분)', '카드 내용'][i]} value={c[k]} area={['tone', 'body'].includes(k)} onChange={v => editCard(c.id, { [k]: v })}/>)}</div><button className="danger" onClick={() => { if (confirm('이 설정 카드를 삭제할까요?'))
    update(p => ({ ...p, cards: p.cards.filter(x => x.id !== c.id), selectedCards: p.selectedCards.filter(x => x !== c.id), contextQuery: '', contextSegmentId: '' })); }}>카드 삭제</button></details>)}</section><section className="card"><h3>표현과 검사 규칙</h3><div className="fields"><Field label="금지어 (쉼표 또는 줄바꿈)" area value={p.banned} onChange={banned => update(p => ({ ...p, banned }))}/><Field label="주의어 (쉼표 또는 줄바꿈)" area value={p.caution} onChange={caution => update(p => ({ ...p, caution }))}/><Field label="반복 표현 묶음 (한 줄에 한 묶음, 표현 / 표현)" area value={p.repeat} onChange={repeat => update(p => ({ ...p, repeat }))}/><label className="field"><span>반복 알림 횟수</span><input aria-label="반복 알림 횟수" type="number" min="2" max="100" value={p.threshold} onChange={e => update(p => ({ ...p, threshold: Math.min(100, Math.max(2, Number(e.target.value) || 2)) }))}/></label></div><p>설정 충돌이나 말투 위반은 찾을 표현과 확인할 이유를 규칙으로 등록하세요. 텍스트 일치 방식으로 표시합니다.</p>{p.rules.map(r => <div key={r.id} className="subcard fields"><Field label="찾을 표현" value={r.term} onChange={term => update(p => ({ ...p, rules: p.rules.map(x => x.id === r.id ? { ...x, term } : x) }))}/><Field label="확인할 이유" value={r.message} onChange={message => update(p => ({ ...p, rules: p.rules.map(x => x.id === r.id ? { ...x, message } : x) }))}/><Field label="범위 키워드 (빈칸이면 전체)" value={r.scope} onChange={scope => update(p => ({ ...p, rules: p.rules.map(x => x.id === r.id ? { ...x, scope } : x) }))}/><Select label="검사 분류" value={r.level} onChange={level => update(p => ({ ...p, rules: p.rules.map(x => x.id === r.id ? { ...x, level: level as typeof r.level } : x) }))}><option>필수 수정</option><option>확인 필요</option></Select><button onClick={() => update(p => ({ ...p, rules: p.rules.filter(x => x.id !== r.id) }))}>규칙 삭제</button></div>)}<button onClick={() => update(p => ({ ...p, rules: [...p.rules, { id: id(), term: '', message: '', scope: '', level: '확인 필요' }] }))}>검사 규칙 추가</button></section></>; }
function Manuscripts({ p, update, edit, notice, act }: {
    p: Project;
    update: PanelProps['update'];
    edit: (x: Partial<Segment>) => void;
    notice: (s: string) => void;
    act: PanelProps['act'];
}) {
    const s = selectedSegment(p);
    const [kind, setKind] = useState<Kind>('장면'), [parent, setParent] = useState(''), [title, setTitle] = useState(''), [preview, setPreview] = useState<ReturnType<typeof splitText> | null>(null);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const draft = (patch: Partial<Project['importDraft']>) => { setPreview(null); update(p => ({ ...p, importDraft: { ...p.importDraft, ...patch } })); };
    const move = (direction: number) => { if (!s)
        return; update(p => { const list = [...p.segments], siblings = list.filter(x => x.parentId === s.parentId), other = siblings[siblings.findIndex(x => x.id === s.id) + direction]; if (!other)
        return p; const a = list.findIndex(x => x.id === s.id), b = list.findIndex(x => x.id === other.id); [list[a], list[b]] = [list[b], list[a]]; return { ...p, segments: list }; }); };
    return <><section className="card"><h3>목차와 원고</h3><div className="fields"><Field label="새 원고 제목" value={title} onChange={setTitle}/><Select label="새 원고 단위" value={kind} onChange={v => { setKind(v as Kind); setParent(''); }}>{kinds.map(k => <option key={k}>{k}</option>)}</Select><Select label="새 원고 상위 목차" value={parent} onChange={setParent}><option value="">최상위</option>{orderedSegments(p).filter(s => kinds.indexOf(s.kind) < kinds.indexOf(kind)).map(s => <option key={s.id} value={s.id}>{pathOf(p, s)}</option>)}</Select><button className="primary" onClick={() => { const seg = blankSegment(title.trim() || '새 원고', kind, parent); update(p => ({ ...p, segments: [...p.segments, seg], selectedId: seg.id })); setTitle(''); }}>원고 추가</button></div><div className="outline">{orderedSegments(p).map(x => <button key={x.id} className={p.selectedId === x.id ? 'selected' : ''} onClick={() => update(p => ({ ...p, selectedId: x.id }))}><span>{pathOf(p, x)}</span><small>{x.kind} · {x.status} · {x.original.length.toLocaleString()}자</small></button>)}</div></section>
 {s && <section className="card"><div className="fields"><Field label="원고 제목" value={s.title} onChange={title => edit({ title })}/><Select label="원고 상태" value={s.status} onChange={v => edit({ status: v as Segment['status'] })}>{statuses.map(k => <option key={k}>{k}</option>)}</Select><Select label="상위 목차 변경" value={s.parentId} onChange={parentId => edit({ parentId })}><option value="">최상위</option>{orderedSegments(p).filter(x => x.id !== s.id && canParent(s, x)).map(x => <option key={x.id} value={x.id}>{pathOf(p, x)}</option>)}</Select></div><div className="actions"><button onClick={() => move(-1)}>위로 이동</button><button onClick={() => move(1)}>아래로 이동</button><button onClick={() => { edit({ revisions: [...s.revisions, snapshot(s, '수동 저장')] }); notice('현재 원본·확장본·최종본을 버전으로 보관했습니다.'); }}>버전 보관</button><button className="danger" onClick={() => { const ids = [s.id, ...descendants(p, s.id)]; if (confirm(`선택 원고와 하위 원고 ${ids.length}개를 삭제할까요?`)) {
        update(p => ({ ...p, segments: p.segments.filter(x => !ids.includes(x.id)), selectedId: '', contextSegmentId: '', contextQuery: '', referenceIds: p.referenceIds.filter(x => !ids.includes(x)), importDraft: ids.includes(p.importDraft.parentId) ? { ...p.importDraft, parentId: '' } : p.importDraft }));
        setParent('');
    } }}>원고 삭제</button></div><Field label="원본 원고" area large value={s.original} onChange={original => edit({ original })}/><p className="muted">{s.original.length.toLocaleString()}자 (공백 포함) · 원본은 직접 수정한 내용만 저장됩니다.</p><details><summary>장면 정보와 작업 메모</summary><div className="fields">{(['people', 'place', 'foreshadows', 'emotion', 'goal', 'before', 'after', 'notes'] as const).map((k, i) => <Field key={k} area label={['등장인물', '장소', '복선', '감정선', '장면 목적', '앞 장면 요약', '다음 장면 메모', '작업 메모'][i]} value={s[k]} onChange={v => edit({ [k]: v })}/>)}</div></details>{s.revisions.length > 0 && <details><summary>보관한 버전 ({s.revisions.length})</summary>{s.revisions.map(r => <div className="subcard" key={r.id}><p>{new Date(r.date).toLocaleString('ko-KR')} · {r.name}</p><button onClick={() => download('writing-studio-revision.json', json(r))}>버전 다운로드</button><button onClick={() => { if (confirm('현재 세 원고를 보관한 뒤 이 버전의 원본·확장본·최종본으로 되돌릴까요? 후보와 메모는 유지됩니다.'))
        edit({ original: r.original, expanded: r.expanded, final: r.final, status: r.status, checked: [], revisions: [...s.revisions, snapshot(s, '복원 직전')] }); }}>이 버전으로 복원</button></div>)}</details>}</section>}
 <section className="card"><h3>긴 원고 가져오기</h3><p>TXT·MD 파일 또는 본문 붙여넣기를 사용하세요. Word·한글·PDF는 본문을 복사하거나 UTF-8 TXT로 저장한 뒤 넣어 주세요.</p><label className="file-button">TXT·MD 파일 선택<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f)
        return; if (!/\.(txt|md)$/i.test(f.name) || f.size > 10 * 1024 * 1024) {
        notice('10MB 이하 TXT·MD 파일을 선택하세요.');
        return;
    } try {
        const text = await f.text();
        if (mounted.current)
            draft({ text, title: f.name.replace(/\.[^.]+$/, '') });
    }
    catch (e) {
        notice(message(e));
    } }}/></label><Field label="가져올 원고 제목" value={p.importDraft.title} onChange={title => draft({ title })}/><Field label="붙여넣을 긴 원고" area large value={p.importDraft.text} onChange={text => draft({ text })}/><div className="fields"><Select label="가져오기 단위" value={p.importDraft.kind} onChange={v => draft({ kind: v as Kind, parentId: '' })}>{kinds.map(k => <option key={k}>{k}</option>)}</Select><Select label="가져오기 상위 목차" value={p.importDraft.parentId} onChange={parentId => draft({ parentId })}><option value="">최상위</option>{orderedSegments(p).filter(s => kinds.indexOf(s.kind) < kinds.indexOf(p.importDraft.kind)).map(s => <option key={s.id} value={s.id}>{pathOf(p, s)}</option>)}</Select><Select label="분리 방식" value={p.importDraft.mode} onChange={v => draft({ mode: v as Project['importDraft']['mode'] })}><option value="whole">전체를 하나로</option><option value="heading">제목 줄 (# 제목, 제1화 등)</option><option value="separator">구분선 (***, ---, ===)</option></Select></div><button disabled={!p.importDraft.text.trim()} onClick={() => setPreview(splitText(p.importDraft.text, p.importDraft.title, p.importDraft.mode))}>분리 미리보기</button>{preview && <div className="subcard"><p>{preview.length}개로 저장합니다. 원문 전체도 가져온 자료로 보관합니다.</p>{preview.map((part, i) => <div key={i}><Field label={`분리 원고 ${i + 1} 제목`} value={part.title} onChange={title => setPreview(preview.map((x, j) => i === j ? { ...x, title } : x))}/><details><summary>{part.text.length.toLocaleString()}자 미리보기</summary><pre>{part.text}</pre></details></div>)}<button className="primary" onClick={() => act(() => { const next = importSegments(p, preview); update(() => next); setPreview(null); notice('원고를 분리해 저장했습니다. 원문 전체도 보관했습니다.'); })}>확인한 원고 저장</button></div>}{p.imports.length > 0 && <details><summary>가져온 원문 보관함 ({p.imports.length})</summary>{p.imports.map(x => <div className="subcard" key={x.id}><span>{x.title} · {x.text.length.toLocaleString()}자</span><button onClick={() => download('writing-studio-import.txt', x.text, 'text/plain;charset=utf-8')}>원문 다운로드</button></div>)}</details>}</section></>;
}
function Comparison({ p, s, edit, notice }: {
    p: Project;
    s: Segment;
    edit: (x: Partial<Segment>) => void;
    notice: (s: string) => void;
}) { const list = paragraphs(s.expanded); const [selection, setSelection] = useState(''); useEffect(() => setSelection(''), [s.id, s.expanded]); return <><section className="card"><p>원본과 확장본을 비교해 필요한 부분만 후보로 보관하세요. 후보는 최종본에 자동 반영되지 않습니다.</p><div className="compare"><Field label="비교할 원본" area large value={s.original} onChange={original => edit({ original })}/><label className="field"><span>AI 확장본</span><textarea aria-label="AI 확장본" className="manuscript" value={s.expanded} onChange={e => edit({ expanded: e.target.value, checked: [] })} onSelect={e => { const t = e.currentTarget; setSelection(t.value.slice(t.selectionStart, t.selectionEnd)); }}/></label></div><button disabled={!selection.trim()} onClick={() => { if (!s.candidates.some(c => c.text === selection))
    edit({ candidates: [...s.candidates, { id: id(), text: selection, note: '', date: now(), source: 'AI 확장본', sourceTitle: s.title }] }); setSelection(''); notice('직접 선택한 문장을 후보로 보관했습니다.'); }}>선택한 문장만 후보로 보관</button><h3>문단을 골라 보관하기</h3>{list.map((text, i) => <div className="subcard" key={i}><label className="check"><input type="checkbox" aria-label={`문단 ${i + 1} 후보 선택`} checked={s.checked.includes(i)} onChange={e => edit({ checked: e.target.checked ? [...s.checked, i] : s.checked.filter(x => x !== i) })}/><span>문단 {i + 1} · {s.original.includes(text) ? '원본에 같은 문단 있음' : '원본과 다른 문단 — 직접 대조'}</span></label><pre>{text}</pre>{inspect(p, text).filter(f => f.quote).map((f, j) => <p key={j} className="warning">{f.level} · {f.title}: {f.detail}</p>)}</div>)}<button className="primary" disabled={!s.checked.length} onClick={() => { const next = storeCandidates(s); edit({ candidates: next.candidates, checked: [] }); notice('선택한 문단을 후보 보관함에 저장했습니다.'); }}>체크한 문단 후보 보관 ({s.checked.length})</button></section><section className="card"><h3>내가 고른 후보 · {s.candidates.length}</h3>{!s.candidates.length && <p>아직 선택한 후보가 없습니다.</p>}{s.candidates.map(c => <article className="subcard" key={c.id}><p className="muted">{c.source} · {c.sourceTitle} · {new Date(c.date).toLocaleDateString('ko-KR')}</p><pre>{c.text}</pre><Field label="후보 메모" area value={c.note} onChange={note => edit({ candidates: s.candidates.map(x => x.id === c.id ? { ...x, note } : x) })}/><div className="actions"><button onClick={() => copy(c.text, notice)}>후보 복사</button><button onClick={() => { if (confirm('이 후보를 삭제할까요?'))
    edit({ candidates: s.candidates.filter(x => x.id !== c.id) }); }}>후보 삭제</button></div></article>)}</section><section className="card"><h3>최종본</h3><p>후보를 살펴보고 직접 입력하거나 붙여넣으세요. 비워 두면 최종본은 빈 상태로 유지됩니다.</p><Field label="내가 작성하는 최종본" area large value={s.final} onChange={final => edit({ final })}/><p>{s.final.length.toLocaleString()}자</p></section></>; }
function Review({ p, s, edit }: {
    p: Project;
    s: Segment;
    edit: (x: Partial<Segment>) => void;
}) { const findings = inspect(p); return <><section className="card"><h3>장면 완성도 검수</h3><p>자동 검사는 등록한 표현·규칙의 일치와 문단 길이를 확인합니다. 감정·관계·설정의 의미 판단은 아래 기준을 보며 직접 확인하거나 검토용 프롬프트를 이용하세요.</p>{!activeText(p).trim() ? <Empty>선택한 버전의 원고가 비어 있습니다.</Empty> : <div className="review-grid">{(['필수 수정', '확인 필요', '선택 수정', '유지 추천'] as const).map(level => <section key={level}><h4>{level} <span className="badge">{findings.filter(f => f.level === level).length}</span></h4>{findings.filter(f => f.level === level).map((f, i) => <article className="finding" key={i}><strong>{f.title}</strong><p>{f.detail}</p>{f.quote && <blockquote>{f.line}행 · {f.quote}</blockquote>}</article>)}{!findings.some(f => f.level === level) && <p className="muted">해당 자동 검사 결과 없음</p>}</section>)}</div>}<p className="muted">검출되지 않았다는 것은 오류가 없다는 뜻은 아닙니다. 금지어·주의어·반복 묶음은 작품 기준집에서 등록하세요.</p></section><section className="card"><h3>내가 확인하는 장면 기준</h3><div className="fields">{reviewItems.map(k => <label key={k} className="check"><input type="checkbox" checked={!!s.review[k]} onChange={e => edit({ review: { ...s.review, [k]: e.target.checked } })}/><span>{k} 확인 완료</span></label>)}</div><details><summary>이 작품의 기준 다시 보기</summary>{Object.entries(p.criteria).filter(([, v]) => v.trim()).map(([k, v]) => <div key={k}><h4>{k}</h4><pre>{v}</pre></div>)}</details></section></>; }
function Context({ p, update, notice }: {
    p: Project;
    update: PanelProps['update'];
    notice: (s: string) => void;
}) { const hits = searchContext(p), refs = referenceScenes(p), fresh = contextFresh(p); const run = () => update(p => ({ ...p, contextQuery: activeText(p), contextSegmentId: p.selectedId, selectedCards: searchContext(p).slice(0, 8).map(h => h.card.id), referenceIds: [] })); return <><section className="card"><h3>원고에서 관련 설정 찾기</h3><p>이 작품의 이름·별칭·키워드와 직접 연결된 카드 한 단계까지만 찾습니다. 인공지능이나 외부 검색 서버는 사용하지 않습니다.</p><button className="primary" disabled={!activeText(p).trim()} onClick={run}>현재 원고로 맥락 검색</button>{!fresh && <p className="warning">원고를 선택하거나 수정한 뒤 검색을 실행하세요. 이전 선택은 패키지에 포함되지 않습니다.</p>}{fresh && <>{cardTypes.map(type => { const group = hits.filter(h => h.card.type === type); return group.length ? <div key={type}><h4>관련 {type}</h4>{group.map(h => <article className="subcard" key={h.card.id}><label className="check"><input type="checkbox" checked={p.selectedCards.includes(h.card.id)} onChange={e => update(p => ({ ...p, selectedCards: e.target.checked ? [...p.selectedCards, h.card.id] : p.selectedCards.filter(x => x !== h.card.id) }))}/><strong>{h.card.title}</strong></label><p className="muted">{h.reasons.join(' · ')} · 점수 {h.score}</p><pre>{h.card.body}</pre>{h.card.tone && <p>말투: {h.card.tone}</p>}</article>)}</div> : null; })}{!hits.length && <p>관련 카드가 없습니다. 기준집에 이름·별칭·검색 키워드를 추가하세요.</p>}<h4>관련된 다른 원고</h4>{refs.map(r => <label className="check subcard" key={r.id}><input type="checkbox" checked={p.referenceIds.includes(r.id)} onChange={e => update(p => ({ ...p, referenceIds: e.target.checked ? [...p.referenceIds, r.id] : p.referenceIds.filter(x => x !== r.id) }))}/><span>{pathOf(p, r)} · {(r.final || r.original).length.toLocaleString()}자</span></label>)}{!refs.length && <p className="muted">같은 키워드를 포함하는 다른 원고가 없습니다.</p>}</>}</section>{fresh && <section className="card"><h3>선택한 맥락 패키지</h3><textarea aria-label="맥락 패키지" className="manuscript" readOnly value={contextPackage(p)}/><button onClick={() => copy(contextPackage(p), notice)}>맥락 패키지 복사</button><p className="muted">선택한 다른 원고는 최종본이 있으면 최종본, 없으면 원본을 포함합니다.</p></section>}</>; }
function Backups({ ws, change, notice }: {
    ws: Workspace;
    change: Change;
    notice: (s: string) => void;
}) { const p = ws.projects.find(p => p.id === ws.activeId); const [pending, setPending] = useState<Backup | null>(null), [mode, setMode] = useState<Project['sourceMode']>('final'), [root, setRoot] = useState(''); useEffect(() => setRoot(''), [p?.id]); const load = async (f?: File) => { if (!f)
    return; if (f.size > 100 * 1024 * 1024) {
    notice('100MB 이하의 JSON 백업을 선택하세요.');
    return;
} try {
    setPending(parseBackup(await f.text()));
}
catch (e) {
    notice(message(e));
} }; return <><section className="card"><h2>저장과 백업</h2><p>현재 브라우저의 IndexedDB에 자동 저장합니다. 브라우저 데이터 삭제·기기 분실에 대비해 JSON을 따로 보관하세요. GitHub에는 앱 코드만 올라가며 작품 데이터가 자동 동기화되지 않습니다.</p><div className="actions"><button className="primary" onClick={() => fullBackup(ws)}>전체 백업 JSON</button><button disabled={!p} onClick={() => p && download('writing-studio-project-backup.json', json({ kind: 'project', project: p }))}>현재 작품 백업 JSON</button><button disabled={!p} onClick={() => p && download('writing-studio-criteria-backup.json', json({ kind: 'criteria', project: criteriaOnly(p) }))}>기준집만 내보내기</button></div><h3>백업 불러오기</h3><label className="file-button">백업 JSON 선택<input type="file" accept=".json,application/json" onChange={e => { void load(e.target.files?.[0]); e.target.value = ''; }}/></label>{pending && <div className="subcard"><h4>복원 미리보기</h4><p>{pending.kind === 'workspace' ? `전체 서재: ${pending.workspace.projects.length}개 작품. 현재 서재 전체가 교체됩니다.` : pending.kind === 'project' ? `작품 “${pending.project.name}”: ${pending.project.segments.length}개 원고. 새 작품으로 추가합니다.` : `“${pending.project.name}”의 기준집으로 현재 선택 작품의 기준집을 교체합니다. 원고는 유지합니다.`}</p><div className="actions"><button onClick={() => fullBackup(ws)}>교체 전 현재 자료 백업</button><button className="primary" disabled={pending.kind === 'criteria' && !p} onClick={() => { if (!confirm('표시된 방식으로 백업을 복원할까요?'))
    return; try {
    const next = applyBackup(ws, pending);
    change(() => next);
    setPending(null);
    notice('백업을 복원했습니다. 브라우저 저장 완료 표시를 확인하세요.');
}
catch (e) {
    notice(message(e));
} }}>확인 후 복원</button><button onClick={() => setPending(null)}>취소</button></div></div>}<p className="muted">다른 기기에서는 이 앱을 열고 같은 JSON을 선택해 복원하세요. 작품 백업은 기존 작품을 덮어쓰지 않고 별도 작품으로 추가합니다.</p></section>{p && <section className="card"><h3>원고 내려받기</h3><div className="fields"><Select label="내려받을 버전" value={mode} onChange={v => setMode(v as Project['sourceMode'])}><option value="original">원본</option><option value="expanded">AI 확장본</option><option value="final">최종본</option></Select><Select label="내려받을 범위" value={root} onChange={setRoot}><option value="">현재 작품 전체</option>{orderedSegments(p).map(s => <option key={s.id} value={s.id}>{pathOf(p, s)} 및 하위 원고</option>)}</Select></div><div className="actions"><button onClick={() => download('writing-studio-manuscript.txt', exportManuscript(p, root, mode), 'text/plain;charset=utf-8')}>TXT 다운로드</button><button onClick={() => download('writing-studio-manuscript.md', exportManuscript(p, root, mode, true), 'text/markdown;charset=utf-8')}>MD 다운로드</button></div><p className="muted">최종본을 비워 둔 원고는 제목만 내보냅니다. 원본이나 후보를 대신 합치지 않습니다.</p></section>}<section className="card"><h3>태블릿에서 사용하기</h3><p>배포 주소를 Safari 또는 Chrome에서 열어 사용하세요. 홈 화면에 추가하거나 앱 설치를 선택하면 편집실을 바로 열 수 있습니다. 첫 방문은 인터넷 연결이 필요하며, 캐시 준비 후 기본 화면을 오프라인에서도 사용할 수 있습니다.</p><p>홈 화면 앱과 일반 브라우저의 저장소는 기기·브라우저에 따라 다를 수 있습니다. 전환하기 전에 백업을 내려받으세요.</p></section></>; }
