import React from 'react';

export function IssueStatusIcon({status}:{status:string}){
  const color=status==='阻塞'?'#e5484d':status==='进行中'?'#d9a441':status==='已完成'?'#3b6fd8':'#71717a';
  return <svg className="mc-status-glyph sidebar-inbox-status" viewBox="0 0 14 14" width="14" height="14" aria-label={status} style={{color}}><circle cx="7" cy="7" r="6" fill={status==='已完成'?'currentColor':'none'} stroke="currentColor" strokeWidth="1.5" strokeDasharray="3.14 0" strokeDashoffset="-0.7"/>{status==='进行中'&&<path d="M7 7 L7 3.5 A3.5 3.5 0 0 1 7 10.5 Z" fill="currentColor"/>}{status==='已完成'&&<path d="M10.951 4.249C11.283 4.581 11.283 5.119 10.951 5.451L5.951 10.451C5.619 10.783 5.081 10.783 4.749 10.451L2.749 8.451C2.417 8.119 2.417 7.581 2.749 7.249C3.081 6.917 3.619 6.917 3.951 7.249L5.35 8.648L9.749 4.249C10.081 3.917 10.619 3.917 10.951 4.249Z" fill="#fff"/>}{status==='阻塞'&&<line x1="4.525" y1="4.525" x2="9.475" y2="9.475" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>}</svg>;
}
