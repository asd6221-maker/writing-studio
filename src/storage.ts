import { blankWorkspace, blankProject, blankSegment, duplicateProject, criteriaFields, kinds, statuses, cardTypes, promptKinds, canParent, type Workspace, type Project } from './model';
const fail = (): never => { throw new Error('백업 형식이 올바르지 않습니다. 원본 파일은 변경하지 않았습니다.'); };
const obj = (x: any) => { if (!x || typeof x !== 'object' || Array.isArray(x))
    fail(); };
const strings = (x: any, keys: string[]) => { obj(x); for (const k of keys)
    if (typeof x[k] !== 'string')
        fail(); };
const arr = (x: any): any[] => { if (!Array.isArray(x))
    fail(); return x; };
const unique = (xs: any[]) => { const ids = xs.map(x => x.id); if (ids.some(x => typeof x !== 'string' || !x) || new Set(ids).size !== ids.length)
    fail(); };
export function validateProject(x: any): Project {
    strings(x, ['id', 'name', 'updatedAt', 'banned', 'caution', 'repeat', 'selectedId', 'contextQuery', 'contextSegmentId']);
    if (!x.id || !x.name.trim())
        fail();
    strings(x.criteria, [...criteriaFields]);
    if (!Number.isInteger(x.threshold) || x.threshold < 2 || x.threshold > 100)
        fail();
    if (!['original', 'expanded', 'final'].includes(x.sourceMode) || !promptKinds.includes(x.promptKind))
        fail();
    const segments = arr(x.segments);
    unique(segments);
    for (const s of segments) {
        strings(s, ['id', 'parentId', 'title', 'original', 'expanded', 'final', 'people', 'place', 'foreshadows', 'emotion', 'goal', 'before', 'after', 'notes']);
        if (!kinds.includes(s.kind) || !statuses.includes(s.status))
            fail();
        obj(s.review);
        if (Object.values(s.review).some(v => typeof v !== 'boolean'))
            fail();
        if (arr(s.checked).some(i => !Number.isInteger(i) || i < 0))
            fail();
        unique(arr(s.candidates));
        for (const c of s.candidates) {
            strings(c, ['id', 'text', 'note', 'date', 'sourceTitle']);
            if (c.source !== 'AI 확장본')
                fail();
        }
        unique(arr(s.revisions));
        for (const r of s.revisions) {
            strings(r, ['id', 'date', 'name', 'original', 'expanded', 'final']);
            if (!statuses.includes(r.status))
                fail();
        }
    }
    for (const s of segments) {
        const parent = segments.find(p => p.id === s.parentId);
        if (s.parentId && (!parent || !canParent(s, parent)))
            fail();
    }
    if (x.selectedId && !segments.some(s => s.id === x.selectedId))
        fail();
    const cards = arr(x.cards);
    unique(cards);
    for (const c of cards) {
        strings(c, ['id', 'title', 'aliases', 'keywords', 'body', 'related', 'tone', 'avoid']);
        if (!cardTypes.includes(c.type))
            fail();
    }
    unique(arr(x.rules));
    for (const r of x.rules) {
        strings(r, ['id', 'term', 'message', 'scope']);
        if (!['필수 수정', '확인 필요'].includes(r.level))
            fail();
    }
    unique(arr(x.imports));
    for (const r of x.imports)
        strings(r, ['id', 'title', 'text', 'date']);
    strings(x.importDraft, ['title', 'text', 'parentId']);
    if (!kinds.includes(x.importDraft.kind) || !['whole', 'heading', 'separator'].includes(x.importDraft.mode))
        fail();
    if (x.importDraft.parentId && !segments.some(s => s.id === x.importDraft.parentId && kinds.indexOf(s.kind) < kinds.indexOf(x.importDraft.kind)))
        fail();
    if (arr(x.selectedCards).some(v => !cards.some(c => c.id === v)) || arr(x.referenceIds).some(v => !segments.some(s => s.id === v)))
        fail();
    return structuredClone(x);
}
export function validateWorkspace(x: any): Workspace { obj(x); if (x.schemaVersion !== 2 || typeof x.activeId !== 'string')
    fail(); const ps = arr(x.projects).map(validateProject); unique(ps); if (x.activeId && !ps.some(p => p.id === x.activeId))
    fail(); return { schemaVersion: 2, projects: ps, activeId: x.activeId }; }
