import { useState } from 'react'
import type { Lead, LeadSource, LeadStatus, ActivityType, Employee } from '../../types'
import { Home, Phone, Mail, Plus, Send, StickyNote, MessageCircle, MapPinned } from 'lucide-react'

const navy = '#1C2B4A'
const gold = '#C9A96E'

const SOURCES: LeadSource[] = ['Housing.com', 'Social Media', 'Referral', 'Walk-in']
const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Site Visit', 'Closed']
const PROPERTY_TYPES: Lead['propertyType'][] = ['Apartment', 'Villa', 'Plot']
const ACTIVITY_TYPES: ActivityType[] = ['call', 'email', 'note', 'site-visit', 'whatsapp']

const statusColor: Record<LeadStatus, { bg: string; text: string }> = {
    New: { bg: '#EFF6FF', text: '#1D4ED8' },
    Contacted: { bg: '#FFFBEB', text: '#D97706' },
    Qualified: { bg: '#F5F3FF', text: '#7C3AED' },
    'Site Visit': { bg: '#FFF7ED', text: '#EA580C' },
    Closed: { bg: '#ECFDF5', text: '#059669' },
}

const activityIcon: Record<ActivityType, React.ReactNode> = {
    call: <Phone size={13} />,
    email: <Mail size={13} />,
    note: <StickyNote size={13} />,
    'site-visit': <MapPinned size={13} />,
    whatsapp: <MessageCircle size={13} />,
}

const NEW_LEAD_DEFAULT = {
    name: '',
    phone: '',
    email: '',
    source: 'Referral' as LeadSource,
    budget: '',
    propertyType: 'Apartment' as Lead['propertyType'],
    location: '',
    followUpDate: '',
    notes: '',
}

interface MyLeadsProps {
    leads: Lead[]
    employeeId: string
    currentEmployee?: Employee
    onLeadsUpdate: (next: Lead[]) => void
    onAddActivity: (leadId: string, type: ActivityType, description: string) => Promise<void>
}

