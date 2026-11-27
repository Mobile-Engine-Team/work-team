import type {BoardIssue} from './board-model';
import type {Comment} from './store';

type TimelineEntry=
 | {kind:'comment';id:string;time?:string;comment:Comment}
 | {kind:'property';id:string;time:string;event:NonNullable<BoardIssue['activity']>[number]};
const timestamp=(time?:string)=>{const value=Date.parse(time||'');return Number.isFinite(value)?value:0};

export function taskTimeline(issue:BoardIssue,comments:Comment[]):TimelineEntry[]{
 const entries:TimelineEntry[]=[
  ...comments.filter(c=>c.issue===issue.id).map(comment=>({kind:'comment' as const,id:'comment:'+comment.id,time:comment.createdAt,comment})),
  ...(issue.activity||[]).map(event=>({kind:'property' as const,id:'property:'+event.id,time:event.time,event})),
 ];
 return entries.sort((a,b)=>timestamp(a.time)-timestamp(b.time)||a.id.localeCompare(b.id));
}
