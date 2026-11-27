import React,{useEffect,useState} from 'react';
import {useWorkspace,updateWorkspace,getWorkspace} from './multica-ui/store';
import {useIdentity,identity,setIdentity} from './local-identity';
import {getConversation} from './collaboration-store';
import {invitationEvents,writeInvitation,matchesInvite,InviteEvent} from './invitation-events';
import {findLocalMember,inviteLinkAvailable,readInviteLinks} from './team-access';
import {currentTeam,teamUrl} from './team-context';
import {INVITATION_TEST_MEMBERS} from './invitation-test-members';
export function acceptInvitation(id:string){
 const invite=invitationEvents().find(i=>i.id===id),data=getWorkspace();
 if(!invite||!matchesInvite(invite.to,identity(),data.members))throw new Error('邀请身份不匹配');
 if(invite.acceptedAt)return invite;
 if(invite.conversation&&!getConversation(invite.conversation)?.members.includes(identity()))throw new Error('邀请已撤销');
 if(invite.email)updateWorkspace(s=>{if(!s.invitations.some(i=>i.id===id))throw new Error('邀请已撤销');if(!s.members.some(m=>m.email===invite.email))s.members.push({name:identity(),email:invite.email!,role:invite.role||'成员'} as any);s.invitations=s.invitations.filter(i=>i.id!==id)});
 const accepted={...invite,acceptedAt:new Date().toISOString()};writeInvitation(accepted);return accepted;
}
export function InvitationReceiver(){
 const data=useWorkspace(),who=useIdentity();
 const [selectedId,setSelectedId]=useState(''),[error,setError]=useState(''),[joined,setJoined]=useState(false);
 const selected=selectedId?invitationEvents().find(i=>i.id===selectedId):undefined;
 const link=selectedId&&!selected?readInviteLinks().find(i=>i.id===selectedId):undefined;
 useEffect(()=>{
  const open=(e:any)=>{setSelectedId(String(e.detail||''));setError('');setJoined(false)};
  window.addEventListener('mw-accept-invitation',open);
  const id=new URLSearchParams(location.search).get('invite');if(id)open({detail:id});
  return()=>window.removeEventListener('mw-accept-invitation',open);
 },[]);
 if(!selectedId)return null;
 const close=()=>{setSelectedId('');const url=new URL(location.href);url.searchParams.delete('invite');history.replaceState(null,'',url)};
 if(!selected){
  const already=!!findLocalMember(data.members,who),available=inviteLinkAvailable(link);
  const join=()=>{try{if(!inviteLinkAvailable(readInviteLinks().find(i=>i.id===selectedId)))throw new Error('邀请链接已失效');
   updateWorkspace(s=>{if(!findLocalMember(s.members,who))s.members.push({name:who,email:who.includes('@')?who:'local-'+crypto.randomUUID()+'@demo.invalid',role:'成员'})});setJoined(true);
  }catch{setError('邀请链接已失效或无法保存，请联系邀请人。')}};
  return <div className="fx-search-overlay"><section className="fx-invitation" role="dialog" aria-modal="true" aria-label="接受邀请"><h2>{joined?'已接受邀请':available?'团队邀请链接':'邀请不可用'}</h2><p>{available?`以 ${who} 的身份加入「${currentTeam().name}」，权限为成员。`:'链接不存在、已停用、已过期，或不属于当前浏览器。'}</p>{available&&already&&!joined&&<p>该身份已经是团队成员。</p>}{error&&<p role="alert">{error}</p>}<footer><button onClick={close}>关闭</button>{available&&!already&&!joined&&<button className="co-primary" onClick={join}>加入团队</button>}</footer></section></div>;
 }
 const valid=matchesInvite(selected.to,who,data.members);
 const fixture=!valid&&!selected.acceptedAt&&selected.email&&INVITATION_TEST_MEMBERS.find(m=>m.email===selected.email);
 const accept=()=>{
  try{
   const accepted=acceptInvitation(selected.id);setJoined(true);setError('');
   if(selected.conversation)location.href=teamUrl('index.html?conversation='+selected.conversation);
  }catch{setError('邀请已撤销或无法保存，请联系邀请人。')}
 };
 return <div className="fx-search-overlay"><section className="fx-invitation" role="dialog" aria-modal="true" aria-label="接受邀请">
  <h2>{(joined||selected.acceptedAt)?'已接受邀请':'邀请你加入'}</h2>
  <p>{selected.from} 邀请你加入「{selected.context}」</p><p>当前身份：{who}</p>
  {!valid&&!selected.acceptedAt&&<p role="alert">此邀请发送给 {selected.to}，请先切换到对应身份。</p>}
  {fixture&&<p>这是本地测试邀请。切换只影响当前标签页，不会自动接受邀请。</p>}
  {error&&<p role="alert">{error}</p>}
  <footer><button onClick={close}>关闭</button>
   {fixture&&<button className="co-primary" onClick={()=>{setIdentity(fixture.email);setError('')}}>切换测试身份 · {fixture.name}</button>}
   {valid&&!selected.acceptedAt&&<button className="co-primary" onClick={accept}>接受邀请</button>}
  </footer>
 </section></div>;
}
