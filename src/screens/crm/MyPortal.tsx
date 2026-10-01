import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { LeaveRequest, ExpenseClaim, EmployeeTicket, ExpenseCategory, TicketType, TicketPriority, AttendanceRecord, Employee } from '../../types'
import { Upload, X, FileSpreadsheet, Plus, Trash2, Eye } from 'lucide-react'
import { downloadExcel } from '../../lib/excel'
import * as api from '../../lib/api'
import { computeLeaveBalance, LEAVE_POLICY } from '../../lib/leaveBalance'
import DocumentsPanel from '../../components/DocumentsPanel'

const navy = '#1C2B4A'
const gold = '#C9A96E'

const LEAVE_TYPES = ['Sick', 'Casual', 'Earned', 'Unpaid'] as const
const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Travel', 'Meals', 'Training', 'Equipment', 'Accommodation', 'Client Entertainment', 'Office Supplies', 'Other']
const TICKET_TYPES: TicketType[] = ['IT Support', 'Finance Query', 'HR Request', 'Access Request', 'Document Request', 'Grievance', 'Other']
const TICKET_PRIORITIES: TicketPriority[] = ['Low', 'Medium', 'High', 'Urgent']

type Tab = 'leave' | 'attendance' | 'expenses' | 'tickets' | 'documents'

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
    Open: 'bg-blue-50 text-blue-700',
    'In Progress': 'bg-amber-50 text-amber-700',
    'Pending Info': 'bg-orange-50 text-orange-700',
    Resolved: 'bg-emerald-50 text-emerald-700',
    Closed: 'bg-gray-100 text-gray-600',
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
  onExpensesRefetch: () => Promise<void>
  employeeId: string
  employees: Employee[]
  attendance: AttendanceRecord[]
  onAttendanceUpdate: (next: AttendanceRecord[]) => Promise<void>
  tickets: EmployeeTicket[]
  onTicketsUpdate: (next: EmployeeTicket[]) => void
  onAddTicketComment: (ticketId: string, text: string) => Promise<void>
}

interface DraftRow {
  id: string
  date: string
  category: ExpenseCategory
  description: string
  amount: string
  file: File | null
  previewUrl: string | null
}

function blankRow(): DraftRow {
  return { id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date: '', category: 'Travel', description: '', amount: '', file: null, previewUrl: null }
}

