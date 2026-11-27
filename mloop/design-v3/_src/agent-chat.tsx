import React from 'react';
import {Collaboration} from './collaboration';
import {resolveAgentConversation} from './conversation-bridge';
export function AgentChat(){const c=resolveAgentConversation(new URLSearchParams(location.search));return c?<Collaboration initialId={c.id}/>:<div className="co-task-empty"><h3>智能体不存在或已归档</h3><a href="agents.html">返回智能体</a></div>}
