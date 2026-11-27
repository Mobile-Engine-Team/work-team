// Local equivalent of the five-field robfig schedules used by the reference UI.
// Dates are evaluated in the schedule's IANA timezone, including DST changes.
const descriptors:Record<string,string>={'@yearly':'0 0 1 1 *','@annually':'0 0 1 1 *','@monthly':'0 0 1 * *','@weekly':'0 0 * * 0','@daily':'0 0 * * *','@midnight':'0 0 * * *','@hourly':'0 * * * *'};
const names=[{}, {}, {},Object.fromEntries('JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ').map((n,i)=>[n,i+1])),Object.fromEntries('SUN MON TUE WED THU FRI SAT'.split(' ').map((n,i)=>[n,i]))];
function field(source:string,index:number){
  const [min,max]=[[0,59],[0,23],[1,31],[1,12],[0,6]][index];
  const value=(s:string)=>{const v=(names[index] as any)[s.toUpperCase()]??(/^\d+$/.test(s)?Number(s):NaN);if(!Number.isInteger(v)||v<min||v>max)throw Error('字段超出范围');return v};
  const result=new Set<number>();
  for(const part of source.split(',')){
    const pieces=part.split('/');if(pieces.length>2||pieces[1]!==undefined&&!/^\d+$/.test(pieces[1]))throw Error('无效间隔');
    const step=pieces[1]===undefined?1:Number(pieces[1]);if(!step)throw Error('间隔必须大于 0');
    const range=pieces[0].split('-');if(range.length>2||range.some(x=>!x))throw Error('无效范围');
    const wildcard=range[0]==='*'||range[0]==='?';
    const start=wildcard?min:value(range[0]);const end=range.length===2?value(range[1]):wildcard||pieces.length===2?max:start;
    if(start>end)throw Error('范围的结束必须晚于开始');
    for(let n=start;n<=end;n+=step)result.add(n);
  }
  return {values:[...result].sort((a,b)=>a-b),wild:source.startsWith('*')||source.startsWith('?')};
}
export function parseSchedule(expression:string,timezone:string){
  let text=expression.trim();const prefix=text.match(/^(?:CRON_TZ|TZ)=([^\s]+)\s+(.*)$/);if(prefix){timezone=prefix[1];text=prefix[2]}
  new Intl.DateTimeFormat('en',{timeZone:timezone}).format(new Date());
  if(text.startsWith('@every ')){
    const duration=text.slice(7);let total=0,index=0;const re=/(\d+(?:\.\d+)?)(h|ms|us|µs|ns|m|s)/g;let match;
    while((match=re.exec(duration))){if(match.index!==index)throw Error('无效间隔');index=re.lastIndex;total+=Number(match[1])*({h:3600000,m:60000,s:1000,ms:1,us:.001,'µs':.001,ns:.000001} as any)[match[2]]}
    if(!total||index!==duration.length)throw Error('无效间隔');return {timezone,interval:Math.max(1000,Math.floor(total/1000)*1000),fields:null};
  }
  text=descriptors[text]||text;const fields=text.split(/\s+/);if(fields.length!==5)throw Error('请输入五段 Cron 字段');
  return {timezone,interval:0,fields:fields.map(field)};
}
export function scheduleDates(expression:string,timezone:string,now=new Date(),count=3):Date[]{
  const config=parseSchedule(expression,timezone);
  if(config.interval)return Array.from({length:count},(_,i)=>new Date(Math.floor(now.getTime()/1000)*1000+(i+1)*config.interval));
  const [minutes,hours,dom,months,dow]=config.fields!;
  const format=new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const parts=(date:Date)=>Object.fromEntries(format.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)])) as Record<string,number>;
  const local=parts(now);const today=Date.UTC(local.year,local.month-1,local.day);const result:Date[]=[];
  // Four years cover Feb 29; the same bound as the server avoids impossible schedules.
  for(let i=0;i<1462&&result.length<count;i++){
    const date=new Date(today+i*86400000),month=date.getUTCMonth()+1,day=date.getUTCDate(),weekday=date.getUTCDay();
    if(!months.values.includes(month))continue;
    const dayMatches=dom.wild||dow.wild?dom.values.includes(day)&&dow.values.includes(weekday):dom.values.includes(day)||dow.values.includes(weekday);
    if(!dayMatches)continue;
    const candidates:Date[]=[];
    for(const hour of hours.values)for(const minute of minutes.values){
      if(i===0&&hour*60+minute<local.hour*60+local.minute)continue;
      const target=Date.UTC(date.getUTCFullYear(),month-1,day,hour,minute);let time=target;
      for(let n=0;n<3;n++){const p=parts(new Date(time));const offset=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)-time;if(time===target-offset)break;time=target-offset}
      // Check both sides of a repeated DST hour, and skip local times that don't exist.
      for(const shift of [-3600000,0,3600000]){const actual=new Date(time+shift);if(actual<=now)continue;const p=parts(actual);if(p.year===date.getUTCFullYear()&&p.month===month&&p.day===day&&p.hour===hour&&p.minute===minute)candidates.push(actual)}
    }
    candidates.sort((a,b)=>a.getTime()-b.getTime());
    for(const candidate of candidates)if(!result.some(d=>d.getTime()===candidate.getTime())){result.push(candidate);if(result.length===count)break}
  }
  return result;
}
