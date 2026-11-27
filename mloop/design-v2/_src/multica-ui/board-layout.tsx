import React from 'react';

export function BoardLayout({title,children,collapsed}:any){
  return <section className={'mw-module-layout mc-font '+(collapsed?'is-nav-collapsed':'')} aria-label={title}>{children}</section>;
}
