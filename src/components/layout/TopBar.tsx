import { Bell, ChevronDown, Menu } from 'lucide-react'
import type { Role, Employee } from '../../types'

const screenTitles: Record<string, string> = {
  'hr-dashboard':    'HR Dashboard',
  'recruitment':     'Recruitment Management',
  'performance':     'Performance Management',
  'directory':       'Employee Directory',
  'payroll-hr':      'Payroll Processing',
  'attendance-hr':   'Attendance Tracker',
  'leave':           'Leave Management',
  'onboarding-hr':   'Onboarding',
  'exit-management': 'Exit Management',
  'expense-hr':      'Expense Claims',
  'tickets-hr':      'Employee Tickets',
  'notifications':   'Notifications',
  'settings':        'Settings',
  'profile':         'My Profile',
  'my-portal':       'My Portal',
  'manager-portal':  'Manager Portal',
  'mgmt-portal':     'Executive Portal',
  'finance-portal':  'Finance Portal',
  'org-chart':       'Organisation Chart',
}

// Every role now covers more than one real person (or resolves to whoever
// actually logged in), so these are generic role labels — not any specific
// person's name — used only in the brief instant before currentEmployee loads.
const USER_INFO: Record<Role, { name: string; initials: string }> = {
  crm:        { name: 'CRM Executive',   initials: '?' },
  manager:    { name: 'Line Manager',    initials: '?' },
  hr:         { name: 'HR Manager',      initials: '?' },
  management: { name: 'Management',      initials: '?' },
  finance:    { name: 'Finance Manager', initials: '?' },
}

interface TopBarProps {
  role: Role
  screen: string
  unreadCount?: number
  onNavigate: (screen: string) => void
  onMenuClick?: () => void
  currentEmployee?: Employee
}

export default function TopBar({ role, screen, unreadCount = 0, onNavigate, onMenuClick, currentEmployee }: TopBarProps) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const fallback = USER_INFO[role]
  const displayName = currentEmployee?.name || fallback.name
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || fallback.initials

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-card border-b border-border z-20 flex items-center px-3 sm:px-5 lg:px-8 gap-2">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="font-serif text-base sm:text-lg lg:text-xl font-semibold text-foreground truncate">{screenTitles[screen] || screen}</h1>
        <p className="hidden sm:block text-xs text-muted-foreground truncate">{today}</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <button onClick={() => onNavigate('notifications')}
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onNavigate('profile')}
          className="flex items-center gap-2.5 cursor-pointer rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-muted transition-colors"
          aria-label="View my profile"
        >
          {currentEmployee?.photoUrl ? (
            <img src={currentEmployee.photoUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: '#1C2B4A', color: '#C9A96E' }}>
              {initials}
            </div>
          )}
          <p className="hidden md:block text-sm font-medium text-foreground leading-none">{displayName}</p>
          <ChevronDown size={14} className="hidden sm:block text-muted-foreground" />
        </button>
      </div>
    </header>
  )
}
