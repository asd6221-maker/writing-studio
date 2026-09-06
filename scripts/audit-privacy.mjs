import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
const root=process.cwd();const errors=[];
function walk(dir){return readdirSync(dir).flatMap(name=>{if(['node_modules','.git','dist','work'].includes(name))return [];const p=join(dir,name);return statSync(p).isDirectory()?walk(p):[p];});}
for(const file of walk(root)){const path=relative(root,file).replaceAll('\\','/');if(/(?:^|\/)(?:backups|private|uploads)(?:\/|$)|\.(?:zip|docx|hwp|hwpx|pdf)$|backup.*\.json$/i.test(path))errors.push('배포 소스에 개인 자료 유형 파일: '+path);if(!/\.(?:ts|tsx|js|mjs|html|css|md|yml|json)$/.test(path)||path.includes('package-lock')||path.startsWith('scripts/'))continue;const text=readFileSync(file,'utf8');if(/(?:sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|ghp_[A-Za-z0-9]{20,})/.test(text))errors.push('키 형식 문자열: '+path);if(path.startsWith('src/')&&!path.includes('.test.')&&/(?:\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\s*\(|sendBeacon\s*\(|dangerouslySetInnerHTML)/.test(text))errors.push('검토가 필요한 전송 또는 HTML 삽입 코드: '+path);}
const workflow=readFileSync('.github/workflows/pages.yml','utf8');if(!/path: dist\s/.test(workflow))errors.push('Pages 산출물은 dist만 포함해야 합니다.');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log('공개 소스 검사 통과: 개인 자료 파일·키 형식·원고 전송 코드 없음. Pages는 dist만 배포합니다.');
