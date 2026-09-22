import { useEffect, useState } from 'react'
import type { LeaveRequest, PayrollRecord, ExpenseClaim, AttendanceRecord, Employee } from '../../types'
import { ChevronDown, FileSpreadsheet, Paperclip } from 'lucide-react'
import { downloadExcel } from '../../lib/excel'
import { computeLeaveBalance, LEAVE_POLICY } from '../../lib/leaveBalance'

const navy = '#1C2B4A'
const gold = '#C9A96E'

const LEAVE_TYPES = ['Sick', 'Casual', 'Earned', 'Unpaid'] as const
type Tab = 'team-leave' | 'my-leave' | 'team-attendance' | 'team-expenses' | 'payroll'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-600',
    Pending: 'bg-amber-50 text-amber-700',
    Approved: 'bg-emerald-50 text-emerald-700',
    Rejected: 'bg-red-50 text-red-600',
    Reimbursed: 'bg-blue-50 text-blue-700',
    present: 'bg-emerald-50 text-emerald-700',
    absent: 'bg-red-50 text-red-600',
    late: 'bg-amber-50 text-amber-700',
    'half-day': 'bg-purple-50 text-purple-700',
    'pending-manager': 'bg-amber-50 text-amber-700',
    'pending-hr': 'bg-blue-50 text-blue-700',
    'pending-management': 'bg-purple-50 text-purple-700',
    disbursed: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

interface Props {
  leaves: LeaveRequest[]
  onLeaveUpdate: (l: LeaveRequest[]) => void
  expenses: ExpenseClaim[]
  onExpensesUpdate: (e: ExpenseClaim[]) => void
  employeeId: string
  employees: Employee[]
  attendance: AttendanceRecord[]
  payroll: PayrollRecord[]
  onPayrollUpdate: (next: PayrollRecord[]) => void
}

