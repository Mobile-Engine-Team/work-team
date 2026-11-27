import React,{useMemo,useState} from 'react';
import {Download,FileText,FolderOpen,Search} from 'lucide-react';
import {useConversations,conversationUrl} from './collaboration-store';
import {useIdentity} from './local-identity';
import {issueUrl,useWorkspace} from './multica-ui/store';
import {Modal,Button} from './multica-ui/primitives';

type Entry={id:string;name:string;origin:string;author:string;at?:string;href:string;url?:string;type?:string};
const extensions:Record<string,string>={md:'文档',txt:'文档',docx:'文档',csv:'表格',xlsx:'表格',pptx:'演示',pdf:'PDF',png:'图片',jpg:'图片',jpeg:'图片',gif:'图片',webp:'图片'};
const kind=(f:Entry)=>extensions[f.name.split('.').at(-1)!.toLowerCase()]||'其他';
const dataURL=(f:Entry)=>typeof f.url==='string'&&f.url.startsWith('data:')?f.url:undefined;
const imageURL=(f:Entry)=>/^data:image\/(?:png|gif|jpe?g|webp);base64,/i.test(dataURL(f)||'')?f.url:undefined;
export function LocalFiles(){
 const who=useIdentity(),workspace=useWorkspace(),conversations=useConversations();
 const [query,setQuery]=useState(''),[type,setType]=useState('全部类型'),[cloud,setCloud]=useState(false),[opened,setOpened]=useState<Entry|null>(null);
 const all=useMemo(()=>{
  const entries:Entry[]=[];
  for(const c of conversations)if(!c.transient&&c.members.includes(who))for(const m of c.messages)if(!m.visibleTo||m.visibleTo===who)m.files?.forEach((f,n)=>entries.push({...f,id:`chat:${c.id}:${m.id}:${n}`,origin:c.title,author:m.author,at:m.sentAt,href:conversationUrl(c.id)}));
  const issues=new Map(workspace.issues.filter(i=>!i.archived).map(i=>[i.id,i]));
  for(const comment of workspace.comments){const issue=issues.get(comment.issue);if(!issue)continue;comment.attachments?.forEach((f,n)=>entries.push({...f,id:`task:${comment.id}:${n}`,origin:issue.title,author:comment.author,at:comment.createdAt,href:issueUrl(issue.id)}))}
  return entries.sort((a,b)=>(b.at||'').localeCompare(a.at||''));
 },[workspace,conversations,who]);
 const visible=all.filter(f=>(type==='全部类型'||kind(f)===type)&&[f.name,f.origin,f.author].some(x=>x.toLowerCase().includes(query.trim().toLowerCase())));
 const selected=opened&&all.find(f=>f.id===opened.id);
 return <div className="px-10 pb-16 pt-[30px]"><h1 className="text-[24px] font-bold">我的文件</h1><p className="mt-1 mb-5 text-sm">查看当前团队中可访问的会话附件与任务成果。数据仅保存在当前浏览器。</p><div className="mb-4 flex gap-6 border-b border-[#EBEDF0]" aria-label="文件范围">{['任务成果','云端网盘'].map((label,i)=><button key={label} aria-pressed={cloud===!!i} className={'border-b-2 pb-2.5 text-sm '+(cloud===!!i?'border-current':'border-transparent')} onClick={()=>setCloud(!!i)}>{label}</button>)}</div>
 {cloud?<p className="py-12 text-center"><FolderOpen size={24} className="mx-auto mb-3"/>云端网盘未接入，不会上传任何附件。</p>:<><div className="mb-4 flex flex-wrap gap-3"><select aria-label="文件类型" className="form-field !w-[130px]" value={type} onChange={e=>setType(e.target.value)}>{['全部类型','文档','表格','演示','PDF','图片','其他'].map(x=><option key={x}>{x}</option>)}</select><label className="flex items-center gap-2 rounded-lg border border-[#E5E6EB] px-3 py-2 text-sm"><Search size={16}/><input aria-label="搜索文件" className="w-52 outline-none" placeholder="搜索文件、来源或上传者" value={query} onChange={e=>setQuery(e.target.value)}/></label>{(query||type!=='全部类型')&&<Button onClick={()=>{setQuery('');setType('全部类型')}}>清除筛选</Button>}</div>
 {!visible.length?<p className="py-12 text-center" role="status">{all.length?'没有匹配的文件':'暂无附件或交付文件'}</p>:<ul className="divide-y divide-[#EBEDF0]">{visible.map(f=><li key={f.id}><button className="flex w-full flex-wrap items-center gap-3 px-3 py-4 text-left text-sm" onClick={()=>setOpened(f)}><FileText size={18}/><strong>{f.name}</strong><span>{kind(f)} · {f.origin} · {f.author}</span><span>{f.at?new Date(f.at).toLocaleString('zh-CN'):''}</span></button></li>)}</ul>}</>}
 {selected&&<Modal title={selected.name} onClose={()=>setOpened(null)} footer={<><a href={selected.href}>查看来源</a>{dataURL(selected)&&<a className="mc-button mc-primary" href={dataURL(selected)} download={selected.name}><Download size={15}/>下载文件</a>}</>}><p>来源：{selected.origin} · {selected.author}</p>{imageURL(selected)?<img className="mt-3 max-h-[50vh] max-w-full" src={imageURL(selected)} alt={selected.name}/>:<p className="mt-3">{dataURL(selected)?'本地保留文件内容，可下载查看。':'此记录只有附件名称，没有可下载的文件内容。'}</p>}</Modal>}
 </div>;
}
