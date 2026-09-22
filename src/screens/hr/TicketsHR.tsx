import { useEffect, useState } from 'react'
import type { EmployeeTicket, TicketStatus, Employee } from '../../types'
import { MessageSquare, Filter, Search, Clock, AlertCircle, CheckCircle, XCircle, ChevronRight, Send, User } from 'lucide-react'

const navy = '#1C2B4A'
const gold = '#C9A96E'

const statusColor: Record<TicketStatus, { bg: string; text: string }> = {
  'Open': { bg: '#FEF2F2', text: '#DC2626' },
  'In Progress': { bg: '#FFF7ED', text: '#EA580C' },
  'Pending Info': { bg: '#FFFBEB', text: '#D97706' },
  'Resolved': { bg: '#ECFDF5', text: '#059669' },
  'Closed': { bg: '#F3F4F6', text: '#6B7280' },
}

const priorityDot: Record<string, string> = {
  Urgent: '#DC2626', High: '#F59E0B', Medium: '#3B82F6', Low: '#9CA3AF',
}

const NEXT_STATUS: Partial<Record<TicketStatus, TicketStatus>> = {
  'Open': 'In Progress',
  'In Progress': 'Resolved',
  'Pending Info': 'In Progress',
  'Resolved': 'Closed',
}

interface TicketsHRProps {
  tickets: EmployeeTicket[]
  onTicketsUpdate: (next: EmployeeTicket[]) => void
  currentEmployee?: Employee
}

