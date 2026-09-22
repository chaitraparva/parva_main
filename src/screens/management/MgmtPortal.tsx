import { useState } from 'react'
import type { LeaveRequest, PayrollRecord, Employee, EmployeeTicket, ExitRecord } from '../../types'

const navy = '#1C2B4A'

type Tab = 'leave-approvals' | 'overview'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-600',
    'pending-manager': 'bg-amber-50 text-amber-700',
    'pending-hr': 'bg-blue-50 text-blue-700',
    'pending-management': 'bg-purple-50 text-purple-700',
    disbursed: 'bg-emerald-50 text-emerald-700',
    Open: 'bg-blue-50 text-blue-700',
    'In Progress': 'bg-amber-50 text-amber-700',
    Resolved: 'bg-emerald-50 text-emerald-700',
    Closed: 'bg-gray-100 text-gray-600',
    'Notice Period': 'bg-amber-50 text-amber-700',
    'Clearance Pending': 'bg-orange-50 text-orange-700',
    'Exit Interview Done': 'bg-blue-50 text-blue-700',
    Completed: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

interface Props {
  leaves: LeaveRequest[]
  onLeaveUpdate: (l: LeaveRequest[]) => void
  employees: Employee[]
  payroll: PayrollRecord[]
  tickets: EmployeeTicket[]
  exits: ExitRecord[]
  currentEmployee?: Employee
}

