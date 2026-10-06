import { useEffect, useState } from 'react'
import { LogIn, LogOut, Home, Clock } from 'lucide-react'
import type { AttendanceRecord, Employee } from '../types'
import * as api from '../lib/api'
import { HALF_DAY_BEFORE_HOUR, formatClock, nowInZone, timeZoneForLocation, zoneLabel } from '../lib/clock'

const navy = '#1C2B4A'

interface Props {
  employeeId: string
  employees: Employee[]
  attendance: AttendanceRecord[]
  // Re-fetches attendance from the server after a login/logout so every
  // screen (including HR's) shows the new record straight away.
  onRefresh: () => Promise<void>
}

// Login / Logout / Work From Home for the signed-in person's own day. Used on
// every portal (CRM, Manager, Finance, HR, CEO). The server stamps the time
// in the person's own office time zone — see lib/clock.ts.
export default function ClockCard({ employeeId, employees, attendance, onRefresh }: Props) {
  const me = employees.find(e => e.id === employeeId)
  const zone = timeZoneForLocation(me?.location)
  const [now, setNow] = useState(() => nowInZone(zone))
  useEffect(() => {
    setNow(nowInZone(zone))
    const t = setInterval(() => setNow(nowInZone(zone)), 20_000)
    return () => clearInterval(t)
  }, [zone])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmEarly, setConfirmEarly] = useState(false)

  const today = attendance.find(r => r.employeeId === employeeId && r.date === now.date)
  const loggedIn = !!today && !!today.checkIn && today.status !== 'absent'
  const loggedOut = loggedIn && !!today!.checkOut

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      await onRefresh()
      setConfirmEarly(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const statusText = today?.status === 'half-day' ? 'Half Day' : 'Present'

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-base" style={{ color: navy }}>Today's Attendance</h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Clock size={12} /> {zoneLabel(zone)} · {formatClock(now.time)} · {now.date}
          </p>
        </div>
        {loggedIn && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${today!.workMode === 'wfh' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {today!.workMode === 'wfh' ? 'Working from home' : 'In office'}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">{error}</div>
      )}

      <div className="mt-4">
        {!loggedIn && (
          <div className="flex flex-wrap gap-3">
            <button onClick={() => run(() => api.clockIn('office'))} disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: navy }}>
              <LogIn size={16} /> {busy ? 'Please wait…' : 'Log In'}
            </button>
            <button onClick={() => run(() => api.clockIn('wfh'))} disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold border border-border bg-white transition-all hover:bg-muted disabled:opacity-60"
              style={{ color: navy }}>
              <Home size={16} /> Work From Home
            </button>
          </div>
        )}

        {loggedIn && !loggedOut && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              Logged in at <span className="font-semibold">{formatClock(today!.checkIn)}</span>
            </p>
            {!confirmEarly ? (
              <button
                onClick={() => (now.hour < HALF_DAY_BEFORE_HOUR ? setConfirmEarly(true) : run(() => api.clockOut()))}
                disabled={busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: '#B45309' }}>
                <LogOut size={16} /> {busy ? 'Please wait…' : 'Log Out'}
              </button>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <p className="text-sm text-amber-900 font-medium">
                  Logging out before {HALF_DAY_BEFORE_HOUR - 12}:00 PM will mark today as a Half Day. Log out anyway?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => run(() => api.clockOut())} disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#B45309' }}>
                    {busy ? 'Please wait…' : 'Yes, log out'}
                  </button>
                  <button onClick={() => setConfirmEarly(false)} disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border border-border bg-white">
                    Stay logged in
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {loggedOut && (
          <p className="text-sm text-foreground">
            Logged in <span className="font-semibold">{formatClock(today!.checkIn)}</span> · Logged out{' '}
            <span className="font-semibold">{formatClock(today!.checkOut)}</span> ·{' '}
            <span className={`font-semibold ${today!.status === 'half-day' ? 'text-violet-700' : 'text-emerald-700'}`}>{statusText}</span>
          </p>
        )}
      </div>
    </div>
  )
}
