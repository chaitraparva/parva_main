import type { TimesheetEntry } from '../types'

// ─────────────────────── Timesheet storage (temporary) ───────────────────────
// Same stopgap as src/lib/documentStore.ts: no live backend is connected yet,
// so daily entries are kept in this browser's localStorage until the real
// Postgres backend (already built in server/, not yet connected) takes over.
// Nothing on the two Timesheet screens needs to change when that happens —
// only the read/write functions below.
const STORAGE_KEY = 'parva_timesheets'

function readAll(): TimesheetEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TimesheetEntry[]) : []
  } catch {
    return []
  }
}

function writeAll(entries: TimesheetEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

/** All timesheet entries for one employee, most recent date first. */
export function listEntries(employeeId: string): TimesheetEntry[] {
  return readAll()
    .filter(e => e.employeeId === employeeId)
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** Every entry across every employee, most recent date first — for the Team Timesheet (HR/manager) view. */
export function listAllEntries(): TimesheetEntry[] {
  return readAll().sort((a, b) => b.date.localeCompare(a.date))
}

/** The entry for one employee on one date (YYYY-MM-DD), if it exists. */
export function getEntry(employeeId: string, date: string): TimesheetEntry | undefined {
  return readAll().find(e => e.employeeId === employeeId && e.date === date)
}

/** Creates or overwrites the entry for this employee+date (one entry per employee per day). */
export function saveEntry(entry: Omit<TimesheetEntry, 'id' | 'loggedAt'> & { id?: string }): TimesheetEntry {
  const all = readAll()
  const existingIndex = all.findIndex(e => e.employeeId === entry.employeeId && e.date === entry.date)
  const saved: TimesheetEntry = {
    ...entry,
    id: entry.id || (existingIndex >= 0 ? all[existingIndex].id : `ts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    loggedAt: new Date().toISOString(),
  }
  if (existingIndex >= 0) {
    all[existingIndex] = saved
  } else {
    all.push(saved)
  }
  writeAll(all)
  return saved
}

export function deleteEntry(id: string) {
  writeAll(readAll().filter(e => e.id !== id))
}

function computeHours(shiftStart: string, shiftEnd: string): number {
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

export { computeHours }

// ─────────────────────── Real seed data ───────────────────────
// Suhas S Vasishta's (DF230010) actual daily entries for September 2026, as
// filled in on the team's shared tracking sheet — used to seed this browser's
// localStorage the first time so the screen isn't empty on first load. Left
// blank/zero exactly where the source sheet left a cell blank.
const SEED_KEY = 'parva_timesheets_seeded_v1'

const SUHAS_SEED: Omit<TimesheetEntry, 'id' | 'loggedAt'>[] = [
  {
    employeeId: 'DF230010', date: '2026-09-01', shiftStart: '9:30 am', shiftEnd: '6:00 pm', totalHours: 8.5,
    leadsAssigned: 29, callsMade: 9, connectedCalls: 9, followUpsScheduled: 9, clientAppointmentsSet: 0, salesClosed: 0,
    companyFundedLeads: true, selfFundedLeads: true,
    tasks: '1. Conducted backtracking of client accounts and reviewed account status\n2. Called Orion Mall Leads\n3. Got reference from existing clients and shared company details\n4. Attended Team Meeting\n5. Shared market updates with clients and asked them to trade carefully\n6. Followed up with clients through calls for their investments.\n7. Updated client records in the Google sheet on a daily basis.',
  },
  {
    employeeId: 'DF230010', date: '2026-09-02', shiftStart: '9:30 am', shiftEnd: '6:00 pm', totalHours: 8.5,
    leadsAssigned: 29, callsMade: 12, connectedCalls: 12, followUpsScheduled: 12, clientAppointmentsSet: 2, salesClosed: 0,
    companyFundedLeads: true, selfFundedLeads: true,
    tasks: '1. Conducted backtracking of client accounts and reviewed account status\n2. Called Orion Mall Leads\n3. Got reference from existing clients and shared company details\n4. Attended Team Meeting\n5. Shared market updates with clients and asked them to trade carefully\n6. Followed up with clients through calls for their investments.\n7. Updated client records in the Google sheet on a daily basis.\n8. Opened 1 new account',
  },
  {
    employeeId: 'DF230010', date: '2026-09-03', shiftStart: '9:30 am', shiftEnd: '6:00 pm', totalHours: 8.5,
    leadsAssigned: 29, callsMade: 0, connectedCalls: 0, followUpsScheduled: 0, clientAppointmentsSet: 0, salesClosed: 0,
    companyFundedLeads: true, selfFundedLeads: true,
    tasks: '1. Conducted backtracking of client accounts and reviewed account status\n2. Shared market updates with clients and asked them to trade carefully\n3. Followed up with clients through calls for their investments.\n4. Updated client records in the Google sheet on a daily basis.',
  },
  {
    employeeId: 'DF230010', date: '2026-09-04', shiftStart: '9:30 am', shiftEnd: '6:00 pm', totalHours: 8.5,
    leadsAssigned: 29, callsMade: 10, connectedCalls: 10, followUpsScheduled: 10, clientAppointmentsSet: 0, salesClosed: 0,
    companyFundedLeads: true, selfFundedLeads: true,
    tasks: '1. Conducted backtracking of client accounts and reviewed account status\n2. Shared market updates with clients and asked them to trade carefully\n3. Connected clients to explain about the New PMS Plan\n4. Followed up with clients through calls for their investments.\n5. Updated client records in the Google sheet on a daily basis.\n6. Attended Team Meeting',
  },
  {
    employeeId: 'DF230010', date: '2026-09-05', shiftStart: '9:30 am', shiftEnd: '6:00 pm', totalHours: 8.5,
    leadsAssigned: 29, callsMade: 20, connectedCalls: 20, followUpsScheduled: 20, clientAppointmentsSet: 0, salesClosed: 0,
    companyFundedLeads: false, selfFundedLeads: false,
    tasks: '1. Cold Calls real estate Leads\n2. 50,000 business',
  },
  {
    employeeId: 'DF230010', date: '2026-09-07', shiftStart: '9:30 am', shiftEnd: '6:00 pm', totalHours: 8.5,
    leadsAssigned: 29, callsMade: 19, connectedCalls: 19, followUpsScheduled: 19, clientAppointmentsSet: 0, salesClosed: 0,
    companyFundedLeads: true, selfFundedLeads: true,
    tasks: '1. Conducted backtracking of client accounts and reviewed account status\n2. Shared market updates with clients and asked them to trade carefully\n3. Connected clients to explain about the New PMS Plan\n4. Updated client records in the Google sheet on a daily basis.\n5. Did Cold Calls',
  },
  {
    employeeId: 'DF230010', date: '2026-09-08', shiftStart: '9:30 am', shiftEnd: '6:00 pm', totalHours: 8.5,
    leadsAssigned: 29, callsMade: 20, connectedCalls: 20, followUpsScheduled: 20, clientAppointmentsSet: 0, salesClosed: 0,
    companyFundedLeads: true, selfFundedLeads: true,
    tasks: '1. Conducted backtracking of client accounts and reviewed account status\n2. Shared market updates with clients and asked them to trade carefully\n3. Connected clients to explain about the New PMS Plan\n4. Updated client records in the Google sheet on a daily basis.',
  },
  {
    employeeId: 'DF230010', date: '2026-09-09', shiftStart: '9:30 am', shiftEnd: '6:00 pm', totalHours: 8.5,
    leadsAssigned: 29, callsMade: 10, connectedCalls: 10, followUpsScheduled: 10, clientAppointmentsSet: 0, salesClosed: 0,
    companyFundedLeads: true, selfFundedLeads: true,
    tasks: '1. Conducted backtracking of client accounts and reviewed account status\n2. Shared market updates with clients and asked them to trade carefully\n3. Connected clients to explain about the New PMS Plan\n4. Updated client records in the Google sheet on a daily basis.\n5. Did Cold Calls',
  },
  {
    employeeId: 'DF230010', date: '2026-09-10', shiftStart: '9:30 am', shiftEnd: '6:00 pm', totalHours: 8.5,
    leadsAssigned: 29, callsMade: 10, connectedCalls: 10, followUpsScheduled: 10, clientAppointmentsSet: 0, salesClosed: 0,
    companyFundedLeads: true, selfFundedLeads: true,
    tasks: '1. Conducted backtracking of client accounts and reviewed account status\n2. Shared market updates with clients and asked them to trade carefully\n3. Connected clients to explain about the New PMS Plan\n4. Updated client records in the Google sheet on a daily basis.\n5. Did Cold Calls for property expo leads\n6. One Account converted to self fund',
  },
  {
    employeeId: 'DF230010', date: '2026-09-11', shiftStart: '9:30 am', shiftEnd: '6:00 pm', totalHours: 8.5,
    leadsAssigned: 29, callsMade: 7, connectedCalls: 7, followUpsScheduled: 7, clientAppointmentsSet: 0, salesClosed: 1,
    companyFundedLeads: false, selfFundedLeads: false,
    tasks: '1. Conducted backtracking of client accounts and reviewed account status\n2. One Account converted to self fund (500000)\n3. Shared market updates with clients and asked them to trade carefully',
  },
]

/** Seeds Suhas's real September entries once per browser, without ever overwriting anything the user has since entered/edited. */
export function ensureSeeded() {
  try {
    if (localStorage.getItem(SEED_KEY)) return
    const all = readAll()
    for (const entry of SUHAS_SEED) {
      if (!all.some(e => e.employeeId === entry.employeeId && e.date === entry.date)) {
        all.push({
          ...entry,
          id: `ts-seed-${entry.date}`,
          loggedAt: new Date().toISOString(),
        })
      }
    }
    writeAll(all)
    localStorage.setItem(SEED_KEY, '1')
  } catch {
    // localStorage unavailable — screens just start empty, nothing to seed into
  }
}
