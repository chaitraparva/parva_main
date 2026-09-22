import type { LeadStatus, LeadSource } from '../../types'

const statusConfig: Record<LeadStatus, { bg: string; text: string; dot: string }> = {
  New: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  Contacted: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  Qualified: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  'Site Visit': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  Closed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
}

const sourceConfig: Record<LeadSource, { bg: string; text: string }> = {
  'Housing.com': { bg: 'bg-[#1C2B4A]/10', text: 'text-[#1C2B4A]' },
  'Social Media': { bg: 'bg-pink-50', text: 'text-pink-700' },
  Referral: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'Walk-in': { bg: 'bg-gray-100', text: 'text-gray-700' },
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const cfg = statusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  )
}

export function SourceBadge({ source }: { source: LeadSource }) {
  const cfg = sourceConfig[source]
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {source}
    </span>
  )
}

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
