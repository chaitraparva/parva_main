import { useEffect, useState } from 'react'
import type { PayrollRecord, Employee, AttendanceRecord, LeaveRequest } from '../../types'
import { CreditCard, Check, X, ChevronRight, Download, AlertCircle, Plus, Pencil, Trash2 } from 'lucide-react'
import { downloadCsv } from '../../lib/csv'
import { computePayslip, cycleForPayMonth } from '../../lib/payslip'
import { downloadPayslipsPdf } from '../../lib/payslipPdf'
import PayslipDocument from '../../components/PayslipDocument'

const navy = '#1C2B4A'
const gold = '#C9A96E'

// 'sent' = payslip HR has sent to the employee; 'unsent' = older records that were never sent.
type FilterTab = 'all' | 'sent' | 'unsent'

const statusLabel: Record<string, string> = {
  'pending-manager': 'Not sent yet',
  'pending-hr': 'Not sent yet',
  'pending-management': 'Not sent yet',
  'rejected': 'Not sent yet',
  'disbursed': 'Sent to employee',
}

const statusColor: Record<string, { bg: string; text: string }> = {
  'pending-manager': { bg: '#FFF7ED', text: '#EA580C' },
  'pending-hr': { bg: '#FFFBEB', text: '#D97706' },
  'pending-management': { bg: '#EFF6FF', text: '#2563EB' },
  'disbursed': { bg: '#ECFDF5', text: '#059669' },
  'rejected': { bg: '#FEF2F2', text: '#DC2626' },
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
  onPayrollDelete: (id: string) => Promise<void>
  employees: Employee[]
  attendance: AttendanceRecord[]
  leaves: LeaveRequest[]
}

function currentPayMonthInput() {
  return new Date().toISOString().slice(0, 7)
}

