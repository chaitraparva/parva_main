import type { Employee, PayrollRecord, AttendanceRecord, LeaveRequest } from '../types'
import { NATIONAL_HOLIDAYS_PER_ANNUM } from './leaveBalance'

// Diago Finance's salary cycle doesn't follow the calendar month — it runs
// from the 21st of one month to the 20th of the next (confirmed from the
// company's own reference payslip). "Pay month" below means the month whose
// 20th the cycle ends on, e.g. picking "2026-08" produces 21 Jul – 20 Aug.
export function cycleForPayMonth(payMonth: string): { periodStart: string; periodEnd: string } {
  const [y, m] = payMonth.split('-').map(Number) // m is 1-indexed
  const periodEnd = new Date(Date.UTC(y, m - 1, 20))
  const periodStart = new Date(Date.UTC(y, m - 2, 21))
  return { periodStart: periodStart.toISOString().slice(0, 10), periodEnd: periodEnd.toISOString().slice(0, 10) }
}

/** Falls back to deriving a cycle from `month` (e.g. "August 2026") for records that predate periodStart/periodEnd. */
export function cycleForRecord(record: PayrollRecord): { periodStart: string; periodEnd: string } {
  if (record.periodStart && record.periodEnd) return { periodStart: record.periodStart, periodEnd: record.periodEnd }
  const parsed = new Date(`1 ${record.month}`)
  if (isNaN(parsed.getTime())) {
    const today = new Date()
    return cycleForPayMonth(today.toISOString().slice(0, 7))
  }
  const payMonth = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
  return cycleForPayMonth(payMonth)
}

function formatCycleLabel(periodStart: string, periodEnd: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return `${fmt(periodStart)} to ${fmt(periodEnd)}`
}

function daysBetweenInclusive(startIso: string, endIso: string): number {
  const start = new Date(startIso)
  const end = new Date(endIso)
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1
}

function countSundays(startIso: string, endIso: string): number {
  let count = 0
  const cur = new Date(startIso)
  const end = new Date(endIso)
  while (cur <= end) {
    if (cur.getUTCDay() === 0) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

export interface AttendanceSummary {
  monthDays: number
  workingDays: number
  nationalHolidays: number
  daysPresent: number
  paidLeave: number
  weeklyOff: number
  lopDays: number
  netPaidDays: number
}

/**
 * Attendance Summary — computed live from real Attendance and Leave
 * records for this employee, the same way the Leave tab's balances are
 * computed. Not a hand-entered figure: HR/managers keep marking attendance
 * and approving leave as normal, and this section always reflects that.
 * National Holidays is an even monthly share of the annual count (the
 * system doesn't hold exact holiday dates yet), and Paid Leave counts
 * approved Sick/Casual/Earned requests that start within this cycle.
 */
export function computeAttendanceSummary(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  attendance: AttendanceRecord[],
  leaves: LeaveRequest[]
): AttendanceSummary {
  const monthDays = daysBetweenInclusive(periodStart, periodEnd)
  const weeklyOff = countSundays(periodStart, periodEnd)
  const nationalHolidays = Math.round(NATIONAL_HOLIDAYS_PER_ANNUM / 12)
  const workingDays = Math.max(0, monthDays - weeklyOff - nationalHolidays)

  const inRange = (iso: string) => iso >= periodStart && iso <= periodEnd

  const myAttendance = attendance.filter(a => a.employeeId === employeeId && inRange(a.date))
  const daysPresent = myAttendance.reduce((sum, a) => {
    if (a.status === 'present' || a.status === 'late') return sum + 1
    if (a.status === 'half-day') return sum + 0.5
    return sum
  }, 0)

  const paidLeave = leaves
    .filter(l => l.employeeId === employeeId && l.status === 'approved' && l.type !== 'Unpaid' && inRange(l.startDate))
    .reduce((sum, l) => sum + l.days, 0)

  const lopDays = Math.max(0, Math.round((workingDays - daysPresent - paidLeave) * 10) / 10)
  const netPaidDays = Math.max(0, monthDays - lopDays)

  return { monthDays, workingDays, nationalHolidays, daysPresent, paidLeave, weeklyOff, lopDays, netPaidDays }
}

export interface PayslipData {
  employee: Employee
  record: PayrollRecord
  periodStart: string
  periodEnd: string
  cycleLabel: string
  attendance: AttendanceSummary
  earnings: {
    basicSalary: number
    hra: number
    conveyanceAllowance: number
    medicalAllowance: number
    otherAllowance: number
    netBasicSalary: number
    reimbursements: number
    incentives: number
    bonus: number
    totalEarnings: number
  }
  deductions: {
    stdDays: number
    perDayRate: number
    lopDeduction: number
    professionalTax: number
    otherDeductions: number
    totalDeductions: number
  }
  netSalaryPayable: number
  netSalaryInWords: string
}

const STD_DAYS = 26 // standard working-day divisor for per-day rate, matching the company's own payslip
const PROFESSIONAL_TAX = 200 // flat, matching the company's own payslip

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n]
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`
}

function threeDigitWords(n: number): string {
  if (n < 100) return twoDigitWords(n)
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + twoDigitWords(n % 100) : ''}`
}