export default function MyPortal({ leaves, onLeaveUpdate, expenses, onExpensesUpdate: _onExpensesUpdate, onExpensesRefetch, employeeId, employees, attendance: attendanceRecords, onAttendanceUpdate, tickets, onTicketsUpdate, onAddTicketComment }: Props) {
  const [tab, setTab] = useState<Tab>('leave')
  const [leaveFlash, setLeaveFlash] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ type: 'Sick' as typeof LEAVE_TYPES[number], startDate: '', endDate: '', reason: '' })

  const myLeaves = leaves.filter(l => l.employeeId === employeeId)
  const myAttendance = attendanceRecords.filter(r => r.employeeId === employeeId)
  const me = employees.find(e => e.id === employeeId)
  const meName = me?.name || 'Unknown'
  const meDepartment = me?.department || ''
  const myBalance = me ? computeLeaveBalance(me, leaves) : null

  // Self-service attendance — until biometric attendance is wired up,
  // everyone marks their own day manually. Same create-or-update-today's-row
  // pattern as AttendanceHR.tsx's markAttendance(), scoped to just this
  // employee and today.
  const todayIso = new Date().toISOString().slice(0, 10)
  const myTodayAttendance = myAttendance.find(r => r.date === todayIso)
  // Seeded once from whatever's already on today's record (if any), so
  // re-marking the same day defaults to what was last saved instead of
  // silently resetting to "present".
  const [selfAttForm, setSelfAttForm] = useState(() => {
    const existing = attendanceRecords.find(r => r.employeeId === employeeId && r.date === todayIso)
    return existing
      ? { checkIn: existing.checkIn, checkOut: existing.checkOut, status: existing.status }
      : { checkIn: '09:00', checkOut: '18:00', status: 'present' as AttendanceRecord['status'] }
  })
  const [selfAttFlash, setSelfAttFlash] = useState(false)
  const [selfAttError, setSelfAttError] = useState('')
  const [selfAttSaving, setSelfAttSaving] = useState(false)

  async function markMyAttendance() {
    const existing = attendanceRecords.find(r => r.employeeId === employeeId && r.date === todayIso)
    setSelfAttError('')
    setSelfAttSaving(true)
    try {
      if (existing) {
        await onAttendanceUpdate(attendanceRecords.map(r => r.id === existing.id ? { ...r, ...selfAttForm } : r))
      } else {
        const newRec: AttendanceRecord = {
          id: `att-${Date.now()}`,
          employeeId,
          employeeName: meName,
          date: todayIso,
          ...selfAttForm,
        }
        await onAttendanceUpdate([...attendanceRecords, newRec])
      }
      setSelfAttFlash(true)
      setTimeout(() => setSelfAttFlash(false), 3000)
    } catch (err) {
      // Show the real server error instead of a false "saved" message that
      // silently reverts — see the comment on onAttendanceUpdate in App.tsx.
      setSelfAttError(err instanceof Error ? err.message : 'Something went wrong while saving. Please try again.')
    } finally {
      setSelfAttSaving(false)
    }
  }

  // Expenses — a structured, Excel-style sheet: add as many rows as needed,
  // attach a receipt photo per row, see the running total, then submit the
  // whole sheet at once.
  const myExpenses = expenses.filter(e => e.employeeId === employeeId)
  // Expense claims can be filed any day — HR reviews everything submitted
  // so far at month end (see ExpenseHR.tsx), so there's no per-month limit
  // here any more.
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [rows, setRows] = useState<DraftRow[]>([blankRow()])
  const [expenseError, setExpenseError] = useState('')
  const [expenseFlash, setExpenseFlash] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const rowFileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTargetRow, setUploadTargetRow] = useState<string | null>(null)

  const rowsTotal = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  function addRow() {
    setRows(prev => [...prev, blankRow()])
  }

  function removeRow(id: string) {
    setRows(prev => {
      const row = prev.find(r => r.id === id)
      if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl)
      const next = prev.filter(r => r.id !== id)
      return next.length ? next : [blankRow()]
    })
  }

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function triggerRowUpload(id: string) {
    setUploadTargetRow(id)
    rowFileInputRef.current?.click()
  }

  function handleRowFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const targetId = uploadTargetRow
    e.target.value = ''
    setUploadTargetRow(null)
    if (file && targetId) {
      const previewUrl = URL.createObjectURL(file)
      updateRow(targetId, { file, previewUrl })
    }
  }

  async function submitSheet() {
    const incomplete = rows.some(r => !r.date || !r.description.trim() || !r.amount || parseFloat(r.amount) <= 0)
    if (incomplete) {
      setExpenseError('Please fill in date, category, description and a valid amount for every row before submitting.')
      return
    }
    setExpenseError('')
    setSubmitting(true)
    try {
      // Create each claim for real first (the server assigns its actual
      // id), then upload that row's receipt photo against the real id —
      // receipts live in Supabase Storage now, keyed by the claim's database
      // id, so there's no way to attach one before the claim exists there.
      // This bypasses the generic onExpensesUpdate diff path on purpose:
      // that path can create claims but has no way to also push a file.
      const receiptFailures: string[] = []
      for (const r of rows) {
        const created = await api.createExpenseClaim({
          employeeId,
          date: r.date,
          description: r.description.trim(),
          category: r.category,
          amount: parseFloat(r.amount),
          status: 'Pending',
        })
        if (r.file) {
          try {
            await api.uploadExpenseReceipt(created.id, r.file)
          } catch (err) {
            console.error('Claim was saved, but its receipt photo failed to upload', err)
            receiptFailures.push(err instanceof Error ? err.message : 'Unknown error')
          }
        }
      }
      await onExpensesRefetch()
      rows.forEach(r => { if (r.previewUrl) URL.revokeObjectURL(r.previewUrl) })
      setRows([blankRow()])
      setShowExpenseForm(false)
      if (receiptFailures.length > 0) {
        // Claims themselves are saved either way — only surface the receipt
        // problem, so it's never silently lost like before.
        setExpenseError(`Submitted, but ${receiptFailures.length} receipt photo${receiptFailures.length !== 1 ? 's' : ''} failed to upload: ${receiptFailures[0]}`)
      } else {
        setExpenseFlash(`Submitted ${rows.length} expense claim${rows.length !== 1 ? 's' : ''} — pending approval.`)
        setTimeout(() => setExpenseFlash(''), 4000)
      }
    } catch (err) {
      console.error('Failed to submit the expense sheet', err)
      setExpenseError('Something went wrong while submitting. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Receipts live in Supabase Storage now, not as a data URL on the claim —
  // fetch a short-lived signed link on demand and open it.
  async function viewReceipt(claimId: string) {
    try {
      const url = await api.fetchExpenseReceiptDownloadUrl(claimId)
      window.open(url, '_blank')
    } catch (err) {
      console.error('Failed to open the receipt', err)
    }
  }

  function exportMyExpenses() {
    downloadExcel(
      `my-expense-claims-${new Date().toISOString().slice(0, 10)}.xlsx`,
      'My Expense Claims',
      ['Date', 'Description', 'Category', 'Amount', 'Receipt', 'Status'],
      myExpenses.map(e => [e.date, e.description, e.category, e.amount, e.receipt ? (e.receiptFileName || 'Attached') : 'No', e.status])
    )
  }

  // Tickets — derived live from the shared tickets store (rather than a
  // one-time local snapshot) so a status change or HR reply made in
  // TicketsHR shows up here immediately, and anything submitted here is
  // visible to HR right away too.
  const myTickets = tickets.filter(t => t.employeeId === employeeId)
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketForm, setTicketForm] = useState({ title: '', type: 'IT Support' as TicketType, priority: 'Medium' as TicketPriority, description: '' })
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  function submitLeave() {
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
      submittedByRole: 'crm',
      pendingWith: 'manager',
    }
    onLeaveUpdate([...leaves, newLeave])
    setLeaveForm({ type: 'Sick', startDate: '', endDate: '', reason: '' })
    setLeaveFlash(true)
    setTimeout(() => setLeaveFlash(false), 4000)
  }

  function submitTicket() {
    if (!ticketForm.title || !ticketForm.description) return
    const newTicket: EmployeeTicket = {
      id: `TKT-${Date.now()}`,
      employeeId,
      employeeName: meName,
      department: meDepartment,
      title: ticketForm.title,
      type: ticketForm.type,
      priority: ticketForm.priority,
      status: 'Open',
      description: ticketForm.description,
      raisedOn: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
      comments: [],
    }
    onTicketsUpdate([newTicket, ...tickets])
    setTicketForm({ title: '', type: 'IT Support', priority: 'Medium', description: '' })
    setShowTicketForm(false)
  }

  // Comments live in their own backend table now (not a field on the
  // ticket), so this posts directly rather than mutating the ticket object
  // and going through onTicketsUpdate.
  async function addComment(ticketId: string) {
    const text = commentInputs[ticketId]?.trim()
    if (!text) return
    setCommentInputs(prev => ({ ...prev, [ticketId]: '' }))
    try {
      await onAddTicketComment(ticketId, text)
    } catch (err) {
      console.error('Failed to post the comment', err)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'leave', label: 'My Leave' },
    { key: 'attendance', label: 'My Attendance' },
    { key: 'expenses', label: 'My Expenses' },
    { key: 'tickets', label: 'My Tickets' },
    { key: 'documents', label: 'My Documents' },
  ]

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF8F5', minHeight: '100vh' }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-bold" style={{ color: navy }}>My Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">{meName}{me?.team ? ` · ${me.team}` : ''}{meDepartment ? ` · ${meDepartment}` : ''}</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-white border border-border rounded-xl p-1 w-fit shadow-sm">
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

      {/* MY LEAVE TAB */}
      {tab === 'leave' && (
        <div className="space-y-4">
          {leaveFlash && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-medium">
              Submitted — pending your manager&apos;s approval.
            </div>
          )}
          {/* Leave Balance */}
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
              <p className="text-xs text-muted-foreground mt-3">Unpaid leave has no fixed quota — it's granted at manager/HR discretion. You've taken {myBalance.unpaidTaken} unpaid day{myBalance.unpaidTaken === 1 ? '' : 's'} so far.</p>
            </div>
          )}

          {/* Apply Form */}
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
                <input
                  type="date"
                  value={leaveForm.startDate}
                  onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                <input
                  type="date"
                  value={leaveForm.endDate}
                  onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="Reason for leave"
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={submitLeave}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: navy }}
            >
              Submit Leave Request
            </button>
          </div>

          {/* Leave History */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h2 className="font-semibold text-base mb-4" style={{ color: navy }}>My Leave History</h2>
            {myLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave requests found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">From</th>
                      <th className="pb-2 font-medium">To</th>
                      <th className="pb-2 font-medium">Days</th>
                      <th className="pb-2 font-medium">Reason</th>
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
                        <td className="py-2.5 max-w-[200px] truncate">{l.reason}</td>
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

      {/* MY ATTENDANCE TAB */}
      {tab === 'attendance' && (
        <div className="space-y-4">
          {selfAttFlash && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-medium">
              Today's attendance saved.
            </div>
          )}
          {selfAttError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
              {selfAttError}
            </div>
          )}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h2 className="font-semibold text-base mb-1" style={{ color: navy }}>Mark Today's Attendance</h2>
            <p className="text-xs text-muted-foreground mb-4">
              {myTodayAttendance ? `Already marked for today (${todayIso}) — update it below if needed.` : `Not yet marked for today (${todayIso}).`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
                <select
                  value={selfAttForm.status}
                  onChange={e => setSelfAttForm(p => ({ ...p, status: e.target.value as AttendanceRecord['status'] }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="half-day">Half Day</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Check In</label>
                <input type="time" value={selfAttForm.checkIn} onChange={e => setSelfAttForm(p => ({ ...p, checkIn: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Check Out</label>
                <input type="time" value={selfAttForm.checkOut} onChange={e => setSelfAttForm(p => ({ ...p, checkOut: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
              </div>
              <div className="flex items-end">
                <button onClick={markMyAttendance} disabled={selfAttSaving}
                  className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: navy }}>
                  {selfAttSaving ? 'Saving…' : myTodayAttendance ? 'Update' : 'Mark Attendance'}
                </button>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h2 className="font-semibold text-base mb-4" style={{ color: navy }}>My Attendance History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Check In</th>
                    <th className="pb-2 font-medium">Check Out</th>
                    <th className="pb-2 font-medium">Hours</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myAttendance.map(r => {
                    let hours = '—'
                    if (r.checkIn && r.checkOut) {
                      const [ih, im] = r.checkIn.split(':').map(Number)
                      const [oh, om] = r.checkOut.split(':').map(Number)
                      const diff = (oh * 60 + om) - (ih * 60 + im)
                      hours = `${Math.floor(diff / 60)}h ${diff % 60}m`
                    }
                    return (
                      <tr key={r.id} className="border-b border-border hover:bg-muted/20">
                        <td className="py-2.5">{r.date}</td>
                        <td className="py-2.5">{r.checkIn || '—'}</td>
                        <td className="py-2.5">{r.checkOut || '—'}</td>
                        <td className="py-2.5">{hours}</td>
                        <td className="py-2.5"><StatusBadge status={r.status} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MY EXPENSES TAB */}
      {tab === 'expenses' && (
        <div className="space-y-4">
          {expenseFlash && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-medium">
              {expenseFlash}
            </div>
          )}
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="font-semibold text-base" style={{ color: navy }}>My Expense Claims</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={exportMyExpenses}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-white hover:bg-muted transition-all"
                style={{ color: navy }}
              >
                <FileSpreadsheet size={14} />
                Export to Excel
              </button>
              <button
                onClick={() => setShowExpenseForm(v => !v)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: navy }}
              >
                {showExpenseForm ? 'Cancel' : '+ New Expense Sheet'}
              </button>
            </div>
          </div>

          <input
            ref={rowFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleRowFileChange}
          />

          {showExpenseForm && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-sm" style={{ color: navy }}>New Expense Sheet</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Add a row for every expense, attach its receipt photo, then submit them all together.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border">
                      {['Date', 'Expense Type', 'Description / Purpose', 'Amount (₹)', 'Receipt', ''].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                        <td className="px-3 py-2.5">
                          <input type="date" value={r.date} onChange={e => updateRow(r.id, { date: e.target.value })}
                            className="w-36 border border-border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none" />
                        </td>
                        <td className="px-3 py-2.5">
                          <select value={r.category} onChange={e => updateRow(r.id, { category: e.target.value as ExpenseCategory })}
                            className="w-32 border border-border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none">
                            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="text" placeholder="e.g. Lunch with client" value={r.description} onChange={e => updateRow(r.id, { description: e.target.value })}
                            className="w-full min-w-[160px] border border-border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none" />
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="number" placeholder="0" value={r.amount} onChange={e => updateRow(r.id, { amount: e.target.value })}
                            className="w-24 border border-border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none" />
                        </td>
                        <td className="px-3 py-2.5">
                          {r.file ? (
                            <div className="flex items-center gap-1.5">
                              {r.previewUrl && (
                                <button type="button" onClick={() => window.open(r.previewUrl!, '_blank')} className="w-8 h-8 rounded-lg overflow-hidden border border-border shrink-0" title="View">
                                  <img src={r.previewUrl} alt="Receipt" className="w-full h-full object-cover" />
                                </button>
                              )}
                              <span className="text-[10px] text-muted-foreground max-w-[80px] truncate">{r.file.name}</span>
                            </div>
                          ) : (
                            <button type="button" onClick={() => triggerRowUpload(r.id)}
                              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg border border-dashed transition-colors hover:bg-muted whitespace-nowrap"
                              style={{ borderColor: '#E5DFD5', color: '#7A7065' }}>
                              <Upload size={11} /> Attach
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <button type="button" onClick={() => removeRow(r.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors" aria-label="Remove row">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="px-3 pt-3">
                        <button type="button" onClick={addRow} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: navy }}>
                          <Plus size={14} /> Add Row
                        </button>
                      </td>
                      <td className="px-3 pt-3 text-sm font-bold text-foreground whitespace-nowrap">₹{rowsTotal.toLocaleString('en-IN')}</td>
                      <td colSpan={2} className="px-3 pt-3 text-xs text-muted-foreground">Total</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {expenseError && <p className="text-xs font-medium" style={{ color: '#DC2626' }}>{expenseError}</p>}

              <button
                onClick={submitSheet}
                disabled={submitting}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                style={{ background: navy }}
              >
                {submitting ? 'Submitting…' : 'Submit Expense Sheet'}
              </button>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Receipt</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myExpenses.map(e => (
                    <tr key={e.id} className="border-b border-border hover:bg-muted/20">
                      <td className="py-2.5">{e.date}</td>
                      <td className="py-2.5 max-w-[180px] truncate">{e.description}</td>
                      <td className="py-2.5">{e.category}</td>
                      <td className="py-2.5 font-medium">₹{e.amount.toLocaleString('en-IN')}</td>
                      <td className="py-2.5">
                        {e.receipt ? (
                          <button onClick={() => viewReceipt(e.id)}
                            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity text-xs text-muted-foreground max-w-[130px] truncate" title="View receipt">
                            <Eye size={12} />
                            <span className="truncate">{e.receiptFileName || 'Attached'}</span>
                          </button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5"><StatusBadge status={e.status} /></td>
                    </tr>
                  ))}
                  {myExpenses.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No expense claims yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MY TICKETS TAB */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-base" style={{ color: navy }}>My Support Tickets</h2>
            <button
              onClick={() => setShowTicketForm(v => !v)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: navy }}
            >
              {showTicketForm ? 'Cancel' : '+ Raise Ticket'}
            </button>
          </div>

          {showTicketForm && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
              <h3 className="font-semibold text-sm" style={{ color: navy }}>New Ticket</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Title</label>
                  <input
                    type="text"
                    placeholder="Brief title"
                    value={ticketForm.title}
                    onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Type</label>
                  <select
                    value={ticketForm.type}
                    onChange={e => setTicketForm(f => ({ ...f, type: e.target.value as TicketType }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    {TICKET_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Priority</label>
                  <select
                    value={ticketForm.priority}
                    onChange={e => setTicketForm(f => ({ ...f, priority: e.target.value as TicketPriority }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    {TICKET_PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Describe your issue in detail"
                    value={ticketForm.description}
                    onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none resize-none"
                  />
                </div>
              </div>
              <button
                onClick={submitTicket}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: navy }}
              >
                Submit Ticket
              </button>
            </div>
          )}

          <div className="space-y-3">
            {myTickets.map(t => (
              <div key={t.id} className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: navy }}>{t.title}</span>
                      <StatusBadge status={t.status} />
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.priority === 'Urgent' ? 'bg-red-50 text-red-600' : t.priority === 'High' ? 'bg-orange-50 text-orange-700' : t.priority === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {t.priority}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t.type} · Raised {t.raisedOn}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{t.id}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{t.description}</p>
                {t.resolution && (
                  <div className="mt-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-800">
                    <span className="font-medium">Resolution: </span>{t.resolution}
                  </div>
                )}
                {/* Comments */}
                {t.comments.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    {t.comments.map((c, i) => (
                      <div key={i} className={`rounded-lg px-3 py-2 text-sm ${c.role === 'hr' ? 'bg-blue-50 text-blue-900' : 'bg-gray-50 text-gray-800'}`}>
                        <span className="font-medium">{c.by}</span>
                        <span className="text-xs text-muted-foreground ml-2">{c.at}</span>
                        <p className="mt-0.5">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={commentInputs[t.id] || ''}
                    onChange={e => setCommentInputs(prev => ({ ...prev, [t.id]: e.target.value }))}
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                  />
                  <button
                    onClick={() => addComment(t.id)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ background: gold, color: navy }}
                  >
                    Send
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MY DOCUMENTS TAB */}
      {tab === 'documents' && (
        <DocumentsPanel
          employeeId={employeeId}
          employeeName={meName}
          viewerId={employeeId}
          viewerName={meName}
          employees={employees}
          title="My Documents"
          description="Upload your Aadhar, PAN, offer letter and other documents here, and download them whenever you need them."
        />
      )}
    </div>
  )
}
