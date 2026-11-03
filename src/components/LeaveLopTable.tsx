import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FileMinus } from 'lucide-react'
import type { AttendanceRecord, Employee, LeaveRequest } from '../types'
import { computeMonthLeaveLop, monthBounds } from '../lib/leaveLop'
import type { LopDetail } from '../lib/leaveLop'

interface Props {
  employees: Employee[]
  attendance: AttendanceRecord[]
  leaves: LeaveRequest[]
  todayIso: string
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const dayLabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const reasonText: Record<LopDetail['reason'], string> = {
  'no-leave': 'no leave applied',
  'unpaid-leave': 'unpaid leave',
  'half-day': 'half day, no leave for the rest',
}

/** Monthly Leave & LOP summary for HR: every absent working day is either
 * covered by an approved leave or counted as LOP (Loss of Pay). */
export default function LeaveLopTable({ employees, attendance, leaves, todayIso }: Props) {
  const [offset, setOffset] = useState(0)
  const [onlyLop, setOnlyLop] = useState(false)
  const bounds = monthBounds(todayIso, offset)

  const rows = useMemo(
    () => computeMonthLeaveLop(employees, bounds.start, bounds.end, todayIso, attendance, leaves)
      .sort((a, b) => b.lopDays - a.lopDays || a.employee.name.localeCompare(b.employee.name)),
    [employees, bounds.start, bounds.end, todayIso, attendance, leaves],
  )
  const shown = onlyLop ? rows.filter(r => r.lopDays > 0) : rows
  const totalLop = rows.reduce((s, r) => s + r.lopDays, 0)
  const totalLeave = rows.reduce((s, r) => s + r.leaveDays, 0)

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="p-5 border-b border-border flex items-center gap-3 flex-wrap">
        <FileMinus size={18} className="text-muted-foreground" />
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground">Leave &amp; LOP — {bounds.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Absent days covered by an approved leave count as Leave. Absent days with no leave go to LOP (Loss of Pay).
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={onlyLop} onChange={e => setOnlyLop(e.target.checked)} /> Only people with LOP
          </label>
          <button onClick={() => setOffset(o => o - 1)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Previous month" title="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setOffset(0)} disabled={offset === 0} className="px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40">
            This month
          </button>
          <button onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset >= 0} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40" aria-label="Next month" title="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="px-5 py-2.5 text-xs bg-muted/40 text-muted-foreground border-b border-border">
        Total leave days {fmt(totalLeave)} · Total LOP days {fmt(totalLop)}. Sundays are not counted, and today is counted from tomorrow
        (once the day is over). Company holidays are not set in the portal yet — if everyone was off on a holiday, mark them present for it.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              {['Employee', 'Working days', 'Worked', 'Leave', 'LOP', 'LOP dates'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.employee.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors align-top">
                <td className="px-5 py-3 text-sm font-semibold text-foreground">{r.employee.name}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{fmt(r.countedDays)}</td>
                <td className="px-5 py-3 text-sm text-foreground">{fmt(r.workedDays)}</td>
                <td className="px-5 py-3 text-sm" title={r.leave.map(l => `${dayLabel(l.date)}: ${l.type}${l.units === 0.5 ? ' (half day)' : ''}`).join('\n')}>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: r.leaveDays > 0 ? '#FFFBEB' : undefined, color: r.leaveDays > 0 ? '#D97706' : '#9CA3AF' }}>{fmt(r.leaveDays)}</span>
                </td>
                <td className="px-5 py-3 text-sm">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: r.lopDays > 0 ? '#FEF2F2' : undefined, color: r.lopDays > 0 ? '#DC2626' : '#9CA3AF' }}>{fmt(r.lopDays)}</span>
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground">
                  {r.lop.length === 0 ? '—' : r.lop.map(l => (
                    <span key={l.date} className="inline-block mr-2" title={reasonText[l.reason]}>
                      {dayLabel(l.date)}{l.units === 0.5 ? ' (½)' : ''}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                {onlyLop ? 'Nobody has LOP in this month.' : 'No attendance data for this month yet.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