export function migrateLegacy(raw: string): Workspace {
    const old = JSON.parse(raw);
    strings(old, ['manuscript']);
    const p = blankProject(typeof old.title === 'string' && old.title.trim() ? old.title : '가져온 작품');
    const s = blankSegment('가져온 원고');
    s.original = old.manuscript;
    s.before = typeof old.before === 'string' ? old.before : '';
    s.after = typeof old.after === 'string' ? old.after : '';
    p.segments = [s];
    p.selectedId = s.id;
    p.criteria['작품 기획서'] = typeof old.settings === 'string' ? old.settings : '';
    p.caution = typeof old.caution === 'string' ? old.caution : '';
    p.repeat = typeof old.repeat === 'string' ? old.repeat : '';
    if (Array.isArray(old.cards))
        p.cards = old.cards.map((c: any) => ({ id: crypto.randomUUID(), type: cardTypes.includes(c.type) ? c.type : '관계·규칙', title: String(c.title || ''), aliases: Array.isArray(c.aliases) ? c.aliases.join(', ') : String(c.aliases || ''), keywords: Array.isArray(c.keywords) ? c.keywords.join(', ') : String(c.keywords || ''), body: String(c.body || ''), related: '', tone: '', avoid: '' }));
    if (typeof old.rules === 'string')
        p.rules = old.rules.split('\n').filter((r: string) => r.trim()).map((r: string) => { const [term, message, level] = r.split('=>'); return { id: crypto.randomUUID(), term: term.trim(), message: message?.trim() || '저장한 기준 확인', level: level?.trim() === '필수 수정' ? '필수 수정' : '확인 필요', scope: '' }; });
    return { schemaVersion: 2, projects: [p], activeId: p.id };
}
export type Backup = {
    kind: 'workspace';
    workspace: Workspace;
} | {
    kind: 'project';
    project: Project;
} | {
    kind: 'criteria';
    project: Project;
};
export function parseBackup(raw: string): Backup { const x = JSON.parse(raw); obj(x); if (x.kind === 'workspace')
    return { kind: x.kind, workspace: validateWorkspace(x.workspace) }; if (x.kind === 'project' || x.kind === 'criteria')
    return { kind: x.kind, project: validateProject(x.project) }; if (x.schemaVersion === 2)
    return { kind: 'workspace', workspace: validateWorkspace(x) }; if (typeof x.manuscript === 'string')
    return { kind: 'workspace', workspace: migrateLegacy(raw) }; return fail(); }
export function criteriaOnly(p: Project): Project { return { ...blankProject(p.name), criteria: structuredClone(p.criteria), cards: structuredClone(p.cards), rules: structuredClone(p.rules), banned: p.banned, caution: p.caution, repeat: p.repeat, threshold: p.threshold }; }
export function applyBackup(ws: Workspace, b: Backup): Workspace { if (b.kind === 'workspace')
    return structuredClone(b.workspace); if (b.kind === 'project') {
    const p = duplicateProject(b.project, b.project.name);
    return { ...ws, projects: [...ws.projects, p], activeId: p.id };
} if (!ws.activeId)
    throw new Error('기준집을 넣을 작품을 먼저 선택하세요.'); const fields = criteriaOnly(b.project); return { ...ws, projects: ws.projects.map(p => p.id === ws.activeId ? { ...p, criteria: fields.criteria, cards: fields.cards, rules: fields.rules, banned: fields.banned, caution: fields.caution, repeat: fields.repeat, threshold: fields.threshold, selectedCards: [], contextQuery: '', contextSegmentId: '' } : p) }; }
const DB = 'writing-studio-personal';
function openDB(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('data'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); r.onblocked = () => reject(new Error('다른 탭을 닫고 다시 시도하세요.')); }); }
export async function loadWorkspace(): Promise<{
    workspace: Workspace;
    revision: number;
    migrated: boolean;
}> { const db = await openDB(); return new Promise((resolve, reject) => { const tx = db.transaction('data', 'readonly'); const r = tx.objectStore('data').get('workspace'); r.onsuccess = () => { try {
    if (r.result)
        resolve({ workspace: validateWorkspace(r.result.workspace), revision: r.result.revision, migrated: false });
    else {
        const old = localStorage.getItem('writing-studio-v1');
        resolve({ workspace: old ? migrateLegacy(old) : blankWorkspace(), revision: 0, migrated: !!old });
    }
}
catch (e) {
    reject(e);
} }; r.onerror = () => reject(r.error); tx.oncomplete = () => db.close(); }); }
export async function saveWorkspace(workspace: Workspace, expected: number): Promise<number> { validateWorkspace(workspace); const db = await openDB(); return new Promise((resolve, reject) => { const tx = db.transaction('data', 'readwrite'); const store = tx.objectStore('data'); const r = store.get('workspace'); let conflict = false; r.onsuccess = () => { if ((r.result?.revision || 0) !== expected) {
    conflict = true;
    tx.abort();
    return;
} store.put({ workspace, revision: expected + 1 }, 'workspace'); }; tx.oncomplete = () => { db.close(); resolve(expected + 1); }; tx.onabort = tx.onerror = () => { db.close(); reject(new Error(conflict ? '다른 탭에서 저장되었습니다. 현재 작업을 백업한 뒤 새로고침하세요.' : '브라우저에 저장하지 못했습니다. 지금 전체 백업을 내려받으세요.')); }; }); }
export function download(name: string, text: string, type = 'application/json') { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
