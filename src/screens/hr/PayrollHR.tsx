import { useEffect, useState } from 'react'
import type { PayrollRecord, Employee, AttendanceRecord, LeaveRequest } from '../../types'
import { CreditCard, Check, X, ChevronRight, Download, AlertCircle, Plus } from 'lucide-react'
import { downloadCsv } from '../../lib/csv'
import { computePayslip, cycleForPayMonth } from '../../lib/payslip'
import { downloadPayslipsPdf } from '../../lib/payslipPdf'
import PayslipDocument from '../../components/PayslipDocument'

const navy = '#1C2B4A'
const gold = '#C9A96E'

type FilterTab = 'all' | 'pending-hr' | 'pending-management' | 'disbursed'

const statusLabel: Record<string, string> = {
  'pending-manager': 'Awaiting Manager',
  'pending-hr': 'Pending HR',
  'pending-management': 'Pending Admin',
  'disbursed': 'Disbursed',
}

const statusColor: Record<string, { bg: string; text: string }> = {
  'pending-manager': { bg: '#FFF7ED', text: '#EA580C' },
  'pending-hr': { bg: '#FFFBEB', text: '#D97706' },
  'pending-management': { bg: '#EFF6FF', text: '#2563EB' },
  'disbursed': { bg: '#ECFDF5', text: '#059669' },
}

const PIPELINE = ['pending-manager', 'pending-hr', 'pending-management', 'disbursed']
const PIPELINE_LABELS = ['Manager Approval', 'HR Processing', 'Admin Sign-off', 'Disbursed']

// Group leadership (CEO, Directors) aren't run through this payroll pipeline —
// excluded from the payslip generator's employee picker and the payroll log.
const PAYROLL_EXCLUDED_IDS = ['DF230001', 'DF230002', 'PA230045'] // Neelesh H P, Akshita Raturi, Chaitra

interface PayrollHRProps {
  role?: string
  payroll: PayrollRecord[]
  onPayrollUpdate: (next: PayrollRecord[]) => Promise<void>
  employees: Employee[]
  attendance: AttendanceRecord[]
  leaves: LeaveRequest[]
}

function currentPayMonthInput() {
  return new Date().toISOString().slice(0, 7)
}

