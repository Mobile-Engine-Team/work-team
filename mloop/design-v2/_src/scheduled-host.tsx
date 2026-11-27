import React from 'react';
import {createRoot} from 'react-dom/client';
import {ScheduledTasks} from './scheduled-tasks';
class ScheduledWorkspace extends HTMLElement {
 private root:any;
 connectedCallback(){if(!this.root){this.root=createRoot(this);this.root.render(<ScheduledTasks/>);}}
 disconnectedCallback(){const root=this.root;this.root=null;queueMicrotask(()=>root?.unmount());}
}
if(!customElements.get('scheduled-workspace'))customElements.define('scheduled-workspace',ScheduledWorkspace);
