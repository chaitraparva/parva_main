import { useEffect, useState } from 'react'
import type { JobRequisition, Candidate, CandidateStage, RequisitionStatus, Employee } from '../../types'
import { Briefcase, Users, Send, Clock, Check, X, Plus, Sparkles, ShieldCheck, MessageSquare, BarChart2, IndianRupee } from 'lucide-react'

const EMPLOYMENT_TYPES = ['Full-time', 'Contract', 'Intern'] as const
const NEW_REQ_DEFAULT = {
  title: '',
  department: '',
  team: '',
  openings: '1',
  location: '',
  employmentType: 'Full-time' as JobRequisition['employmentType'],
  startDate: '',
  targetCloseDate: '',
  ctcRange: '',
  channels: '',
}

const navy = '#1C2B4A'
const gold = '#C9A96E'

const reqStatusColor: Record<RequisitionStatus, { bg: string; text: string }> = {
  Draft: { bg: '#F5F2EC', text: '#7A7065' },
  'Pending Approval': { bg: '#FFFBEB', text: '#D97706' },
  Approved: { bg: '#ECFDF5', text: '#059669' },
  'On Hold': { bg: '#FEF2F2', text: '#DC2626' },
  Closed: { bg: '#EEF2FF', text: '#4338CA' },
}

const STAGES: CandidateStage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']

const stageColor: Record<CandidateStage, { bg: string; text: string }> = {
  Applied: { bg: '#EFF6FF', text: '#1D4ED8' },
  Screening: { bg: '#FFFBEB', text: '#D97706' },
  Interview: { bg: '#F5F3FF', text: '#7C3AED' },
  Offer: { bg: '#FFF7ED', text: '#EA580C' },
  Hired: { bg: '#ECFDF5', text: '#059669' },
  Rejected: { bg: '#FEF2F2', text: '#DC2626' },
}

const CAPABILITIES = [
  { icon: <Sparkles size={13} />, label: 'AI resume parsing & shortlisting' },
  { icon: <MessageSquare size={13} />, label: 'Chatbot pre-screening' },
  { icon: <ShieldCheck size={13} />, label: 'Background verification integrations' },
  { icon: <Users size={13} />, label: 'External agency portal & management' },
  { icon: <BarChart2 size={13} />, label: 'Hiring analytics & reports' },
]

function scoreColor(score: number) {
  if (score >= 80) return { bg: '#ECFDF5', text: '#059669' }
  if (score >= 60) return { bg: '#FFFBEB', text: '#D97706' }
  return { bg: '#FEF2F2', text: '#DC2626' }
}

interface RecruitmentProps {
  requisitions: JobRequisition[]
  onRequisitionsUpdate: (next: JobRequisition[]) => void
  candidates: Candidate[]
  currentEmployee?: Employee
}

