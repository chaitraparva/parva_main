import type { Employee, Holiday } from '../types'

// A "branch" is the office an employee works from — taken from the Location on
// their record. Must match branchOf() in server/src/routes/holiday-lists.js.
export function branchOf(location: string | undefined | null): string {
  const l = (location || '').trim()
  if (/bangalore|bengaluru/i.test(l)) return 'Bangalore'
  if (/dubai|uae|abu dhabi|sharjah/i.test(l)) return 'Dubai'
  if (/dehradun/i.test(l)) return 'Dehradun'
  if (/tumkur/i.test(l)) return 'Tumkur'
  return l || 'Other'
}

const DEFAULT_BRANCHES = ['Bangalore', 'Dubai', 'Dehradun']

/** Branches HR can pick: the usual ones, plus any other location someone works from. */
export function branchList(employees: Employee[]): string[] {
  const found = new Set(DEFAULT_BRANCHES)
  for (const e of employees) if ((e.location || '').trim()) found.add(branchOf(e.location))
  return [...found]
}

/** The holiday (if any) that applies to this branch on this YYYY-MM-DD date. */
export function holidayFor(holidays: Holiday[] | undefined, branch: string, date: string): Holiday | undefined {
  return holidays?.find(h => h.branch === branch && h.date === date)
}
