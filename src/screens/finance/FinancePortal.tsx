import { useEffect, useState } from 'react'
import type { PayrollRecord, ExpenseClaim, Employee } from '../../types'
import { DollarSign } from 'lucide-react'

const navy = '#1C2B4A'
const gold = '#C9A96E'

type Tab = 'overview' | 'payroll-signoff' | 'reimbursements'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    disbursed: 'bg-emerald-50 text-emerald-700',
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
  currentEmployee?: Employee
}

export default function FinancePortal({ payroll: payrollProp, onPayrollUpdate, expenses, onExpensesUpdate, currentEmployee }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

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
                      <td className="py-2.5 text-muted-foreground">{c.approvedBy || '—'}</td>
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
    </div>
  )
}
