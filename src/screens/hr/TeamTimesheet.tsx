import { useMemo, useState } from 'react'
import type { Employee, TimesheetEntry } from '../../types'
import { downloadCsv } from '../../lib/csv'
import { ClipboardList, Download } from 'lucide-react'

const navy = '#1C2B4A'
const gold = '#C9A96E'

function dayName(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })
}

interface TeamTimesheetProps {
  employees: Employee[]
  timesheet: TimesheetEntry[]
}

export default function TeamTimesheet({ employees, timesheet }: TeamTimesheetProps) {
  const entries = useMemo(() => [...timesheet].sort((a, b) => b.date.localeCompare(a.date)), [timesheet])
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const nameFor = (employeeId: string) => employees.find(e => e.id === employeeId)?.name || employeeId

  const loggedEmployeeIds = useMemo(() => [...new Set(entries.map(e => e.employeeId))], [entries])
  const datesAvailable = useMemo(() => [...new Set(entries.map(e => e.date))].sort().reverse(), [entries])

  const filtered = entries.filter(e =>
    (!employeeFilter || e.employeeId === employeeFilter) &&
    (!dateFilter || e.date === dateFilter)
  )

  const summary = {
    entries: filtered.length,
    hours: filtered.reduce((sum, e) => sum + (e.totalHours || 0), 0),
    calls: filtered.reduce((sum, e) => sum + (e.callsMade || 0), 0),
    sales: filtered.reduce((sum, e) => sum + (e.salesClosed || 0), 0),
  }

  const handleExport = () => {
    downloadCsv(
      'Team_Timesheet.csv',
      ['Date', 'Day', 'Employee Name', 'Shift Start', 'Shift End', 'Total Hours', 'Leads Assigned', 'Calls Made', 'Connected Calls', 'Follow-Ups Scheduled', 'Client Appointments Set', 'Sales Closed', 'Company-Funded Leads', 'Self-Funded Leads', 'Details of Tasks'],
      filtered.map(e => [
        e.date,
        dayName(e.date),
        nameFor(e.employeeId),
        e.shiftStart,
        e.shiftEnd,
        e.totalHours,
        e.leadsAssigned,
        e.callsMade,
        e.connectedCalls,
        e.followUpsScheduled,
        e.clientAppointmentsSet,
        e.salesClosed,
        e.companyFundedLeads ? 'yes' : '',
        e.selfFundedLeads ? 'yes' : '',
        e.tasks,
      ])
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Team Timesheet</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Daily activity logged by the CRM team — download for HR records anytime.</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: navy, color: '#FAF8F5' }}>
          <Download size={15} /> Download CSV
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Entries', value: summary.entries },
          { title: 'Total Hours', value: summary.hours.toFixed(1) },
          { title: 'Calls Made', value: summary.calls },
          { title: 'Sales Closed', value: summary.sales },
        ].map(s => (
          <div key={s.title} className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="font-serif text-2xl font-bold" style={{ color: navy }}>{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.title}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-3 flex-wrap">
          <ClipboardList size={18} className="text-muted-foreground" />
          <h3 className="font-serif text-lg font-semibold text-foreground">Daily Log</h3>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
              <option value="">All employees</option>
              {loggedEmployeeIds.map(id => <option key={id} value={id}>{nameFor(id)}</option>)}
            </select>
            <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
              <option value="">All dates</option>
              {datesAvailable.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {['Employee', 'Date', 'Day', 'Shift', 'Hours', 'Leads', 'Calls', 'Connected', 'Follow-Ups', 'Appointments', 'Sales Closed', 'Funding', 'Tasks'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: `${navy}14`, color: navy }}>
                        {nameFor(e.employeeId).split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-sm font-semibold text-foreground whitespace-nowrap">{nameFor(e.employeeId)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{dayName(e.date)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{e.shiftStart} – {e.shiftEnd}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.totalHours}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.leadsAssigned}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.callsMade}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.connectedCalls}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.followUpsScheduled}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.clientAppointmentsSet}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.salesClosed}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {e.companyFundedLeads && <span className="px-2 py-0.5 rounded-full mr-1" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>Company</span>}
                    {e.selfFundedLeads && <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>Self</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[260px]">
                    <p className="line-clamp-3" title={e.tasks}>{e.tasks}</p>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={13} className="text-center py-10 text-sm text-muted-foreground">No timesheet entries for this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
