import React from 'react';
import {Collaboration} from './collaboration';
import {resolveGroupConversation} from './conversation-bridge';
export function GroupChat(){const c=resolveGroupConversation(new URLSearchParams(location.search));return c?<Collaboration initialId={c.id}/>:<div className="co-task-empty"><h3>小队不存在或已归档</h3><a href="squads.html">返回小队</a></div>}
