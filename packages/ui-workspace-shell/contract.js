import React, { useEffect, useRef, useState } from 'react'
import { invoke } from '@team-workbench/multica-host/client-api'

export const PAGE_SLOT = 'workbench.page'

export function contribute(ctx, key, label, order, component) {
  ctx.slots.inject(PAGE_SLOT, () => ctx.slots.register({ name: PAGE_SLOT, key, label, order }, component))
}

export function useQuery(call, dependencies) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    const controller = new AbortController()
    setState(previous => ({ ...previous, loading: true, error: null }))
    call(controller.signal).then(
      data => { if (!controller.signal.aborted) setState({ data, loading: false }) },
      error => { if (!controller.signal.aborted) setState(previous => ({ ...previous, error, loading: false })) },
    )
    return () => controller.abort()
  }, [...dependencies, revision])
  return { ...state, reload: () => setRevision(value => value + 1) }
}

export function useAction() {
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [uncertain, setUncertain] = useState(false)
  async function run(action, verify) {
    if (locked.current) return false
    locked.current = true
    setBusy(true)
    setError(null)
    try {
      if (uncertain && verify) {
        const found = await verify()
        setUncertain(false)
        if (!found) setError(new Error('已刷新记录。请确认后再次提交。'))
        return found
      }
      await action()
      setUncertain(false)
      return true
    } catch (failure) {
      setError(failure)
      setUncertain(uncertain || [0, 503, 504].includes(failure.status))
      return false
    } finally {
      locked.current = false
      setBusy(false)
    }
  }
  return { busy, error, uncertain, run, clearError: () => setError(null) }
}

export function ErrorNote({ error, retry }) {
  if (!error) return null
  return React.createElement('div', { role: 'alert', className: 'wb-error' }, error.message,
    retry && React.createElement('button', { type: 'button', onClick: retry }, '刷新'))
}

export function useWorkspaceApi({ workspace, onUnauthorized }) {
  return async (operation, args, options = {}) => {
    try {
      return await invoke(operation, args, { ...options, workspaceId: workspace.id })
    } catch (error) {
      if (error.status === 401) onUnauthorized(error)
      throw error
    }
  }
}
