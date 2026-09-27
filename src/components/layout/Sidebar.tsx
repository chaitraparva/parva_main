import { LayoutDashboard, FolderOpen, Calendar, UserCheck, CreditCard, Receipt, Building2, DoorOpen, TicketIcon, Bell, Settings, LogOut, BarChart2, Briefcase, ClipboardCheck, TrendingUp, Network, X, ClipboardList } from 'lucide-react'
import type { Role, Employee } from '../../types'

interface NavItem { id: string; label: string; icon: React.ReactNode; section: string }

// Exported so App.tsx can use the same list as a role guard on `screen` —
// every screen id a role's sidebar can navigate to is also the only set of
// screens that role is allowed to render (see ALLOWED_SCREENS in App.tsx).
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  crm: [
    { id: 'my-portal', label: 'My Portal', icon: <LayoutDashboard size={18} />, section: 'Self Service' },
    { id: 'my-timesheet', label: 'My Timesheet', icon: <ClipboardList size={18} />, section: 'Self Service' },
    { id: 'org-chart', label: 'Organisation Chart', icon: <Network size={18} />, section: 'Company' },
  ],
  manager: [
    { id: 'manager-portal', label: 'Team Overview', icon: <LayoutDashboard size={18} />, section: 'Overview' },
    { id: 'attendance-hr', label: 'Attendance', icon: <Calendar size={18} />, section: 'Team' },
    { id: 'team-timesheet', label: 'Team Timesheet', icon: <ClipboardList size={18} />, section: 'Team' },
    { id: 'org-chart', label: 'Organisation Chart', icon: <Network size={18} />, section: 'Company' },
  ],
  hr: [
    { id: 'hr-dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, section: 'Overview' },
    { id: 'recruitment', label: 'Recruitment', icon: <Briefcase size={18} />, section: 'Recruitment Management' },
    { id: 'directory', label: 'Employee Directory', icon: <FolderOpen size={18} />, section: 'Core HR' },
    { id: 'org-chart', label: 'Organisation Chart', icon: <Network size={18} />, section: 'Core HR' },
    { id: 'attendance-hr', label: 'Attendance', icon: <Calendar size={18} />, section: 'Leave & Attendance Management' },
    { id: 'leave', label: 'Leave Management', icon: <UserCheck size={18} />, section: 'Leave & Attendance Management' },
    { id: 'team-timesheet', label: 'Team Timesheet', icon: <ClipboardList size={18} />, section: 'Leave & Attendance Management' },
    { id: 'payroll-hr', label: 'Payroll', icon: <CreditCard size={18} />, section: 'Payroll' },
    { id: 'performance', label: 'Performance', icon: <TrendingUp size={18} />, section: 'Performance Management' },
    { id: 'expense-hr', label: 'Expense Claims', icon: <Receipt size={18} />, section: 'Expense Management' },
    { id: 'onboarding-hr', label: 'Onboarding', icon: <Building2 size={18} />, section: 'Onboarding & Exit Management' },
    { id: 'exit-management', label: 'Exit Management', icon: <DoorOpen size={18} />, section: 'Onboarding & Exit Management' },
    { id: 'tickets-hr', label: 'Employee Tickets', icon: <TicketIcon size={18} />, section: 'Support' },
  ],
  management: [
    { id: 'mgmt-portal', label: 'Executive Overview', icon: <LayoutDashboard size={18} />, section: 'Overview' },
    { id: 'leave', label: 'HR Leave Requests', icon: <ClipboardCheck size={18} />, section: 'Approvals' },
    { id: 'directory', label: 'Employee Directory', icon: <FolderOpen size={18} />, section: 'People' },
    { id: 'org-chart', label: 'Organisation Chart', icon: <Network size={18} />, section: 'People' },
    { id: 'attendance-hr', label: 'Attendance', icon: <Calendar size={18} />, section: 'People' },
    { id: 'team-timesheet', label: 'Team Timesheet', icon: <ClipboardList size={18} />, section: 'People' },
  ],
  finance: [
    { id: 'finance-portal', label: 'Finance Overview', icon: <LayoutDashboard size={18} />, section: 'Overview' },
    { id: 'directory', label: 'Employee Directory', icon: <FolderOpen size={18} />, section: 'People' },
    { id: 'org-chart', label: 'Organisation Chart', icon: <Network size={18} />, section: 'People' },
  ],
}

