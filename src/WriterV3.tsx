import { useEffect, useMemo, useRef, useState } from 'react';
import { blankProject, blankSegment, now, orderedSegments, pathOf, splitText, type Project, type Segment, type Workspace } from './model';
import { loadWorkspace, saveWorkspace } from './storage';
import './writer-v3.css';

type Mode = 'original' | 'expanded' | 'final';
type Finding = { term:string; count:number; snippets:string[] };
const modes: {key:Mode; label:string}[] = [{key:'original',label:'원본'},{key:'expanded',label:'AI 확장본'},{key:'final',label:'다듬는 원고'}];
const count = (s:string) => s.length;
const esc = (s:string) => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function repeatFindings(text:string, custom:string, threshold=3):Finding[]{
  const terms = new Set(custom.split(/[\n,/]/).map(x=>x.trim()).filter(x=>x.length>=2));
  const tokens = text.match(/[가-힣A-Za-z]{2,}/g) || [];
  const freq = new Map<string,number>();
  tokens.forEach(t=>freq.set(t,(freq.get(t)||0)+1));
  [...freq].filter(([,n])=>n>=Math.max(4,threshold)).sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([t])=>terms.add(t));
  return [...terms].map(term=>{
    const re=new RegExp(esc(term),'g'); const n=(text.match(re)||[]).length;
    if(n<threshold) return null;
    const snippets:string[]=[]; let m:RegExpExecArray|null;
    while((m=re.exec(text)) && snippets.length<5){const a=Math.max(0,m.index-45),b=Math.min(text.length,m.index+term.length+55);snippets.push(text.slice(a,b).replace(/\s+/g,' ')); if(re.lastIndex===m.index) re.lastIndex++;}
    return {term,count:n,snippets};
  }).filter(Boolean).sort((a,b)=>b!.count-a!.count) as Finding[];
}
function promptFor(term:string, selected:string, text:string){
  const target=selected.trim() || term;
  const i=selected.trim()?text.indexOf(selected):text.indexOf(term); const a=Math.max(0,i-500), b=Math.min(text.length,(i<0?0:i+target.length)+500);
  return `아래는 장편소설 퇴고 중 수정 요청입니다.\n\n[수정 목적]\n반복되거나 어색한 표현 “${term}”을 점검해 주세요. 원래 장면의 의미·사건·캐릭터 성격은 바꾸지 말고, 필요한 부분만 보수적으로 수정해 주세요. 과한 감정 추가, 새로운 설정 추가, 문체의 전면 재작성은 하지 마세요.\n\n[수정 대상]\n${target}\n\n[앞뒤 문맥]\n${text.slice(a,b)}\n\n[답변 방식]\n1. 수정이 필요한지 먼저 판단\n2. 필요하면 수정안 1~3개\n3. 원문 유지가 더 좋다면 유지 추천이라고 명시`;
}
export default function WriterV3(){
 const [ws,setWs]=useState<Workspace|null>(null),[notice,setNotice]=useState('불러오는 중'),[mode,setMode]=useState<Mode>('final'),[finding,setFinding]=useState<Finding|null>(null),[selection,setSelection]=useState(''),[prompt,setPrompt]=useState('');
 const rev=useRef(0); const timer=useRef<number|undefined>(undefined);
 useEffect(()=>{loadWorkspace().then(r=>{rev.current=r.revision;setWs(r.workspace);setNotice('이 브라우저에 저장됨')}).catch(e=>setNotice('불러오기 실패: '+e));},[]);
 useEffect(()=>{if(!ws)return; window.clearTimeout(timer.current);setNotice('저장 대기');timer.current=window.setTimeout(async()=>{try{rev.current=await saveWorkspace(ws,rev.current);setNotice('이 브라우저에 저장됨')}catch(e){setNotice('저장 실패: '+e)}},500);return()=>window.clearTimeout(timer.current)},[ws]);
 const p=ws?.projects.find(x=>x.id===ws.activeId); const s=p?.segments.find(x=>x.id===p.selectedId); const text=s?.[mode]||'';
 const findings=useMemo(()=>p?repeatFindings(text,p.repeat,p.threshold):[],[text,p?.repeat,p?.threshold]);
 const projectChars=p?orderedSegments(p).reduce((n,x)=>n+count(x.final||x.original),0):0;
 const changeProject=(fn:(p:Project)=>Project)=>setWs(w=>{if(!w||!p)return w;return {...w,projects:w.projects.map(x=>x.id===p.id?{...fn(x),updatedAt:now()}:x)}});
 const edit=(value:string)=>{if(!s)return;changeProject(q=>({...q,segments:q.segments.map(x=>x.id===s.id?{...x,[mode]:value}:x)}))};
 const selectSegment=(id:string)=>changeProject(q=>({...q,selectedId:id}));
 const importFile=async(f?:File)=>{if(!f||!p)return;const raw=await f.text();const parts=splitText(raw,f.name.replace(/\.[^.]+$/,''),'heading');const segs=parts.map(x=>({...blankSegment(x.title,'회차',''),original:x.text,final:x.text}));changeProject(q=>({...q,segments:[...q.segments,...segs],selectedId:segs[0]?.id||q.selectedId,imports:[...q.imports,{id:crypto.randomUUID(),title:f.name,text:raw,date:now()}]}));setMode('final');setNotice(`${parts.length}개 원고를 가져왔어요. 다듬는 원고에 원본을 복사해 두었습니다.`)};
 if(!ws)return <main className="v3"><p>{notice}</p></main>;
 return <div className="v3"><header className="v3-head"><div><b>장편 원고 다듬기 작업실</b><small>원고를 넣고 → 반복을 찾고 → 직접 고치거나 GPT에 수정 요청</small></div><span>{notice}</span></header>
 <div className="v3-project"><label>작품 <select value={ws.activeId} onChange={e=>setWs(w=>w&&({...w,activeId:e.target.value}))}><option value="">작품 선택</option>{ws.projects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>{p&&<><strong>전체 {projectChars.toLocaleString()}자</strong><label className="v3-file">원고 한 번에 넣기<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={e=>{void importFile(e.target.files?.[0]);e.currentTarget.value=''}}/></label></>}</div>
 {!p?<section className="v3-empty"><h2>먼저 작품을 선택하세요.</h2><button onClick={()=>{const name=prompt('새 작품 이름');if(!name?.trim())return;const q=blankProject(name);setWs(w=>w&&({...w,projects:[...w.projects,q],activeId:q.id}))}}>새 작품 만들기</button></section>:
 <div className="v3-layout"><aside><h3>원고</h3><p className="v3-help">회차를 누르면 바로 다듬기 시작해요.</p>{orderedSegments(p).map(x=><button key={x.id} className={x.id===p.selectedId?'on':''} onClick={()=>selectSegment(x.id)}><span>{pathOf(p,x)}</span><small>{count(x.final||x.original).toLocaleString()}자</small></button>)}</aside>
 <main>{!s?<section className="v3-empty"><h2>원고를 넣어 시작하세요.</h2><p>TXT/MD 파일을 한 번에 넣으면 제목 줄(제1화, 2화, # 제목 등)을 기준으로 나눠 저장합니다.</p></section>:<>
 <section className="v3-toolbar"><div><h2>{s.title}</h2><b>{count(text).toLocaleString()}자</b><small>공백·띄어쓰기·줄바꿈 포함</small></div><div className="v3-modes">{modes.map(m=><button key={m.key} className={mode===m.key?'on':''} onClick={()=>setMode(m.key)}>{m.label}</button>)}</div></section>
 <section className="v3-editor"><textarea value={text} onChange={e=>edit(e.target.value)} onSelect={e=>{const t=e.currentTarget;setSelection(t.value.slice(t.selectionStart,t.selectionEnd))}} placeholder="원고를 입력하거나 파일로 가져오세요."/><div className="v3-editor-foot"><span>선택한 부분 {selection.length.toLocaleString()}자</span>{selection&&<button onClick={()=>{setFinding({term:'선택한 부분',count:1,snippets:[selection]});setPrompt(promptFor('선택한 부분',selection,text))}}>선택 부분 GPT 검토</button>}</div></section>
 <section className="v3-review"><div className="v3-title"><div><h3>반복 검수</h3><p>이번 버전은 우선 반복을 빠르게 찾아 다듬는 데 집중해요.</p></div><span>{findings.length}개 확인</span></div>{!findings.length?<p className="v3-ok">현재 기준에서 눈에 띄는 반복이 없어요. 기준집의 ‘반복 표현 묶음’을 추가하면 그 표현도 함께 검사합니다.</p>:<div className="v3-findings">{findings.map(f=><button key={f.term} onClick={()=>{setFinding(f);setPrompt(promptFor(f.term,'',text))}}><b>{f.term}</b><span>{f.count}회</span><small>{f.snippets[0]}</small></button>)}</div>}</section>
 {finding&&<section className="v3-fix"><div className="v3-title"><div><h3>“{finding.term}” 확인</h3><p>{finding.count}회 발견. 무조건 바꾸지 말고 문맥상 반복이 거슬리는 곳만 고르면 돼요.</p></div><button onClick={()=>{setFinding(null);setPrompt('')}}>닫기</button></div><div className="v3-snips">{finding.snippets.map((x,i)=><blockquote key={i}>{x}</blockquote>)}</div><div className="v3-choice"><div><h4>직접 수정</h4><p>위 원고 편집창에서 바로 고치면 자동 저장돼요.</p><button onClick={()=>document.querySelector<HTMLTextAreaElement>('.v3-editor textarea')?.focus()}>원고로 돌아가 수정</button></div><div><h4>GPT에게 수정 요청</h4><p>현재 문제와 앞뒤 문맥을 포함한 요청문을 만들었어요.</p><button className="primary" onClick={async()=>{await navigator.clipboard.writeText(prompt);setNotice('GPT 수정 요청을 복사했어요')}}>프롬프트 복사</button></div></div><textarea className="v3-prompt" value={prompt} onChange={e=>setPrompt(e.target.value)}/></section>}
 </>}</main></div>}
 </div>
}