export default function MgmtPortal({ leaves, onLeaveUpdate, employees, payroll: payrollProp, tickets: employeeTickets, exits: exitRecords, currentEmployee }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  // Leave approvals
  const pendingLeaves = leaves.filter(l => l.pendingWith === 'management' && l.submittedByRole === 'hr')
  const historyLeaves = leaves.filter(l => l.pendingWith === 'done' && l.submittedByRole === 'hr')
  const [confirmId, setConfirmId] = useState<{ id: string; action: 'approved' | 'rejected' } | null>(null)

  function handleLeave(id: string, action: 'approved' | 'rejected') {
    onLeaveUpdate(leaves.map(l => l.id === id ? { ...l, status: action, pendingWith: 'done' } : l))
    setConfirmId(null)
  }

  // Overview stats
  const totalEmployees = employees.length
  const totalMonthlyPayroll = payrollProp.reduce((s, r) => s + r.netPay, 0)
  const pendingCRM = leaves.filter(l => l.pendingWith === 'manager').length
  const pendingHR = leaves.filter(l => l.pendingWith === 'hr').length
  const pendingMgmt = leaves.filter(l => l.pendingWith === 'management').length
  const openTickets = employeeTickets.filter(t => t.status === 'Open' || t.status === 'In Progress' || t.status === 'Pending Info').length
  const activeExits = exitRecords.filter(e => e.status !== 'Completed').length

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'leave-approvals', label: 'Leave Approvals' },
  ]

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF8F5', minHeight: '100vh' }}>
      <div>
        <h1 className="text-2xl font-serif font-bold" style={{ color: navy }}>Executive Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">{currentEmployee?.name || 'Management'}{currentEmployee?.title ? ` · ${currentEmployee.title}` : ''}</p>
      </div>

      <div className="flex flex-wrap gap-1 bg-white border border-border rounded-xl p-1 w-fit shadow-sm">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t.key ? { background: navy, color: '#fff' } : { color: navy }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Total Employees</p>
              <p className="text-3xl font-bold font-serif" style={{ color: navy }}>{totalEmployees}</p>
              <p className="text-xs text-muted-foreground mt-1">Active workforce</p>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Monthly Payroll</p>
              <p className="text-3xl font-bold font-serif" style={{ color: navy }}>₹{(totalMonthlyPayroll / 100000).toFixed(2)}L</p>
              <p className="text-xs text-muted-foreground mt-1">August 2024</p>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Open Tickets</p>
              <p className="text-3xl font-bold font-serif" style={{ color: openTickets > 0 ? '#D97706' : '#059669' }}>{openTickets}</p>
              <p className="text-xs text-muted-foreground mt-1">Unresolved support items</p>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Active Exits</p>
              <p className="text-3xl font-bold font-serif" style={{ color: activeExits > 0 ? '#DC2626' : '#059669' }}>{activeExits}</p>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm p-5 col-span-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Pending Leave Requests by Tier</p>
              <div className="flex gap-6">
                <div>
                  <p className="text-xl font-bold" style={{ color: '#D97706' }}>{pendingCRM}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">CRM → Manager</p>
                </div>
                <div>
                  <p className="text-xl font-bold" style={{ color: '#2563EB' }}>{pendingHR}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Manager → HR</p>
                </div>
                <div>
                  <p className="text-xl font-bold" style={{ color: '#7C3AED' }}>{pendingMgmt}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">HR → Management</p>
                </div>
              </div>
            </div>
          </div>

          {/* Employee List */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h2 className="font-semibold text-base mb-4" style={{ color: navy }}>All Employees</h2>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Department</th>
                  <th className="pb-2 font-medium">Team</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.id} className="border-b border-border hover:bg-muted/20">
                    <td className="py-2.5 font-medium" style={{ color: navy }}>{e.name}</td>
                    <td className="py-2.5 capitalize">{e.role}</td>
                    <td className="py-2.5">{e.department}</td>
                    <td className="py-2.5">{e.team}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${e.status === 'active' ? 'bg-emerald-50 text-emerald-700' : e.status === 'on-leave' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Exit records */}
          {exitRecords.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h2 className="font-semibold text-base mb-4" style={{ color: navy }}>Exit Records</h2>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Employee</th>
                    <th className="pb-2 font-medium">Exit Type</th>
                    <th className="pb-2 font-medium">Last Day</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {exitRecords.map(ex => (
                    <tr key={ex.id} className="border-b border-border hover:bg-muted/20">
                      <td className="py-2.5 font-medium">{ex.employeeName}</td>
                      <td className="py-2.5">{ex.exitType}</td>
                      <td className="py-2.5">{ex.lastWorkingDay}</td>
                      <td className="py-2.5"><StatusBadge status={ex.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LEAVE APPROVALS */}
      {tab === 'leave-approvals' && (
        <div className="space-y-4">
          {/* Confirm dialog */}
          {confirmId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4">
                <h3 className="font-semibold text-base mb-2" style={{ color: navy }}>Confirm Action</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Are you sure you want to <strong>{confirmId.action}</strong> this leave request?
                </p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setConfirmId(null)} className="px-4 py-2 rounded-lg text-sm border border-border">
                    Cancel
                  </button>
                  <button
                    onClick={() => handleLeave(confirmId.id, confirmId.action)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${confirmId.action === 'approved' ? '' : 'bg-red-600'}`}
                    style={confirmId.action === 'approved' ? { background: navy } : {}}
                  >
                    {confirmId.action === 'approved' ? 'Approve' : 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h2 className="font-semibold text-base mb-4" style={{ color: navy }}>Pending HR-Submitted Leaves</h2>
            {pendingLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending leave requests for your approval.</p>
            ) : (
              <div className="space-y-3">
                {pendingLeaves.map(l => (
                  <div key={l.id} className="border border-border rounded-xl p-4 hover:bg-muted/20">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm" style={{ color: navy }}>{l.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{l.department} · Applied {l.appliedOn}</p>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <div><span className="font-medium text-foreground">{l.type}</span><br />Type</div>
                      <div><span className="font-medium text-foreground">{l.startDate}</span><br />From</div>
                      <div><span className="font-medium text-foreground">{l.endDate}</span><br />To</div>
                      <div><span className="font-medium text-foreground">{l.days} days</span><br />Duration</div>
                    </div>
                    <p className="text-sm mt-2 text-muted-foreground italic">"{l.reason}"</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setConfirmId({ id: l.id, action: 'approved' })}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
                        style={{ background: navy }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setConfirmId({ id: l.id, action: 'rejected' })}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {historyLeaves.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h2 className="font-semibold text-base mb-4" style={{ color: navy }}>History</h2>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Employee</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Dates</th>
                    <th className="pb-2 font-medium">Days</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLeaves.map(l => (
                    <tr key={l.id} className="border-b border-border hover:bg-muted/20">
                      <td className="py-2.5">{l.employeeName}</td>
                      <td className="py-2.5">{l.type}</td>
                      <td className="py-2.5">{l.startDate} — {l.endDate}</td>
                      <td className="py-2.5">{l.days}</td>
                      <td className="py-2.5"><StatusBadge status={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
