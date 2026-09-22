import { useState } from 'react'
import { Search, Phone, Mail, IdCard, UserCog, MapPin } from 'lucide-react'
import type { JobTitle, Employee } from '../../types'
import DocumentsPanel from '../../components/DocumentsPanel'
import SalaryStructureEditor from '../../components/SalaryStructureEditor'

const roleLabels: Record<JobTitle, string> = { admin: 'Super Admin', manager: 'Sales Manager', agent: 'CRM Agent', hr: 'HR Manager', finance: 'Finance Manager' }

function formatEmpId(id: string) {
  const n = id.split('-')[1]
  return n ? `EMP-${n.padStart(3, '0')}` : id.toUpperCase()
}

interface Props {
  employees: Employee[]
  currentEmployeeId?: string
  onEmployeesUpdate?: (list: Employee[]) => void
}

export default function Directory({ employees, currentEmployeeId, onEmployeesUpdate }: Props) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<JobTitle | 'all'>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [selected, setSelected] = useState<string | null>(null)

  const companies = Array.from(new Set(employees.map((e) => e.company))).sort()
  const viewer = employees.find(e => e.id === currentEmployeeId)

  const filtered = employees.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.email.includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || e.role === roleFilter
    const matchCompany = companyFilter === 'all' || e.company === companyFilter
    return matchSearch && matchRole && matchCompany
  })

  const selectedEmp = employees.find((e) => e.id === selected)

  const reportingManagerName = (emp: typeof employees[number]) =>
    emp.managerId ? (employees.find(e => e.id === emp.managerId)?.name || '—') : ''

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* List */}
      <div className="flex-1 min-w-0 bg-card rounded-xl border border-border shadow-sm">
        <div className="p-5 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees…" className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'agent', 'manager', 'hr', 'admin', 'finance'] as const).map((r) => (
                <button key={r} onClick={() => setRoleFilter(r)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                  style={{ backgroundColor: roleFilter === r ? '#1C2B4A' : '#F5F2EC', color: roleFilter === r ? '#FAF8F5' : '#7A7065' }}>
                  {r === 'all' ? 'All' : roleLabels[r as JobTitle]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap mt-3">
            <button onClick={() => setCompanyFilter('all')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ backgroundColor: companyFilter === 'all' ? '#A8823C' : '#F5F2EC', color: companyFilter === 'all' ? '#FAF8F5' : '#7A7065' }}>
              All Companies
            </button>
            {companies.map((c) => (
              <button key={c} onClick={() => setCompanyFilter(c)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ backgroundColor: companyFilter === c ? '#A8823C' : '#F5F2EC', color: companyFilter === c ? '#FAF8F5' : '#7A7065' }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Full data table — every field HR asked for (Employee ID, Department,
            Joined Date, Reporting Manager, contact details, email, location)
            is visible directly in the row, no click required. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px]">
            <thead>
              <tr className="border-b border-border">
                {['Employee', 'Employee ID', 'Department', 'Joined Date', 'Reporting Manager', 'Phone', 'Email', 'Location'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, i) => (
                <tr
                  key={emp.id}
                  onClick={() => setSelected(emp.id === selected ? null : emp.id)}
                  className={`cursor-pointer transition-colors border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                  style={{ backgroundColor: selected === emp.id ? 'rgba(201,169,110,0.08)' : undefined }}
                  onMouseEnter={(e) => { if (selected !== emp.id) e.currentTarget.style.backgroundColor = '#FAFAF9' }}
                  onMouseLeave={(e) => { if (selected !== emp.id) e.currentTarget.style.backgroundColor = i % 2 === 0 ? 'transparent' : '' }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {emp.photoUrl ? (
                        <img src={emp.photoUrl} alt={emp.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: 'rgba(28,43,74,0.1)', color: '#1C2B4A' }}>
                          {emp.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground whitespace-nowrap">{emp.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {emp.status === 'active' ? 'Active' : 'On Leave'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">{emp.title || roleLabels[emp.role]} · {emp.team}</p>
                        <p className="text-[10px] text-muted-foreground/80 whitespace-nowrap">{emp.company}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">{formatEmpId(emp.id)}</td>
                  <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{emp.department}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{emp.joinDate}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{reportingManagerName(emp)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{emp.phone}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{emp.email}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{emp.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">No employees match this search.</p>
          )}
        </div>
      </div>

      {/* Detail panel — documents & downloads for the selected employee */}
      {selectedEmp && (
        <div className="w-full lg:w-80 bg-card rounded-xl border border-border shadow-sm h-fit lg:sticky lg:top-20">
          <div className="p-6 border-b border-border text-center">
            {selectedEmp.photoUrl ? (
              <img src={selectedEmp.photoUrl} alt={selectedEmp.name} className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3" />
            ) : (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-semibold font-serif mx-auto mb-3" style={{ backgroundColor: 'rgba(28,43,74,0.1)', color: '#1C2B4A' }}>
                {selectedEmp.name.split(' ').map((n) => n[0]).join('')}
              </div>
            )}
            <h3 className="font-serif text-lg font-semibold text-foreground">{selectedEmp.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{selectedEmp.title || roleLabels[selectedEmp.role]} · {selectedEmp.team}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{selectedEmp.company}</p>
            <p className="flex items-center justify-center gap-1 text-[10px] font-mono text-muted-foreground mt-1.5 tracking-wide">
              <IdCard size={11} /> {formatEmpId(selectedEmp.id)}
            </p>
            <span className={`inline-flex mt-2 text-xs px-2.5 py-1 rounded-full font-medium ${selectedEmp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {selectedEmp.status === 'active' ? 'Active' : 'On Leave'}
            </span>
          </div>
          <div className="p-5 space-y-3 border-b border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail size={14} className="shrink-0" /><span className="truncate">{selectedEmp.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone size={14} className="shrink-0" /><span>{selectedEmp.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin size={14} className="shrink-0" /><span className="truncate">{selectedEmp.location}</span>
            </div>
            {selectedEmp.managerId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCog size={14} className="shrink-0" />
                <span className="truncate">Reports to {reportingManagerName(selectedEmp)}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-3">
              {[
                { label: 'Employee ID', value: formatEmpId(selectedEmp.id) },
                { label: 'Join Date', value: selectedEmp.joinDate },
                { label: 'Department', value: selectedEmp.department },
                { label: 'Base Salary', value: `₹${selectedEmp.baseSalary.toLocaleString('en-IN')}` },
                { label: 'Leads', value: selectedEmp.role === 'agent' ? `${selectedEmp.leadsAssigned}` : 'N/A' },
              ].map((info) => (
                <div key={info.label} className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">{info.label}</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{info.value}</p>
                </div>
              ))}
            </div>
          </div>
          {onEmployeesUpdate && (
            <div className="p-5 border-b border-border">
              <SalaryStructureEditor
                employee={selectedEmp}
                onSave={patch => onEmployeesUpdate(employees.map(e => e.id === selectedEmp.id ? { ...e, ...patch } : e))}
              />
            </div>
          )}
          <div className="p-5">
            <DocumentsPanel
              employeeId={selectedEmp.id}
              employeeName={selectedEmp.name}
              viewerId={viewer?.id || currentEmployeeId || selectedEmp.id}
              viewerName={viewer?.name || 'HR'}
              description={`Upload documents on ${selectedEmp.name.split(' ')[0]}'s behalf, or download what's already on file.`}
            />
          </div>
        </div>
      )}
    </div>
  )
}
