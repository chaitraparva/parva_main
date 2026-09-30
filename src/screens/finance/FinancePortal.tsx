import { useEffect, useState } from 'react'
import type { PayrollRecord, ExpenseClaim, Employee, LeaveRequest } from '../../types'
import { DollarSign } from 'lucide-react'
import { computeLeaveBalance, LEAVE_POLICY } from '../../lib/leaveBalance'

const navy = '#1C2B4A'
const gold = '#C9A96E'

const LEAVE_TYPES = ['Sick', 'Casual', 'Earned', 'Unpaid'] as const
type Tab = 'overview' | 'payroll-signoff' | 'reimbursements' | 'my-leave'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    disbursed: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-600',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

interface Props {
  payroll: PayrollRecord[]
  onPayrollUpdate: (next: PayrollRecord[]) => void
  expenses: ExpenseClaim[]
  onExpensesUpdate: (next: ExpenseClaim[]) => void
  employees: Employee[]
  currentEmployee?: Employee
  leaves: LeaveRequest[]
  onLeaveUpdate: (l: LeaveRequest[]) => void
  employeeId: string
}

export default function FinancePortal({ payroll: payrollProp, onPayrollUpdate, expenses, onExpensesUpdate, employees, currentEmployee, leaves, onLeaveUpdate, employeeId }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  // My Leave — a finance employee's own leave request, same self-service
  // pattern as ManagerPortal.tsx's "My Leave" tab. It goes to HR for
  // approval (see Leave.tsx), never to management.
  const myLeaves = leaves.filter(l => l.employeeId === employeeId)
  const me = currentEmployee || employees.find(e => e.id === employeeId)
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
      submittedByRole: 'finance',
      pendingWith: 'hr',
    }
    onLeaveUpdate([...leaves, newLeave])
    setLeaveForm({ type: 'Sick', startDate: '', endDate: '', reason: '' })
    setLeaveFlash(true)
    setTimeout(() => setLeaveFlash(false), 4000)
  }

  // Payroll sign-off — HR processes a record, then it lands here for
  // Finance to give the final sign-off and mark it disbursed.
  const [payroll, setPayrollLocal] = useState<PayrollRecord[]>(payrollProp)
  useEffect(() => { setPayrollLocal(payrollProp) }, [payrollProp])
  const setPayroll = (updater: PayrollRecord[] | ((prev: PayrollRecord[]) => PayrollRecord[])) => {
    setPayrollLocal(prev => {
      const next = typeof updater === 'function' ? (updater as (prev: PayrollRecord[]) => PayrollRecord[])(prev) : updater
      onPayrollUpdate(next)
      return next
    })
  }
  const pendingPayroll = payroll.filter(r => r.status === 'pending-management')
  const disbursedPayroll = payroll.filter(r => r.status === 'disbursed')
  const totalDisbursement = disbursedPayroll.reduce((s, r) => s + r.netPay, 0)
  const pendingTotal = pendingPayroll.reduce((s, r) => s + r.netPay, 0)

  function signOff(id: string) {
    setPayroll(prev => prev.map(r => r.id === id ? { ...r, status: 'disbursed' as const, adminApproved: true } : r))
  }
  function signOffAll() {
    setPayroll(prev => prev.map(r => r.status === 'pending-management' ? { ...r, status: 'disbursed' as const, adminApproved: true } : r))
  }

  // Reimbursements — HR approves a claim, then it lands here for Finance
  // to actually pay out and mark reimbursed.
  const awaitingReimbursement = expenses.filter(c => c.status === 'Approved')
  const reimbursedClaims = expenses.filter(c => c.status === 'Reimbursed')
  function reimburse(id: string) {
    onExpensesUpdate(expenses.map(c => c.id === id ? { ...c, status: 'Reimbursed' as const, reimbursedOn: new Date().toISOString().split('T')[0] } : c))
  }
  function reimburseAll() {
    const today = new Date().toISOString().split('T')[0]
    onExpensesUpdate(expenses.map(c => c.status === 'Approved' ? { ...c, status: 'Reimbursed' as const, reimbursedOn: today } : c))
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'payroll-signoff', label: 'Payroll Sign-off' },
    { key: 'reimbursements', label: 'Reimbursements' },
    { key: 'my-leave', label: 'My Leave' },
  ]

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF8F5', minHeight: '100vh' }}>
      <div>
        <h1 className="text-2xl font-serif font-bold" style={{ color: navy }}>Finance Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">{currentEmployee?.name || 'Finance'}{currentEmployee?.title ? ` · ${currentEmployee.title}` : ''}</p>
      </div>

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

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Pending Sign-off</p>
              <p className="text-2xl font-bold font-serif" style={{ color: '#D97706' }}>₹{(pendingTotal / 100000).toFixed(2)}L</p>
              <p className="text-xs text-muted-foreground mt-1">{pendingPayroll.length} record{pendingPayroll.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Total Disbursed</p>
              <p className="text-2xl font-bold font-serif" style={{ color: '#059669' }}>₹{(totalDisbursement / 100000).toFixed(2)}L</p>
              <p className="text-xs text-muted-foreground mt-1">{disbursedPayroll.length} record{disbursedPayroll.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Awaiting Reimbursement</p>
              <p className="text-2xl font-bold font-serif" style={{ color: '#D97706' }}>
                ₹{awaitingReimbursement.reduce((s, c) => s + c.amount, 0).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{awaitingReimbursement.length} claim{awaitingReimbursement.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Total Reimbursed</p>
              <p className="text-2xl font-bold font-serif" style={{ color: '#059669' }}>
                ₹{reimbursedClaims.reduce((s, c) => s + c.amount, 0).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{reimbursedClaims.length} claim{reimbursedClaims.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every payroll record HR has processed lands here for final sign-off, and every expense claim HR has
              approved lands here for payout. Use the tabs above to act on what's waiting.
            </p>
          </div>
        </div>
      )}

      {/* PAYROLL SIGN-OFF */}
      {tab === 'payroll-signoff' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Pending Sign-off Total</p>
              <p className="text-2xl font-bold font-serif" style={{ color: '#D97706' }}>₹{(pendingTotal / 100000).toFixed(2)}L</p>
              <p className="text-xs text-muted-foreground mt-1">{pendingPayroll.length} record{pendingPayroll.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Total Disbursed</p>
              <p className="text-2xl font-bold font-serif" style={{ color: '#059669' }}>₹{(totalDisbursement / 100000).toFixed(2)}L</p>
              <p className="text-xs text-muted-foreground mt-1">{disbursedPayroll.length} record{disbursedPayroll.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base" style={{ color: navy }}>
                Awaiting Sign-off
                {pendingPayroll.length > 0 && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{pendingPayroll.length}</span>}
              </h2>
              {pendingPayroll.length > 0 && (
                <button onClick={signOffAll} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: gold, color: navy }}>
                  Sign Off All
                </button>
              )}
            </div>
            {pendingPayroll.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payroll records awaiting sign-off.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Employee</th>
                      <th className="pb-2 font-medium">Role</th>
                      <th className="pb-2 font-medium">Month</th>
                      <th className="pb-2 font-medium">Net Pay</th>
                      <th className="pb-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPayroll.map(r => (
                      <tr key={r.id} className="border-b border-border hover:bg-muted/20">
                        <td className="py-2.5 font-medium">{r.employeeName}</td>
                        <td className="py-2.5 capitalize">{r.role}</td>
                        <td className="py-2.5 text-muted-foreground">{r.month}</td>
                        <td className="py-2.5 font-bold" style={{ color: navy }}>₹{r.netPay.toLocaleString('en-IN')}</td>
                        <td className="py-2.5">
                          <button onClick={() => signOff(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: navy }}>
                            Sign Off
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {disbursedPayroll.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h2 className="font-semibold text-base mb-4" style={{ color: navy }}>Disbursed Records</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Employee</th>
                      <th className="pb-2 font-medium">Role</th>
                      <th className="pb-2 font-medium">Net Pay</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disbursedPayroll.map(r => (
                      <tr key={r.id} className="border-b border-border hover:bg-muted/20">
                        <td className="py-2.5">{r.employeeName}</td>
                        <td className="py-2.5 capitalize">{r.role}</td>
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

      {/* REIMBURSEMENTS — HR-approved expense claims, paid out by Finance */}
      {tab === 'reimbursements' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Awaiting Reimbursement</p>
              <p className="text-2xl font-bold font-serif" style={{ color: '#D97706' }}>
                ₹{awaitingReimbursement.reduce((s, c) => s + c.amount, 0).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{awaitingReimbursement.length} claim{awaitingReimbursement.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Total Reimbursed</p>
              <p className="text-2xl font-bold font-serif" style={{ color: '#059669' }}>
                ₹{reimbursedClaims.reduce((s, c) => s + c.amount, 0).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{reimbursedClaims.length} claim{reimbursedClaims.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base" style={{ color: navy }}>
                Approved by HR — Awaiting Payout
                {awaitingReimbursement.length > 0 && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{awaitingReimbursement.length}</span>}
              </h2>
              {awaitingReimbursement.length > 0 && (
                <button onClick={reimburseAll} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: gold, color: navy }}>
                  Reimburse All
                </button>
              )}
            </div>
            {awaitingReimbursement.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expense claims are waiting on reimbursement.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Employee</th>
                      <th className="pb-2 font-medium">Category</th>
                      <th className="pb-2 font-medium">Description</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Approved By</th>
                      <th className="pb-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awaitingReimbursement.map(c => (
                      <tr key={c.id} className="border-b border-border hover:bg-muted/20">
                        <td className="py-2.5 font-medium" style={{ color: navy }}>{c.employeeName}</td>
                        <td className="py-2.5">{c.category}</td>
                        <td className="py-2.5 text-muted-foreground max-w-[220px] truncate">{c.description}</td>
                        <td className="py-2.5 font-bold" style={{ color: navy }}>₹{c.amount.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 text-muted-foreground">{(c.approvedBy && (employees.find(e => e.id === c.approvedBy)?.name || c.approvedBy)) || '—'}</td>
                        <td className="py-2.5">
                          <button onClick={() => reimburse(c.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90" style={{ background: navy }}>
                            <DollarSign size={12} /> Reimburse
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {reimbursedClaims.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h2 className="font-semibold text-base mb-4" style={{ color: navy }}>Reimbursed</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Employee</th>
                      <th className="pb-2 font-medium">Category</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Reimbursed On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reimbursedClaims.map(c => (
                      <tr key={c.id} className="border-b border-border hover:bg-muted/20">
                        <td className="py-2.5">{c.employeeName}</td>
                        <td className="py-2.5">{c.category}</td>
                        <td className="py-2.5 font-medium">₹{c.amount.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 text-muted-foreground">{c.reimbursedOn || '—'}</td>
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
              Submitted — pending HR's approval.
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
    </div>
  )
}
