import { useEffect, useState } from 'react'
import type { AttendanceRecord, Employee, LeaveRequest } from '../../types'
import { Calendar, Plus, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import ClockCard from '../../components/ClockCard'
import { ATTENDANCE_EXCLUDED_IDS, buildDayRows, isAbsentGroup, isAttended } from '../../lib/attendanceStatus'
import type { DayRow } from '../../lib/attendanceStatus'
import { formatClock, nowInZone, timeZoneForLocation, zoneLabel } from '../../lib/clock'

const navy = '#1C2B4A'
const gold = '#C9A96E'

const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
  present: { bg: '#ECFDF5', text: '#059669', label: 'Present' },
  absent: { bg: '#FEF2F2', text: '#DC2626', label: 'Absent' },
  late: { bg: '#FFFBEB', text: '#D97706', label: 'Late' },
  'half-day': { bg: '#F5F3FF', text: '#7C3AED', label: 'Half Day' },
}

type AttStatus = 'present' | 'absent' | 'late' | 'half-day'

// Labels/colours for the derived per-day status shown in the log.
const rowStyle: Record<DayRow['status'], { bg: string; text: string; label: string }> = {
  present: { bg: '#ECFDF5', text: '#059669', label: 'Present' },
  wfh: { bg: '#F0F9FF', text: '#0369A1', label: 'Work From Home' },
  'half-day': { bg: '#F5F3FF', text: '#7C3AED', label: 'Half Day' },
  absent: { bg: '#FEF2F2', text: '#DC2626', label: 'Absent' },
  leave: { bg: '#FFFBEB', text: '#D97706', label: 'On Leave' },
}

// Heatmap day-rate buckets: 0 = good (≥85%), 1 = mid (70-84%), 2 = low (<70%)
// — computed live from real attendance records below, not seeded/hardcoded.
const HEATMAP_COLORS = [
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FEE2E2', text: '#991B1B' },
]

interface AttendanceHRProps {
  employees: Employee[]
  attendance: AttendanceRecord[]
  leaves: LeaveRequest[]
  currentEmployeeId: string
  onAttendanceUpdate: (next: AttendanceRecord[]) => Promise<void>
  onAttendanceRefresh: () => Promise<void>
}