export default function PayrollHR({ role, payroll, onPayrollUpdate, employees, attendance, leaves }: PayrollHRProps) {
  const [records, setRecordsLocal] = useState<PayrollRecord[]>(payroll.filter(r => !PAYROLL_EXCLUDED_IDS.includes(r.employeeId)))
  useEffect(() => { setRecordsLocal(payroll.filter(r => !PAYROLL_EXCLUDED_IDS.includes(r.employeeId))) }, [payroll])
  const [saveError, setSaveError] = useState('')
  const setRecords = (updater: PayrollRecord[] | ((prev: PayrollRecord[]) => PayrollRecord[])) => {
    setSaveError('')
    setRecordsLocal(prev => {
      const next = typeof updater === 'function' ? (updater as (prev: PayrollRecord[]) => PayrollRecord[])(prev) : updater
      // onPayrollUpdate now rejects on a failed save (see App.tsx) instead of
      // only logging it — surface that here instead of letting it silently
      // revert on the next refetch with no explanation.
      onPayrollUpdate(next).catch(err => {
        setSaveError(err instanceof Error ? err.message : 'Could not save that payroll change. Please try again.')
      })
      return next
    })
  }
  const [processing, setProcessing] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<FilterTab>('all')
  const [selected, setSelected] = useState<PayrollRecord | null>(null)

  // Generate a new payslip for one employee/cycle. Basic Salary, allowances,
  // and the whole Attendance Summary are all pulled in automatically — HR
  // only ever fills in the handful of per-cycle discretionary amounts.
  const [showGenerate, setShowGenerate] = useState(false)
  const [genEmployeeId, setGenEmployeeId] = useState('')
  const [genPayMonth, setGenPayMonth] = useState(currentPayMonthInput())
  const [genReimbursements, setGenReimbursements] = useState('0')
  const [genIncentives, setGenIncentives] = useState('0')
  const [genBonus, setGenBonus] = useState('0')
  const [genOtherDeductions, setGenOtherDeductions] = useState('0')
  const [genError, setGenError] = useState('')

  const payableEmployees = employees.filter(e => e.status !== 'inactive' && !PAYROLL_EXCLUDED_IDS.includes(e.id))

  function generatePayslip() {
    const employee = employees.find(e => e.id === genEmployeeId)
    if (!employee) { setGenError('Choose an employee.'); return }
    const { periodStart, periodEnd } = cycleForPayMonth(genPayMonth)
    const monthLabel = new Date(`${genPayMonth}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    const already = records.find(r => r.employeeId === employee.id && r.periodEnd === periodEnd)
    if (already) { setGenError(`${employee.name} already has a payslip for this cycle.`); return }

    const draft: PayrollRecord = {
      id: `pr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      employeeId: employee.id,
      employeeName: employee.name,
      role: employee.role,
      month: monthLabel,
      baseSalary: employee.baseSalary || 0,
      incentives: parseFloat(genIncentives) || 0,
      deductions: 0,
      netPay: 0,
      status: 'pending-manager',
      managerApproved: false,
      hrProcessed: false,
      adminApproved: false,
      periodStart,
      periodEnd,
      reimbursements: parseFloat(genReimbursements) || 0,
      bonus: parseFloat(genBonus) || 0,
      otherDeductions: parseFloat(genOtherDeductions) || 0,
    }
    // Run it through the same engine that renders the document, so the
    // stored deductions/netPay always match what the payslip itself shows.
    const computed = computePayslip(employee, draft, attendance, leaves)
    const finalRecord: PayrollRecord = { ...draft, deductions: computed.deductions.totalDeductions, netPay: computed.netSalaryPayable }

    setRecords(prev => [finalRecord, ...prev])
    setShowGenerate(false)
    setGenReimbursements('0'); setGenIncentives('0'); setGenBonus('0'); setGenOtherDeductions('0')
    setGenError('')
    setSelected(finalRecord)
  }

  const doProcess = (id: string) => {
    setProcessing(prev => new Set([...prev, id]))
    setTimeout(() => {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, hrProcessed: true, status: 'pending-management' } : r))
      setProcessing(prev => { const n = new Set(prev); n.delete(id); return n })
      setSelected(prev => prev?.id === id ? { ...prev, hrProcessed: true, status: 'pending-management' } : prev)
    }, 800)
  }

  const processAll = () => {
    const pendingIds = records.filter(r => r.status === 'pending-hr').map(r => r.id)
    pendingIds.forEach(id => doProcess(id))
  }

  const filtered = tab === 'all' ? records : records.filter(r => r.status === tab)

  const exportPaysheet = () => {
    downloadCsv(
      `paysheet-${tab}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Employee', 'Role', 'Month', 'Base Salary', 'Incentives', 'Deductions', 'Net Pay', 'Status'],
      filtered.map(r => [r.employeeName, r.role, r.month, r.baseSalary, r.incentives, r.deductions, r.netPay, statusLabel[r.status]])
    )
  }

  const exportPayslipsPdf = () => {
    const payslips = filtered
      .map(r => {
        const emp = employees.find(e => e.id === r.employeeId)
        return emp ? computePayslip(emp, r, attendance, leaves) : null
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
    if (payslips.length === 0) return
    downloadPayslipsPdf(`Payslips_${tab}_${new Date().toISOString().slice(0, 10)}.pdf`, payslips)
  }

  const pendingHRCount = records.filter(r => r.status === 'pending-hr').length
  const totalPayout = records.reduce((s, r) => s + r.netPay, 0)
  const disbursedPayout = records.filter(r => r.status === 'disbursed').reduce((s, r) => s + r.netPay, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Payroll</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Stage 2 of 3 — HR processes verified records and forwards to Admin</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setGenError(''); setShowGenerate(true) }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all" style={{ backgroundColor: navy }}>
            <Plus size={14} /> Generate Payslip
          </button>
          <button onClick={exportPayslipsPdf} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card hover:bg-muted transition-all">
            <Download size={14} /> Export Payslips (PDF)
          </button>
          <button onClick={exportPaysheet} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card hover:bg-muted transition-all">
            <Download size={14} /> Export Paysheet (CSV)
          </button>
        </div>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
          {saveError}
        </div>
      )}

      {/* Generate Payslip */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowGenerate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-serif text-base font-semibold text-foreground">Generate Payslip</h4>
              <button onClick={() => setShowGenerate(false)}><X size={16} className="text-muted-foreground hover:text-foreground transition-colors" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Employee</label>
                <select value={genEmployeeId} onChange={e => setGenEmployeeId(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
                  <option value="">Choose…</option>
                  {payableEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Pay Month (cycle ends the 20th)</label>
                <input type="month" value={genPayMonth} onChange={e => setGenPayMonth(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">Basic Salary, allowances and the Attendance Summary are pulled in automatically. Fill in only this cycle's extras below.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Reimbursements</label>
                  <input type="number" value={genReimbursements} onChange={e => setGenReimbursements(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Incentives</label>
                  <input type="number" value={genIncentives} onChange={e => setGenIncentives(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Bonus</label>
                  <input type="number" value={genBonus} onChange={e => setGenBonus(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Other Deductions</label>
                  <input type="number" value={genOtherDeductions} onChange={e => setGenOtherDeductions(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
                </div>
              </div>
              {genError && <p className="text-xs font-medium" style={{ color: '#DC2626' }}>{genError}</p>}
              <button onClick={generatePayslip} className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all" style={{ backgroundColor: navy }}>
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline visual */}
      <div className="bg-card rounded-xl border border-border shadow-sm px-8 py-5 overflow-x-auto">
        <div className="flex items-center min-w-[420px]">
          {PIPELINE.map((stage, i) => {
            const count = records.filter(r => r.status === stage).length
            const isCurrent = stage === 'pending-hr'
            return (
              <div key={stage} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 font-bold text-sm transition-all"
                    style={{
                      backgroundColor: i === 0 ? '#ECFDF5' : isCurrent ? navy : i < PIPELINE.indexOf('pending-management') ? '#ECFDF5' : '#F0EDE7',
                      color: i === 0 ? '#059669' : isCurrent ? '#FAF8F5' : i < PIPELINE.indexOf('pending-management') ? '#059669' : '#9CA3AF',
                      boxShadow: isCurrent ? `0 0 0 3px rgba(28,43,74,0.2)` : undefined,
                    }}>
                    {i === 0 ? <Check size={16} /> : i + 1}
                  </div>
                  <p className="text-xs font-semibold text-center" style={{ color: isCurrent ? navy : '#9CA3AF' }}>{PIPELINE_LABELS[i]}</p>
                  {count > 0 && <span className="text-[10px] font-medium mt-0.5" style={{ color: isCurrent ? gold : '#9CA3AF' }}>{count} records</span>}
                </div>
                {i < PIPELINE.length - 1 && (
                  <div className="h-0.5 w-12 shrink-0 -mt-6"
                    style={{ backgroundColor: i < PIPELINE.indexOf('pending-hr') ? '#10B981' : '#E5DFD5' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending HR Action', value: pendingHRCount, note: 'Records to process', color: '#D97706' },
          { label: 'Total Org Payout', value: `₹${(totalPayout / 100000).toFixed(1)}L`, note: 'Gross, all cycles', color: navy },
          { label: 'Disbursed', value: `₹${(disbursedPayout / 100000).toFixed(1)}L`, note: `${records.filter(r => r.status === 'disbursed').length} employees`, color: '#059669' },
          { label: 'Avg Net Pay', value: `₹${(records.length ? Math.round(totalPayout / records.length) : 0).toLocaleString('en-IN')}`, note: 'Per employee', color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{s.label}</p>
            <p className="font-serif text-2xl font-semibold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.note}</p>
          </div>
        ))}
      </div>

      {pendingHRCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
          <AlertCircle size={15} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 flex-1"><strong>{pendingHRCount} payroll record{pendingHRCount > 1 ? 's' : ''}</strong> require HR processing before Admin can sign off.</p>
          <button onClick={processAll}
            className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 whitespace-nowrap"
            style={{ backgroundColor: navy, color: '#FAF8F5' }}>
            Process All ({pendingHRCount})
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Records list */}
        <div className="flex-1 min-w-0 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Filter tabs */}
          <div className="border-b border-border px-4 flex flex-wrap gap-0">
            {(['all', 'pending-hr', 'pending-management', 'disbursed'] as FilterTab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="py-3.5 px-4 text-xs font-medium border-b-2 -mb-px transition-colors"
                style={{ borderColor: tab === t ? gold : 'transparent', color: tab === t ? navy : '#7A7065' }}>
                {t === 'all' ? 'All Records' : statusLabel[t]}
                <span className="ml-1.5 text-[10px] font-bold opacity-60">
                  ({t === 'all' ? records.length : records.filter(r => r.status === t).length})
                </span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {['Employee', 'Base Salary', 'Incentives', 'Deductions', 'Net Pay', 'Status', 'Action'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(rec => {
                  const sc = statusColor[rec.status]
                  const isProc = processing.has(rec.id)
                  return (
                    <tr key={rec.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setSelected(selected?.id === rec.id ? null : rec)}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: `${navy}14`, color: navy }}>
                            {rec.employeeName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{rec.employeeName}</p>
                            <p className="text-xs text-muted-foreground capitalize">{rec.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground">₹{rec.baseSalary.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-4 text-sm font-medium" style={{ color: '#059669' }}>+₹{rec.incentives.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-4 text-sm font-medium" style={{ color: '#DC2626' }}>−₹{rec.deductions.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-foreground">₹{rec.netPay.toLocaleString('en-IN')}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: sc.bg, color: sc.text }}>
                          {statusLabel[rec.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        {rec.status === 'pending-hr' ? (
                          <button onClick={() => doProcess(rec.id)} disabled={isProc}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-60"
                            style={{ backgroundColor: gold, color: navy }}>
                            <CreditCard size={12} />
                            {isProc ? 'Processing…' : 'Process'}
                          </button>
                        ) : (
                          <button className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setSelected(selected?.id === rec.id ? null : rec)}>
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payslip panel — the real document, computed live from attendance/
            leave data plus the salary structure and this cycle's extras. */}
        {selected && (() => {
          const selEmployee = employees.find(e => e.id === selected.employeeId)
          return (
            <div className="w-full lg:w-[400px] shrink-0">
              <div className="sticky top-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-base font-semibold text-foreground">Payslip Preview</h4>
                  <button onClick={() => setSelected(null)}>
                    <X size={15} className="text-muted-foreground hover:text-foreground transition-colors" />
                  </button>
                </div>
                {selEmployee ? (
                  <PayslipDocument data={computePayslip(selEmployee, selected, attendance, leaves)} />
                ) : (
                  <div className="bg-card rounded-xl border border-border shadow-sm p-5 text-sm text-muted-foreground">
                    Could not find this employee's record.
                  </div>
                )}
                {selected.status === 'pending-hr' && (
                  <button onClick={() => { doProcess(selected.id); setSelected(null) }}
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={{ backgroundColor: gold, color: navy }}>
                    Process This Payslip
                  </button>
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}