export default function TicketsHR({ tickets: ticketsProp, onTicketsUpdate, currentEmployee }: TicketsHRProps) {
  const hrName = currentEmployee?.name || 'HR'
  const [tickets, setTicketsLocal] = useState<EmployeeTicket[]>(ticketsProp)
  useEffect(() => { setTicketsLocal(ticketsProp) }, [ticketsProp])
  const setTickets = (updater: EmployeeTicket[] | ((prev: EmployeeTicket[]) => EmployeeTicket[])) => {
    setTicketsLocal(prev => {
      const next = typeof updater === 'function' ? (updater as (prev: EmployeeTicket[]) => EmployeeTicket[])(prev) : updater
      onTicketsUpdate(next)
      return next
    })
  }
  const [selected, setSelected] = useState<EmployeeTicket | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [reply, setReply] = useState('')

  const filtered = tickets.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    const matchPriority = filterPriority === 'all' || t.priority === filterPriority
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.employeeName.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchPriority && matchSearch
  })

  const updateStatus = (id: string, status: TicketStatus) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null)
  }

  const sendComment = () => {
    if (!reply.trim() || !selected) return
    const comment = { by: hrName, role: 'hr' as const, text: reply.trim(), at: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
    const updated = tickets.map(t => t.id === selected.id ? { ...t, comments: [...t.comments, comment] } : t)
    setTickets(updated)
    const found = updated.find(t => t.id === selected.id)
    if (found) setSelected(found)
    setReply('')
  }

  const counts = {
    open: tickets.filter(t => t.status === 'Open').length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    resolved: tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length,
    urgent: tickets.filter(t => t.priority === 'Urgent' && t.status !== 'Resolved' && t.status !== 'Closed').length,
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Employee Tickets</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Respond to and resolve support requests from employees</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Open', value: counts.open, Icon: AlertCircle, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'In Progress', value: counts.inProgress, Icon: Clock, color: '#EA580C', bg: '#FFF7ED' },
          { label: 'Resolved / Closed', value: counts.resolved, Icon: CheckCircle, color: '#059669', bg: '#ECFDF5' },
          { label: 'Urgent', value: counts.urgent, Icon: XCircle, color: '#7C3AED', bg: '#F5F3FF' },
        ].map(k => (
          <div key={k.label} className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: k.bg }}>
              <k.Icon size={18} style={{ color: k.color }} />
            </div>
            <div>
              <p className="font-serif text-2xl font-semibold text-foreground">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Ticket list */}
        <div className="w-full lg:w-[380px] shrink-0 space-y-3">
          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-accent/40" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-2 py-2 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none">
              <option value="all">All Status</option>
              {['Open', 'In Progress', 'Pending Info', 'Resolved', 'Closed'].map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
              className="px-2 py-2 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none">
              <option value="all">All Priority</option>
              {['Urgent', 'High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground bg-card rounded-xl border border-border">No tickets match your filters</div>
            )}
            {filtered.map(t => {
              const sc = statusColor[t.status]
              const isActive = selected?.id === t.id
              return (
                <button key={t.id} onClick={() => setSelected(t)}
                  className="w-full text-left bg-card rounded-xl border p-4 transition-all hover:shadow-md"
                  style={{ borderColor: isActive ? gold : '#E5DFD5', boxShadow: isActive ? `0 0 0 2px rgba(201,169,110,0.3)` : undefined }}>
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: priorityDot[t.priority] }} />
                    <p className="text-sm font-semibold text-foreground leading-tight flex-1">{t.title}</p>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{t.status}</span>
                    <span className="text-xs text-muted-foreground">{t.type}</span>
                  </div>
                  <div className="flex items-center justify-between ml-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: navy }}>
                        {t.employeeName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-xs text-muted-foreground">{t.employeeName}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{t.raisedOn}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Ticket detail */}
        {selected ? (
          <div className="flex-1 bg-card rounded-xl border border-border shadow-sm flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            {/* Header */}
            <div className="p-5 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{selected.id}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${priorityDot[selected.priority]}18`, color: priorityDot[selected.priority] }}>
                      {selected.priority}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: statusColor[selected.status].bg, color: statusColor[selected.status].text }}>{selected.status}</span>
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-foreground">{selected.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{selected.type} · {selected.department} · Raised {selected.raisedOn}</p>
                </div>
                <div className="flex items-center gap-2">
                  {NEXT_STATUS[selected.status] && (
                    <button onClick={() => updateStatus(selected.id, NEXT_STATUS[selected.status]!)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                      style={{ backgroundColor: navy, color: '#FAF8F5' }}>
                      Move to: {NEXT_STATUS[selected.status]}
                    </button>
                  )}
                  {selected.status !== 'Closed' && (
                    <button onClick={() => updateStatus(selected.id, 'Closed')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:bg-muted transition-all">
                      Close
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Employee & description */}
            <div className="p-5 border-b border-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: navy }}>
                  {selected.employeeName.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selected.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{selected.department}</p>
                </div>
                {selected.assignedTo && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <User size={12} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Assigned to <strong className="text-foreground">{selected.assignedTo}</strong></span>
                  </div>
                )}
              </div>
              <div className="bg-muted rounded-lg px-4 py-3">
                <p className="text-sm text-foreground leading-relaxed">{selected.description}</p>
              </div>
              {selected.resolution && (
                <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Resolution</p>
                  <p className="text-sm text-emerald-800">{selected.resolution}</p>
                </div>
              )}
            </div>

            {/* Comments thread */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {selected.comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Add a reply below.</p>
              )}
              {selected.comments.map((c, i) => (
                <div key={i} className={`flex gap-3 ${c.role === 'hr' ? 'flex-row-reverse' : ''}`}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                    style={{ backgroundColor: c.role === 'hr' ? gold : '#F0EDE7', color: c.role === 'hr' ? navy : '#7A7065' }}>
                    {c.by.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className={`max-w-[75%] ${c.role === 'hr' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{c.by}</span>
                      <span className="text-[10px] text-muted-foreground">{c.at}</span>
                    </div>
                    <div className="px-3.5 py-2.5 rounded-xl text-sm"
                      style={{ backgroundColor: c.role === 'hr' ? `${navy}12` : '#F5F2EC', color: '#1C1A2E' }}>
                      {c.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply box */}
            {selected.status !== 'Closed' && (
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input value={reply} onChange={e => setReply(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendComment()}
                    placeholder="Type your reply… (Enter to send)"
                    className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-border bg-muted focus:outline-none focus:ring-1 focus:ring-accent/40" />
                  <button onClick={sendComment} disabled={!reply.trim()}
                    className="w-10 h-10 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                    style={{ backgroundColor: navy }}>
                    <Send size={15} color="#FAF8F5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 bg-card rounded-xl border border-border flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={36} className="mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">Select a ticket to view details and reply</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
