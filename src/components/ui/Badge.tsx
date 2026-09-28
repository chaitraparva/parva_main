export function SeverityBadge({ severity }: { severity: 'Low' | 'Medium' | 'High' }) {
  const cfg = {
    Low: 'bg-blue-50 text-blue-700',
    Medium: 'bg-amber-50 text-amber-700',
    High: 'bg-red-50 text-red-700',
  }[severity]
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${cfg}`}>{severity}</span>
}

export function PayrollStatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    'pending-manager': 'bg-amber-50 text-amber-700',
    'pending-hr': 'bg-blue-50 text-blue-700',
    'pending-admin': 'bg-violet-50 text-violet-700',
    disbursed: 'bg-emerald-50 text-emerald-700',
  }
  const labels: Record<string, string> = {
    'pending-manager': 'Awaiting Manager',
    'pending-hr': 'Awaiting HR',
    'pending-admin': 'Awaiting Admin',
    disbursed: 'Disbursed',
  }
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${configs[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  )
}

export function AttendanceBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    present: 'bg-emerald-50 text-emerald-700',
    absent: 'bg-red-50 text-red-700',
    late: 'bg-amber-50 text-amber-700',
    'half-day': 'bg-blue-50 text-blue-700',
  }
  const labels: Record<string, string> = {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    'half-day': 'Half Day',
  }
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${configs[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  )
}

export function LeaveBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${configs[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
