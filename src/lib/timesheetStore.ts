// Timesheet entries themselves are real backend data now (see src/lib/api.ts's
// fetch/create/updateTimesheetEntry, wired up centrally in App.tsx) — this
// file used to hold a localStorage-backed store plus a hardcoded seed of one
// employee's real September entries so the screen wasn't empty on first
// load. Both are gone now that the real backend is the source of truth; all
// that's left here is this pure formatting helper, still used by
// MyTimesheet.tsx to show/derive total hours from a shift's start/end time.
export function computeHours(shiftStart: string, shiftEnd: string): number {
  const parse = (t: string): number | null => {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i)
    if (!m) return null
    let h = Number(m[1])
    const min = Number(m[2])
    const ampm = m[3]?.toLowerCase()
    if (ampm === 'pm' && h !== 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
    return h + min / 60
  }
  const start = parse(shiftStart)
  const end = parse(shiftEnd)
  if (start === null || end === null) return 0
  const diff = end - start
  return Math.round((diff < 0 ? diff + 24 : diff) * 100) / 100
}
