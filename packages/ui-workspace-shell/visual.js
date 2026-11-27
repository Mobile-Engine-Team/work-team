import React from 'react'
import { ArrowLeft, ArrowRight, Bot, ChevronDown, Columns3, Cpu, Crown, FileText, Inbox, LayoutList, ListTodo, Paperclip, Plus, RotateCw, Search, Users, X } from 'lucide-react'

const icons = {
  tasks: ListTodo, inbox: Inbox, squads: Bot, members: Users,
  add: Plus, list: LayoutList, board: Columns3, search: Search, refresh: RotateCw,
  back: ArrowLeft, forward: ArrowRight, chevron: ChevronDown, document: FileText,
  cpu: Cpu, crown: Crown, paperclip: Paperclip, close: X,
}

export function Icon({ name, size = 16 }) {
  const Component = icons[name]
  return Component ? React.createElement(Component, { size, 'aria-hidden': true, strokeWidth: 1.8 }) : null
}

export function Avatar({ name }) {
  return React.createElement('span', { className: 'wb-avatar', 'aria-hidden': true }, name?.slice(0, 1) || '–')
}

export function Dialog({ title, children }) {
  return React.createElement('div', { className: 'wb-overlay' },
    React.createElement('section', { className: 'wb-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': title }, children))
}
