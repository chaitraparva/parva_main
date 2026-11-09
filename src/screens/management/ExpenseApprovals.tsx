import { useState } from 'react'
import { Check, X, Eye, Receipt } from 'lucide-react'
import type { Employee, ExpenseClaim } from '../../types'
import * as api from '../../lib/api'

const navy = '#1C2B4A'

const statusColor: Record<string, { bg: string; text: string }> = {
  Pending: { bg: '#FFFBEB', text: '#D97706' },
  Approved: { bg: '#ECFDF5', text: '#059669' },
  Rejected: { bg: '#FEF2F2', text: '#DC2626' },
  Reimbursed: { bg: '#EEF2FF', text: '#4338CA' },
}

interface Props {
  expenses: ExpenseClaim[]
  onExpensesUpdate: (list: ExpenseClaim[]) => Promise<void>
  employees: Employee[]
  currentEmployee?: Employee
}

/** The Director's screen: expense claims filed by HR team members. HR can't
 * approve their own team's claims, so they land here instead. Once approved,
 * a claim goes to Finance for reimbursement like any other. */
export default function ExpenseApprovals({ expenses, onExpensesUpdate, employees, currentEmployee }: Props) {
  const [filter, setFilter] = useState<'Pending' | 'all'>('Pending')
  const [noteMap, setNoteMap] = useState<Record<string, string>>({})
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const hrIds = new Set(employees.filter(e => e.role === 'hr').map(e => e.id))
  const hrClaims = expenses.filter(c => hrIds.has(c.employeeId))
  const shown = (filter === 'Pending' ? hrClaims.filter(c => c.status === 'Pending') : hrClaims)
    .slice()
    .sort((a, b) => (a.status === 'Pending' ? 0 : 1) - (b.status === 'Pending' ? 0 : 1) || b.date.localeCompare(a.date))
  const pendingTotal = hrClaims.filter(c => c.status === 'Pending').reduce((s, c) => s + c.amount, 0)
  const pendingCount = hrClaims.filter(c => c.status === 'Pending').length

  async function decide(c: ExpenseClaim, patch: Partial<ExpenseClaim>) {
    setError('')
    setBusyId(c.id)
    try {
      await onExpensesUpdate(expenses.map(x => (x.id === c.id ? { ...x, ...patch } : x)))
      setRejectingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that decision. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const approve = (c: ExpenseClaim) => decide(c, { status: 'Approved', approvedBy: currentEmployee?.id })
  const reject = (c: ExpenseClaim) => decide(c, { status: 'Rejected', note: noteMap[c.id] || 'Rejected by the Director.' })

  async function viewReceipt(c: ExpenseClaim) {
    try {
      window.open(await api.fetchExpenseReceiptDownloadUrl(c.id), '_blank')
    } catch {
      setError('Could not open this receipt. Please try again.')
    }
  }

  const approverName = (id?: string) => (id ? employees.find(e => e.id === id)?.name || id : '')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">HR Expense Approvals</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Expense claims filed by the HR team. Approved claims go to Finance for reimbursement.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#D97706' }}>Waiting for you</p>
          <p className="font-serif text-2xl font-semibold text-foreground">₹{pendingTotal.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground mt-1">{pendingCount} claim{pendingCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-muted-foreground">All HR claims</p>
          <p className="font-serif text-2xl font-semibold text-foreground">{hrClaims.length}</p>
          <p className="text-xs text-muted-foreground mt-1">including approved, rejected and reimbursed</p>
        </div>
      </div>

      <div className="flex gap-2">
        {([['Pending', 'Waiting for me'], ['all', 'All HR claims']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{ backgroundColor: filter === k ? navy : '#F0EDE7', color: filter === k ? '#FAF8F5' : '#7A7065' }}>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {['Employee', 'Date', 'Type', 'Description', 'Amount', 'Receipt', 'Status', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(c => {
                const sc = statusColor[c.status]
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 align-top">
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{c.employeeName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{c.date}</td>
                    <td className="px-4 py-3 text-xs text-foreground whitespace-nowrap">{c.category}</td>
                    <td className="px-4 py-3 text-xs text-foreground max-w-[220px]">
                      {c.description}
                      {c.note && <p className="text-muted-foreground italic mt-0.5">{c.note}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground whitespace-nowrap">₹{c.amount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      {c.receipt ? (
                        <button onClick={() => viewReceipt(c)} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: navy }}>
                          <Eye size={12} /> View
                        </button>
                      ) : <span className="text-xs text-muted-foreground">None</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{c.status}</span>
                      {c.approvedBy && <p className="text-[10px] text-muted-foreground mt-0.5">by {approverName(c.approvedBy)}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {c.status === 'Pending' ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => approve(c)} disabled={busyId === c.id}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-60"
                              style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                              <Check size={11} /> Approve
                            </button>
                            <button onClick={() => setRejectingId(rejectingId === c.id ? null : c.id)} disabled={busyId === c.id}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-60"
                              style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                              <X size={11} /> Reject
                            </button>
                          </div>
                          {rejectingId === c.id && (
                            <div className="flex flex-col gap-1">
                              <input value={noteMap[c.id] || ''} onChange={e => setNoteMap(p => ({ ...p, [c.id]: e.target.value }))}
                                placeholder="Reason for rejection…" className="text-xs px-2 py-1 rounded border border-border bg-muted w-40 focus:outline-none" />
                              <button onClick={() => reject(c)} className="text-xs text-red-600 font-medium underline text-left">Confirm reject</button>
                            </div>
                          )}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                )
              })}
              {shown.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-sm text-muted-foreground">
                  <Receipt size={18} className="inline mr-2 -mt-0.5" />
                  {filter === 'Pending' ? 'No HR expense claims are waiting for approval.' : 'No HR expense claims yet.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