export default function MyLeads({ leads, employeeId, currentEmployee, onLeadsUpdate, onAddActivity }: MyLeadsProps) {
    const [showAddForm, setShowAddForm] = useState(false)
    const [newLead, setNewLead] = useState(NEW_LEAD_DEFAULT)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [activityType, setActivityType] = useState<ActivityType>('call')
    const [activityText, setActivityText] = useState('')
    const [loggingActivity, setLoggingActivity] = useState(false)

    const total = leads.length
    const newCount = leads.filter(l => l.status === 'New').length
    const siteVisits = leads.filter(l => l.status === 'Site Visit').length
    const closed = leads.filter(l => l.status === 'Closed').length

    const setStatus = (id: string, status: LeadStatus) => {
        onLeadsUpdate(leads.map(l => l.id === id ? { ...l, status } : l))
    }

    const addLead = () => {
        if (!newLead.name || !newLead.phone || !newLead.location) return
        const lead: Lead = {
            id: `lead-${Date.now()}`,
            name: newLead.name,
            phone: newLead.phone,
            email: newLead.email,
            source: newLead.source,
            status: 'New',
            assignedTo: employeeId,
            agentName: currentEmployee?.name || '',
            budget: newLead.budget,
            propertyType: newLead.propertyType,
            location: newLead.location,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            activities: [],
            followUpDate: newLead.followUpDate || undefined,
            notes: newLead.notes || undefined,
        }
        onLeadsUpdate([lead, ...leads])
        setNewLead(NEW_LEAD_DEFAULT)
        setShowAddForm(false)
    }

    const selected = leads.find(l => l.id === selectedId) || null

    const submitActivity = async () => {
        if (!selected || !activityText.trim()) return
        setLoggingActivity(true)
        try {
            await onAddActivity(selected.id, activityType, activityText.trim())
            setActivityText('')
        } finally {
            setLoggingActivity(false)
        }
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="font-serif text-2xl font-semibold text-foreground">My Leads</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Your assigned pipeline — log every call, visit, and follow-up.</p>
                </div>
                <button onClick={() => setShowAddForm(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{ backgroundColor: navy, color: '#FAF8F5' }}>
                    <Plus size={14} />
                    {showAddForm ? 'Cancel' : 'New Lead'}
                </button>
            </div>

            {showAddForm && (
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <h3 className="font-serif text-lg font-semibold text-foreground mb-4">New Lead</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
                            <input value={newLead.name} onChange={e => setNewLead(f => ({ ...f, name: e.target.value }))}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Phone *</label>
                            <input value={newLead.phone} onChange={e => setNewLead(f => ({ ...f, phone: e.target.value }))}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                            <input value={newLead.email} onChange={e => setNewLead(f => ({ ...f, email: e.target.value }))}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Source</label>
                            <select value={newLead.source} onChange={e => setNewLead(f => ({ ...f, source: e.target.value as LeadSource }))}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none">
                                {SOURCES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Property Type</label>
                            <select value={newLead.propertyType} onChange={e => setNewLead(f => ({ ...f, propertyType: e.target.value as Lead['propertyType'] }))}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none">
                                {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Budget</label>
                            <input value={newLead.budget} onChange={e => setNewLead(f => ({ ...f, budget: e.target.value }))}
                                placeholder="e.g. ₹80,00,000"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Location *</label>
                            <input value={newLead.location} onChange={e => setNewLead(f => ({ ...f, location: e.target.value }))}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Follow-Up Date</label>
                            <input type="date" value={newLead.followUpDate} onChange={e => setNewLead(f => ({ ...f, followUpDate: e.target.value }))}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
                        </div>
                        <div className="sm:col-span-3">
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                            <input value={newLead.notes} onChange={e => setNewLead(f => ({ ...f, notes: e.target.value }))}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
                        </div>
                    </div>
                    <button onClick={addLead}
                        className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                        style={{ backgroundColor: gold, color: navy }}>
                        Add Lead
                    </button>
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Leads', value: total, color: navy },
                    { label: 'New', value: newCount, color: '#1D4ED8' },
                    { label: 'Site Visits', value: siteVisits, color: '#EA580C' },
                    { label: 'Closed', value: closed, color: '#059669' },
                ].map(k => (
                    <div key={k.label} className="bg-card rounded-xl border border-border shadow-sm p-5">
                        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: k.color }}>{k.label}</p>
                        <p className="font-serif text-2xl font-semibold text-foreground mt-2">{k.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px]">
                            <thead>
                                <tr className="border-b border-border">
                                    {['Lead', 'Location', 'Budget', 'Follow-Up', 'Status'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {leads.map((l, i) => {
                                    const sc = statusColor[l.status]
                                    return (
                                        <tr key={l.id} onClick={() => setSelectedId(l.id)}
                                            className={`border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-muted/40 ${selectedId === l.id ? 'bg-muted/40' : i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-semibold text-foreground">{l.name}</p>
                                                <p className="text-xs text-muted-foreground">{l.phone} · {l.source}</p>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">{l.location}<br /><span className="text-[10px]">{l.propertyType}</span></td>
                                            <td className="px-4 py-3 text-xs font-medium text-foreground whitespace-nowrap">{l.budget || '—'}</td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{l.followUpDate || '—'}</td>
                                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                <select value={l.status} onChange={e => setStatus(l.id, e.target.value as LeadStatus)}
                                                    className="text-xs px-2 py-1 rounded-full font-medium border-0 focus:outline-none"
                                                    style={{ backgroundColor: sc.bg, color: sc.text }}>
                                                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {leads.length === 0 && (
                                    <tr><td colSpan={5} className="text-center py-10 text-sm text-muted-foreground">No leads assigned to you yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm p-5 flex flex-col">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                            <Home size={28} className="text-muted-foreground opacity-30 mb-2" />
                            <p className="text-sm text-muted-foreground">Select a lead to view and log activity.</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                            <p className="text-xs text-muted-foreground mb-1">{selected.phone}{selected.email ? ` · ${selected.email}` : ''}</p>
                            {selected.notes && <p className="text-xs text-muted-foreground italic mb-3">"{selected.notes}"</p>}

                            <div className="flex-1 overflow-y-auto max-h-64 space-y-2 mb-3">
                                {selected.activities.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-6">No activity logged yet.</p>
                                )}
                                {selected.activities.map(a => (
                                    <div key={a.id} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-muted/40">
                                        <span className="mt-0.5 text-muted-foreground">{activityIcon[a.type]}</span>
                                        <div className="flex-1">
                                            <p className="text-foreground">{a.description}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">{a.by} · {a.timestamp}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-border pt-3 space-y-2">
                                <div className="flex gap-2 flex-wrap">
                                    {ACTIVITY_TYPES.map(t => (
                                        <button key={t} onClick={() => setActivityType(t)}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium capitalize transition-all"
                                            style={{ backgroundColor: activityType === t ? navy : '#F5F2EC', color: activityType === t ? '#FAF8F5' : '#7A7065' }}>
                                            {activityIcon[t]} {t.replace('-', ' ')}
                                        </button>
                                    ))}
                                </div>
                                <textarea value={activityText} onChange={e => setActivityText(e.target.value)} rows={2}
                                    placeholder="What happened?"
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none resize-none" />
                                <button onClick={submitActivity} disabled={loggingActivity || !activityText.trim()}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60 w-full justify-center"
                                    style={{ backgroundColor: gold, color: navy }}>
                                    <Send size={13} /> {loggingActivity ? 'Logging…' : 'Log Activity'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
