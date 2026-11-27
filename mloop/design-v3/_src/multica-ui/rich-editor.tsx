import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {EditorContent,useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {Markdown} from '@tiptap/markdown';
import {Extension} from '@tiptap/core';
import {Bold,Italic,Code,Heading2 as Heading,List,ListOrdered,Quote} from '../multica-icons';
import {useWorkspace} from './store';
import {mentionCandidates,ownWork} from '../member-policy';
import {useIdentity,useDirectory} from '../local-identity';
const markdown=()=>Markdown.configure({indentation:{style:'space',size:3}});
const starter=()=>StarterKit.configure({heading:{levels:[1,2,3,4,5,6]},link:{openOnClick:false}});
export function RichText({content='',className=''}:any){
  const editor=useEditor({extensions:[starter(),markdown()],content,contentType:'markdown',editable:false,editorProps:{attributes:{class:'mc-rich-content mc-rich-readonly'}}});
  useEffect(()=>{editor?.commands.setContent(content,{contentType:'markdown'})},[content,editor]);
  return <div className={className}><EditorContent editor={editor}/></div>;
}
export const RichEditor=forwardRef(function RichEditor({initial='',label='内容',placeholder='',onChange,onSubmit,commands,compact=false,autoFocus=false}:any,ref){
  useDirectory();const data=useWorkspace(),who=useIdentity();
  const handlers=useRef({onChange,onSubmit});handlers.current={onChange,onSubmit};
  const [mention,setMention]=useState<string|null>(null),[suggestionKind,setSuggestionKind]=useState('@'),[active,setActive]=useState(0),[toolbar,setToolbar]=useState(false);const composing=useRef(false),mentionState=useRef<any>(null),slashArmed=useRef(false);
  const mentionOptions=suggestionKind==='@'?[...mentionCandidates([who,ownWork(who)],data,who),...data.issues.map(i=>'ANDR-'+i.id)]:commands==='comment'?['note']:[];
  const matches=mention===null?[]:mentionOptions.filter(x=>x.toLowerCase().includes(mention.toLowerCase()));
  const editor=useEditor({
    extensions:[starter(),markdown(),Placeholder.configure({placeholder}),Extension.create({name:'localSubmit',addKeyboardShortcuts(){return {'Mod-Enter':()=>{if(composing.current)return false;if(handlers.current.onSubmit){handlers.current.onSubmit();return true}return false},Escape:()=>{if(mentionState.current){setMention(null);return true}return false}}}})],
    content:initial,contentType:'markdown',autofocus:autoFocus?'end':false,
    editorProps:{attributes:{role:'textbox','aria-label':label,'aria-multiline':'true',class:'mc-rich-content'},handleDOMEvents:{compositionstart:()=>{composing.current=true;return false},compositionend:()=>{composing.current=false;return false}},handleTextInput:(_view,_from,_to,text)=>{if(text==='/')slashArmed.current=true;return false},handleKeyDown:(_,event)=>{const suggestion=mentionState.current;if(!suggestion||composing.current||event.isComposing)return false;if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setActive(n=>(n+(event.key==='ArrowDown'?1:-1)+suggestion.matches.length)%suggestion.matches.length);return true}if(event.key==='Enter'&&suggestion.matches.length){event.preventDefault();suggestion.pick(suggestion.matches[suggestion.active]);return true}return false},handlePaste:(view,event)=>{slashArmed.current=false;const value=event.clipboardData?.getData('text/plain');if(!event.clipboardData?.getData('text/html')&&value&&(/\n|^#{1,6} |^[-*] |^\d+\. |\*\*/.test(value))){event.preventDefault();editor?.commands.insertContent((editor as any).markdown.parse(value));return true}return false}},
    onUpdate:({editor})=>{handlers.current.onChange?.((editor as any).getMarkdown(),editor.getHTML());const text=editor.state.doc.textBetween(Math.max(0,editor.state.selection.from-40),editor.state.selection.from,'\n');const match=text.match(/(?:^|\s)@([^@\s]*)$/);const slash=commands==='comment'&&slashArmed.current?text.match(/(?:^|\s)\/([^/\s]*)$/):null;setSuggestionKind(match?'@':'/');setMention(match?match[1]:slash?slash[1]:null);if(!slash&&!match)slashArmed.current=false;setActive(0)},
    onSelectionUpdate:({editor})=>setToolbar(!editor.state.selection.empty),
  });
  const pick=(name:string)=>{if(!editor||mention===null)return;const pos=editor.state.selection.from;editor.chain().focus().deleteRange({from:pos-mention.length-1,to:pos}).insertContent(suggestionKind+name+' ').run();setMention(null)};
  mentionState.current=mention===null||!matches.length?null:{matches,active:Math.min(active,matches.length-1),pick};
  useImperativeHandle(ref,()=>({clear:()=>editor?.commands.clearContent(true),focus:()=>editor?.commands.focus('end'),getMarkdown:()=>editor?(editor as any).getMarkdown():'',getHTML:()=>editor?.getHTML()||'',insert:(text:string)=>editor?.chain().focus().insertContent(text).run()}),[editor]);
  useEffect(()=>()=>{composing.current=false},[]);
  const command=(action:string)=>{const chain=editor?.chain().focus();if(action==='bold')chain?.toggleBold().run();if(action==='italic')chain?.toggleItalic().run();if(action==='code')chain?.toggleCode().run();if(action==='heading')chain?.toggleHeading({level:2}).run();if(action==='bullet')chain?.toggleBulletList().run();if(action==='ordered')chain?.toggleOrderedList().run();if(action==='quote')chain?.toggleBlockquote().run()};
  return <div className={'mc-rich-editor '+(compact?'mc-rich-compact':'')}>{toolbar&&<div className="mc-format-toolbar" role="toolbar" aria-label="文本格式" onMouseDown={e=>e.preventDefault()}>{[[Bold,'加粗','bold'],[Italic,'斜体','italic'],[Code,'行内代码','code'],[Heading,'标题','heading'],[List,'无序列表','bullet'],[ListOrdered,'有序列表','ordered'],[Quote,'引用','quote']].map(([Icon,title,action]:any)=><button key={action} type="button" aria-label={title} title={title} onClick={()=>command(action)}><Icon size={14}/></button>)}</div>}<EditorContent editor={editor}/>{mention!==null&&matches.length>0&&<div className="mc-mention-popup" role="listbox" aria-label={suggestionKind==='@'?'提及对象':'命令'} onMouseDown={e=>e.preventDefault()}>{matches.map((name,i)=><button key={name} type="button" role="option" aria-selected={active===i} onMouseMove={()=>setActive(i)} onClick={()=>pick(name)}>{name}</button>)}</div>}</div>
});
