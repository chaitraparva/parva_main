import { useMemo, useState } from 'react'
import type { Employee, Lead, LeadStatus } from '../../types'
import { downloadCsv } from '../../lib/csv'
import { Home, Download } from 'lucide-react'

const navy = '#1C2B4A'

const statusColor: Record<LeadStatus, { bg: string; text: string }> = {
    New: { bg: '#EFF6FF', text: '#1D4ED8' },
    Contacted: { bg: '#FFFBEB', text: '#D97706' },
    Qualified: { bg: '#F5F3FF', text: '#7C3AED' },
    'Site Visit': { bg: '#FFF7ED', text: '#EA580C' },
    Closed: { bg: '#ECFDF5', text: '#059669' },
}

const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Site Visit', 'Closed']

interface TeamLeadsProps {
    leads: Lead[]
    employees: Employee[]
    onLeadsUpdate: (next: Lead[]) => void
}

export default function TeamLeads({ leads, employees, onLeadsUpdate }: TeamLeadsProps) {
    const [agentFilter, setAgentFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const nameFor = (id: string) => employees.find(e => e.id === id)?.name || id

    const agentsWithLeads = useMemo(() => [...new Set(leads.map(l => l.assignedTo))].filter(Boolean), [leads])

    const filtered = leads.filter(l =>
        (!agentFilter || l.assignedTo === agentFilter) &&
        (!statusFilter || l.status === statusFilter)
    )

    const summary = {
        total: filtered.length,
        closed: filtered.filter(l => l.status === 'Closed').length,
        siteVisits: filtered.filter(l => l.status === 'Site Visit').length,
        conversionRate: filtered.length ? Math.round((filtered.filter(l => l.status === 'Closed').length / filtered.length) * 100) : 0,
    }

    const reassign = (leadId: string, newAssignedTo: string) => {
        const emp = employees.find(e => e.id === newAssignedTo)
        onLeadsUpdate(leads.map(l => l.id === leadId ? { ...l, assignedTo: newAssignedTo, agentName: emp?.name || '' } : l))
    }

    const handleExport = () => {
        downloadCsv(
            'Leads.csv',
            ['Name', 'Phone', 'Email', 'Agent', 'Source', 'Status', 'Budget', 'Property Type', 'Location', 'Follow-Up Date', 'Last Activity', 'Notes'],
            filtered.map(l => [
                l.name, l.phone, l.email, nameFor(l.assignedTo), l.source, l.status,
                l.budget, l.propertyType, l.location, l.followUpDate || '', l.lastActivity, l.notes || '',
            ])
        )
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="font-serif text-2xl font-semibold text-foreground">Team Leads</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Every lead across the team's pipeline — reassign or export anytime.</p>
                </div>
                <button onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: navy, color: '#FAF8F5' }}>
                    <Download size={15} /> Download CSV
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Leads', value: summary.total },
                    { label: 'Site Visits', value: summary.siteVisits },
                    { label: 'Closed', value: summary.closed },
                    { label: 'Conversion Rate', value: `${summary.conversionRate}%` },
                ].map(s => (
                    <div key={s.label} className="bg-card rounded-xl border border-border shadow-sm p-5">
                        <p className="font-serif text-2xl font-bold" style={{ color: navy }}>{s.value}</p>
                        <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border flex items-center gap-3 flex-wrap">
                    <Home size={18} className="text-muted-foreground" />
                    <h3 className="font-serif text-lg font-semibold text-foreground">Pipeline</h3>
                    <div className="ml-auto flex items-center gap-2 flex-wrap">
                        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
                            <option value="">All agents</option>
                            {agentsWithLeads.map(id => <option key={id} value={id}>{nameFor(id)}</option>)}
                        </select>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
                            <option value="">All statuses</option>
                            {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                {['Lead', 'Agent', 'Source', 'Status', 'Budget', 'Location', 'Follow-Up', 'Notes'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(l => {
                                const sc = statusColor[l.status]
                                return (
                                    <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors align-top">
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-semibold text-foreground whitespace-nowrap">{l.name}</p>
                                            <p className="text-xs text-muted-foreground whitespace-nowrap">{l.phone}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select value={l.assignedTo} onChange={e => reassign(l.id, e.target.value)}
                                                className="text-xs px-2 py-1 rounded-lg border border-border bg-background focus:outline-none">
                                                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{l.source}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: sc.bg, color: sc.text }}>{l.status}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-medium text-foreground whitespace-nowrap">{l.budget || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{l.location}</td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{l.followUpDate || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px]">
                                            <p className="line-clamp-2" title={l.notes}>{l.notes || '—'}</p>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={8} className="text-center py-10 text-sm text-muted-foreground">No leads for this filter.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