export default function PayrollHR({ role, payroll, onPayrollUpdate, onPayrollDelete, employees, attendance, leaves }: PayrollHRProps) {
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
      // Generating a payslip sends it straight to the employee — there is no
      // manager / admin / finance approval any more.
      status: 'disbursed',
      managerApproved: false,
      hrProcessed: true,
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

  // ───────── Edit / delete a payslip ─────────
  // Basic salary and this cycle's extras can be changed; deductions and net pay
  // are recomputed the same way as when the payslip was generated. The
  // employee, month and attendance can't be edited here — to change those,
  // delete the payslip and generate it again.
  const [editing, setEditing] = useState<PayrollRecord | null>(null)
  const [editBase, setEditBase] = useState('0')
  const [editReimbursements, setEditReimbursements] = useState('0')
  const [editIncentives, setEditIncentives] = useState('0')
  const [editBonus, setEditBonus] = useState('0')
  const [editOtherDeductions, setEditOtherDeductions] = useState('0')
  const [editError, setEditError] = useState('')

  function startEdit(rec: PayrollRecord) {
    setEditing(rec)
    setEditBase(String(rec.baseSalary || 0))
    setEditReimbursements(String(rec.reimbursements || 0))
    setEditIncentives(String(rec.incentives || 0))
    setEditBonus(String(rec.bonus || 0))
    setEditOtherDeductions(String(rec.otherDeductions || 0))
    setEditError('')
  }

  function saveEdit() {
    if (!editing) return
    const employee = employees.find(e => e.id === editing.employeeId)
    if (!employee) { setEditError('Could not find this employee.'); return }
    const nums = [editBase, editReimbursements, editIncentives, editBonus, editOtherDeductions].map(v => parseFloat(v))
    if (nums.some(n => Number.isNaN(n) || n < 0)) { setEditError('Please enter valid amounts (0 or more).'); return }
    const [baseSalary, reimbursements, incentives, bonus, otherDeductions] = nums
    const updated: PayrollRecord = { ...editing, baseSalary, reimbursements, incentives, bonus, otherDeductions }
    const computed = computePayslip(employee, updated, attendance, leaves)
    const finalRecord: PayrollRecord = { ...updated, deductions: computed.deductions.totalDeductions, netPay: computed.netSalaryPayable }
    setRecords(prev => prev.map(r => r.id === finalRecord.id ? finalRecord : r))
    setSelected(prev => prev?.id === finalRecord.id ? finalRecord : prev)
    setEditing(null)
  }

  async function deletePayslip(rec: PayrollRecord) {
    const sent = rec.status === 'disbursed'
    if (!window.confirm(`Delete ${rec.employeeName}'s payslip for ${rec.month}?${sent ? ' It has already been sent, so the employee will no longer see it.' : ''} This cannot be undone.`)) return
    setSaveError('')
    try {
      await onPayrollDelete(rec.id)
      setSelected(prev => prev?.id === rec.id ? null : prev)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not delete that payslip. Please try again.')
    }
  }

  // Older records that were generated before payslips were sent straight away.
  const sendToEmployee = (id: string) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, hrProcessed: true, status: 'disbursed' as const } : r))
    setSelected(prev => prev?.id === id ? { ...prev, hrProcessed: true, status: 'disbursed' as const } : prev)
  }

  const sendAll = () => {
    records.filter(r => r.status !== 'disbursed').forEach(r => sendToEmployee(r.id))
  }

  const filtered = tab === 'all' ? records : tab === 'sent' ? records.filter(r => r.status === 'disbursed') : records.filter(r => r.status !== 'disbursed')

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

  const unsentCount = records.filter(r => r.status !== 'disbursed').length
  const sentCount = records.length - unsentCount
  const totalPayout = records.reduce((s, r) => s + r.netPay, 0)
  const disbursedPayout = records.filter(r => r.status === 'disbursed').reduce((s, r) => s + r.netPay, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Payroll</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Generate a payslip and it is sent straight to the employee. Only HR can see everyone\'s payslips.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setGenError(''); setShowGenerate(true) }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all" style={{ backgroundColor: navy }}>
            <Plus size={14} /> Generate &amp; Send Payslip
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

      {/* Edit Payslip */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-serif text-base font-semibold text-foreground">Edit Payslip</h4>
              <button onClick={() => setEditing(null)}><X size={16} className="text-muted-foreground hover:text-foreground transition-colors" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{editing.employeeName} · {editing.month}</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['Basic Salary', editBase, setEditBase],
                ['Reimbursements', editReimbursements, setEditReimbursements],
                ['Incentives', editIncentives, setEditIncentives],
                ['Bonus', editBonus, setEditBonus],
                ['Other Deductions', editOtherDeductions, setEditOtherDeductions],
              ] as [string, string, (v: string) => void][]).map(([label, value, set]) => (
                <div key={label}>
                  <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                  <input type="number" min="0" value={value} onChange={e => set(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">Deductions and net pay are worked out again when you save. To change the employee or month, delete this payslip and generate a new one.{editing.status === 'disbursed' ? ' The employee will see the updated payslip.' : ''}</p>
            {editError && <p className="text-xs font-medium mt-2" style={{ color: '#DC2626' }}>{editError}</p>}
            <button onClick={saveEdit} className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold text-white transition-all" style={{ backgroundColor: navy }}>
              Save changes
            </button>
          </div>
        </div>
      )}

      {/* Generate Payslip */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowGenerate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-serif text-base font-semibold text-foreground">Generate &amp; Send Payslip</h4>
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
              <p className="text-[11px] text-muted-foreground">The payslip goes straight to the employee and cannot be edited afterwards.</p>
              <button onClick={generatePayslip} className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all" style={{ backgroundColor: navy }}>
                Generate &amp; Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Payslips Sent', value: sentCount, note: 'Delivered to employees', color: '#059669' },
          { label: 'Not Sent Yet', value: unsentCount, note: 'Older records', color: '#D97706' },
          { label: 'Total Net Pay Sent', value: `₹${(disbursedPayout / 100000).toFixed(1)}L`, note: 'All cycles', color: navy },
          { label: 'Avg Net Pay', value: `₹${(records.length ? Math.round(totalPayout / records.length) : 0).toLocaleString('en-IN')}`, note: 'Per payslip', color: '#7C3AED' },
        ].map(c => (
          <div key={c.label} className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{c.label}</p>
            <p className="font-serif text-2xl font-semibold" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.note}</p>
          </div>
        ))}
      </div>

      {unsentCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
          <AlertCircle size={15} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 flex-1"><strong>{unsentCount} older payslip{unsentCount > 1 ? 's' : ''}</strong> {unsentCount > 1 ? 'were' : 'was'} generated before and {unsentCount > 1 ? 'have' : 'has'} not been sent to the employee.</p>
          <button onClick={sendAll}
            className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 whitespace-nowrap"
            style={{ backgroundColor: navy, color: '#FAF8F5' }}>
            Send All ({unsentCount})
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Records list */}
        <div className="flex-1 min-w-0 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Filter tabs */}
          <div className="border-b border-border px-4 flex flex-wrap gap-0">
            {(['all', 'sent', 'unsent'] as FilterTab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="py-3.5 px-4 text-xs font-medium border-b-2 -mb-px transition-colors"
                style={{ borderColor: tab === t ? gold : 'transparent', color: tab === t ? navy : '#7A7065' }}>
                {t === 'all' ? 'All Payslips' : t === 'sent' ? 'Sent' : 'Not sent yet'}
                <span className="ml-1.5 text-[10px] font-bold opacity-60">
                  ({t === 'all' ? records.length : t === 'sent' ? sentCount : unsentCount})
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
                      <td className="px-5 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {rec.status !== 'disbursed' ? (
                          <button onClick={() => sendToEmployee(rec.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all hover:opacity-90"
                            style={{ backgroundColor: gold, color: navy }}>
                            <CreditCard size={12} /> Send to employee
                          </button>
                        ) : (
                          <button className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setSelected(selected?.id === rec.id ? null : rec)}>
                            <ChevronRight size={16} />
                          </button>
                        )}
                        <button onClick={() => startEdit(rec)} className="ml-1 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Edit payslip" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deletePayslip(rec)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50" aria-label="Delete payslip" title="Delete">
                          <Trash2 size={14} />
                        </button>
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
                <div className="flex gap-2">
                  <button onClick={() => startEdit(selected)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border border-border bg-card hover:bg-muted">
                    <Pencil size={14} /> Edit
                  </button>
                  <button onClick={() => deletePayslip(selected)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
                {selected.status !== 'disbursed' && (
                  <button onClick={() => sendToEmployee(selected.id)}
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={{ backgroundColor: gold, color: navy }}>
                    Send to employee
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