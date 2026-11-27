import React, { useSyncExternalStore } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import TeamPage from './views/team/team-page'
import { Pages } from './views/pages'
import { PAGE_SLOT } from './contract'
import sheet from './views/shell.css?inline'
import baseStyles from '@/app/index.css?inline'
import teamStyles from './views/team/team.css?inline'
import projectStyles from './views/team/projects.css?inline'
import workbenchStyles from './views/workbench/workbench.css?inline'
import dynamicStyles from './views/workbench/dynamic.css?inline'
import surfaceStyles from './views/workbench/a2ui.css?inline'

// Page plugins share the router, query cache and business context of this root.
export { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
export { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
export { teamApi, teamServer, text, useTeam, useTeamQuery, useTeamAction } from './views/team/client'
export { api, getApi, ApiError, dispatchReasonCode, errorCode } from '@multica/core/api'

function Workbench({ renderSlot, pageStore }) {
  const entries = useSyncExternalStore(pageStore.subscribe, pageStore.snapshot)
  const assembly = {
    entries: new Set(entries.map(entry => entry.options.key)),
    renderPage: (key, props) => renderSlot(PAGE_SLOT, props, { entryKey: key }),
  }
  return <Pages.Provider value={assembly}><HashRouter>
    <div className="mw-mac-top-base titlebar-drag pointer-events-auto fixed inset-x-0 top-0 z-[24] h-8 bg-[var(--mw-home-page)]" />
    <div className="team-pilot-shell"><div className="team-pilot-main">
      <Routes>
        <Route path="/team" element={<TeamPage showInvitationNotifications />} />
        <Route path="/team/:slug" element={<TeamPage showInvitationNotifications />} />
        <Route path="/team/:slug/issue/:issueId" element={<TeamPage showInvitationNotifications />} />
        <Route path="*" element={<Navigate to="/team" replace />} />
      </Routes>
    </div></div>
  </HashRouter></Pages.Provider>
}

export const inject = ['slots']
export function apply(ctx) {
  const root = document.documentElement
  const previousLanguage = root.lang
  const previousTitle = document.title
  const classes = ['openwork-electron', 'openwork-platform-mac'].filter(name => !root.classList.contains(name))
  root.classList.add(...classes)
  root.lang = 'zh-CN'
  document.title = '团队工作台'
  const style = document.createElement('style')
  style.textContent = [baseStyles, surfaceStyles, dynamicStyles, workbenchStyles, projectStyles, teamStyles, sheet].join('\n')
  document.head.append(style)
  ctx.effect(() => () => {
    style.remove()
    root.classList.remove(...classes)
    root.lang = previousLanguage
    document.title = previousTitle
  })
  const pageStore = {
    subscribe: notify => ctx.slots.subscribe(PAGE_SLOT, notify),
    snapshot: () => ctx.slots.entries(PAGE_SLOT),
  }
  ctx.slots.register({
    name: 'root', priority: -100, children: { [PAGE_SLOT]: { kind: 'keyed', scope: 'root' } },
    inject: () => ({ pageStore }),
  }, Workbench)
}
export * from './views/team/ui'
