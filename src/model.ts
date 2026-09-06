export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const statuses = ['아이디어', '초고', 'AI 확장본', '취사선택 중', '퇴고 중', '교정 중', '완료', '보류'] as const;
export type Status = typeof statuses[number];
export const kinds = ['권', '장', '회차', '장면'] as const;
export type Kind = typeof kinds[number];
export const cardTypes = ['인물', '장소', '복선', '타임라인', '문체', '관계·규칙'] as const;
export type CardType = typeof cardTypes[number];
export const criteriaFields = ['요약', '작품 기획서', '인물·관계성', '세계관', '금지선', '문체 기준', '회차별 줄거리', 'AI가 자주 망치는 부분', '독자에게 주고 싶은 감정', '관계 톤·장르별 주의사항'] as const;
export const promptKinds = ['장면 완성도 검토', '감정선 검토', '캐릭터 톤 검토', 'AI 확장본 취사선택', '앞뒤 장면 이음새 검토', '최종본 패치 요청', '설정 충돌 검사'] as const;
export const reviewItems = ['장면 목적', '앞 장면과 감정 연결', '다음 장면으로의 연결', '캐릭터 말투', '관계 변화', '설명과 행동의 균형', '반복·주의 표현', '감정 변화의 속도', '장면 끝맛', '설정·호칭·관계·나이·직업·장소'] as const;
export interface Card {
    id: string;
    type: CardType;
    title: string;
    aliases: string;
    keywords: string;
    body: string;
    related: string;
    tone: string;
    avoid: string;
}
export interface Rule {
    id: string;
    term: string;
    message: string;
    level: '필수 수정' | '확인 필요';
    scope: string;
}
export interface Candidate {
    id: string;
    text: string;
    note: string;
    date: string;
    source: 'AI 확장본';
    sourceTitle: string;
}
export interface Revision {
    id: string;
    date: string;
    name: string;
    original: string;
    expanded: string;
    final: string;
    status: Status;
}
export interface Segment {
    id: string;
    parentId: string;
    kind: Kind;
    title: string;
    status: Status;
    original: string;
    expanded: string;
    final: string;
    people: string;
    place: string;
    foreshadows: string;
    emotion: string;
    goal: string;
    before: string;
    after: string;
    notes: string;
    candidates: Candidate[];
    checked: number[];
    revisions: Revision[];
    review: Record<string, boolean>;
}
export interface Project {
    id: string;
    name: string;
    updatedAt: string;
    criteria: Record<string, string>;
    cards: Card[];
    rules: Rule[];
    banned: string;
    caution: string;
    repeat: string;
    threshold: number;
    segments: Segment[];
    selectedId: string;
    sourceMode: 'original' | 'expanded' | 'final';
    imports: {
        id: string;
        title: string;
        text: string;
        date: string;
    }[];
    importDraft: {
        title: string;
        text: string;
        parentId: string;
        kind: Kind;
        mode: 'whole' | 'heading' | 'separator';
    };
    contextQuery: string;
    contextSegmentId: string;
    selectedCards: string[];
    referenceIds: string[];
    promptKind: typeof promptKinds[number];
}
export interface Workspace {
    schemaVersion: 2;
    projects: Project[];
    activeId: string;
}
export const blankSegment = (title = '새 원고', kind: Kind = '장면', parentId = ''): Segment => ({ id: id(), title, kind, parentId, status: '초고', original: '', expanded: '', final: '', people: '', place: '', foreshadows: '', emotion: '', goal: '', before: '', after: '', notes: '', candidates: [], checked: [], revisions: [], review: {} });
export const blankProject = (name: string): Project => ({ id: id(), name: name.trim(), updatedAt: now(), criteria: Object.fromEntries(criteriaFields.map(k => [k, ''])), cards: [], rules: [], banned: '', caution: '', repeat: '', threshold: 3, segments: [], selectedId: '', sourceMode: 'original', imports: [], importDraft: { title: '', text: '', parentId: '', kind: '회차', mode: 'whole' }, contextQuery: '', contextSegmentId: '', selectedCards: [], referenceIds: [], promptKind: promptKinds[0] });
export const blankWorkspace = (): Workspace => ({ schemaVersion: 2, projects: [], activeId: '' });
export const words = (text: string) => [...new Set(text.split(/[,，\n]/).map(s => s.trim()).filter(Boolean))];
export const norm = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
export const paragraphs = (text: string) => text.split(/\n\s*\n/).filter(s => s.trim());
export const selectedSegment = (p: Project) => p.segments.find(s => s.id === p.selectedId);
export const activeText = (p: Project) => selectedSegment(p)?.[p.sourceMode] || '';
export function pathOf(p: Project, segment: Segment): string { const names = [segment.title]; let parent = segment.parentId; const seen = new Set([segment.id]); while (parent && !seen.has(parent)) {
    seen.add(parent);
    const s = p.segments.find(x => x.id === parent);
    if (!s)
        break;
    names.unshift(s.title);
    parent = s.parentId;
} return names.join(' / '); }
export function orderedSegments(p: Project, parentId = ''): Segment[] { return p.segments.filter(s => s.parentId === parentId).flatMap(s => [s, ...orderedSegments(p, s.id)]); }
export function descendants(p: Project, segmentId: string): string[] { return p.segments.filter(s => s.parentId === segmentId).flatMap(s => [s.id, ...descendants(p, s.id)]); }
export function canParent(segment: Segment, parent?: Segment): boolean { return !parent || kinds.indexOf(parent.kind) < kinds.indexOf(segment.kind); }
export function duplicateProject(p: Project, name = p.name + ' 사본'): Project {
    const next = structuredClone(p);
    const map = new Map(p.segments.map(s => [s.id, id()]));
    const cards = new Map(p.cards.map(c => [c.id, id()]));
    next.id = id();
    next.name = name;
    next.updatedAt = now();
    next.selectedId = map.get(p.selectedId) || '';
    next.contextSegmentId = '';
    next.contextQuery = '';
    next.selectedCards = [];
    next.referenceIds = [];
    next.segments = next.segments.map(s => ({ ...s, id: map.get(s.id)!, parentId: map.get(s.parentId) || '', candidates: s.candidates.map(c => ({ ...c, id: id() })), revisions: s.revisions.map(r => ({ ...r, id: id() })) }));
    next.cards = next.cards.map(c => ({ ...c, id: cards.get(c.id)! }));
    next.rules = next.rules.map(r => ({ ...r, id: id() }));
    next.imports = next.imports.map(s => ({ ...s, id: id() }));
    next.importDraft.parentId = map.get(p.importDraft.parentId) || '';
    return next;
}
export function splitText(text: string, title: string, mode: Project['importDraft']['mode']): {
    title: string;
    text: string;
}[] {
    if (!text.trim())
        return [];
    if (mode === 'whole')
        return [{ title: title.trim() || '새 원고', text }];
    const cuts: {
        start: number;
        title: string;
    }[] = [];
    for (const m of text.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)) {
        const line = m[0].trim();
        if (mode === 'heading' ? /^(?:#{1,4}\s+\S.*|(?:제\s*)?\d+\s*[권장화](?:\s.*|[.:：].*|$)|(?:프롤로그|에필로그|외전)(?:\s.*|[.:：].*|$))$/.test(line) : /^(?:\*\s*\*\s*\*|---+|===+)$/.test(line))
            cuts.push({ start: m.index!, title: mode === 'heading' ? line.replace(/^#+\s+/, '') : `장면 ${cuts.length + 1}` });
    }
    if (!cuts.length)
        return [{ title: title.trim() || '새 원고', text }];
    if (cuts[0].start > 0)
        cuts.unshift({ start: 0, title: (title || '원고') + ' · 시작 부분' });
    return cuts.map((c, i) => ({ title: c.title, text: text.slice(c.start, cuts[i + 1]?.start ?? text.length) }));
}
export function importSegments(p: Project, parts: {
    title: string;
    text: string;
}[]): Project {
    const d = p.importDraft;
    const parent = p.segments.find(s => s.id === d.parentId);
    if (d.parentId && !parent || !canParent(blankSegment('', d.kind), parent))
        throw Error('상위 목차와 원고 단위를 확인해 주세요.');
    if (!parts.length || parts.some(s => !s.title.trim()) || parts.map(s => s.text).join('') !== d.text)
        throw Error('원고가 바뀌었습니다. 분리 미리보기를 다시 확인하세요.');
    const segments = parts.map(part => ({ ...blankSegment(part.title, d.kind, d.parentId), original: part.text }));
    return { ...p, segments: [...p.segments, ...segments], imports: [...p.imports, { id: id(), title: d.title || '가져온 원고', text: d.text, date: now() }], selectedId: segments[0].id, importDraft: { ...d, title: '', text: '' } };
}
export function snapshot(s: Segment, name: string): Revision { return { id: id(), date: now(), name, original: s.original, expanded: s.expanded, final: s.final, status: s.status }; }
export function storeCandidates(s: Segment): Segment { const list = paragraphs(s.expanded); const picked = s.checked.filter(i => i >= 0 && i < list.length).map(i => list[i]).filter(t => !s.candidates.some(c => c.text === t)); return { ...s, checked: [], candidates: [...s.candidates, ...picked.map(text => ({ id: id(), text, note: '', date: now(), source: 'AI 확장본' as const, sourceTitle: s.title }))] }; }
export function exportManuscript(p: Project, rootId = '', mode: Project['sourceMode'] = 'final', markdown = false): string {
    const allowed = rootId ? new Set([rootId, ...descendants(p, rootId)]) : null;
    return `${markdown ? '# ' : ''}${p.name}\n\n` + orderedSegments(p).filter(s => !allowed || allowed.has(s.id)).map(s => `${markdown ? '## ' : ''}${s.kind} · ${pathOf(p, s)}\n\n${s[mode]}`).join('\n\n');
}
