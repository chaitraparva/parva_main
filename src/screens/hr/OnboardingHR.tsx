import { useEffect, useState } from 'react'
import type { JobTitle } from '../../types'
import { Check, Clock, AlertCircle, Plus, X, FileText, Upload } from 'lucide-react'

const navy = '#1C2B4A'
const gold = '#C9A96E'

const CHECKLIST = [
  { label: 'Offer letter issued', owner: 'HR' },
  { label: 'Documents collected & verified', owner: 'HR' },
  { label: 'Role assigned in CRM/system', owner: 'IT' },
  { label: 'System credentials created', owner: 'IT' },
  { label: 'Manager introduction done', owner: 'Manager' },
  { label: 'Policy document shared', owner: 'HR' },
  { label: 'First-week schedule shared', owner: 'Manager' },
  { label: 'Payroll account setup', owner: 'Finance' },
  { label: 'ID card & access issued', owner: 'Admin' },
]

type DocStatus = 'complete' | 'pending' | 'missing'
const DOC_STATUS_STYLE: Record<DocStatus, { bg: string; text: string; label: string }> = {
  complete: { bg: '#ECFDF5', text: '#059669', label: 'Docs Complete' },
  pending:  { bg: '#FFFBEB', text: '#D97706', label: 'Docs Pending' },
  missing:  { bg: '#FEF2F2', text: '#DC2626', label: 'Docs Missing' },
}

interface Candidate {
  id: string
  name: string
  role: JobTitle
  team: string
  joiningDate: string
  docStatus: DocStatus
  onboardingProgress: number
  email?: string
  phone?: string
}

const REQUIRED_DOCS = [
  'Aadhar Card', 'PAN Card', 'Previous Employment Letter', 'Educational Certificates',
  'Bank Account Details', 'Passport Photo', 'Address Proof',
]

const BLANK_FORM = {
  name: '', role: 'agent' as JobTitle, team: '', joiningDate: '',
  email: '', phone: '', docStatus: 'missing' as DocStatus,
}

interface OnboardingHRProps {
  onboarding: Array<{ id: string; name: string; role: string; team: string; joiningDate: string; docStatus: string; onboardingProgress: number; email?: string; phone?: string }>
  onOnboardingUpdate: (next: OnboardingHRProps['onboarding']) => void
}

function toLocalCandidates(source: OnboardingHRProps['onboarding']): Candidate[] {
  return source.map(c => ({ ...c, role: c.role as JobTitle, email: c.email || '', phone: c.phone || '', docStatus: c.docStatus as DocStatus }))
}

