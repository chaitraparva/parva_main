import { useState } from 'react'
import type { LeaveRequest, Role, Employee } from '../../types'
import { Check, X, Calendar, Plus, Info, ChevronDown } from 'lucide-react'
import { computeAllLeaveBalances, computeLeaveBalance, LEAVE_POLICY, NATIONAL_HOLIDAYS_PER_ANNUM } from '../../lib/leaveBalance'

const navy = '#1C2B4A'
const gold = '#C9A96E'

type Tab = 'requests' | 'balances' | 'policy'

const POLICY = [
  { type: 'Sick Leave', annual: LEAVE_POLICY.Sick, carry: 3, note: 'Medical certificate required for 3+ consecutive days.' },
  { type: 'Casual Leave', annual: LEAVE_POLICY.Casual, carry: 0, note: 'Cannot be combined with Earned Leave. 1-day advance notice needed.' },
  { type: 'Earned Leave', annual: LEAVE_POLICY.Earned, carry: 15, note: 'Credited at 1 day per month. Minimum 4 days per application. Requires 7-day advance notice.' },
  { type: 'Unpaid Leave', annual: 0, carry: 0, note: 'Granted at manager and HR discretion. No carry forward.' },
  { type: 'National Holidays', annual: NATIONAL_HOLIDAYS_PER_ANNUM, carry: 0, note: 'Company-wide paid holidays, the same for every employee — not applied for individually.' },
]

const statusStyle: Record<string, { bg: string; text: string }> = {
  pending:  { bg: '#FFFBEB', text: '#D97706' },
  approved: { bg: '#ECFDF5', text: '#059669' },
  rejected: { bg: '#FEF2F2', text: '#DC2626' },
}

const LEAVE_TYPES = ['Sick', 'Casual', 'Earned', 'Unpaid'] as const

interface LeaveProps {
  role: Role
  leaves: LeaveRequest[]
  onLeaveUpdate: (leaves: LeaveRequest[]) => void
  employees: Employee[]
}

