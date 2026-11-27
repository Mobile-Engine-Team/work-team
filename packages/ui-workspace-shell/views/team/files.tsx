import {useEffect, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {useNavigate, useSearchParams} from "react-router-dom";
import {Download, FileText, FolderOpen, Search} from "lucide-react";
import {z} from "zod";
import {request} from "../workbench/api";
import {teamApi, teamServer, useTeam, useTeamQuery, useTeamAction} from "./client";
import {teamFetch} from "./request-transport";
import {Action, Failure, Modal} from "./ui";

const FileRow = z.object({
  id: z.string(),
  filename: z.string(),
  size: z.number(),
  uploader: z.string(),
  source_id: z.string(),
  message_id: z.string().optional(),
  source_title: z.string(),
  kind: z.enum(["room", "issue", "work","input","agent-chat"]),
  created_at: z.string(),
  downloadable: z.boolean(),
});
async function fetchWorkspaceFile(workspaceId:string,file:z.infer<typeof FileRow>,signal?:AbortSignal) {
    const path=file.kind==="input" ? "/api/workbench/input-files/"+file.id : file.kind==="work" ? "/api/workbench/artifacts/"+file.id : (file.kind==="issue" || file.kind==="agent-chat") ? "/api/attachments/"+file.id+"/download" : "/api/workbench/room-files/"+file.id;
    const res=await teamFetch(teamServer+path,{headers:{"X-Workspace-ID":workspaceId},signal});
    if(!res.ok) throw Error("文件不可用");
    return await res.blob();
}
function FilePreview({file,workspaceId}:{file:z.infer<typeof FileRow>;workspaceId:string}){
  const [url,setUrl]=useState("");
  useEffect(()=>{
    const controller=new AbortController();let generated="";
    setUrl("");
    if(file.size<=8*1024*1024 && /\.(png|jpe?g|gif|webp)$/i.test(file.filename)){
      void (async()=>{
        const blob=await fetchWorkspaceFile(workspaceId,file,controller.signal);
        const bytes=new Uint8Array(await blob.slice(0,12).arrayBuffer());
        const starts=(signature:number[])=>signature.every((b,i)=>bytes[i]===b);
        const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
        const mime=starts([137,80,78,71,13,10,26,10])?"image/png":starts([255,216,255])?"image/jpeg":["GIF87a","GIF89a"].includes(ascii(0,6))?"image/gif":ascii(0,4)==="RIFF"&&ascii(8,12)==="WEBP"?"image/webp":"";
        if(mime&&!controller.signal.aborted){generated=URL.createObjectURL(blob.slice(0,blob.size,mime));setUrl(generated)}
      })().catch(()=>{});
    }
    return ()=>{controller.abort();if(generated) URL.revokeObjectURL(generated)};
  },[file.id,file.kind,file.filename,file.size,workspaceId]);
  return url ? <img alt={file.filename} src={url} style={{maxWidth:"100%",maxHeight:"50vh",objectFit:"contain"}}/> : null;
}
const fileTypes: Record<string,string> = {
  md:"文档", txt:"文档", docx:"文档", csv:"表格", xlsx:"表格", pptx:"演示",
  pdf:"PDF", png:"图片", jpg:"图片", jpeg:"图片", gif:"图片", webp:"图片",
};
const fileType = (filename: string) => fileTypes[filename.split(".").pop()?.toLowerCase() || ""] || "其他";
export function FilesPage() {
  const [params,setParams]=useSearchParams();
  const { workspace, user } = useTeam(),
    navigate = useNavigate();
  const [search, setSearch] = useState(""),
    [type, setType] = useState(""),
    [cloud, setCloud] = useState(false);
  const selected = params.get("file");
  const setSelected = (id: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (id) next.set("file",id); else next.delete("file");
    return next;
  },{replace:true});
  const files = useQuery({
    queryKey:["team",workspace.id,"files",user.id],
    queryFn:()=>request(workspace.id,"/files",FileRow.array()),
    refetchOnMount:"always", refetchOnWindowFocus:"always", refetchInterval:3500,
    staleTime:0,
  });
  const available = files.isFetchedAfterMount && !files.isError ? files.data : undefined;
  const members = useTeamQuery(["members"], () =>
    teamApi.listMembers(workspace.id),
  );
  const agents = useTeamQuery(["agents"], () => teamApi.listAgents({workspace_id:workspace.id}));
  const uploader = (file:z.infer<typeof FileRow>) => file.kind==="work" ? "Work" :
    members.data?.find(m=>m.user_id===file.uploader)?.name || agents.data?.find(agent=>agent.id===file.uploader)?.name || "成员";
  const file = available?.find((f) => f.id === selected);
  const download = useTeamAction(async () => {
    if (!file) return;
    const u=URL.createObjectURL(await fetchWorkspaceFile(workspace.id,file));
    const a = document.createElement("a");
    a.href = u;
    a.download = file.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  });
  const query = search.trim().toLowerCase();
  const rows = available?.filter(f=>(!type || fileType(f.filename)===type) &&
    [f.filename,f.source_title,uploader(f)].some(text=>text.toLowerCase().includes(query)));
  const showSource = (entry:z.infer<typeof FileRow>) => {
    const base = "/team/"+workspace.slug;
    const message = entry.message_id ? "&message="+entry.message_id : "";
    if (entry.kind==="issue") {
      navigate(base+"/issue/"+entry.source_id+(entry.message_id ? "?comment="+entry.message_id : ""));
    } else if (entry.kind==="room") {
      navigate(base+"?view=rooms&room="+entry.source_id+message);
    } else if (entry.kind==="agent-chat") {
      navigate(base+"?view=agent-chat&chat="+entry.source_id+message);
    } else {
      navigate(base+"?view=workbench&conversation="+entry.source_id+message);
    }
  };
  return <section className="v3-files" aria-label="我的文件">
    <h1>我的文件</h1>
    <p>查看当前团队中可访问的会话附件与任务成果。</p>
    <nav aria-label="文件范围">{["任务成果","云端网盘"].map((label,i)=>
      <button key={label} aria-pressed={cloud===Boolean(i)} onClick={()=>setCloud(Boolean(i))}>{label}</button>)}</nav>
    {cloud ? <p className="v3-files-empty"><FolderOpen size={24}/>云端网盘未接入，不会上传任何附件。</p> : <>
      <div className="v3-file-filters">
        <select aria-label="文件类型" value={type} onChange={e=>setType(e.target.value)}>
          <option value="">全部类型</option>{["文档","表格","演示","PDF","图片","其他"].map(t=><option key={t}>{t}</option>)}
        </select>
        <label><Search size={16}/><input aria-label="搜索文件" placeholder="搜索文件、来源或上传者" value={search} onChange={e=>setSearch(e.target.value)}/></label>
        {(search||type) && <button onClick={()=>{setSearch("");setType("");}}>清除筛选</button>}
      </div>
      <Failure error={files.error}/>
      {!files.error && (!available ? <p className="v3-files-empty" role="status">正在读取文件…</p> :
        rows?.length ? <ul>{rows.map(f=><li key={f.kind+":"+f.id}>
          <button onClick={()=>setSelected(f.id)}><FileText size={18}/><strong>{f.filename}</strong>
            <span>{fileType(f.filename)} · {f.source_title} · {uploader(f)}</span>
            <time dateTime={f.created_at}>{new Date(f.created_at).toLocaleString("zh-CN")}</time></button>
        </li>)}</ul> : <p className="v3-files-empty" role="status">{available.length ? "没有匹配的文件" : "暂无附件或交付文件"}</p>)}
    </>}
    {selected && available && !file && <Modal title="文件不可用" onClose={()=>setSelected("")}>
      <p>当前无法访问此文件。</p><Action onClick={()=>setSelected("")}>返回文件列表</Action>
    </Modal>}
    {file && <Modal title={file.filename} onClose={()=>setSelected("")} className="v3-file-dialog">
      <p>来源：{file.source_title} · {uploader(file)}</p>
      <p>{file.size} 字节 · {fileType(file.filename)}</p>
      {file.downloadable ? <FilePreview file={file} workspaceId={workspace.id}/> : <p>此记录只有附件名称，没有可下载的文件内容。</p>}
      <Failure error={download.error}/>
      <footer><button onClick={()=>showSource(file)}>查看来源</button>
        {file.downloadable && <Action primary disabled={download.isPending} onClick={()=>download.mutate()}><Download size={15}/>下载文件</Action>}</footer>
    </Modal>}
  </section>;
}
