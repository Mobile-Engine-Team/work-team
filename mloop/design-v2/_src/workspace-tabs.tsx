import React from 'react';
import {TopTabs as OriginalTopTabs} from '@/react-app/domains/experts/workspace-ui';

export function WorkspaceTabs({value,onChange}) {
  return <div className="flex items-center gap-3">
    <OriginalTopTabs value={value} onChange={onChange}/>
    <a href="agents.html" className="aw-top-tab"><img src="expert-workspace-icons/agent.svg" alt=""/>智能体</a>
  </div>;
}
