import { Users, Calendar, CreditCard, TicketIcon, Receipt, DoorOpen, AlertCircle, CheckCircle, Clock, TrendingUp, Building2, UserCheck } from 'lucide-react'
import type { Employee, LeaveRequest, PayrollRecord, AttendanceRecord, EmployeeTicket, ExpenseClaim, ExitRecord } from '../../types'

interface OnboardingCandidateLite { id: string; onboardingProgress: number }

interface Props {
  navigate: (s: string) => void
  employees: Employee[]
  leaves: LeaveRequest[]
  payroll: PayrollRecord[]
  attendance: AttendanceRecord[]
  tickets: EmployeeTicket[]
  expenses: ExpenseClaim[]
  exits: ExitRecord[]
  onboarding: OnboardingCandidateLite[]
  currentEmployee?: Employee
}

const navy = '#1C2B4A'
const gold = '#C9A96E'

export default function HRDashboard({ navigate, employees, leaves, payroll, attendance, tickets, expenses, exits, onboarding, currentEmployee }: Props) {
  const firstName = currentEmployee?.name?.split(' ')[0] || 'there'
  const pendingLeave = leaves.filter(l => l.status === 'pending').length
  const pendingPayroll = payroll.filter(p => p.status === 'pending-hr').length
  const pendingExpenses = expenses.filter(e => e.status === 'Pending').length
  const openTickets = tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length
  const urgentTickets = tickets.filter(t => t.priority === 'Urgent' && t.status !== 'Resolved' && t.status !== 'Closed')
  const activeOnboarding = onboarding.filter(c => c.onboardingProgress < 100).length
  const activeExits = exits.filter(e => e.status !== 'Completed').length
  const todayAttendance = attendance.filter(a => a.date === '2024-08-14')
  const presentToday = todayAttendance.filter(a => a.status === 'present').length

  const QUICK_ACTIONS = [
    { label: 'Employee Directory', screen: 'directory', icon: Users, color: navy, count: employees.length, sub: 'employees' },
    { label: 'Leave Requests', screen: 'leave', icon: UserCheck, color: '#D97706', count: pendingLeave, sub: 'pending' },
    { label: 'Payroll', screen: 'payroll-hr', icon: CreditCard, color: '#0F766E', count: pendingPayroll, sub: 'to process' },
    { label: 'Attendance', screen: 'attendance-hr', icon: Calendar, color: navy, count: presentToday, sub: 'present today' },
    { label: 'Expense Claims', screen: 'expense-hr', icon: Receipt, color: '#7C3AED', count: pendingExpenses, sub: 'pending' },
    { label: 'Employee Tickets', screen: 'tickets-hr', icon: TicketIcon, color: '#DC2626', count: openTickets, sub: 'open' },
    { label: 'Onboarding', screen: 'onboarding-hr', icon: Building2, color: gold, count: activeOnboarding, sub: 'in progress' },
    { label: 'Exit Management', screen: 'exit-management', icon: DoorOpen, color: '#6B7280', count: activeExits, sub: 'active' },
  ]

  const totalPayroll = payroll.reduce((s, r) => s + r.netPay, 0)

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${navy} 0%, #2d4a7a 100%)` }}>
        <div className="px-8 py-7 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(201,169,110,0.7)' }}>Human Resources</p>
            <h2 className="font-serif text-3xl font-semibold text-white mb-1">Good morning, {firstName}</h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>You have {pendingLeave + pendingPayroll + pendingExpenses + openTickets} items requiring your attention today.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { label: 'Org Strength', value: employees.length },
              { label: 'On Leave Today', value: leaves.filter(l => l.status === 'approved').length },
              { label: 'New Joiners (Month)', value: activeOnboarding },
            ].map(s => (
              <div key={s.label}>
                <p className="font-serif text-4xl font-semibold" style={{ color: gold }}>{s.value}</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending alerts */}
      {(urgentTickets.length > 0 || pendingLeave > 0) && (
        <div className="space-y-2">
          {urgentTickets.map(t => (
            <button key={t.id} onClick={() => navigate('tickets-hr')}
              className="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl border text-left transition-all hover:bg-red-50"
              style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <div className="flex-1">
                <span className="text-sm font-semibold text-red-800">Urgent ticket from {t.employeeName}: </span>
                <span className="text-sm text-red-700">{t.title}</span>
              </div>
              <span className="text-xs text-red-500 font-medium">View →</span>
            </button>
          ))}
          {pendingLeave > 0 && (
            <button onClick={() => navigate('leave')}
              className="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl border text-left transition-all hover:bg-amber-50"
              style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
              <Clock size={16} className="text-amber-500 shrink-0" />
              <p className="text-sm text-amber-800 flex-1"><strong>{pendingLeave} leave request{pendingLeave > 1 ? 's' : ''}</strong> awaiting your approval</p>
              <span className="text-xs text-amber-600 font-medium">Review →</span>
            </button>
          )}
        </div>
      )}

      {/* Module grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map(qa => {
          const Icon = qa.icon
          return (
            <button key={qa.screen} onClick={() => navigate(qa.screen)}
              className="bg-card rounded-xl border border-border p-5 text-left hover:shadow-md hover:border-accent/30 transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: `${qa.color}14` }}>
                  <Icon size={20} style={{ color: qa.color }} />
                </div>
                {qa.count > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${qa.color}14`, color: qa.color }}>
                    {qa.count}
                  </span>
                )}
              </div>
              <p className="font-semibold text-sm text-foreground mb-0.5">{qa.label}</p>
              <p className="text-xs text-muted-foreground">{qa.count} {qa.sub}</p>
            </button>
          )
        })}
      </div>

      {/* Bottom 3-col row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's attendance snapshot */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-base font-semibold text-foreground">Today's Attendance</h3>
            <button onClick={() => navigate('attendance-hr')} className="text-xs font-medium" style={{ color: gold }}>View all →</button>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Present', count: todayAttendance.filter(a => a.status === 'present').length, color: '#10B981', bg: '#ECFDF5' },
              { label: 'Late', count: todayAttendance.filter(a => a.status === 'late').length, color: '#F59E0B', bg: '#FFFBEB' },
              { label: 'Absent', count: todayAttendance.filter(a => a.status === 'absent').length, color: '#EF4444', bg: '#FEF2F2' },
              { label: 'Half Day', count: todayAttendance.filter(a => a.status === 'half-day').length, color: '#8B5CF6', bg: '#F5F3FF' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: s.bg }}>
                  <span className="text-sm font-bold" style={{ color: s.color }}>{s.count}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{s.label}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(s.count / (todayAttendance.length || 1)) * 100}%`, backgroundColor: s.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payroll cycle status */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-base font-semibold text-foreground">Payroll Cycle</h3>
            <button onClick={() => navigate('payroll-hr')} className="text-xs font-medium" style={{ color: gold }}>View all →</button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">August 2024 · Stage 2 of 3</p>
          {/* Stage bar */}
          <div className="flex items-center gap-1 mb-4">
            {['Manager', 'HR', 'Admin', 'Disbursed'].map((stage, i) => (
              <div key={stage} className="flex-1 flex flex-col items-center gap-1">
                <div className="h-2 w-full rounded-full" style={{ backgroundColor: i <= 1 ? navy : '#E5DFD5' }} />
                <span className="text-[9px] font-medium" style={{ color: i <= 1 ? navy : '#9CA3AF' }}>{stage}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[
              { label: 'Pending HR Processing', value: payroll.filter(p => p.status === 'pending-hr').length, color: '#F59E0B' },
              { label: 'Processed by HR', value: payroll.filter(p => p.hrProcessed).length, color: '#10B981' },
              { label: 'Disbursed', value: payroll.filter(p => p.status === 'disbursed').length, color: '#6B7280' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Total payout</p>
            <p className="font-serif text-xl font-semibold text-foreground">₹{(totalPayroll / 100000).toFixed(1)}L</p>
          </div>
        </div>

        {/* Recent tickets */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-base font-semibold text-foreground">Recent Tickets</h3>
            <button onClick={() => navigate('tickets-hr')} className="text-xs font-medium" style={{ color: gold }}>View all →</button>
          </div>
          <div className="space-y-3">
            {tickets.slice(0, 4).map(t => (
              <div key={t.id} className="flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: t.priority === 'Urgent' ? '#EF4444' : t.priority === 'High' ? '#F59E0B' : '#10B981' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.employeeName} · {t.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