export default function Leave({ role, leaves, onLeaveUpdate, employees }: LeaveProps) {
  const [tab, setTab] = useState<Tab>('requests')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState({ employeeName: '', type: 'Sick' as typeof LEAVE_TYPES[number], startDate: '', endDate: '', reason: '' })

  const handle = (id: string, action: 'approved' | 'rejected') => {
    onLeaveUpdate(leaves.map(l => l.id === id ? { ...l, status: action, pendingWith: 'done' } : l))
    setExpandedId(null)
  }

  const applyLeave = () => {
    if (!form.employeeName || !form.startDate || !form.endDate || !form.reason) return
    const start = new Date(form.startDate)
    const end = new Date(form.endDate)
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
    const emp = employees.find(e => e.name === form.employeeName)
    const newLeave: LeaveRequest = {
      id: `lr-${Date.now()}`,
      employeeId: emp?.id || 'emp-x',
      employeeName: form.employeeName,
      department: emp?.department || 'Human Resources',
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      days,
      reason: form.reason,
      status: 'pending',
      appliedOn: new Date().toISOString().split('T')[0],
      submittedByRole: 'hr',
      pendingWith: 'management',
    }
    onLeaveUpdate([newLeave, ...leaves])
    setShowApplyForm(false)
    setForm({ employeeName: '', type: 'Sick', startDate: '', endDate: '', reason: '' })
    setTab('requests')
    setFilterStatus('pending')
  }

  // HR sees leaves submitted by managers; management sees leaves submitted by HR
  const visibleLeaves = role === 'management'
    ? leaves.filter(l => l.submittedByRole === 'hr' || l.pendingWith === 'management')
    : leaves.filter(l => l.submittedByRole === 'manager' || l.pendingWith === 'hr' || l.submittedByRole === 'crm')

  const filtered = visibleLeaves.filter(l => filterStatus === 'all' || l.status === filterStatus)

  const counts = {
    total: visibleLeaves.length,
    pending: visibleLeaves.filter(l => l.status === 'pending').length,
    approved: visibleLeaves.filter(l => l.status === 'approved').length,
    rejected: visibleLeaves.filter(l => l.status === 'rejected').length,
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Leave Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Approve requests, track balances, and apply leave on behalf of employees</p>
        </div>
        <button onClick={() => setShowApplyForm(!showApplyForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: navy, color: '#FAF8F5' }}>
          <Plus size={15} /> Apply Leave (HR)
        </button>
      </div>

      {/* Apply form */}
      {showApplyForm && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">Apply Leave on Behalf of Employee</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Employee *</label>
              <select value={form.employeeName} onChange={e => setForm(p => ({ ...p, employeeName: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none focus:ring-1 focus:ring-accent/40">
                <option value="">Select employee…</option>
                {employees.map(e => <option key={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Leave Type *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as typeof LEAVE_TYPES[number] }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none">
                {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="hidden sm:block" />
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">End Date *</label>
              <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            {form.startDate && form.endDate && (
              <div className="flex items-end pb-2">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">
                    {Math.max(1, Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) + 1)} day(s)
                  </strong>
                </p>
              </div>
            )}
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Reason *</label>
              <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Reason for leave…"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={applyLeave}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: gold, color: navy }}>
              Submit Leave Request
            </button>
            <button onClick={() => setShowApplyForm(false)}
              className="px-5 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: counts.total, color: navy },
          { label: 'Pending Approval', value: counts.pending, color: '#D97706' },
          { label: 'Approved', value: counts.approved, color: '#059669' },
          { label: 'Rejected', value: counts.rejected, color: '#DC2626' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{s.label}</p>
            <p className="font-serif text-4xl font-semibold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="border-b border-border px-5 flex flex-wrap gap-x-6 gap-y-1 overflow-x-auto">
          {([['requests', 'Leave Requests'], ['balances', 'Leave Balances'], ['policy', 'Leave Policy']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className="py-4 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap"
              style={{ borderColor: tab === t ? gold : 'transparent', color: tab === t ? navy : '#7A7065' }}>
              {label}
            </button>
          ))}

          {tab === 'requests' && (
            <div className="sm:ml-auto flex items-center gap-2 py-3 flex-wrap">
              {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className="px-3 py-1 rounded-full text-xs font-medium capitalize transition-all"
                  style={{ backgroundColor: filterStatus === s ? navy : '#F0EDE7', color: filterStatus === s ? '#FAF8F5' : '#7A7065' }}>
                  {s === 'all' ? 'All' : s}
                  {s !== 'all' && <span className="ml-1 opacity-70">({counts[s]})</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Requests tab */}
        {tab === 'requests' && (
          <div>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">No {filterStatus === 'all' ? '' : filterStatus} leave requests.</div>
            )}
            {filtered.map(req => {
              const ss = statusStyle[req.status]
              const isExpanded = expandedId === req.id
              return (
                <div key={req.id} className="border-b border-border last:border-0">
                  <button className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: `${navy}14`, color: navy }}>
                      {req.employeeName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{req.employeeName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{req.type} Leave</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <Calendar size={11} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{req.startDate} → {req.endDate}</span>
                        <span className="text-xs font-semibold text-foreground">({req.days}d)</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium capitalize shrink-0"
                      style={{ backgroundColor: ss.bg, color: ss.text }}>{req.status}</span>
                    {req.status === 'pending' && (
                      <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handle(req.id, 'approved')}
                          className="p-1.5 rounded-lg transition-colors hover:bg-emerald-100"
                          style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                          <Check size={14} />
                        </button>
                        <button onClick={() => handle(req.id, 'rejected')}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-100"
                          style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    <ChevronDown size={14} className="text-muted-foreground shrink-0 transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : '' }} />
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 ml-13 bg-muted/20 border-t border-border">
                      <div className="pt-3 flex gap-8">
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Applied On</p>
                          <p className="text-sm font-medium text-foreground">{req.appliedOn}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Reason</p>
                          <p className="text-sm text-foreground">{req.reason}</p>
                        </div>
                        {/* Current balance for this leave type */}
                        {(() => {
                          const emp = employees.find(e => e.id === req.employeeId)
                          if (!emp || req.type === 'Unpaid') return null
                          const bal = computeLeaveBalance(emp, leaves)
                          return (
                            <div className="ml-auto">
                              <p className="text-xs text-muted-foreground mb-1">Leave Balance ({req.type})</p>
                              <div className="flex items-center gap-1">
                                <span className="font-serif text-xl font-semibold text-foreground">
                                  {bal[req.type as 'Sick' | 'Casual' | 'Earned']}
                                </span>
                                <span className="text-xs text-muted-foreground">days remaining</span>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                      {req.status === 'pending' && (
                        <div className="flex gap-3 mt-3">
                          <button onClick={() => handle(req.id, 'approved')}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                            style={{ backgroundColor: '#059669', color: '#fff' }}>
                            Approve Leave
                          </button>
                          <button onClick={() => handle(req.id, 'rejected')}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                            style={{ backgroundColor: '#DC2626', color: '#fff' }}>
                            Reject Leave
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Balances tab */}
        {tab === 'balances' && (
          <div className="p-5">
            <p className="text-xs text-muted-foreground mb-4">Remaining balance for every employee, computed from their approved leave history. Annual allocation: Sick {LEAVE_POLICY.Sick} · Casual {LEAVE_POLICY.Casual} · Earned {LEAVE_POLICY.Earned}.</p>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border">
                  {['Employee', 'Department', `Sick (${LEAVE_POLICY.Sick})`, `Casual (${LEAVE_POLICY.Casual})`, `Earned (${LEAVE_POLICY.Earned})`, 'Total Available', 'Days Taken'].map(h => (
                    <th key={h} className="pb-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {computeAllLeaveBalances(employees, leaves).map(bal => (
                    <tr key={bal.employeeId} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="py-4 pr-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: `${navy}14`, color: navy }}>
                            {bal.employeeName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-sm font-semibold text-foreground">{bal.employeeName}</span>
                        </div>
                      </td>
                      <td className="py-4 pr-6 text-xs text-muted-foreground">{bal.department}</td>
                      {[{ val: bal.Sick, total: LEAVE_POLICY.Sick }, { val: bal.Casual, total: LEAVE_POLICY.Casual }, { val: bal.Earned, total: LEAVE_POLICY.Earned }].map((item, i) => (
                        <td key={i} className="py-4 pr-6">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(item.val / item.total) * 100}%`, backgroundColor: item.val > item.total * 0.5 ? '#10B981' : item.val > 0 ? '#F59E0B' : '#EF4444' }} />
                            </div>
                            <span className="text-sm font-semibold text-foreground">{item.val}</span>
                          </div>
                        </td>
                      ))}
                      <td className="py-4 pr-6 font-serif text-lg font-semibold text-foreground">{bal.totalAvailable}</td>
                      <td className="py-4">
                        <span className="text-sm font-medium" style={{ color: bal.totalTaken > 0 ? '#D97706' : '#9CA3AF' }}>{bal.totalTaken}</span>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Policy tab */}
        {tab === 'policy' && (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">Policy effective from January 2024. Annual leave quotas reset on Jan 1 each year. Carry-forward credits expire by March 31.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {POLICY.map(p => (
                <div key={p.type} className="bg-muted/30 rounded-xl border border-border p-5">
                  <h4 className="font-serif text-base font-semibold text-foreground mb-3">{p.type}</h4>
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Annual Quota</span>
                      <span className="text-sm font-bold text-foreground">{p.annual > 0 ? `${p.annual} days` : 'As approved'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Carry Forward</span>
                      <span className="text-sm font-semibold text-foreground">{p.carry > 0 ? `Up to ${p.carry} days` : 'Not allowed'}</span>
                    </div>
                  </div>
                  <div className="bg-card rounded-lg px-3 py-2 border border-border">
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
