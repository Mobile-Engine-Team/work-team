import React,{useState} from 'react';
import {MwPageTitle,MwCardRow,MwButton,MwSelect,MwSwitch,MwActionRow} from '@/react-app/domains/settings/mobilework/kit';
import {getMwSettingsSections} from '@/react-app/domains/settings/mobilework/sections';
import {Layers,Plus} from 'lucide-react';
import {Modal} from './multica-ui/primitives';
import {applyFont,applyTheme,usePreference} from './local-preferences';
import {useIdentity} from './local-identity';

const notify=(text:string)=>window.dispatchEvent(new CustomEvent('design-toast',{detail:text}));
const version='MW-V1.0.1 · 本地原型';
const prefsOnly='本地偏好，仅记录选择，不执行系统操作。';
function Choice({id,options,personal=false}:{id:string;options:string[];personal?:boolean}){
 const [value,save]=usePreference(id,options[0],personal);
 return <MwSelect value={value} onChange={save} className="shrink-0" style={{width:150}} options={options.map(x=>({value:x,label:x}))}/>;
}
function Toggle({id,label,personal=false,initial=true}:{id:string;label:string;personal?:boolean;initial?:boolean}){
 const [value,save]=usePreference(id,initial,personal);
 return <MwSwitch checked={value} onCheckedChange={save} aria-label={label}/>;
}
export function SettingsContent(props){const who=useIdentity();return <LocalSettings key={who+':'+props.section} who={who} {...props}/>}
function LocalSettings({section,who,FontSizeControl,ThemeSegmented}){
 const [theme,saveTheme]=usePreference('theme','light'),[font,saveFont]=usePreference('font',14);
 const [instruction,saveInstruction]=usePreference('instruction','',true),[memory,saveMemory]=usePreference('memory','',true),[models,saveModels]=usePreference<string[]>('mock-model-names',[]);
 const [draft,setDraft]=useState(instruction),[input,setInput]=useState(''),[dialog,setDialog]=useState(''),[modelToRemove,setModelToRemove]=useState(''),[error,setError]=useState('');
 const close=()=>{setDialog('');setError('')};
 const open=(name:string,value='')=>{setInput(value);setError('');setDialog(name)};
 const action=(title,description,label,fn)=> <MwActionRow title={title} description={description} actionLabel={label} onAction={fn}/>;
 const row=(title,description,control)=> <MwCardRow title={title} description={description} control={control}/>;
 const confirm=(text,save)=> <div className="flex justify-end gap-2"><MwButton variant="secondary" onClick={close}>取消</MwButton><MwButton onClick={save}>{text}</MwButton></div>;
 return <><MwPageTitle>{getMwSettingsSections().find(s=>s.key===section)?.label}</MwPageTitle>
 {section==='account'?<><div className="flex min-h-[100px] flex-wrap items-center gap-4 rounded-lg bg-[image:var(--mw-account-card-background)] bg-cover bg-center p-5"><span className="flex size-[50px] items-center justify-center rounded-full bg-[var(--mw-brand-bg)] text-2xl text-[var(--mw-brand)]">{who.slice(0,1)}</span><span className="text-[18px] font-medium text-[var(--mw-account-card-text)]">{who}</span><div className="ml-auto flex gap-3"><MwButton variant="secondary" onClick={()=>open('退出登录')}>退出登录</MwButton><MwButton onClick={()=>open('我的积分')}>我的积分</MwButton></div></div><p className="text-sm">当前为本地演示身份，不需要网页登录；切换身份请使用左下角账户菜单。</p></>
 :section==='system'?<div className="flex flex-col gap-4">
 {row('语言','界面固定为简体中文；语言选择只记录偏好。',<Choice id="language" options={['简体中文','English']}/>)}
 <FontSizeControl value={font===12?'small':font===18?'large':'default'} onChange={tier=>{const size=tier==='small'?12:tier==='large'?18:14;if(saveFont(size))applyFont(size)}}/>
 {row('主题','跟随系统，或固定浅色／深色。',<ThemeSegmented value={theme} onChange={v=>{if(saveTheme(v))applyTheme(v)}}/>)}
 {action('存储位置','当前数据保存在浏览器中，不写入主机文件夹。','了解',()=>open('本地存储'))}
 {row('关闭行为',prefsOnly,<Choice id="close-behavior" options={['最小化到系统托盘','退出应用']}/>)}
 </div>:section==='personalization'?<div className="flex flex-col gap-4">
 {row('回复语气','按身份保存；不会改变固定的 Mock 回复。',<Choice personal id="tone" options={['简洁','严谨','友好']}/>)}
 {row('加载提示','按身份记录偏好，不改变 Mock 进度卡。',<Toggle personal id="loading-tips" label="加载提示"/>)}
 <label className="flex flex-col gap-2">自定义指令 <small>按身份保存，不提交给模型；清空后保存可删除。</small><textarea aria-label="自定义指令" rows={3} maxLength={150} className="form-field" value={draft} onChange={e=>setDraft(e.target.value)}/></label>
 <div className="flex items-center justify-end gap-3"><span className="text-xs">{draft.length}/150</span><MwButton disabled={draft===instruction} onClick={()=>{if(saveInstruction(draft))notify('自定义指令已保存')}}>保存指令</MwButton></div>
 </div>:section==='security'?<div className="flex flex-col gap-4">
 <p className="text-sm">安全设置仅演示配置流程。这里没有文件访问沙箱、策略执行或正式审计服务。</p>
 {row('安全防护',prefsOnly,<Toggle id="guard" label="安全防护"/>)}
 {row('沙箱保护',prefsOnly,<Toggle id="sandbox" label="沙箱保护"/>)}
 {action('文件安全','网页无权设置主机受保护目录。','查看',()=>open('文件安全'))}
 {['行为审计','会话审计','沙箱审计日志'].map(name=><React.Fragment key={name}>{action(name,'暂无正式审计记录。','查看明细',()=>open(name))}</React.Fragment>)}
 </div>:section==='memory'?<div className="flex flex-col gap-4">
 {row('生成对话记忆','只保存偏好，不会提取、注入或同步对话记忆。',<Toggle personal id="memory-generate" label="生成对话记忆"/>)}
 {action('管理对话记忆',memory||'暂无手动记录。','编辑',()=>open('管理对话记忆',memory))}
 </div>:section==='models'?<div className="flex flex-col gap-4">
 {row('本地模型样例','只管理显示名称，不填写密钥，不调用接口，不影响已预配的 Work 或其他智能体。',<MwButton variant="secondary" onClick={()=>open('添加模型')}><Plus size={16}/>添加模型</MwButton>)}
 {row('模型安全防护',prefsOnly,<Toggle id="model-firewall" label="模型安全防护"/>)}
 <h2 className="text-lg">已保存样例</h2>{!models.length&&<p>暂无模型样例</p>}{models.map(model=><React.Fragment key={model}>{row(model,'本地样例',<MwButton variant="secondary" onClick={()=>{setModelToRemove(model);open('移除模型')}}>移除 {model}</MwButton>)}</React.Fragment>)}
 </div>:section==='software'?<div className="flex flex-col gap-4">
 {row('版本信息',version,<MwButton variant="ghost" onClick={async()=>{try{await navigator.clipboard.writeText(version);notify('版本信息已复制')}catch{open('版本信息')}}}><Layers size={14}/>复制版本信息</MwButton>)}
 {row('开机启动',prefsOnly,<Toggle initial={false} id="auto-launch" label="开机启动"/>)}
 {action('快捷键','查看当前网页实际支持的快捷操作。','查看',()=>open('快捷键'))}
 </div>:<div className="flex flex-col gap-4">
 {action('帮助文档','打开本地使用与实现手册。','打开',()=>{window.open('./docs/使用与实现手册.md','_blank','noopener,noreferrer')})}
 {action('问题反馈','本地版不会上传日志或提交报告。','查看',()=>open('问题反馈'))}
 {action('关于 MobileWork',version,'查看',()=>open('关于 MobileWork'))}
 </div>}
 {dialog&&<Modal title={dialog} onClose={close} footer={dialog==='添加模型'?confirm('添加',()=>{const name=input.trim();if(!name){setError('请输入模型样例名称');return}if(models.some(m=>m.toLowerCase()===name.toLowerCase())){setError('已存在同名样例');return}if(saveModels([...models,name]))close()}):dialog==='移除模型'?confirm('移除',()=>{if(saveModels(models.filter(m=>m!==modelToRemove)))close()}):dialog==='管理对话记忆'?confirm('保存',()=>{if(saveMemory(input.trim()))close()}):<MwButton onClick={close}>关闭</MwButton>}>
 {dialog==='添加模型'?<label className="flex flex-col gap-2">样例名称<input className="form-field" autoFocus maxLength={64} value={input} onChange={e=>{setInput(e.target.value);setError('')}}/>{error&&<span role="alert">{error}</span>}</label>
 :dialog==='移除模型'?<p>移除「{modelToRemove}」？只移除此本地样例。</p>
 :dialog==='管理对话记忆'?<label className="flex flex-col gap-2">手动记忆（保存空内容可清除）<textarea className="form-field" autoFocus rows={6} maxLength={2000} value={input} onChange={e=>setInput(e.target.value)}/></label>
 :dialog==='快捷键'?<ul className="space-y-2"><li>全局搜索：⌘/Ctrl + K</li><li>发送会话消息：Enter（输入法候选确认不会发送）</li><li>会话换行：Shift + Enter</li><li>关闭支持快捷操作的当前弹层：Esc</li></ul>
 :<p>{({'退出登录':'该工作区未接入账号服务，没有可撤销的登录。请从账户菜单切换本地预览身份。','我的积分':'本地版没有积分余额或扣费。','本地存储':'数据随当前浏览器配置及地址端口保存；清除站点数据会移除本地记录。','文件安全':'浏览器不能读取未选中的主机文件，也不能配置主机受保护目录。','问题反馈':'请在当前交付渠道反馈问题，并自行提供可公开的复现步骤。','版本信息':version,'关于 MobileWork':version})[dialog]||'没有连接正式审计服务，无记录可查。'}</p>}
 </Modal>}</>;
}
