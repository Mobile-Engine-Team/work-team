import React from 'react';
import { Modal as WorkspaceModal, Select } from './primitives';
import copy from './project-reference-copy.json';

export const text = (key:string):string => (copy as Record<string,string>)[key] || key;
export const Action = ({primary=false,className='',...props}: React.ComponentProps<'button'> & {primary?:boolean}) => <button type="button" {...props} className={`project-action${primary?' project-action-primary':''} ${className}`} />;
export const Empty = ({children}:React.PropsWithChildren) => <div className="team-empty">{children}</div>;
export const Field = ({label,children}:React.PropsWithChildren<{label:string}>) => <label className="team-field"><span>{label}</span>{children}</label>;
export const Input = (props:React.ComponentProps<'input'>) => <input className="project-input" {...props} />;
export const Textarea = (props:React.ComponentProps<'textarea'>) => <textarea className="project-input" {...props} />;
export const Modal = ({title,onClose,wide,children}:React.PropsWithChildren<{title:string;onClose:()=>void;wide?:boolean}>) =>
  <WorkspaceModal title={title} onClose={onClose} className={`project-reference-dialog${wide?' project-dialog-wide':''}`}>{children}</WorkspaceModal>;
export const Picker = ({options=[],...props}:{label:string;value:string;onChange:(v:string)=>void;disabled?:boolean;options:{value:string;label:string}[]}) =>
  <Select {...props} placeholder={props.label} options={options.some(o=>o.value===props.value)||!props.value||props.disabled?options:[...options,{value:props.value,label:props.label}]} triggerClassName="project-picker" />;
const statusTokens:Record<string,string> = {进行中:'in_progress',已完成:'done',阻塞:'blocked'};
export const Status = ({value}:{value:string}) => <span className={`team-status team-status-${statusTokens[value] || 'neutral'}`}>{value}</span>;
export const PlanFailure = ({error}:{error:string}) => error ? <div className="project-error" role="alert">{error}</div> : null;
