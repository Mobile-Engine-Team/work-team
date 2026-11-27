import {TeamAssistance} from './team-assistance';
import React,{useRef,useState} from 'react';
import {ChevronDown,ChevronRight,Search,X,Copy,RotateCw,Check,Users} from 'lucide-react';
import {WorkspaceFolderGlyph,SessionSearchGlyph,SessionHistoryGlyph,SessionRightRailGlyph} from '@/react-app/design-system/mw-glyphs';
import {Composer,SAMPLE_TITLE,taskNames,notify} from './chrome';

export function Task(){
 const taskIndex=Number(new URLSearchParams(location.search).get('task'))||0;
 const title=taskNames[taskIndex]??SAMPLE_TITLE;
 const isPrimary=title===SAMPLE_TITLE;
 const[draft,setDraft]=useState(''),[thinking,setThinking]=useState(false),[history,setHistory]=useState(false),[search,setSearch]=useState<string|null>(null),[rail,setRail]=useState(false),[followups,setFollowups]=useState<string[]>([]);
 const [assistDraft,setAssistDraft]=useState<{draft:string;quote:string}|null>(null);
 const scroll=useRef<HTMLDivElement>(null);
 const openAssistance=()=>{
   const question=followups.at(-1)||(isPrimary?'你可以一直思考一个问题，就是p = np问题，千禧年难题，你必须解决':title);
   const answer=followups.length?'已收到。当前为静态设计稿，以上展示完整的对话排版和交互状态。':scroll.current?.querySelector<HTMLElement>('.task-markdown')?.innerText||'';
   setAssistDraft({draft,quote:'我：'+question+'\n\nMobileWork：'+answer});
 };
 const latest=()=>scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'});
 return <div className={'chat-layout reference-chat '+(rail?'chat-with-rail':'')}>
   <header className="session-header"><div className="session-breadcrumb"><span className="session-workspace"><WorkspaceFolderGlyph className="size-4"/>默认工作空间</span><ChevronRight size={16}/><h1>{title}</h1></div><div className="session-header-actions"><button className="ta-entry" onClick={()=>openAssistance()}><Users size={15}/>团队协助</button><i/>{search!==null?<div className="session-search"><Search size={14}/><input aria-label="搜索对话" placeholder="搜索对话" autoFocus value={search} onChange={e=>setSearch(e.target.value)}/><button aria-label="关闭对话搜索" onClick={()=>setSearch(null)}><X size={14}/></button></div>:<button aria-label="搜索对话" onClick={()=>setSearch('')}><SessionSearchGlyph className="size-4"/></button>}<i/><div className="history-question-wrap"><button className="history-question-trigger" onClick={()=>setHistory(!history)}><SessionHistoryGlyph className="size-4"/>历史提问</button>{history&&<div className="history-question-popover"><h3>历史提问</h3>{isPrimary&&<button onClick={()=>{scroll.current?.scrollTo({top:0,behavior:'smooth'});setHistory(false)}}>你可以一直思考一个问题，就是p = np问题，千禧年难题，你必须解决</button>}<button onClick={()=>{scroll.current?.scrollTo({top:0,behavior:'smooth'});setHistory(false)}}>{title}</button>{followups.map((text,i)=><button key={i} onClick={()=>{latest();setHistory(false)}}>{text}</button>)}</div>}</div><i/><button aria-label={rail?'关闭右侧栏':'展开右侧栏'} onClick={()=>setRail(!rail)}><SessionRightRailGlyph className="size-4 -scale-x-100"/></button></div></header>
   <div className="transcript-area"><div className="transcript-scroll" ref={scroll}><div className="transcript-column">
     <div className="user-message">{isPrimary?'你可以一直思考一个问题，就是p = np问题，千禧年难题，你必须解决':title}</div>
     <article className="assistant-message"><div className="assistant-identity"><img src="ai-message-avatar.svg" alt=""/><span>MobileWork</span></div><div className="assistant-completion">已完成 · 17s</div><button aria-expanded={thinking} className="thinking-toggle" onClick={()=>setThinking(!thinking)}>深度思考<ChevronDown size={14} className={thinking?'rotate-180':''}/></button>{thinking&&<div className="thinking-content">先明确 P 与 NP 的定义，再检查是否存在严格、可复核的证明。当前仍没有公认的解决方案，因此应如实说明边界，并解释已有研究与证明必须满足的条件。</div>}
     {isPrimary?<div className="task-markdown">
       <h2>先说结论</h2>
       <p>这件事我做不到，我也不会假装做到。</p>
       <p>我这样说，是因为要真正解决 P vs NP，必须给出一个<strong>数学上完整、可被同行逐行检验的证明</strong>。这个证明至今没有人做出来，AI 同样没有做出来。任何声称“已经解决”的回答，要么是误解了问题，要么是在编造。如果我今天给你一套看似严密的论证，然后说“证毕”，那对你毫无价值，还会浪费你判断真伪的时间。</p>
       <p>但“我不能解决它”并不意味着“我没什么可说的”。下面是我认为真正有用的思考。</p>
       <hr/>
       <h2>一、先把问题说准</h2>
       <p>大多数人，包括不少写“证明”的人，一开始就把它说错了。</p>
       <p><strong>P</strong>：存在多项式时间算法可判定的语言类。 <strong>NP</strong>：存在多项式时间验证器的语言类；给定一个候选解，能在多项式时间内验证它是否成立。</p>
       <p>P vs NP 问的是：<strong>P = NP 还是 P ≠ NP?</strong></p>
       <p>关键细节在于：</p>
       <ul><li>它问的是<strong>判定问题</strong>的复杂度类是否相等，不是“难问题能不能快点算”。</li><li>NP 的定义是<strong>验证</strong>，不是<strong>求解</strong>。很多人把“我能不能验证一个解”偷换成“我能不能找到一个解”，错误就从这里开始。</li></ul>
       <hr/><h2>二、一个证明必须回答什么</h2><p>无论证明哪一个方向，都需要对所有合法输入成立，给出完整、可核查的推导，并避免把局部现象当作普遍结论。</p><p>如果证明 P = NP，就需要给出一个 NP 完全问题的多项式时间算法；如果证明 P ≠ NP，则需要严格证明某个 NP 问题无法由任何多项式时间算法解决。</p>
       <h2>三、可以继续推进的工作</h2><p>我们可以从现有复杂度理论出发，逐步检查具体思路、寻找论证漏洞，或者研究受限模型中的已知结论。每一步都需要区分已经证明的事实与尚待验证的猜想。</p>
     </div>:<p className="task-markdown">这条任务的对话记录会在这里继续展开。当前为静态设计稿，已切换到「{title}」上下文。</p>}<div className="assistant-actions"><button title="复制" onClick={()=>{navigator.clipboard?.writeText(document.querySelector('.task-markdown')?.textContent||'');notify('内容已复制')}}><Copy size={14}/></button><button title="重新生成" onClick={()=>notify('已显示静态回答')}><RotateCw size={14}/></button></div></article>
     {followups.map((text,i)=><div className="followup-turn" key={i}><div className="user-message">{text}</div><div className="assistant-identity"><img src="ai-message-avatar.svg" alt=""/><span>MobileWork</span></div><p>已收到。当前为静态设计稿，以上展示完整的对话排版和交互状态。</p></div>)}
   </div></div><div className="transcript-bottom-fade"/><button className="jump-to-latest" onClick={latest}>跳转到最新消息</button></div>
   <div className="session-composer-dock"><div className="session-composer-column"><Composer draft={draft} setDraft={setDraft} onSend={()=>{setFollowups([...followups,draft]);setDraft('');requestAnimationFrame(latest)}}/></div><p className="composer-disclaimer">内容由AI生成，请核实重要信息</p></div>
   {assistDraft&&<TeamAssistance initialDraft={assistDraft.draft} quote={assistDraft.quote} onClose={()=>setAssistDraft(null)} onCreated={()=>{setAssistDraft(null);notify('任务已创建 · 本地演示')}}/>}
   {rail&&<aside className="task-right-rail"><header>任务成果<button aria-label="关闭成果" onClick={()=>setRail(false)}><X size={16}/></button></header><div><WorkspaceFolderGlyph className="size-8"/><p>当前任务暂无成果文件</p><a href="files.html">查看我的文件</a></div></aside>}
 </div>;
}
