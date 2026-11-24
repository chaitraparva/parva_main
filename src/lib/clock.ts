// Time-zone helpers for Login / Logout. The SERVER stamps the real login and
// logout times (server/src/routes/attendance-clock.js) in each employee's own
// office time zone; these helpers only let the screen work out which calendar
// day is "today" there, and show the right local clock — they must stay in
// step with the server's timeZoneForLocation().

export const HALF_DAY_BEFORE_HOUR = 15 // logging out before 3:00 PM local = Half Day
export const NIGHT_SHIFT_FROM_HOUR = 14 // a login from 2:00 PM local is a night shift (logout can be after midnight)

/** "16:00" -> minutes since midnight */
export function minutesOf(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
}

/** The calendar day before `date` (YYYY-MM-DD). */
export function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export type OfficeZone = 'Asia/Dubai' | 'Asia/Kolkata'

export function timeZoneForLocation(location: string | undefined): OfficeZone {
  return /dubai|uae|abu dhabi|sharjah/i.test(location || '') ? 'Asia/Dubai' : 'Asia/Kolkata'
}

export function zoneLabel(zone: OfficeZone): string {
  return zone === 'Asia/Dubai' ? 'Dubai time' : 'India time'
}

function parts(zone: OfficeZone, now: Date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => p.find(x => x.type === t)!.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}`, hour: Number(get('hour')) }
}

/** Today's date (YYYY-MM-DD) and current HH:MM on the wall clock in `zone`. */
export function nowInZone(zone: OfficeZone, now: Date = new Date()) {
  return parts(zone, now)
}

/** "13:30" -> "1:30 PM" */
export function formatClock(hhmm: string): string {
  if (!hhmm) return '—'
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}