const BOTTOM: NavItem[] = [
  { id: 'notifications', label: 'Notifications', icon: <Bell size={18} />, section: '' },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} />, section: '' },
]

// Every role now covers more than one real person (or resolves to whoever
// actually logged in), so these are generic role labels — not any specific
// person's name — used only in the brief instant before currentEmployee loads.
const USER_INFO: Record<Role, { name: string; initials: string; title: string }> = {
  crm: { name: 'CRM Executive', initials: '?', title: 'CRM Executive' },
  manager: { name: 'Line Manager', initials: '?', title: 'Line Manager' },
  hr: { name: 'HR Manager', initials: '?', title: 'HR Manager' },
  management: { name: 'Management', initials: '?', title: 'Management' },
  finance: { name: 'Finance Manager', initials: '?', title: 'Finance Manager' },
}

interface Props {
  role: Role
  activeScreen: string
  onNavigate: (screen: string) => void
  onLogout: () => void
  unreadCount?: number
  open?: boolean
  onClose?: () => void
  currentEmployee?: Employee
}

export default function Sidebar({ role, activeScreen, onNavigate, onLogout, unreadCount = 0, open = false, onClose, currentEmployee }: Props) {
  const nav = NAV_BY_ROLE[role]
  const sections = Array.from(new Set(nav.map(i => i.section)))
  const fallback = USER_INFO[role]
  const displayName = currentEmployee?.name || fallback.name
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || fallback.initials

  const navBtn = (item: NavItem, showBadge = false) => {
    const isActive = activeScreen === item.id
    return (
      <button key={item.id} onClick={() => { onNavigate(item.id); onClose?.() }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all"
        style={{
          backgroundColor: isActive ? 'rgba(201,169,110,0.15)' : 'transparent',
          color: isActive ? '#C9A96E' : 'rgba(250,248,245,0.65)',
          borderLeft: isActive ? '3px solid #C9A96E' : '3px solid transparent',
        }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'rgba(250,248,245,0.06)'; e.currentTarget.style.color = 'rgba(250,248,245,0.9)' } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(250,248,245,0.65)' } }}>
        <span style={{ color: isActive ? '#C9A96E' : 'rgba(250,248,245,0.5)' }}>{item.icon}</span>
        {item.label}
        {showBadge && unreadCount > 0 && (
          <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: '#C9A96E' }}>
            {unreadCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 w-64 flex flex-col z-40 transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{ backgroundColor: '#1C2B4A' }}
      >
        <div className="px-6 py-6 border-b flex items-center justify-between" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #C9A96E, #A8823C)' }}>
              <BarChart2 size={18} color="#fff" />
            </div>
            <div>
              <p className="font-serif text-lg font-bold leading-tight" style={{ color: '#C9A96E' }}>Parva Group</p>
              <p className="text-xs tracking-[0.18em] uppercase font-light" style={{ color: 'rgba(201,169,110,0.6)' }}>Portal</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg shrink-0" style={{ color: 'rgba(250,248,245,0.6)' }} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {sections.map(section => (
            <div key={section} className="mb-4">
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'rgba(250,248,245,0.3)' }}>{section}</p>
              {nav.filter(i => i.section === section).map(item => navBtn(item))}
            </div>
          ))}
          <div className="border-t pt-3 mt-2" style={{ borderColor: 'rgba(201,169,110,0.15)' }}>
            {BOTTOM.map(item => navBtn(item, item.id === 'notifications'))}
          </div>
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
          <button
            onClick={() => { onNavigate('profile'); onClose?.() }}
            className="w-full flex items-center gap-3 mb-3 rounded-lg -mx-1 px-1 py-1 transition-colors"
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(250,248,245,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
            aria-label="View my profile"
          >
            {currentEmployee?.photoUrl ? (
              <img src={currentEmployee.photoUrl} alt={displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ backgroundColor: 'rgba(201,169,110,0.2)', color: '#C9A96E' }}>
                {initials}
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium truncate" style={{ color: '#FAF8F5' }}>{displayName}</p>
              <p className="text-xs truncate" style={{ color: 'rgba(250,248,245,0.4)' }}>{currentEmployee?.title || fallback.title}</p>
            </div>
          </button>
          <button onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
            style={{ color: 'rgba(250,248,245,0.5)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(250,248,245,0.06)'; e.currentTarget.style.color = '#FAF8F5' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(250,248,245,0.5)' }}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