export default function ManagerPortal({ leaves, onLeaveUpdate, expenses, onExpensesUpdate, employeeId, employees, attendance: attendanceRecords, payroll: payrollProp, onPayrollUpdate }: Props) {
  const [tab, setTab] = useState<Tab>('team-leave')

  // People who report directly to whoever is signed in.
  const teamIds = employees.filter(e => e.managerId === employeeId).map(e => e.id)

  // Team leave
  const pendingTeamLeaves = leaves.filter(l => l.pendingWith === 'manager' && l.submittedByRole === 'crm')
  const historyTeamLeaves = leaves.filter(l => l.pendingWith === 'done' && l.submittedByRole === 'crm')

  function handleTeamLeave(id: string, action: 'approved' | 'rejected') {
    onLeaveUpdate(leaves.map(l =>
      l.id === id ? { ...l, status: action, pendingWith: 'done' } : l
    ))
  }

  // My leave
  const myLeaves = leaves.filter(l => l.employeeId === employeeId)
  const me = employees.find(e => e.id === employeeId)
  const meName = me?.name || 'Unknown'
  const meDepartment = me?.department || ''
  const myBalance = me ? computeLeaveBalance(me, leaves) : null
  const [leaveFlash, setLeaveFlash] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ type: 'Sick' as typeof LEAVE_TYPES[number], startDate: '', endDate: '', reason: '' })

  function submitMyLeave() {
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) return
    const start = new Date(leaveForm.startDate)
    const end = new Date(leaveForm.endDate)
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
    const newLeave: LeaveRequest = {
      id: `lv-${Date.now()}`,
      employeeId,
      employeeName: meName,
      department: meDepartment,
      type: leaveForm.type,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      days,
      reason: leaveForm.reason,
      status: 'pending',
      appliedOn: new Date().toISOString().slice(0, 10),
      submittedByRole: 'manager',
      pendingWith: 'hr',
    }
    onLeaveUpdate([...leaves, newLeave])
    setLeaveForm({ type: 'Sick', startDate: '', endDate: '', reason: '' })
    setLeaveFlash(true)
    setTimeout(() => setLeaveFlash(false), 4000)
  }

  // Attendance
  const [attendanceDateFilter, setAttendanceDateFilter] = useState<string>('all')
  const teamAttendance = attendanceRecords.filter(r => teamIds.includes(r.employeeId))
  const uniqueDates = [...new Set(teamAttendance.map(r => r.date))].sort().reverse()
  const filteredAttendance = attendanceDateFilter === 'all' ? teamAttendance : teamAttendance.filter(r => r.date === attendanceDateFilter)

  const kpiCounts = {
    present: filteredAttendance.filter(r => r.status === 'present').length,
    absent: filteredAttendance.filter(r => r.status === 'absent').length,
    late: filteredAttendance.filter(r => r.status === 'late').length,
    halfDay: filteredAttendance.filter(r => r.status === 'half-day').length,
  }

  // Team expenses — reads from the shared expenses store so claims an
  // employee just submitted show up here immediately, and any decision
  // made here is visible to HR too.
  const teamExpenses = expenses.filter(e => teamIds.includes(e.employeeId))
  const [expenseFilter, setExpenseFilter] = useState('all')
  const [expenseNotes, setExpenseNotes] = useState<Record<string, string>>({})
  const [collapsedExpenseEmp, setCollapsedExpenseEmp] = useState<Set<string>>(new Set())

  function handleExpense(id: string, action: 'Approved' | 'Rejected') {
    onExpensesUpdate(expenses.map(e =>
      e.id === id ? { ...e, status: action, approvedBy: action === 'Approved' ? meName : undefined, note: action === 'Rejected' ? (expenseNotes[id] || '') : e.note } : e
    ))
  }

  function toggleExpenseEmp(employeeId: string) {
    setCollapsedExpenseEmp(prev => {
      const next = new Set(prev)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }

  const filteredExpenses = expenseFilter === 'all' ? teamExpenses : teamExpenses.filter(e => e.status === expenseFilter)

  // Group filtered team expenses by employee — every category one person has
  // claimed under sits together, instead of one flat list mixing everyone.
  const groupedTeamExpenses = Array.from(
    filteredExpenses.reduce((map, e) => {
      const group = map.get(e.employeeId) || { employeeId: e.employeeId, employeeName: e.employeeName, department: e.department, claims: [] as ExpenseClaim[] }
      group.claims.push(e)
      map.set(e.employeeId, group)
      return map
    }, new Map<string, { employeeId: string; employeeName: string; department: string; claims: ExpenseClaim[] }>()).values()
  ).sort((a, b) => a.employeeName.localeCompare(b.employeeName))

  function exportTeamExpenses() {
    const rows = groupedTeamExpenses.flatMap(group => group.claims.map(e => [
      e.employeeName, e.department, e.category, e.description, e.date, e.amount,
      e.receipt ? (e.receiptFileName || 'Attached') : 'No', e.status,
    ]))
    downloadExcel(
      `team-expense-claims-${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Team Expenses',
      ['Employee', 'Department', 'Category', 'Description', 'Date', 'Amount', 'Receipt', 'Status'],
      rows
    )
  }

  // Payroll
  const [payroll, setPayrollLocal] = useState<PayrollRecord[]>(payrollProp)
  useEffect(() => { setPayrollLocal(payrollProp) }, [payrollProp])
  const setPayroll = (updater: PayrollRecord[] | ((prev: PayrollRecord[]) => PayrollRecord[])) => {
    setPayrollLocal(prev => {
      const next = typeof updater === 'function' ? (updater as (prev: PayrollRecord[]) => PayrollRecord[])(prev) : updater
      onPayrollUpdate(next)
      return next
    })
  }
  const pendingPayroll = payroll.filter(r => r.status === 'pending-manager')

  function approvePayroll(id: string) {
    setPayroll(prev => prev.map(r => r.id === id ? { ...r, status: 'pending-hr' as const, managerApproved: true } : r))
  }

  function approveAllPayroll() {
    setPayroll(prev => prev.map(r => r.status === 'pending-manager' ? { ...r, status: 'pending-hr' as const, managerApproved: true } : r))
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'team-leave', label: 'Team Leave Requests' },
    { key: 'my-leave', label: 'My Leave' },
    { key: 'team-attendance', label: 'Team Attendance' },
    { key: 'team-expenses', label: 'Team Expenses' },
    { key: 'payroll', label: 'Payroll' },
  ]

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF8F5', minHeight: '100vh' }}>
      <div>
        <h1 className="text-2xl font-serif font-bold" style={{ color: navy }}>Manager Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">{meName}{me?.team ? ` · ${me.team}` : ''}{meDepartment ? ` · ${meDepartment}` : ''}</p>
      </div>

      <div className="flex gap-1 flex-wrap bg-white border border-border rounded-xl p-1 w-fit shadow-sm">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t.key ? { background: navy, color: '#fff' } : { color: navy }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TEAM LEAVE REQUESTS */}
      {tab === 'team-leave' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h2 className="font-semibold text-base mb-4" style={{ color: navy }}>Pending Approvals</h2>
            {pendingTeamLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending leave requests.</p>
            ) : (
              <div className="space-y-3">
                {pendingTeamLeaves.map(l => (
                  <div key={l.id} className="border border-border rounded-xl p-4 hover:bg-muted/20">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-sm" style={{ color: navy }}>{l.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{l.department} · Applied {l.appliedOn}</p>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <div><span className="font-medium text-foreground">{l.type}</span><br />Type</div>
                      <div><span className="font-medium text-foreground">{l.startDate}</span><br />From</div>
                      <div><span className="font-medium text-foreground">{l.endDate}</span><br />To</div>
                      <div><span className="font-medium text-foreground">{l.days} days</span><br />Duration</div>
                    </div>
                    <p className="text-sm mt-2 text-muted-foreground italic">"{l.reason}"</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleTeamLeave(l.id, 'approved')}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
                        style={{ background: navy }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleTeamLeave(l.id, 'rejected')}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {historyTeamLeaves.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h2 className="font-semibold text-base mb-4" style={{ color: navy }}>History</h2>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Employee</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Dates</th>
                    <th className="pb-2 font-medium">Days</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyTeamLeaves.map(l => (
                    <tr key={l.id} className="border-b border-border hover:bg-muted/20">
                      <td className="py-2.5">{l.employeeName}</td>
                      <td className="py-2.5">{l.type}</td>
                      <td className="py-2.5">{l.startDate} — {l.endDate}</td>
                      <td className="py-2.5">{l.days}</td>
                      <td className="py-2.5"><StatusBadge status={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MY LEAVE */}
      {tab === 'my-leave' && (
        <div className="space-y-4">
          {leaveFlash && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-medium">
              Submitted — pending HR approval.
            </div>
          )}
          {myBalance && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h2 className="font-semibold text-base mb-1" style={{ color: navy }}>My Leave Balance</h2>
              <p className="text-xs text-muted-foreground mb-4">Days remaining by type, out of your annual allocation.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([['Sick', myBalance.Sick, LEAVE_POLICY.Sick], ['Casual', myBalance.Casual, LEAVE_POLICY.Casual], ['Earned', myBalance.Earned, LEAVE_POLICY.Earned]] as const).map(([label, val, total]) => (
                  <div key={label} className="rounded-lg p-3.5" style={{ backgroundColor: '#F5F2EC' }}>
                    <p className="text-xs text-muted-foreground mb-1">{label} Leave</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-serif text-2xl font-semibold" style={{ color: navy }}>{val}</span>
                      <span className="text-xs text-muted-foreground">/ {total} days</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white overflow-hidden mt-2">
                      <div className="h-full rounded-full" style={{ width: `${(val / total) * 100}%`, backgroundColor: val > total * 0.5 ? '#10B981' : val > 0 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-base" style={{ color: navy }}>Apply for Leave</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Leave Type</label>
                <select
                  value={leaveForm.type}
                  onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value as typeof LEAVE_TYPES[number] }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                >
                  {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
                <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Reason</label>
                <input type="text" placeholder="Reason for leave" value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
              </div>
            </div>
            <button onClick={submitMyLeave} className="px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: navy }}>
              Submit Leave Request
            </button>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h2 className="font-semibold text-base mb-4" style={{ color: navy }}>My Leave History</h2>
            {myLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave requests.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">From</th>
                    <th className="pb-2 font-medium">To</th>
                    <th className="pb-2 font-medium">Days</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myLeaves.map(l => (
                    <tr key={l.id} className="border-b border-border hover:bg-muted/20">
                      <td className="py-2.5">{l.type}</td>
                      <td className="py-2.5">{l.startDate}</td>
                      <td className="py-2.5">{l.endDate}</td>
                      <td className="py-2.5">{l.days}</td>
                      <td className="py-2.5"><StatusBadge status={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TEAM ATTENDANCE */}
      {tab === 'team-attendance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Present', count: kpiCounts.present, color: '#059669', bg: '#ECFDF5' },
              { label: 'Absent', count: kpiCounts.absent, color: '#DC2626', bg: '#FEF2F2' },
              { label: 'Late', count: kpiCounts.late, color: '#D97706', bg: '#FFFBEB' },
              { label: 'Half Day', count: kpiCounts.halfDay, color: '#7C3AED', bg: '#F5F3FF' },
            ].map(k => (
              <div key={k.label} className="rounded-xl p-4 border border-border shadow-sm" style={{ background: k.bg }}>
                <p className="text-2xl font-bold" style={{ color: k.color }}>{k.count}</p>
                <p className="text-xs font-medium mt-1" style={{ color: k.color }}>{k.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base" style={{ color: navy }}>Team Alpha Attendance</h2>
              <select
                value={attendanceDateFilter}
                onChange={e => setAttendanceDateFilter(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
              >
                <option value="all">All Dates</option>
                {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium">Employee</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Check In</th>
                  <th className="pb-2 font-medium">Check Out</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.map(r => (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/20">
                    <td className="py-2.5">{r.employeeName}</td>
                    <td className="py-2.5">{r.date}</td>
                    <td className="py-2.5">{r.checkIn || '—'}</td>
                    <td className="py-2.5">{r.checkOut || '—'}</td>
                    <td className="py-2.5"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* TEAM EXPENSES */}
      {tab === 'team-expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium" style={{ color: navy }}>Filter:</span>
              {['all', 'Pending', 'Approved', 'Rejected', 'Reimbursed'].map(f => (
                <button
                  key={f}
                  onClick={() => setExpenseFilter(f)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border transition-all"
                  style={expenseFilter === f ? { background: navy, color: '#fff', borderColor: navy } : { color: navy }}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
            <button onClick={exportTeamExpenses} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-white hover:bg-muted transition-all" style={{ color: navy }}>
              <FileSpreadsheet size={14} />
              Export to Excel
            </button>
          </div>

          {/* Claims grouped by employee — every category one person has used sits together */}
          <div className="space-y-4">
            {groupedTeamExpenses.length === 0 && (
              <div className="bg-card rounded-xl border border-border shadow-sm p-8 text-center">
                <p className="text-sm text-muted-foreground">No expense claims match this filter.</p>
              </div>
            )}
            {groupedTeamExpenses.map(group => {
              const isCollapsed = collapsedExpenseEmp.has(group.employeeId)
              const groupTotal = group.claims.reduce((s, e) => s + e.amount, 0)
              const groupCategories = Array.from(new Set(group.claims.map(e => e.category)))
              return (
                <div key={group.employeeId} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <button onClick={() => toggleExpenseEmp(group.employeeId)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: `${navy}14`, color: navy }}>
                      {group.employeeName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{group.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{group.department}</p>
                    </div>
                    <div className="hidden sm:flex flex-wrap gap-1 max-w-[280px] justify-end">
                      {groupCategories.map(cat => (
                        <span key={cat} className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: '#F0EDE7', color: '#7A7065' }}>
                          {cat}
                        </span>
                      ))}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">₹{groupTotal.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-muted-foreground">{group.claims.length} claim{group.claims.length !== 1 ? 's' : ''}</p>
                    </div>
                    <ChevronDown size={16} className={`text-muted-foreground shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </button>

                  {!isCollapsed && (
                    <div className="border-t border-border overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground border-b border-border">
                            <th className="px-5 py-2.5 font-medium">Category</th>
                            <th className="px-5 py-2.5 font-medium">Description</th>
                            <th className="px-5 py-2.5 font-medium">Date</th>
                            <th className="px-5 py-2.5 font-medium">Amount</th>
                            <th className="px-5 py-2.5 font-medium">Receipt</th>
                            <th className="px-5 py-2.5 font-medium">Status</th>
                            <th className="px-5 py-2.5 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.claims.map((e, i) => (
                            <tr key={e.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                              <td className="px-5 py-3 whitespace-nowrap">{e.category}</td>
                              <td className="px-5 py-3 max-w-[180px] truncate">{e.description}</td>
                              <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{e.date}</td>
                              <td className="px-5 py-3 font-medium">₹{e.amount.toLocaleString('en-IN')}</td>
                              <td className="px-5 py-3">
                                {e.receipt ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700" title={e.receiptFileName}>
                                    <Paperclip size={11} />
                                    <span className="max-w-[110px] truncate">{e.receiptFileName || 'Attached'}</span>
                                  </span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="px-5 py-3"><StatusBadge status={e.status} /></td>
                              <td className="px-5 py-3">
                                {e.status === 'Pending' ? (
                                  <div className="flex gap-1.5 items-center">
                                    <input
                                      type="text"
                                      placeholder="Note (optional)"
                                      value={expenseNotes[e.id] || ''}
                                      onChange={ev => setExpenseNotes(prev => ({ ...prev, [e.id]: ev.target.value }))}
                                      className="border border-border rounded px-2 py-1 text-xs bg-white focus:outline-none w-24"
                                    />
                                    <button onClick={() => handleExpense(e.id, 'Approved')} className="px-2.5 py-1 rounded text-xs font-medium text-white" style={{ background: navy }}>Approve</button>
                                    <button onClick={() => handleExpense(e.id, 'Rejected')} className="px-2.5 py-1 rounded text-xs font-medium bg-red-50 text-red-600">Reject</button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{e.approvedBy || e.note || '—'}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* PAYROLL */}
      {tab === 'payroll' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base" style={{ color: navy }}>
                Pending Payroll Approvals
                {pendingPayroll.length > 0 && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pendingPayroll.length}</span>}
              </h2>
              {pendingPayroll.length > 0 && (
                <button onClick={approveAllPayroll} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: gold, color: navy }}>
                  Approve All
                </button>
              )}
            </div>
            {pendingPayroll.length === 0 ? (
              <p className="text-sm text-muted-foreground">All payroll approved.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Employee</th>
                    <th className="pb-2 font-medium">Month</th>
                    <th className="pb-2 font-medium">Base</th>
                    <th className="pb-2 font-medium">Incentives</th>
                    <th className="pb-2 font-medium">Deductions</th>
                    <th className="pb-2 font-medium">Net Pay</th>
                    <th className="pb-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPayroll.map(r => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/20">
                      <td className="py-2.5 font-medium">{r.employeeName}</td>
                      <td className="py-2.5 text-muted-foreground">{r.month}</td>
                      <td className="py-2.5">₹{r.baseSalary.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-emerald-700">+₹{r.incentives.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-red-600">-₹{r.deductions.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 font-bold" style={{ color: navy }}>₹{r.netPay.toLocaleString('en-IN')}</td>
                      <td className="py-2.5">
                        <button onClick={() => approvePayroll(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: navy }}>
                          Approve
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {payroll.filter(r => r.status !== 'pending-manager').length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h2 className="font-semibold text-base mb-4" style={{ color: navy }}>All Payroll Records</h2>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Employee</th>
                    <th className="pb-2 font-medium">Net Pay</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.filter(r => r.status !== 'pending-manager').map(r => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/20">
                      <td className="py-2.5">{r.employeeName}</td>
                      <td className="py-2.5 font-medium">₹{r.netPay.toLocaleString('en-IN')}</td>
                      <td className="py-2.5"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
