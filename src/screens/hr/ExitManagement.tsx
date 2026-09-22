import { useEffect, useState } from 'react'
import type { ExitRecord, ExitType, ExitStatus } from '../../types'
import { DoorOpen, Check, Calendar, FileText, Plus, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'

const navy = '#1C2B4A'
const gold = '#C9A96E'

const statusColor: Record<ExitStatus, { bg: string; text: string }> = {
  'Notice Period': { bg: '#FFF7ED', text: '#EA580C' },
  'Clearance Pending': { bg: '#FFFBEB', text: '#D97706' },
  'Exit Interview Done': { bg: '#EFF6FF', text: '#2563EB' },
  'Completed': { bg: '#ECFDF5', text: '#059669' },
}

const STATUS_FLOW: ExitStatus[] = ['Notice Period', 'Clearance Pending', 'Exit Interview Done', 'Completed']

const NEW_EXIT_DEFAULT = {
  employeeName: '',
  employeeId: '',
  department: '',
  exitType: 'Resignation' as ExitType,
  resignationDate: '',
  lastWorkingDay: '',
  noticePeriodDays: 30,
  reason: '',
}

interface ExitManagementProps {
  exits: ExitRecord[]
  onExitsUpdate: (next: ExitRecord[]) => void
}

export default function ExitManagement({ exits, onExitsUpdate }: ExitManagementProps) {
  const [records, setRecordsLocal] = useState<ExitRecord[]>(exits)
  useEffect(() => { setRecordsLocal(exits) }, [exits])
  const setRecords = (updater: ExitRecord[] | ((prev: ExitRecord[]) => ExitRecord[])) => {
    setRecordsLocal(prev => {
      const next = typeof updater === 'function' ? (updater as (prev: ExitRecord[]) => ExitRecord[])(prev) : updater
      onExitsUpdate(next)
      return next
    })
  }
  const [expanded, setExpanded] = useState<string | null>(records[0]?.id || null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(NEW_EXIT_DEFAULT)

  const toggleClearance = (recordId: string, idx: number) => {
    setRecords(prev => prev.map(r => {
      if (r.id !== recordId) return r
      const checklist = r.clearanceChecklist.map((item, i) => i === idx ? { ...item, done: !item.done } : item)
      return { ...r, clearanceChecklist: checklist }
    }))
  }

  const markInterviewDone = (recordId: string) => {
    setRecords(prev => prev.map(r => r.id !== recordId ? r : { ...r, exitInterviewDone: true, status: 'Exit Interview Done' }))
  }

  const advanceStatus = (recordId: string) => {
    setRecords(prev => prev.map(r => {
      if (r.id !== recordId) return r
      const idx = STATUS_FLOW.indexOf(r.status)
      const next = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)]
      return { ...r, status: next }
    }))
  }

  const processFnF = (recordId: string) => {
    setRecords(prev => prev.map(r => r.id !== recordId ? r : { ...r, fnfStatus: 'Processed' }))
  }

  const addExit = () => {
    if (!form.employeeName || !form.resignationDate || !form.lastWorkingDay) return
    const newRecord: ExitRecord = {
      id: `exit-${Date.now()}`,
      employeeId: `emp-new-${Date.now()}`,
      employeeName: form.employeeName,
      role: 'agent',
      department: form.department || 'Sales',
      exitType: form.exitType,
      resignationDate: form.resignationDate,
      lastWorkingDay: form.lastWorkingDay,
      noticePeriodDays: form.noticePeriodDays,
      status: 'Notice Period',
      clearanceChecklist: [
        { label: 'Laptop & Equipment Return', done: false, owner: 'IT' },
        { label: 'Access Card & Keys', done: false, owner: 'Admin' },
        { label: 'Knowledge Transfer', done: false, owner: 'Manager' },
        { label: 'CRM Data Handover', done: false, owner: 'Team Lead' },
        { label: 'Finance Dues Cleared', done: false, owner: 'Finance' },
        { label: 'Exit Interview', done: false, owner: 'HR' },
      ],
      exitInterviewDone: false,
      fnfAmount: undefined,
      fnfStatus: 'Pending',
      reason: form.reason,
      rehireEligible: undefined,
    }
    setRecords(prev => [newRecord, ...prev])
    setExpanded(newRecord.id)
    setShowAddForm(false)
    setForm(NEW_EXIT_DEFAULT)
  }

  const activeRecords = records.filter(r => r.status !== 'Completed')
  const completedRecords = records.filter(r => r.status === 'Completed')

  const renderRecord = (r: ExitRecord) => {
    const isExpanded = expanded === r.id
    const sc = statusColor[r.status]
    const clearanceDone = r.clearanceChecklist.filter(c => c.done).length
    const clearanceTotal = r.clearanceChecklist.length
    const clearancePct = Math.round((clearanceDone / clearanceTotal) * 100)
    const statusIdx = STATUS_FLOW.indexOf(r.status)
    const nextStatus = STATUS_FLOW[statusIdx + 1]

    return (
      <div key={r.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Header row */}
        <button className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors"
          onClick={() => setExpanded(isExpanded ? null : r.id)}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ backgroundColor: `${navy}14`, color: navy }}>
            {r.employeeName.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-foreground">{r.employeeName}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{r.status}</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{r.exitType}</span>
            </div>
            <p className="text-xs text-muted-foreground">{r.department} · LWD: {r.lastWorkingDay} · Notice: {r.noticePeriodDays} days</p>
          </div>
          <div className="flex items-center gap-4 mr-2">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Clearance</p>
              <p className="text-sm font-semibold text-foreground">{clearancePct}%</p>
            </div>
            {r.fnfAmount && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">FnF</p>
                <p className="text-sm font-semibold text-foreground">₹{r.fnfAmount.toLocaleString('en-IN')}</p>
              </div>
            )}
          </div>
          {isExpanded ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
        </button>

        {isExpanded && (
          <div className="border-t border-border">
            {/* Status pipeline */}
            <div className="px-5 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                {STATUS_FLOW.map((s, i) => (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <div className="flex-1 flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${i <= statusIdx ? 'text-white' : 'text-muted-foreground'}`}
                        style={{ backgroundColor: i <= statusIdx ? navy : '#E5DFD5' }}>
                        {i < statusIdx ? <Check size={12} /> : i + 1}
                      </div>
                      <span className="text-[9px] text-center font-medium" style={{ color: i <= statusIdx ? navy : '#9CA3AF' }}>{s}</span>
                    </div>
                    {i < STATUS_FLOW.length - 1 && (
                      <div className="h-0.5 flex-1 mb-4" style={{ backgroundColor: i < statusIdx ? navy : '#E5DFD5' }} />
                    )}
                  </div>
                ))}
              </div>
              {nextStatus && r.status !== 'Completed' && (
                <div className="mt-3 flex justify-end">
                  <button onClick={() => advanceStatus(r.id)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: navy, color: '#FAF8F5' }}>
                    Advance to: {nextStatus}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
              {/* Clearance checklist */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-serif text-sm font-semibold text-foreground">Clearance Checklist</h4>
                  <span className="text-xs font-medium text-muted-foreground">{clearanceDone}/{clearanceTotal} done</span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
                  <div className="h-full rounded-full transition-all" style={{ width: `${clearancePct}%`, backgroundColor: clearancePct === 100 ? '#059669' : gold }} />
                </div>
                <div className="space-y-2.5">
                  {r.clearanceChecklist.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <button onClick={() => r.status !== 'Completed' && toggleClearance(r.id, i)}
                        className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all ${r.status === 'Completed' ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}
                        style={{ borderColor: item.done ? '#059669' : '#E5DFD5', backgroundColor: item.done ? '#059669' : 'transparent' }}>
                        {item.done && <Check size={11} color="white" />}
                      </button>
                      <div className="flex-1">
                        <p className={`text-xs font-medium ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.owner}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panel: exit interview + FnF + details */}
              <div className="p-5 space-y-5">
                {/* Details */}
                <div>
                  <h4 className="font-serif text-sm font-semibold text-foreground mb-2">Exit Details</h4>
                  <div className="space-y-1.5">
                    {[
                      ['Resignation Date', r.resignationDate],
                      ['Last Working Day', r.lastWorkingDay],
                      ['Notice Period', `${r.noticePeriodDays} days`],
                      ['Exit Type', r.exitType],
                      ...(r.reason ? [['Reason', r.reason]] : []),
                      ...(r.rehireEligible !== undefined ? [['Rehire Eligible', r.rehireEligible ? 'Yes' : 'No']] : []),
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-xs font-medium text-foreground text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exit interview */}
                <div className="rounded-xl border border-border p-4" style={{ backgroundColor: r.exitInterviewDone ? '#ECFDF5' : '#FFFBEB' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={14} style={{ color: r.exitInterviewDone ? '#059669' : '#D97706' }} />
                      <p className="text-xs font-semibold" style={{ color: r.exitInterviewDone ? '#059669' : '#D97706' }}>
                        Exit Interview {r.exitInterviewDone ? 'Completed' : 'Pending'}
                      </p>
                    </div>
                    {!r.exitInterviewDone && r.status !== 'Completed' && (
                      <button onClick={() => markInterviewDone(r.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                        style={{ backgroundColor: gold, color: navy }}>
                        Mark Done
                      </button>
                    )}
                  </div>
                </div>

                {/* FnF */}
                {r.fnfAmount !== undefined && (
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-foreground">Full & Final Settlement</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.fnfStatus === 'Processed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {r.fnfStatus}
                      </span>
                    </div>
                    <p className="font-serif text-xl font-semibold text-foreground mb-2">₹{r.fnfAmount.toLocaleString('en-IN')}</p>
                    {r.fnfStatus === 'Pending' && (
                      <button onClick={() => processFnF(r.id)}
                        className="w-full py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                        style={{ backgroundColor: navy, color: '#FAF8F5' }}>
                        Process FnF Payment
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Exit Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage employee offboarding, clearance, interviews, and full & final settlement</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: navy, color: '#FAF8F5' }}>
          <Plus size={16} /> Initiate Exit
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-serif text-lg font-semibold text-foreground mb-4">Initiate New Exit</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Employee Name *</label>
              <input value={form.employeeName} onChange={e => setForm(p => ({ ...p, employeeName: e.target.value }))}
                placeholder="Full name"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none focus:ring-1 focus:ring-accent/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Department</label>
              <input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                placeholder="e.g. Sales"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none focus:ring-1 focus:ring-accent/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Exit Type</label>
              <select value={form.exitType} onChange={e => setForm(p => ({ ...p, exitType: e.target.value as ExitType }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none">
                {['Resignation', 'Retirement', 'Termination', 'Contract End'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Resignation Date *</label>
              <input type="date" value={form.resignationDate} onChange={e => setForm(p => ({ ...p, resignationDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Last Working Day *</label>
              <input type="date" value={form.lastWorkingDay} onChange={e => setForm(p => ({ ...p, lastWorkingDay: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notice Period (days)</label>
              <input type="number" value={form.noticePeriodDays} onChange={e => setForm(p => ({ ...p, noticePeriodDays: +e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Reason (optional)</label>
              <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Brief reason for exit…"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={addExit}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: navy, color: '#FAF8F5' }}>
              Create Exit Record
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="px-5 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active exits */}
      {activeRecords.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">Active Exits ({activeRecords.length})</h3>
          </div>
          {activeRecords.map(renderRecord)}
        </div>
      )}

      {/* Completed exits */}
      {completedRecords.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-emerald-500" />
            <h3 className="text-sm font-semibold text-muted-foreground">Completed ({completedRecords.length})</h3>
          </div>
          {completedRecords.map(renderRecord)}
        </div>
      )}

      {records.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-16 text-center">
          <DoorOpen size={36} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">No exit records. Click "Initiate Exit" to begin.</p>
        </div>
      )}
    </div>
  )
}
