import { useState } from 'react'
import type { Employee, TimesheetEntry } from '../../types'
import { computeHours } from '../../lib/timesheetStore'
import { Clock, Save, CheckCircle2, Calendar } from 'lucide-react'

const navy = '#1C2B4A'
const gold = '#C9A96E'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function dayName(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })
}

const emptyForm = (date: string) => ({
  date,
  shiftStart: '9:30 am',
  shiftEnd: '6:00 pm',
  leadsAssigned: '' as string | number,
  callsMade: '' as string | number,
  connectedCalls: '' as string | number,
  followUpsScheduled: '' as string | number,
  clientAppointmentsSet: '' as string | number,
  salesClosed: '' as string | number,
  companyFundedLeads: false,
  selfFundedLeads: false,
  tasks: '',
})

interface MyTimesheetProps {
  employeeId: string
  employees: Employee[]
  timesheet: TimesheetEntry[]
  onSaveEntry: (entry: Omit<TimesheetEntry, 'id' | 'loggedAt'>) => Promise<void>
}

export default function MyTimesheet({ employeeId, employees, timesheet, onSaveEntry }: MyTimesheetProps) {
  const me = employees.find(e => e.id === employeeId)
  const entries = timesheet
    .filter(e => e.employeeId === employeeId)
    .sort((a, b) => b.date.localeCompare(a.date))
  const [form, setForm] = useState(emptyForm(todayIso()))
  const [savedFlash, setSavedFlash] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const loadDay = (date: string) => {
    const existing = entries.find(e => e.date === date)
    if (existing) {
      setForm({
        date: existing.date,
        shiftStart: existing.shiftStart,
        shiftEnd: existing.shiftEnd,
        leadsAssigned: existing.leadsAssigned,
        callsMade: existing.callsMade,
        connectedCalls: existing.connectedCalls,
        followUpsScheduled: existing.followUpsScheduled,
        clientAppointmentsSet: existing.clientAppointmentsSet,
        salesClosed: existing.salesClosed,
        companyFundedLeads: existing.companyFundedLeads,
        selfFundedLeads: existing.selfFundedLeads,
        tasks: existing.tasks,
      })
    } else {
      setForm(emptyForm(date))
    }
    setSavedFlash(false)
  }

  const handleSave = async () => {
    if (!form.date) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSaveEntry({
        employeeId,
        date: form.date,
        shiftStart: form.shiftStart,
        shiftEnd: form.shiftEnd,
        totalHours: computeHours(form.shiftStart, form.shiftEnd),
        leadsAssigned: Number(form.leadsAssigned) || 0,
        callsMade: Number(form.callsMade) || 0,
        connectedCalls: Number(form.connectedCalls) || 0,
        followUpsScheduled: Number(form.followUpsScheduled) || 0,
        clientAppointmentsSet: Number(form.clientAppointmentsSet) || 0,
        salesClosed: Number(form.salesClosed) || 0,
        companyFundedLeads: form.companyFundedLeads,
        selfFundedLeads: form.selfFundedLeads,
        tasks: form.tasks,
      })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2500)
    } catch (err) {
      // Surfaced instead of silently swallowed — a failed save used to look
      // identical to a successful one (see App.tsx's onSaveTimesheetEntry).
      setSaveError(err instanceof Error ? err.message : 'Could not save this entry. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const numField = (label: string, key: keyof typeof form) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <input
        type="number"
        min={0}
        value={form[key] as string | number}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none"
      />
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">My Timesheet</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Log your daily activity — Team Timesheet reports this straight to HR.</p>
      </div>

      {/* Entry form */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Clock size={18} className="text-muted-foreground" />
          <h3 className="font-serif text-base font-semibold text-foreground">Daily Entry</h3>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Date:</span>
            <input
              type="date"
              value={form.date}
              onChange={e => loadDay(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none"
            />
            <span className="text-xs text-muted-foreground">{dayName(form.date)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Shift Start</label>
            <input value={form.shiftStart} onChange={e => setForm(p => ({ ...p, shiftStart: e.target.value }))}
              placeholder="9:30 am"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Shift End</label>
            <input value={form.shiftEnd} onChange={e => setForm(p => ({ ...p, shiftEnd: e.target.value }))}
              placeholder="6:00 pm"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Total Hours</label>
            <div className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted/50 text-foreground font-semibold">
              {computeHours(form.shiftStart, form.shiftEnd) || '—'}
            </div>
          </div>
          {numField('Leads Assigned', 'leadsAssigned')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {numField('Calls Made', 'callsMade')}
          {numField('Connected Calls', 'connectedCalls')}
          {numField('Follow-Ups Scheduled', 'followUpsScheduled')}
          {numField('Client Appointments Set', 'clientAppointmentsSet')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {numField('Sales Closed', 'salesClosed')}
          <label className="flex items-center gap-2 mt-6 text-sm text-foreground">
            <input type="checkbox" checked={form.companyFundedLeads}
              onChange={e => setForm(p => ({ ...p, companyFundedLeads: e.target.checked }))} />
            Company-Funded Leads
          </label>
          <label className="flex items-center gap-2 mt-6 text-sm text-foreground">
            <input type="checkbox" checked={form.selfFundedLeads}
              onChange={e => setForm(p => ({ ...p, selfFundedLeads: e.target.checked }))} />
            Self-Funded Leads
          </label>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Details of Tasks</label>
          <textarea
            value={form.tasks}
            onChange={e => setForm(p => ({ ...p, tasks: e.target.value }))}
            rows={5}
            placeholder="1. ..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none resize-y"
          />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: gold, color: navy }}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save Entry'}
          </button>
          {saveError && <p className="text-xs font-medium" style={{ color: '#DC2626' }}>{saveError}</p>}
          {savedFlash && (
            <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#059669' }}>
              <CheckCircle2 size={15} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Recent entries */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <Calendar size={18} className="text-muted-foreground" />
          <h3 className="font-serif text-lg font-semibold text-foreground">My Recent Entries</h3>
          <span className="ml-auto text-xs text-muted-foreground">{me?.name}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {['Date', 'Day', 'Shift', 'Hours', 'Leads', 'Calls', 'Connected', 'Sales Closed'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => loadDay(e.date)}>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{e.date}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{dayName(e.date)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.shiftStart} – {e.shiftEnd}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.totalHours}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.leadsAssigned}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.callsMade}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.connectedCalls}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.salesClosed}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-sm text-muted-foreground">No entries logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
