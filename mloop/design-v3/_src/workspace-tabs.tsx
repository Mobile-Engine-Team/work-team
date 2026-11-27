import React from 'react';
import {TopTabs as OriginalTopTabs} from '@/react-app/domains/experts/workspace-ui';

export function WorkspaceTabs({value,onChange}) {
  return <div className="flex items-center gap-3">
    <OriginalTopTabs value={value} onChange={onChange}/>
  </div>;
}
