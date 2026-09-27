import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { ExpenseClaim, Employee } from '../../types'
import { Check, X, Filter, DollarSign, Upload, RefreshCw, ChevronDown, FileSpreadsheet, Archive, Download, Eye } from 'lucide-react'
import { downloadExcel, buildExcelBlob } from '../../lib/excel'
import { downloadDataUrl, downloadZip, placeholderReceiptDataUrl } from '../../lib/files'
import * as api from '../../lib/api'

const navy = '#1C2B4A'
const gold = '#C9A96E'

const statusColor: Record<string, { bg: string; text: string }> = {
  Pending: { bg: '#FFFBEB', text: '#D97706' },
  Approved: { bg: '#ECFDF5', text: '#059669' },
  Rejected: { bg: '#FEF2F2', text: '#DC2626' },
  Reimbursed: { bg: '#EEF2FF', text: '#4338CA' },
}

const categoryIcon: Record<string, string> = {
  Travel: '✈', Meals: '🍽', Training: '📚', Equipment: '💻',
  Accommodation: '🏨', 'Client Entertainment': '🤝', 'Office Supplies': '📎', Other: '📋',
}

function formatEmpId(id: string) {
  const n = id.split('-')[1]
  return n ? `EMP-${n.padStart(3, '0')}` : id.toUpperCase()
}

// A claim's real receipt photo now lives in Supabase Storage, keyed by the
// claim's database id — so viewing/downloading one means asking the backend
// for a short-lived signed link, not reading a local data URL. This falls
// back to a clearly-labelled placeholder image only for older claims that
// have a receipt filename on record but no real photo was ever uploaded
// (from before real storage existed for this), so "view / download" always
// has something honest to show instead of silently failing.
function placeholderFor(c: ExpenseClaim): string {
  return placeholderReceiptDataUrl({ category: c.category, amount: c.amount, date: c.date, employeeName: c.employeeName })
}

function receiptFileNameFor(c: ExpenseClaim): string {
  if (c.receiptFileName) return c.receiptFileName
  const safeName = c.employeeName.replace(/\s+/g, '_')
  return `${safeName}-${c.category}-${c.date}.svg`
}

interface Group {
  employeeId: string
  employeeName: string
  department: string
  claims: ExpenseClaim[]
}

interface Props {
  expenses: ExpenseClaim[]
  onExpensesUpdate: (list: ExpenseClaim[]) => void
  onExpensesRefetch: () => Promise<void>
  employees: Employee[]
  currentEmployee?: Employee
}