export default function Recruitment({ requisitions, onRequisitionsUpdate, candidates, currentEmployee }: RecruitmentProps) {
  const hrName = currentEmployee?.name || 'HR'
  const [tab, setTab] = useState<'requisitions' | 'pipeline'>('requisitions')
  const [reqs, setReqsLocal] = useState<JobRequisition[]>(requisitions)
  useEffect(() => { setReqsLocal(requisitions) }, [requisitions])
  const setReqs = (updater: JobRequisition[] | ((prev: JobRequisition[]) => JobRequisition[])) => {
    setReqsLocal(prev => {
      const next = typeof updater === 'function' ? (updater as (prev: JobRequisition[]) => JobRequisition[])(prev) : updater
      onRequisitionsUpdate(next)
      return next
    })
  }
  const [cands] = useState<Candidate[]>(candidates)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newReq, setNewReq] = useState(NEW_REQ_DEFAULT)

  const setReqStatus = (id: string, status: RequisitionStatus) => {
    setReqs(prev => prev.map(r => r.id === id ? { ...r, status, approvedBy: status === 'Approved' ? hrName : r.approvedBy } : r))
  }

  const addRequisition = () => {
    if (!newReq.title || !newReq.department || !newReq.location || !newReq.startDate || !newReq.targetCloseDate || !newReq.ctcRange) return
    const req: JobRequisition = {
      id: `req-${Date.now()}`,
      title: newReq.title,
      department: newReq.department,
      team: newReq.team || newReq.department,
      openings: Math.max(1, parseInt(newReq.openings) || 1),
      location: newReq.location,
      employmentType: newReq.employmentType,
      status: 'Pending Approval',
      requestedBy: hrName,
      channels: newReq.channels.split(',').map(c => c.trim()).filter(Boolean),
      applicants: 0,
      startDate: newReq.startDate,
      targetCloseDate: newReq.targetCloseDate,
      ctcRange: newReq.ctcRange,
    }
    setReqs(prev => [req, ...prev])
    setNewReq(NEW_REQ_DEFAULT)
    setShowAddForm(false)
  }

  const openRoles = reqs.filter(r => r.status === 'Approved').length
  const activeCandidates = cands.filter(c => c.stage !== 'Hired' && c.stage !== 'Rejected').length
  const offersExtended = cands.filter(c => c.offerStatus === 'Sent' || c.offerStatus === 'Accepted').length
  const avgResumeScore = cands.length ? Math.round(cands.reduce((s, c) => s + c.resumeScore, 0) / cands.length) : 0

  const reqTitle = (id: string) => reqs.find(r => r.id === id)?.title || id

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Recruitment Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Job requisitions, candidate pipeline, and hiring approvals</p>
        </div>
        <button onClick={() => setShowAddForm(v => !v)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all" style={{ backgroundColor: navy, color: '#FAF8F5' }}>
          <Plus size={14} />
          {showAddForm ? 'Cancel' : 'New Requisition'}
        </button>
      </div>

      {/* New requisition form */}
      {showAddForm && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-serif text-lg font-semibold text-foreground mb-4">New Job Requisition</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Role Title *</label>
              <input value={newReq.title} onChange={e => setNewReq(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. CRM Executive — Bangalore"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none focus:ring-1 focus:ring-accent/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Openings</label>
              <input type="number" min={1} value={newReq.openings} onChange={e => setNewReq(f => ({ ...f, openings: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Department *</label>
              <input value={newReq.department} onChange={e => setNewReq(f => ({ ...f, department: e.target.value }))}
                placeholder="e.g. Sales"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Team</label>
              <input value={newReq.team} onChange={e => setNewReq(f => ({ ...f, team: e.target.value }))}
                placeholder="e.g. Team Alpha"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Location *</label>
              <input value={newReq.location} onChange={e => setNewReq(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Bangalore"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Employment Type</label>
              <select value={newReq.employmentType} onChange={e => setNewReq(f => ({ ...f, employmentType: e.target.value as JobRequisition['employmentType'] }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none">
                {EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Expected Start Date *</label>
              <input type="date" value={newReq.startDate} onChange={e => setNewReq(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Target Close Date *</label>
              <input type="date" value={newReq.targetCloseDate} onChange={e => setNewReq(f => ({ ...f, targetCloseDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">CTC Range *</label>
              <input value={newReq.ctcRange} onChange={e => setNewReq(f => ({ ...f, ctcRange: e.target.value }))}
                placeholder="e.g. ₹6,00,000 – ₹9,00,000 /year"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Sourcing Channels</label>
              <input value={newReq.channels} onChange={e => setNewReq(f => ({ ...f, channels: e.target.value }))}
                placeholder="Comma-separated, e.g. LinkedIn, Naukri, Referral"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={addRequisition}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: gold, color: navy }}>
              <Check size={14} className="inline mr-1.5" />Submit Requisition
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="px-5 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Open Roles', value: openRoles, icon: <Briefcase size={16} />, color: navy },
          { label: 'Active Candidates', value: activeCandidates, icon: <Users size={16} />, color: '#7C3AED' },
          { label: 'Offers Extended', value: offersExtended, icon: <Send size={16} />, color: '#EA580C' },
          { label: 'Avg. Resume Match Score', value: `${avgResumeScore}%`, icon: <Sparkles size={16} />, color: '#059669' },
        ].map(k => (
          <div key={k.label} className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: k.color }}>{k.label}</p>
              <span style={{ color: k.color }}>{k.icon}</span>
            </div>
            <p className="font-serif text-2xl font-semibold text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-card rounded-xl border border-border p-1.5 w-fit">
        {(['requisitions', 'pipeline'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ backgroundColor: tab === t ? navy : 'transparent', color: tab === t ? '#FAF8F5' : '#7A7065' }}>
            {t === 'requisitions' ? 'Job Requisitions' : 'Candidate Pipeline'}
          </button>
        ))}
      </div>

      {tab === 'requisitions' ? (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-border">
                {['Role', 'Department', 'Openings', 'Location', 'Channels', 'Applicants', 'Start Date', 'Target Close', 'CTC', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reqs.map((r, i) => {
                const sc = reqStatusColor[r.status]
                return (
                  <tr key={r.id} className={`border-b border-border last:border-0 hover:bg-muted/40 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-foreground">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.team} · {r.employmentType}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-foreground">{r.department}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-foreground">{r.openings}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{r.location}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {r.channels.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        {r.channels.map(ch => (
                          <span key={ch} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#F0EDE7', color: '#7A7065' }}>{ch}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-foreground">{r.applicants}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">{r.startDate}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">{r.targetCloseDate}</td>
                    <td className="px-5 py-4 text-xs font-medium text-foreground whitespace-nowrap">{r.ctcRange}</td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{r.status}</span>
                      {r.approvedBy && <p className="text-[10px] text-muted-foreground mt-0.5">by {r.approvedBy}</p>}
                    </td>
                    <td className="px-5 py-4">
                      {r.status === 'Pending Approval' ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setReqStatus(r.id, 'Approved')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                            style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                            <Check size={11} /> Approve
                          </button>
                          <button onClick={() => setReqStatus(r.id, 'On Hold')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                            style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                            <X size={11} /> Hold
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:overflow-x-auto gap-3">
          {STAGES.map(stage => (
            <div key={stage} className="bg-card rounded-xl border border-border shadow-sm flex flex-col min-h-[200px] lg:w-56 lg:shrink-0">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: stageColor[stage].text }}>{stage}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: stageColor[stage].bg, color: stageColor[stage].text }}>
                  {cands.filter(c => c.stage === stage).length}
                </span>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {cands.filter(c => c.stage === stage).map(c => {
                  const sc = scoreColor(c.resumeScore)
                  return (
                    <div key={c.id} className="p-2.5 rounded-lg border border-border bg-background">
                      <p className="text-xs font-semibold text-foreground leading-tight">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{reqTitle(c.requisitionId)}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: sc.bg, color: sc.text }}>
                          {c.resumeScore}% match
                        </span>
                        <span className="text-[10px] text-muted-foreground">{c.experience}</span>
                      </div>
                      {c.stage === 'Interview' && c.interviewDate && (
                        <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: '#7C3AED' }}>
                          <Clock size={10} /> {c.interviewDate}
                        </p>
                      )}
                      {c.stage === 'Offer' && (
                        <p className="text-[10px] mt-1.5 font-medium" style={{ color: '#EA580C' }}>Offer {c.offerStatus?.toLowerCase()}</p>
                      )}
                      {(c.stage === 'Offer' || c.stage === 'Hired') && c.ctcOffered && (
                        <p className="text-[10px] mt-1 flex items-center gap-1 font-medium" style={{ color: '#059669' }}>
                          <IndianRupee size={9} /> {c.ctcOffered}
                        </p>
                      )}
                      {(c.stage === 'Interview' || c.stage === 'Offer' || c.stage === 'Hired') && (
                        <p className="text-[10px] mt-1 text-muted-foreground">BGV: {c.bgvStatus}</p>
                      )}
                    </div>
                  )
                })}
                {cands.filter(c => c.stage === stage).length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-4">No candidates</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Capabilities strip */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Also included</span>
        {CAPABILITIES.map(c => (
          <span key={c.label} className="flex items-center gap-1.5 text-xs text-foreground">
            <span style={{ color: gold }}>{c.icon}</span>
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}