export default function OnboardingHR({ onboarding, onOnboardingUpdate }: OnboardingHRProps) {
  const [candidates, setCandidatesLocal] = useState<Candidate[]>(() => toLocalCandidates(onboarding))
  // Re-sync when the parent's persisted copy changes (e.g. bootstrap fetch
  // finishing, or another tab/session updating the same data).
  useEffect(() => { setCandidatesLocal(toLocalCandidates(onboarding)) }, [onboarding])

  const setCandidates = (updater: Candidate[] | ((prev: Candidate[]) => Candidate[])) => {
    setCandidatesLocal(prev => {
      const next = typeof updater === 'function' ? (updater as (prev: Candidate[]) => Candidate[])(prev) : updater
      onOnboardingUpdate(next)
      return next
    })
  }

  const [selected, setSelected] = useState<string>(candidates[0]?.id || '')
  const [checklist, setChecklist] = useState<Record<string, string[]>>({
    'ob-1': CHECKLIST.slice(0, 6).map(c => c.label),
    'ob-2': CHECKLIST.slice(0, 3).map(c => c.label),
    'ob-3': CHECKLIST.slice(0, 1).map(c => c.label),
  })
  const [docStatus, setDocStatus] = useState<Record<string, Record<string, boolean>>>({
    'ob-1': Object.fromEntries(REQUIRED_DOCS.map(d => [d, true])),
    'ob-2': Object.fromEntries(REQUIRED_DOCS.map((d, i) => [d, i < 4])),
    'ob-3': Object.fromEntries(REQUIRED_DOCS.map((d, i) => [d, i < 1])),
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)

  const candidate = candidates.find(c => c.id === selected)
  const candidateChecklist = checklist[selected] || []
  const candidateDocs = docStatus[selected] || {}

  const toggleChecklist = (item: string) => {
    const current = checklist[selected] || []
    const updated = current.includes(item) ? current.filter(i => i !== item) : [...current, item]
    setChecklist(p => ({ ...p, [selected]: updated }))
    const progress = Math.round((updated.length / CHECKLIST.length) * 100)
    setCandidates(prev => prev.map(c => c.id === selected ? { ...c, onboardingProgress: progress } : c))
  }

  const toggleDoc = (doc: string) => {
    const current = docStatus[selected] || {}
    const updated = { ...current, [doc]: !current[doc] }
    setDocStatus(p => ({ ...p, [selected]: updated }))
    const allDone = Object.values(updated).every(Boolean)
    const anyDone = Object.values(updated).some(Boolean)
    const status: DocStatus = allDone ? 'complete' : anyDone ? 'pending' : 'missing'
    setCandidates(prev => prev.map(c => c.id === selected ? { ...c, docStatus: status } : c))
  }

  const addCandidate = () => {
    if (!form.name || !form.joiningDate) return
    const id = `ob-${Date.now()}`
    const newCand: Candidate = {
      id, name: form.name, role: form.role, team: form.team || 'Sales',
      joiningDate: form.joiningDate, docStatus: 'missing',
      onboardingProgress: 0, email: form.email, phone: form.phone,
    }
    setCandidates(prev => [...prev, newCand])
    setChecklist(p => ({ ...p, [id]: [] }))
    setDocStatus(p => ({ ...p, [id]: Object.fromEntries(REQUIRED_DOCS.map(d => [d, false])) }))
    setSelected(id)
    setShowAddForm(false)
    setForm(BLANK_FORM)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Onboarding</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Track new joinee checklists, document collection, and onboarding progress</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: navy, color: '#FAF8F5' }}>
          <Plus size={15} /> Add New Joinee
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">Register New Joinee</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Ravi Kumar"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none focus:ring-1 focus:ring-accent/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Role</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as JobTitle }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none">
                {(['agent', 'manager', 'hr', 'admin'] as JobTitle[]).map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Team</label>
              <input value={form.team} onChange={e => setForm(p => ({ ...p, team: e.target.value }))}
                placeholder="e.g. Team Alpha"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Joining Date *</label>
              <input type="date" value={form.joiningDate} onChange={e => setForm(p => ({ ...p, joiningDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="work email"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+91 XXXXX XXXXX"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={addCandidate}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: gold, color: navy }}>
              Create Onboarding Record
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="px-5 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Active Onboarding', value: candidates.length },
          { label: 'Joining This Month', value: candidates.filter(c => c.joiningDate.startsWith('2024-08')).length },
          { label: 'Documents Incomplete', value: candidates.filter(c => c.docStatus !== 'complete').length },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{s.label}</p>
            <p className="font-serif text-4xl font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Candidate list */}
        <div className="w-full lg:w-72 shrink-0 space-y-2.5">
          {candidates.map(c => {
            const ds = DOC_STATUS_STYLE[c.docStatus]
            const isActive = selected === c.id
            return (
              <button key={c.id} onClick={() => setSelected(c.id)}
                className="w-full text-left bg-card rounded-xl border p-4 transition-all hover:shadow-md"
                style={{ borderColor: isActive ? gold : '#E5DFD5', boxShadow: isActive ? `0 0 0 2px rgba(201,169,110,0.25)` : undefined }}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.role} · {c.team}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ml-1"
                    style={{ backgroundColor: ds.bg, color: ds.text }}>{ds.label}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Clock size={11} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Joining: {c.joiningDate}</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold text-foreground">{c.onboardingProgress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${c.onboardingProgress}%`,
                        backgroundColor: c.onboardingProgress >= 80 ? '#10B981' : c.onboardingProgress >= 50 ? gold : '#EF4444',
                      }} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail panel */}
        {candidate && (
          <div className="flex-1 space-y-4">
            {/* Header */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                  style={{ backgroundColor: `${navy}14`, color: navy }}>
                  {candidate.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-xl font-semibold text-foreground">{candidate.name}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{candidate.role} · {candidate.team} · Joining {candidate.joiningDate}</p>
                  {candidate.email && <p className="text-xs text-muted-foreground mt-0.5">{candidate.email}</p>}
                </div>
                <div className="text-right">
                  <p className="font-serif text-3xl font-semibold text-foreground">{candidate.onboardingProgress}%</p>
                  <p className="text-xs text-muted-foreground">onboarded</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Onboarding checklist */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <h4 className="font-serif text-base font-semibold text-foreground mb-1">Onboarding Checklist</h4>
                <p className="text-xs text-muted-foreground mb-3">{candidateChecklist.length} of {CHECKLIST.length} tasks done</p>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${(candidateChecklist.length / CHECKLIST.length) * 100}%`, backgroundColor: candidate.onboardingProgress >= 80 ? '#10B981' : gold }} />
                </div>
                <div className="space-y-2">
                  {CHECKLIST.map(item => {
                    const done = candidateChecklist.includes(item.label)
                    return (
                      <button key={item.label} onClick={() => toggleChecklist(item.label)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all hover:bg-muted/30"
                        style={{ borderColor: done ? `${gold}50` : '#E5DFD5', backgroundColor: done ? `${gold}06` : 'transparent' }}>
                        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-all"
                          style={{ borderColor: done ? gold : '#E5DFD5', backgroundColor: done ? gold : 'transparent' }}>
                          {done && <Check size={11} color={navy} strokeWidth={3} />}
                        </div>
                        <span className="text-xs flex-1 text-left" style={{ color: done ? '#9CA3AF' : '#1C1A2E', textDecoration: done ? 'line-through' : 'none' }}>
                          {item.label}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-medium shrink-0">{item.owner}</span>
                        {!done && <AlertCircle size={12} className="text-amber-400 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Document checklist */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-serif text-base font-semibold text-foreground">Required Documents</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium`}
                    style={{ backgroundColor: DOC_STATUS_STYLE[candidate.docStatus].bg, color: DOC_STATUS_STYLE[candidate.docStatus].text }}>
                    {DOC_STATUS_STYLE[candidate.docStatus].label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {Object.values(candidateDocs).filter(Boolean).length} of {REQUIRED_DOCS.length} collected
                </p>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${(Object.values(candidateDocs).filter(Boolean).length / REQUIRED_DOCS.length) * 100}%`,
                      backgroundColor: candidate.docStatus === 'complete' ? '#10B981' : candidate.docStatus === 'pending' ? gold : '#EF4444',
                    }} />
                </div>
                <div className="space-y-2">
                  {REQUIRED_DOCS.map(doc => {
                    const collected = candidateDocs[doc] ?? false
                    return (
                      <button key={doc} onClick={() => toggleDoc(doc)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all hover:bg-muted/30"
                        style={{ borderColor: collected ? '#A7F3D0' : '#E5DFD5', backgroundColor: collected ? '#F0FDF4' : 'transparent' }}>
                        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-all"
                          style={{ borderColor: collected ? '#059669' : '#E5DFD5', backgroundColor: collected ? '#059669' : 'transparent' }}>
                          {collected && <Check size={11} color="white" strokeWidth={3} />}
                        </div>
                        <div className="flex items-center gap-1.5 flex-1">
                          <FileText size={11} className="text-muted-foreground shrink-0" />
                          <span className="text-xs" style={{ color: collected ? '#059669' : '#1C1A2E' }}>{doc}</span>
                        </div>
                        {!collected && (
                          <div className="flex items-center gap-1 text-[10px] font-medium shrink-0" style={{ color: '#D97706' }}>
                            <Upload size={10} />Pending
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {!candidate && (
          <div className="flex-1 bg-card rounded-xl border border-border flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Select a candidate to view onboarding details.</p>
          </div>
        )}
      </div>
    </div>
  )
}