/** Converts a non-negative rupee amount to words, Indian numbering (lakh/crore) — "Rupees ... Only". */
export function numberToWords(amount: number): string {
  const n = Math.round(Math.max(0, amount))
  if (n === 0) return 'Rupees Zero Only'
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (crore) parts.push(`${threeDigitWords(crore)} Crore`)
  if (lakh) parts.push(`${threeDigitWords(lakh)} Lakh`)
  if (thousand) parts.push(`${threeDigitWords(thousand)} Thousand`)
  if (rest) parts.push(threeDigitWords(rest))
  return `Rupees ${parts.join(' ')} Only`
}

/** Builds the full payslip: real attendance-driven figures plus the fixed
 * salary structure and this cycle's discretionary entries. This is the one
 * place all of it comes together — the on-screen payslip and the PDF export
 * both render straight from this. */
export function computePayslip(employee: Employee, record: PayrollRecord, attendance: AttendanceRecord[], leaves: LeaveRequest[]): PayslipData {
  const { periodStart, periodEnd } = cycleForRecord(record)
  const attendanceSummary = computeAttendanceSummary(employee.id, periodStart, periodEnd, attendance, leaves)

  const basicSalary = record.baseSalary || 0
  const hra = employee.hra || 0
  const conveyanceAllowance = employee.conveyanceAllowance || 0
  const medicalAllowance = employee.medicalAllowance || 0
  const otherAllowance = employee.otherAllowance || 0
  const netBasicSalary = basicSalary + hra + conveyanceAllowance + medicalAllowance + otherAllowance
  const reimbursements = record.reimbursements || 0
  const incentives = record.incentives || 0
  const bonus = record.bonus || 0
  const totalEarnings = netBasicSalary + reimbursements + incentives + bonus

  const perDayRate = STD_DAYS > 0 ? netBasicSalary / STD_DAYS : 0
  const lopDeduction = Math.round(perDayRate * attendanceSummary.lopDays)
  const otherDeductions = record.otherDeductions || 0
  const totalDeductions = lopDeduction + PROFESSIONAL_TAX + otherDeductions

  const netSalaryPayable = Math.max(0, totalEarnings - totalDeductions)

  return {
    employee,
    record,
    periodStart,
    periodEnd,
    cycleLabel: formatCycleLabel(periodStart, periodEnd),
    attendance: attendanceSummary,
    earnings: { basicSalary, hra, conveyanceAllowance, medicalAllowance, otherAllowance, netBasicSalary, reimbursements, incentives, bonus, totalEarnings },
    deductions: { stdDays: STD_DAYS, perDayRate, lopDeduction, professionalTax: PROFESSIONAL_TAX, otherDeductions, totalDeductions },
    netSalaryPayable,
    netSalaryInWords: numberToWords(netSalaryPayable),
  }
}