export default function AttendanceHR({ employees, attendance, leaves, currentEmployeeId, onAttendanceUpdate, onAttendanceRefresh }: AttendanceHRProps) {
  const trackedEmployees = employees.filter(e => !ATTENDANCE_EXCLUDED_IDS.includes(e.id))
  const [records, setRecordsLocal] = useState<AttendanceRecord[]>(attendance)
  useEffect(() => { setRecordsLocal(attendance) }, [attendance])
  const [saveError, setSaveError] = useState('')
  const setRecords = (updater: AttendanceRecord[] | ((prev: AttendanceRecord[]) => AttendanceRecord[])) => {
    setSaveError('')
    setRecordsLocal(prev => {
      const next = typeof updater === 'function' ? (updater as (prev: AttendanceRecord[]) => AttendanceRecord[])(prev) : updater
      // onAttendanceUpdate rejects on a failed save (see App.tsx) — surface
      // that here instead of letting it silently revert on the next
      // refetch with no explanation.
      onAttendanceUpdate(next).catch(err => {
        setSaveError(err instanceof Error ? err.message : 'Could not save that attendance change. Please try again.')
      })
      return next
    })
  }
  // Defaults to TODAY (not "All dates") so the percentages below are
  // meaningful on load — see percentBase/notMarked just below for why.
  const todayIso = nowInZone(timeZoneForLocation(employees.find(e => e.id === currentEmployeeId)?.location)).date
  const [dateFilter, setDateFilter] = useState(todayIso)
  const [showMarkForm, setShowMarkForm] = useState(false)
  // Which group the cards below filter the list to: everyone, only those who
  // attended (present / work from home / half day), or only the absent.
  const [groupFilter, setGroupFilter] = useState<'all' | 'attended' | 'absent'>('all')
  // Heatmap month being viewed (0 = this month, -1 = last month, ...). Records
  // for every month are kept in the database; this only picks which to show.
  const [heatmapOffset, setHeatmapOffset] = useState(0)
  const [markForm, setMarkForm] = useState({ employeeName: '', date: todayIso, checkIn: '09:00', checkOut: '18:00', status: 'present' as AttStatus })

  // One row per tracked employee for the chosen day. Nobody is ever "not
  // marked": no login that day = Absent (approved leave shows as On Leave).
  const dayRows: DayRow[] = buildDayRows(employees, dateFilter, records, leaves)
  const attendedRows = dayRows.filter(r => isAttended(r.status))
  const absentRows = dayRows.filter(r => isAbsentGroup(r.status))
  const headcount = dayRows.length
  const pct = (n: number) => (headcount > 0 ? `${Math.round((n / headcount) * 100)}%` : '—')
  const shownRows = groupFilter === 'attended' ? attendedRows : groupFilter === 'absent' ? absentRows : dayRows
  const isSunday = new Date(dateFilter + 'T00:00:00').getDay() === 0
  const breakdown = {
    present: dayRows.filter(r => r.status === 'present').length,
    wfh: dayRows.filter(r => r.status === 'wfh').length,
    halfDay: dayRows.filter(r => r.status === 'half-day').length,
    onLeave: dayRows.filter(r => r.status === 'leave').length,
  }

  const markAttendance = () => {
    if (!markForm.employeeName || !markForm.date) return
    const emp = trackedEmployees.find(e => e.name === markForm.employeeName)
    const existing = records.find(r => r.employeeId === (emp?.id || 'x') && r.date === markForm.date)
    if (existing) {
      setRecords(prev => prev.map(r => r.id === existing.id ? { ...r, status: markForm.status, checkIn: markForm.checkIn, checkOut: markForm.checkOut } : r))
    } else {
      const newRec: AttendanceRecord = {
        id: `att-${Date.now()}`,
        employeeId: emp?.id || 'emp-x',
        employeeName: markForm.employeeName,
        date: markForm.date,
        checkIn: markForm.checkIn,
        checkOut: markForm.checkOut,
        status: markForm.status,
      }
      setRecords(prev => [...prev, newRec])
    }
    setShowMarkForm(false)
  }

  const workHours = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return '—'
    const [ih, im] = checkIn.split(':').map(Number)
    const [oh, om] = checkOut.split(':').map(Number)
    const h = ((oh * 60 + om) - (ih * 60 + im)) / 60
    return `${h.toFixed(1)} hrs`
  }

  // Heatmap: the current calendar month, computed live from real attendance
  // records (not a fixed/seeded month — see the Heatmap section below).
  const heatmapNow = new Date()
  const heatmapView = new Date(heatmapNow.getFullYear(), heatmapNow.getMonth() + heatmapOffset, 1)
  const heatmapYear = heatmapView.getFullYear()
  const heatmapMonthIndex = heatmapView.getMonth() // 0-based
  const heatmapMonthLabel = heatmapView.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const heatmapDaysInMonth = new Date(heatmapYear, heatmapMonthIndex + 1, 0).getDate()
  // JS getDay() is Sun=0..Sat=6; convert to Mon=0..Sun=6 to match the header row.
  const heatmapStartDow = (heatmapView.getDay() + 6) % 7
  // Days after "today" are future only when viewing the current month; past
  // months are fully in the past, future months fully in the future.
  const heatmapToday = heatmapOffset === 0 ? heatmapNow.getDate() : heatmapOffset < 0 ? 999 : 0
  const allTrackedRecords = records.filter(r => !ATTENDANCE_EXCLUDED_IDS.includes(r.employeeId))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Attendance</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Daily log, monthly trends, and manual attendance marking</p>
        </div>
        <button onClick={() => setShowMarkForm(!showMarkForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: navy, color: '#FAF8F5' }}>
          <Plus size={15} /> Mark Attendance
        </button>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
          {saveError}
        </div>
      )}

      {/* HR's own Login / Logout / Work From Home */}
      <ClockCard employeeId={currentEmployeeId} employees={employees} attendance={records} onRefresh={onAttendanceRefresh} />

      {/* Mark form */}
      {showMarkForm && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">Mark / Update Attendance</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Employee *</label>
              <select value={markForm.employeeName} onChange={e => setMarkForm(p => ({ ...p, employeeName: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none">
                <option value="">Select…</option>
                {trackedEmployees.map(e => <option key={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date *</label>
              {/* A free date picker, not a dropdown limited to dates that
                  already have a record — otherwise there'd be no way to
                  mark attendance for a brand-new date once this runs on a
                  real (initially empty) database. */}
              <input type="date" value={markForm.date} onChange={e => setMarkForm(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
              <select value={markForm.status} onChange={e => setMarkForm(p => ({ ...p, status: e.target.value as AttStatus }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none">
                {Object.entries(statusStyle).filter(([k]) => k !== 'late').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Check In</label>
              <input type="time" value={markForm.checkIn} onChange={e => setMarkForm(p => ({ ...p, checkIn: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Check Out</label>
              <input type="time" value={markForm.checkOut} onChange={e => setMarkForm(p => ({ ...p, checkOut: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={markAttendance}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: gold, color: navy }}>
              <Check size={14} className="inline mr-1.5" />Save Attendance
            </button>
            <button onClick={() => setShowMarkForm(false)}
              className="px-5 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary cards — each is a button. Percentages are out of the full
          tracked team for the chosen day. Click Attended or Absent to see
          exactly who is in that group in the list below. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {([
          { key: 'all', title: 'Everyone', value: headcount, sub: 'tracked team', bg: '#F3F4F6', text: '#374151', ring: '#9CA3AF' },
          { key: 'attended', title: 'Attended', value: attendedRows.length, sub: pct(attendedRows.length), bg: '#ECFDF5', text: '#059669', ring: '#10B981' },
          { key: 'absent', title: 'Absent', value: absentRows.length, sub: pct(absentRows.length), bg: '#FEF2F2', text: '#DC2626', ring: '#EF4444' },
        ] as const).map(c => (
          <button key={c.key} onClick={() => setGroupFilter(c.key)}
            className="bg-card rounded-xl border shadow-sm p-5 flex items-center gap-4 text-left transition-all hover:shadow-md"
            style={{ borderColor: groupFilter === c.key ? c.ring : undefined, boxShadow: groupFilter === c.key ? `0 0 0 2px ${c.ring}33` : undefined }}
            aria-pressed={groupFilter === c.key}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-serif text-2xl font-bold shrink-0"
              style={{ backgroundColor: c.bg, color: c.text }}>
              {c.value}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{c.title}</p>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Present {breakdown.present} · Work from home {breakdown.wfh} · Half day {breakdown.halfDay}
        {breakdown.onLeave > 0 ? ` · On leave ${breakdown.onLeave}` : ''}. Anyone who hasn't logged in counts as absent.
      </p>

      {/* Daily log */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-4 flex-wrap">
          <Calendar size={18} className="text-muted-foreground" />
          <h3 className="font-serif text-lg font-semibold text-foreground">
            {groupFilter === 'attended' ? 'Who attended' : groupFilter === 'absent' ? 'Who is absent' : 'Daily Attendance Log'}
          </h3>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Date:</span>
            <input type="date" value={dateFilter} max={todayIso}
              onChange={e => e.target.value && setDateFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
          </div>
        </div>
        {isSunday && (
          <div className="px-5 py-2.5 text-xs bg-muted/40 text-muted-foreground border-b border-border">
            Sunday is the weekly off — absent numbers don't apply to this day.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {['Employee', 'Check In', 'Check Out', 'Working Hours', 'Status'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownRows.map(row => {
                const style = rowStyle[row.status]
                const zone = timeZoneForLocation(row.employee.location)
                return (
                  <tr key={row.employee.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: `${navy}14`, color: navy }}>
                          {row.employee.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-foreground">{row.employee.name}</span>
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{zone === 'Asia/Dubai' ? 'Dubai' : 'India'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-foreground" title={row.checkIn ? zoneLabel(zone) : undefined}>{row.checkIn ? formatClock(row.checkIn) : '—'}</td>
                    <td className="px-5 py-4 text-sm font-medium text-foreground" title={row.checkOut ? zoneLabel(zone) : undefined}>{row.checkOut ? formatClock(row.checkOut) : '—'}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{workHours(row.checkIn, row.checkOut)}</td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: style.bg, color: style.text }}>{style.label}</span>
                      {row.note && <span className="ml-2 text-xs text-muted-foreground">{row.note}</span>}
                    </td>
                  </tr>
                )
              })}
              {shownRows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-sm text-muted-foreground">
                  {groupFilter === 'absent' ? 'Nobody is absent on this day.' : groupFilter === 'attended' ? 'Nobody has logged in on this day yet.' : 'No employees to show.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Heatmap — the current month, computed live from real attendance
          records (allTrackedRecords) rather than a fixed/seeded pattern. A
          day with zero records marked yet (very likely early on, for a
          fresh database) shows as "no data" rather than a fabricated rate. */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg font-semibold text-foreground">{heatmapMonthLabel} — Attendance Heatmap</h3>
          <div className="flex items-center gap-1">
            <button onClick={() => setHeatmapOffset(o => o - 1)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Previous month" title="Previous month">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setHeatmapOffset(0)} disabled={heatmapOffset === 0} className="px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40">
              This month
            </button>
            <button onClick={() => setHeatmapOffset(o => Math.min(0, o + 1))} disabled={heatmapOffset >= 0} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40" aria-label="Next month" title="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-1.5 min-w-[420px]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-xs text-center font-semibold text-muted-foreground pb-1">{d}</div>
            ))}
            {Array.from({ length: heatmapStartDow }).map((_, i) => (
              <div key={`pad-${i}`} className="h-9 rounded-md" style={{ backgroundColor: '#FAFAFA' }} />
            ))}
            {Array.from({ length: heatmapDaysInMonth }).map((_, i) => {
              const day = i + 1
              const dow = (heatmapStartDow + i) % 7
              const isWeekend = dow === 6 // Sunday only — Saturday is a working day
              const isFuture = day > heatmapToday
              if (isWeekend) {
                return (
                  <div key={day} className="h-9 rounded-md flex items-center justify-center text-xs"
                    style={{ backgroundColor: '#F5F2EC', color: '#E5DFD5' }}>
                    {day}
                  </div>
                )
              }
              if (isFuture) {
                return (
                  <div key={day} className="h-9 rounded-md flex items-center justify-center text-xs text-muted-foreground/40"
                    style={{ backgroundColor: '#FAFAFA' }}>
                    {day}
                  </div>
                )
              }
              const dateStr = `${heatmapYear}-${String(heatmapMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayRecords = allTrackedRecords.filter(r => r.date === dateStr)
              if (dayRecords.length === 0) {
                return (
                  <div key={day} className="h-9 rounded-md flex items-center justify-center text-xs text-muted-foreground/50 border border-dashed border-border"
                    title="No attendance marked yet">
                    {day}
                  </div>
                )
              }
              // Out of the whole tracked team: anyone who didn't log in is absent.
              const rows = buildDayRows(employees, dateStr, records, leaves)
              const presentCount = rows.filter(r => isAttended(r.status)).length
              const headcount = rows.length
              const rate = headcount > 0 ? presentCount / headcount : 0
              const bucket = rate >= 0.85 ? 0 : rate >= 0.7 ? 1 : 2
              const col = HEATMAP_COLORS[bucket]
              return (
                <div key={day} className="h-9 rounded-md flex items-center justify-center text-xs font-semibold cursor-default"
                  title={`${Math.round(rate * 100)}% present (${presentCount} of ${headcount} team members)`}
                  style={{ backgroundColor: col.bg, color: col.text }}>
                  {day}
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-x-6 gap-y-2 mt-4 justify-end">
          {[
            { col: HEATMAP_COLORS[0], label: '≥85% present' },
            { col: HEATMAP_COLORS[1], label: '70–84%' },
            { col: HEATMAP_COLORS[2], label: '<70%' },
            { bg: '#F5F2EC', text: '#E5DFD5', label: 'Sunday (off)' },
            { bg: '#FFFFFF', text: '#D6D0C4', label: 'No data yet' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-4 h-4 rounded border border-dashed border-border" style={{ backgroundColor: l.bg || l.col?.bg }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
