import { useEffect, useState } from 'react'
import type { AttendanceRecord, Employee } from '../../types'
import { Calendar, Plus, Check } from 'lucide-react'

const navy = '#1C2B4A'
const gold = '#C9A96E'

const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
  present: { bg: '#ECFDF5', text: '#059669', label: 'Present' },
  absent: { bg: '#FEF2F2', text: '#DC2626', label: 'Absent' },
  late: { bg: '#FFFBEB', text: '#D97706', label: 'Late' },
  'half-day': { bg: '#F5F3FF', text: '#7C3AED', label: 'Half Day' },
}

type AttStatus = 'present' | 'absent' | 'late' | 'half-day'

// Group leadership (CEO, Directors) aren't tracked in day-to-day attendance —
// excluded from this screen's employee picker and log entirely.
const ATTENDANCE_EXCLUDED_IDS = ['DF230001', 'DF230002', 'PA230045'] // Neelesh H P, Akshita Raturi, Chaitra

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
  onAttendanceUpdate: (next: AttendanceRecord[]) => Promise<void>
}

export default function AttendanceHR({ employees, attendance, onAttendanceUpdate }: AttendanceHRProps) {
  const trackedEmployees = employees.filter(e => !ATTENDANCE_EXCLUDED_IDS.includes(e.id))
  const [records, setRecordsLocal] = useState<AttendanceRecord[]>(attendance)
  useEffect(() => { setRecordsLocal(attendance) }, [attendance])
  const setRecords = (updater: AttendanceRecord[] | ((prev: AttendanceRecord[]) => AttendanceRecord[])) => {
    setRecordsLocal(prev => {
      const next = typeof updater === 'function' ? (updater as (prev: AttendanceRecord[]) => AttendanceRecord[])(prev) : updater
      // onAttendanceUpdate now rejects on a failed save (see App.tsx) instead
      // of only logging it — this screen doesn't yet surface that to the UI,
      // so just catch it here to avoid an unhandled-rejection console error;
      // the state still reverts correctly via the refetch in App.tsx either way.
      onAttendanceUpdate(next).catch(() => { })
      return next
    })
  }
  // Defaults to "All dates" / today rather than a fixed demo date — this is
  // live data now, and a hardcoded 2024 date would hide everything by
  // default.
  const todayIso = new Date().toISOString().slice(0, 10)
  const [dateFilter, setDateFilter] = useState('')
  const [showMarkForm, setShowMarkForm] = useState(false)
  const [markForm, setMarkForm] = useState({ employeeName: '', date: todayIso, checkIn: '09:00', checkOut: '18:00', status: 'present' as AttStatus })

  const filtered = records.filter(r => !ATTENDANCE_EXCLUDED_IDS.includes(r.employeeId) && (!dateFilter || r.date === dateFilter))

  const summary = {
    present: filtered.filter(r => r.status === 'present').length,
    absent: filtered.filter(r => r.status === 'absent').length,
    late: filtered.filter(r => r.status === 'late').length,
    halfDay: filtered.filter(r => r.status === 'half-day').length,
  }

  const datesAvailable = [...new Set(records.map(r => r.date))].sort().reverse()

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
  const heatmapYear = heatmapNow.getFullYear()
  const heatmapMonthIndex = heatmapNow.getMonth() // 0-based
  const heatmapMonthLabel = heatmapNow.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const heatmapDaysInMonth = new Date(heatmapYear, heatmapMonthIndex + 1, 0).getDate()
  // JS getDay() is Sun=0..Sat=6; convert to Mon=0..Sun=6 to match the header row.
  const heatmapStartDow = (new Date(heatmapYear, heatmapMonthIndex, 1).getDay() + 6) % 7
  const heatmapToday = heatmapNow.getDate()
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
                {Object.entries(statusStyle).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Present', value: summary.present, bg: statusStyle.present.bg, text: statusStyle.present.text },
          { title: 'Absent', value: summary.absent, bg: statusStyle.absent.bg, text: statusStyle.absent.text },
          { title: 'Late', value: summary.late, bg: statusStyle.late.bg, text: statusStyle.late.text },
          { title: 'Half Day', value: summary.halfDay, bg: statusStyle['half-day'].bg, text: statusStyle['half-day'].text },
        ].map(s => (
          <div key={s.title} className="bg-card rounded-xl border border-border shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-serif text-2xl font-bold"
              style={{ backgroundColor: s.bg, color: s.text }}>
              {s.value}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground">
                {filtered.length > 0 ? `${Math.round((s.value / filtered.length) * 100)}%` : '—'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Daily log */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-4">
          <Calendar size={18} className="text-muted-foreground" />
          <h3 className="font-serif text-lg font-semibold text-foreground">Daily Attendance Log</h3>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Date:</span>
            <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
              <option value="">All dates</option>
              {datesAvailable.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {['Employee', 'Date', 'Check In', 'Check Out', 'Working Hours', 'Status'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(rec => {
                const ss = statusStyle[rec.status]
                return (
                  <tr key={rec.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: `${navy}14`, color: navy }}>
                          {rec.employeeName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-sm font-semibold text-foreground">{rec.employeeName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{rec.date}</td>
                    <td className="px-5 py-4 text-sm font-medium text-foreground">{rec.checkIn || '—'}</td>
                    <td className="px-5 py-4 text-sm font-medium text-foreground">{rec.checkOut || '—'}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{workHours(rec.checkIn, rec.checkOut)}</td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: ss.bg, color: ss.text }}>{ss.label}</span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-sm text-muted-foreground">No records for selected date.</td></tr>
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
        <h3 className="font-serif text-lg font-semibold text-foreground mb-4">{heatmapMonthLabel} — Attendance Heatmap</h3>
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
              const isWeekend = dow >= 5
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
              const presentCount = dayRecords.filter(r => r.status !== 'absent').length
              const rate = presentCount / dayRecords.length
              const bucket = rate >= 0.85 ? 0 : rate >= 0.7 ? 1 : 2
              const col = HEATMAP_COLORS[bucket]
              return (
                <div key={day} className="h-9 rounded-md flex items-center justify-center text-xs font-semibold cursor-default"
                  title={`${Math.round(rate * 100)}% present (${presentCount}/${dayRecords.length} marked)`}
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
            { bg: '#F5F2EC', text: '#E5DFD5', label: 'Weekend' },
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
