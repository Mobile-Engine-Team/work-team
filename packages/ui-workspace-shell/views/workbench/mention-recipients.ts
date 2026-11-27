// A display name can belong to two members. The picker inserts the account email.
export function mentionRecipients<T extends {name:string;email:string;user_id:string}>(prompt:string,members:T[],self:string):T[]{
  const selected=new Map<string,T>();
  const labels=members.filter(m=>m.user_id!==self).flatMap(member=>
    [...new Set([member.email,member.name])].filter(Boolean).map(label=>({member,label}))
  ).sort((a,b)=>b.label.length-a.label.length);
  const mentions=/(^|\s)@/gu;
  const terminator=/^[\s，。！？、,;:：；!？?]/u;
  for(let match=mentions.exec(prompt);match;match=mentions.exec(prompt)){
    const rest=prompt.slice(mentions.lastIndex);
    const matches=(label:string)=>rest.startsWith(label) && (rest.length===label.length || terminator.test(rest.slice(label.length)));
    if(matches("Work")){mentions.lastIndex+=4;continue}
    const found=labels.find(entry=>matches(entry.label));
    if(!found)throw new Error("请选择当前工作区中可见的成员。");
    if(labels.some(entry=>entry.label===found.label && entry.member.user_id!==found.member.user_id))
      throw new Error("有多位成员使用此名称，请从伙伴菜单选择具体账号。");
    selected.set(found.member.user_id,found.member);
    mentions.lastIndex+=found.label.length;
  }
  return [...selected.values()];
}