export default function ExpenseHR({ expenses, onExpensesUpdate, onExpensesRefetch, employees, currentEmployee }: Props) {
  const approverName = currentEmployee?.name || 'HR'
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [noteMap, setNoteMap] = useState<Record<string, string>>({})
  const [showNoteFor, setShowNoteFor] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<{ claim: ExpenseClaim; url: string; isPlaceholder: boolean } | null>(null)
  const [zippingId, setZippingId] = useState<string | null>(null)

  const toggleCollapsed = (employeeId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }

  const triggerReceiptUpload = (id: string) => {
    setUploadTargetId(id)
    fileInputRef.current?.click()
  }

  const handleReceiptFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const targetId = uploadTargetId
    e.target.value = ''
    setUploadTargetId(null)
    if (file && targetId) {
      setUploadingId(targetId)
      try {
        await api.uploadExpenseReceipt(targetId, file)
        await onExpensesRefetch()
      } catch (err) {
        console.error('Failed to upload the receipt photo', err)
      } finally {
        setUploadingId(null)
      }
    }
  }

  // Fetches a short-lived signed link for one claim's real receipt photo —
  // falls back to the honest placeholder for a claim that has a filename on
  // record but no real photo was ever uploaded.
  async function viewReceipt(c: ExpenseClaim) {
    if (!c.receipt) return
    try {
      const url = await api.fetchExpenseReceiptDownloadUrl(c.id)
      setPreview({ claim: c, url, isPlaceholder: false })
    } catch {
      setPreview({ claim: c, url: placeholderFor(c), isPlaceholder: true })
    }
  }

  async function downloadReceipt(c: ExpenseClaim) {
    if (!c.receipt) return
    try {
      const url = await api.fetchExpenseReceiptDownloadUrl(c.id, receiptFileNameFor(c))
      window.open(url, '_blank')
    } catch {
      downloadDataUrl(receiptFileNameFor(c), placeholderFor(c))
    }
  }

  const filtered = expenses.filter(c => {
    const ms = filterStatus === 'all' || c.status === filterStatus
    const mc = filterCategory === 'all' || c.category === filterCategory
    return ms && mc
  })

  const update = (id: string, patch: Partial<ExpenseClaim>) => {
    onExpensesUpdate(expenses.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  const approve = (c: ExpenseClaim) => {
    update(c.id, { status: 'Approved', approvedBy: approverName })
    setShowNoteFor(null)
  }

  const reject = (c: ExpenseClaim) => {
    update(c.id, { status: 'Rejected', note: noteMap[c.id] || 'Rejected by HR.' })
    setShowNoteFor(null)
  }

  const totals = {
    pending: expenses.filter(c => c.status === 'Pending').reduce((s, c) => s + c.amount, 0),
    approved: expenses.filter(c => c.status === 'Approved').reduce((s, c) => s + c.amount, 0),
    reimbursed: expenses.filter(c => c.status === 'Reimbursed').reduce((s, c) => s + c.amount, 0),
    rejected: expenses.filter(c => c.status === 'Rejected').reduce((s, c) => s + c.amount, 0),
  }

  const categories = Array.from(new Set(expenses.map(c => c.category)))

  // Group filtered claims by employee — every category a person has claimed
  // under sits together, instead of being scattered across a flat list.
  const groupedByEmployee: Group[] = Array.from(
    filtered.reduce((map, c) => {
      const group = map.get(c.employeeId) || { employeeId: c.employeeId, employeeName: c.employeeName, department: c.department, claims: [] as ExpenseClaim[] }
      group.claims.push(c)
      map.set(c.employeeId, group)
      return map
    }, new Map<string, Group>()).values()
  ).sort((a, b) => a.employeeName.localeCompare(b.employeeName))

  const expensePeriod = (group: Group) => {
    const dates = group.claims.map(c => c.date).sort()
    if (dates.length === 0) return '—'
    return dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} – ${dates[dates.length - 1]}`
  }

  const groupExcelRows = (group: Group) => group.claims.map(c => [
    c.date, c.category, c.description, c.amount, c.receipt ? (c.receiptFileName || 'Attached') : 'No', c.status,
  ])

  const exportAll = () => {
    const rows = groupedByEmployee.flatMap(group => group.claims.map(c => [
      c.employeeName, c.department, c.category, c.description, c.date, c.amount,
      c.receipt ? (c.receiptFileName || 'Attached') : 'No', c.status,
    ]))
    downloadExcel(
      `expense-claims-${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Expense Claims',
      ['Employee', 'Department', 'Category', 'Description', 'Date', 'Amount', 'Receipt', 'Status'],
      rows
    )
  }

  const downloadGroupExcel = (group: Group) => {
    downloadExcel(
      `${group.employeeName.replace(/\s+/g, '_')}-expense-sheet.xlsx`,
      group.employeeName.slice(0, 31),
      ['Date', 'Category', 'Description', 'Amount', 'Receipt', 'Status'],
      groupExcelRows(group)
    )
  }

  const downloadGroupAll = async (group: Group) => {
    setZippingId(group.employeeId)
    try {
      const excelBlob = buildExcelBlob(group.employeeName.slice(0, 31), ['Date', 'Category', 'Description', 'Amount', 'Receipt', 'Status'], groupExcelRows(group))
      const files: { name: string; blob?: Blob; dataUrl?: string }[] = [
        { name: `${group.employeeName.replace(/\s+/g, '_')}-expense-sheet.xlsx`, blob: excelBlob },
      ]
      for (const [i, c] of group.claims.entries()) {
        if (!c.receipt) continue
        const name = `receipts/${i + 1}-${receiptFileNameFor(c)}`
        try {
          const signedUrl = await api.fetchExpenseReceiptDownloadUrl(c.id)
          const res = await fetch(signedUrl)
          if (!res.ok) throw new Error('Receipt fetch failed')
          files.push({ name, blob: await res.blob() })
        } catch {
          // No real photo on file for this one — bundle the honest
          // placeholder instead of silently dropping it from the zip.
          files.push({ name, dataUrl: placeholderFor(c) })
        }
      }
      await downloadZip(`${group.employeeName.replace(/\s+/g, '_')}-expenses.zip`, files)
    } finally {
      setZippingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Expense Claims</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Review each employee's expense sheet and view receipts — approved claims are sent to the Director for reimbursement</p>
        </div>
        <button onClick={exportAll} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card hover:bg-muted transition-all">
          <FileSpreadsheet size={14} />
          Export All to Excel
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending Approval', value: totals.pending, count: expenses.filter(c => c.status === 'Pending').length, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Approved (with Director)', value: totals.approved, count: expenses.filter(c => c.status === 'Approved').length, color: '#059669', bg: '#ECFDF5' },
          { label: 'Reimbursed', value: totals.reimbursed, count: expenses.filter(c => c.status === 'Reimbursed').length, color: '#4338CA', bg: '#EEF2FF' },
          { label: 'Rejected', value: totals.rejected, count: expenses.filter(c => c.status === 'Rejected').length, color: '#DC2626', bg: '#FEF2F2' },
        ].map(k => (
          <div key={k.label} className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: k.color }}>
              {k.label}
            </p>
            <p className="font-serif text-2xl font-semibold text-foreground">₹{k.value.toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.count} claim{k.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 bg-card rounded-xl border border-border px-4 py-3 flex-wrap">
        <Filter size={14} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Filter:</span>
        <div className="flex gap-2 flex-wrap">
          {['all', 'Pending', 'Approved', 'Rejected', 'Reimbursed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{ backgroundColor: filterStatus === s ? navy : '#F0EDE7', color: filterStatus === s ? '#FAF8F5' : '#7A7065' }}>
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>
        <div className="sm:ml-4 flex gap-2 flex-wrap">
          <button onClick={() => setFilterCategory('all')}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{ backgroundColor: filterCategory === 'all' ? gold : '#F0EDE7', color: filterCategory === 'all' ? navy : '#7A7065' }}>
            All Categories
          </button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCategory(cat)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{ backgroundColor: filterCategory === cat ? gold : '#F0EDE7', color: filterCategory === cat ? navy : '#7A7065' }}>
              {categoryIcon[cat]} {cat}
            </button>
          ))}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleReceiptFileChange}
      />

      {/* Claims grouped by employee — each employee's full expense sheet,
          with every category they used, sits together */}
      <div className="space-y-4">
        {groupedByEmployee.length === 0 && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-8 text-center">
            <p className="text-sm text-muted-foreground">No expense claims match this filter.</p>
          </div>
        )}
        {groupedByEmployee.map(group => {
          const isCollapsed = collapsed.has(group.employeeId)
          const groupTotal = group.claims.reduce((s, c) => s + c.amount, 0)
          const groupCategories = Array.from(new Set(group.claims.map(c => c.category)))
          const photoUrl = employees.find(e => e.id === group.employeeId)?.photoUrl
          return (
            <div key={group.employeeId} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <button onClick={() => toggleCollapsed(group.employeeId)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors">
                {photoUrl ? (
                  <img src={photoUrl} alt={group.employeeName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: `${navy}14`, color: navy }}>
                    {group.employeeName.split(' ').map(n => n[0]).join('')}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{group.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{group.department} · {formatEmpId(group.employeeId)}</p>
                </div>
                <div className="hidden sm:flex flex-wrap gap-1 max-w-[280px] justify-end">
                  {groupCategories.map(cat => (
                    <span key={cat} className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: '#F0EDE7', color: '#7A7065' }}>
                      {categoryIcon[cat]} {cat}
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
                <div className="border-t border-border">
                  {/* Employee details strip */}
                  <div className="px-5 py-3.5 bg-muted/30 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border">
                    {[
                      { label: 'Employee', value: group.employeeName },
                      { label: 'Employee ID', value: formatEmpId(group.employeeId) },
                      { label: 'Department', value: group.department },
                      { label: 'Expense Period', value: expensePeriod(group) },
                      { label: 'Total Amount', value: `₹${groupTotal.toLocaleString('en-IN')}` },
                    ].map(f => (
                      <div key={f.label}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{f.label}</p>
                        <p className="text-xs font-semibold text-foreground mt-0.5">{f.value}</p>
                      </div>
                    ))}
                    <div className="ml-auto flex gap-2">
                      <button onClick={() => downloadGroupExcel(group)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-white hover:bg-muted transition-all" style={{ color: navy }}>
                        <FileSpreadsheet size={12} /> Download Excel
                      </button>
                      <button onClick={() => downloadGroupAll(group)} disabled={zippingId === group.employeeId}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-60" style={{ backgroundColor: navy }}>
                        <Archive size={12} /> {zippingId === group.employeeId ? 'Zipping…' : 'Download All'}
                      </button>
                    </div>
                  </div>

                  {/* Excel-style expense sheet */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px]">
                      <thead>
                        <tr className="border-b border-border">
                          {['Date', 'Category', 'Description', 'Amount', 'Receipt', 'Status', 'Actions'].map(h => (
                            <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.claims.map((c, i) => {
                          const sc = statusColor[c.status]
                          return (
                            <tr key={c.id} className={`border-b border-border last:border-0 hover:bg-muted/40 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                              <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">{c.date}</td>
                              <td className="px-5 py-4">
                                <span className="text-xs font-medium text-foreground whitespace-nowrap">{categoryIcon[c.category]} {c.category}</span>
                              </td>
                              <td className="px-5 py-4">
                                <p className="text-xs text-foreground max-w-[200px] leading-tight">{c.description}</p>
                                {c.note && <p className="text-xs text-muted-foreground mt-0.5 italic">{c.note}</p>}
                              </td>
                              <td className="px-5 py-4">
                                <p className="text-sm font-semibold text-foreground whitespace-nowrap">₹{c.amount.toLocaleString('en-IN')}</p>
                              </td>
                              <td className="px-5 py-4">
                                {c.receipt ? (
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => viewReceipt(c)}
                                      className="w-9 h-9 rounded-lg overflow-hidden border border-border shrink-0 hover:ring-2 hover:ring-accent/40 transition-all flex items-center justify-center bg-muted/40" title="View receipt">
                                      <Eye size={14} className="text-muted-foreground" />
                                    </button>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[10px] text-muted-foreground max-w-[100px] truncate">{c.receiptFileName || 'Attached'}</span>
                                      <button onClick={() => downloadReceipt(c)}
                                        className="flex items-center gap-1 text-[10px] font-medium hover:underline" style={{ color: navy }}>
                                        <Download size={10} /> Download
                                      </button>
                                      <button onClick={() => triggerReceiptUpload(c.id)} disabled={uploadingId === c.id}
                                        className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">
                                        <RefreshCw size={10} /> {uploadingId === c.id ? 'Uploading…' : 'Replace'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => triggerReceiptUpload(c.id)} disabled={uploadingId === c.id}
                                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-dashed transition-colors hover:bg-muted disabled:opacity-60"
                                    style={{ borderColor: '#E5DFD5', color: '#7A7065' }}>
                                    <Upload size={12} />
                                    {uploadingId === c.id ? 'Uploading…' : 'Upload'}
                                  </button>
                                )}
                              </td>
                              <td className="px-5 py-4">
                                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{c.status}</span>
                                {c.approvedBy && <p className="text-[10px] text-muted-foreground mt-0.5">by {c.approvedBy}</p>}
                                {c.reimbursedOn && <p className="text-[10px] text-muted-foreground">{c.reimbursedOn}</p>}
                              </td>
                              <td className="px-5 py-4">
                                {c.status === 'Pending' && (
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <button onClick={() => approve(c)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                                        style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                                        <Check size={11} /> Approve
                                      </button>
                                      <button onClick={() => setShowNoteFor(showNoteFor === c.id ? null : c.id)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                                        style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                                        <X size={11} /> Reject
                                      </button>
                                    </div>
                                    {showNoteFor === c.id && (
                                      <div className="flex flex-col gap-1">
                                        <input value={noteMap[c.id] || ''} onChange={e => setNoteMap(p => ({ ...p, [c.id]: e.target.value }))}
                                          placeholder="Reason for rejection…"
                                          className="text-xs px-2 py-1 rounded border border-border bg-muted w-36 focus:outline-none" />
                                        <button onClick={() => reject(c)} className="text-xs text-red-600 font-medium underline text-left">Confirm reject</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {c.status === 'Approved' && (
                                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                    <DollarSign size={11} /> Sent to Director
                                  </span>
                                )}
                                {(c.status === 'Reimbursed' || c.status === 'Rejected') && (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Receipt preview lightbox */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5"><Eye size={14} /> Receipt Preview</p>
                <p className="text-xs text-muted-foreground truncate">{preview.claim.employeeName} — {preview.claim.category} — {preview.claim.date}</p>
                {preview.isPlaceholder && (
                  <p className="text-[10px] text-amber-600 mt-0.5">No original photo on file for this claim — showing a placeholder.</p>
                )}
              </div>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0" aria-label="Close preview">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-muted/40 flex items-center justify-center p-4">
              <img src={preview.url} alt="Receipt preview" className="max-w-full max-h-[60vh] rounded-lg shadow-sm" />
            </div>
            <div className="p-3 border-t border-border">
              <button onClick={() => downloadReceipt(preview.claim)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ backgroundColor: navy }}>
                <Download size={14} /> Download Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
