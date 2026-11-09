import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Plus, Trash2, Upload, X } from 'lucide-react'
import type { ExpenseCategory } from '../types'
import * as api from '../lib/api'

const navy = '#1C2B4A'
const gold = '#C9A96E'

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Travel', 'Meals', 'Training', 'Equipment', 'Accommodation', 'Client Entertainment', 'Office Supplies', 'Other']

interface DraftRow {
  id: string
  date: string
  category: ExpenseCategory
  description: string
  amount: string
  file: File | null
}

const blankRow = (): DraftRow => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  date: '', category: 'Travel', description: '', amount: '', file: null,
})

interface Props {
  /** Whose claim this is — always the signed-in person. */
  employeeId: string
  /** Called after claims are saved so the parent can reload the list. */
  onSubmitted: () => Promise<void>
  onCancel: () => void
  /** Who will approve it, shown to the person filing. */
  approverNote?: string
}

/** A small expense sheet: add a row per expense (with an optional receipt
 * photo) and submit them all as Pending claims. Same save path as the
 * employee portal's "New Expense Sheet". */
export default function NewExpenseForm({ employeeId, onSubmitted, onCancel, approverNote }: Props) {
  const [rows, setRows] = useState<DraftRow[]>([blankRow()])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileTarget, setFileTarget] = useState<string | null>(null)

  const total = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const update = (id: string, patch: Partial<DraftRow>) => setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  const remove = (id: string) => setRows(prev => { const next = prev.filter(r => r.id !== id); return next.length ? next : [blankRow()] })

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const target = fileTarget
    e.target.value = ''
    setFileTarget(null)
    if (file && target) update(target, { file })
  }

  async function submit() {
    if (rows.some(r => !r.date || !r.description.trim() || !(parseFloat(r.amount) > 0))) {
      setError('Please fill in the date, type, description and a valid amount for every row.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const receiptFailures: string[] = []
      for (const r of rows) {
        const created = await api.createExpenseClaim({
          employeeId, date: r.date, description: r.description.trim(), category: r.category,
          amount: parseFloat(r.amount), status: 'Pending',
        })
        if (r.file) {
          try { await api.uploadExpenseReceipt(created.id, r.file) }
          catch (err) { receiptFailures.push(err instanceof Error ? err.message : 'Unknown error') }
        }
      }
      await onSubmitted()
      if (receiptFailures.length > 0) {
        setError(`Submitted, but ${receiptFailures.length} receipt photo${receiptFailures.length !== 1 ? 's' : ''} failed to upload: ${receiptFailures[0]}`)
        setRows([blankRow()])
      } else {
        onCancel()
      }
    } catch (err) {
      console.error('Failed to submit the expense sheet', err)
      setError('Something went wrong while submitting. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const input = 'w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-muted focus:outline-none'
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-base font-semibold text-foreground">New Expense Claim</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add a row for every expense and attach its receipt photo.{approverNote ? ` ${approverNote}` : ''}
          </p>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Close"><X size={16} /></button>
      </div>

      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={onFile} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-border">
              {['Date', 'Expense Type', 'Description / Purpose', 'Amount (₹)', 'Receipt', ''].map(h => (
                <th key={h} className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-2 py-2"><input type="date" value={r.date} onChange={e => update(r.id, { date: e.target.value })} className={input} /></td>
                <td className="px-2 py-2">
                  <select value={r.category} onChange={e => update(r.id, { category: e.target.value as ExpenseCategory })} className={input}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2"><input value={r.description} onChange={e => update(r.id, { description: e.target.value })} placeholder="What was it for?" className={input} /></td>
                <td className="px-2 py-2"><input type="number" min="0" value={r.amount} onChange={e => update(r.id, { amount: e.target.value })} className={`${input} w-28`} /></td>
                <td className="px-2 py-2">
                  <button onClick={() => { setFileTarget(r.id); fileRef.current?.click() }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-dashed hover:bg-muted max-w-[150px]"
                    style={{ borderColor: '#E5DFD5', color: r.file ? navy : '#7A7065' }}>
                    <Upload size={12} /> <span className="truncate">{r.file ? r.file.name : 'Attach'}</span>
                  </button>
                </td>
                <td className="px-2 py-2">
                  <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50" aria-label="Remove row"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => setRows(prev => [...prev, blankRow()])}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-muted" style={{ color: navy }}>
          <Plus size={13} /> Add row
        </button>
        <p className="text-sm font-semibold text-foreground">Total: ₹{total.toLocaleString('en-IN')}</p>
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button onClick={submit} disabled={submitting}
          className="px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: gold, color: navy }}>
          {submitting ? 'Submitting…' : 'Submit Claim'}
        </button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted">Cancel</button>
      </div>
    </div>
  )
}
