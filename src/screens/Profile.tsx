import { useRef, useState } from 'react'
import type { Employee, JobTitle, PayrollRecord, AttendanceRecord, LeaveRequest } from '../types'
import { Camera, IdCard, Mail, Phone, MapPin, Calendar, UserCog, Briefcase, Wallet, X } from 'lucide-react'
import DocumentsPanel from '../components/DocumentsPanel'
import PayslipDocument from '../components/PayslipDocument'
import { computePayslip } from '../lib/payslip'
import * as api from '../lib/api'

const navy = '#1C2B4A'
const gold = '#C9A96E'

const roleLabels: Record<JobTitle, string> = { admin: 'Super Admin', manager: 'Sales Manager', agent: 'CRM Agent', hr: 'HR Manager', finance: 'Finance Manager' }

function formatEmpId(id: string) {
  const n = id.split('-')[1]
  return n ? `EMP-${n.padStart(3, '0')}` : id.toUpperCase()
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}

interface Props {
  employeeId: string
  employees: Employee[]
  onEmployeesUpdate: (list: Employee[]) => void
  payroll: PayrollRecord[]
  attendance: AttendanceRecord[]
  leaves: LeaveRequest[]
}

export default function Profile({ employeeId, employees, onEmployeesUpdate, payroll, attendance, leaves }: Props) {
  const me = employees.find(e => e.id === employeeId)
  const { firstName: initFirst, lastName: initLast } = splitName(me?.name || '')
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [firstName, setFirstName] = useState(initFirst)
  const [lastName, setLastName] = useState(initLast)
  const [phone, setPhone] = useState(me?.phone || '')
  const [location, setLocation] = useState(me?.location || '')
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(me?.photoUrl)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [openPayslip, setOpenPayslip] = useState<PayrollRecord | null>(null)

  const myPayslips = payroll.filter(p => p.employeeId === employeeId)

  if (!me) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm p-8 text-center">
        <p className="text-sm text-muted-foreground">Could not find your employee record.</p>
      </div>
    )
  }

  const manager = me.managerId ? employees.find(e => e.id === me.managerId) : undefined

  function handlePhotoPick(file: File | null | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for your photo.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPhotoUrl(reader.result as string)
      setPhotoFile(file)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.')
      return
    }
    if (!me) return
    const name = `${firstName.trim()} ${lastName.trim()}`.trim()
    setSaving(true)
    setError('')
    try {
      // If a new photo was picked, upload it to real Storage first and get
      // back a permanent public URL — only then is it included in the
      // profile update below. email is deliberately never sent — it's the
      // registered login identifier, set by HR and never editable by the
      // employee (the server rejects it too, this just keeps the request
      // honest).
      const uploadedPhotoUrl = photoFile ? await api.uploadProfilePhoto(photoFile) : undefined
      const updated = await api.updateMyProfile({
        name, phone: phone.trim(), location: location.trim(),
        ...(uploadedPhotoUrl ? { photoUrl: uploadedPhotoUrl } : {}),
      })
      // `updated` already carries the real stored photoUrl either way (new
      // or unchanged) — this is what every other screen that reads
      // employees.photoUrl (Org Chart, Directory, ...) will now see too,
      // once they fetch employees again, not just this browser tab.
      onEmployeesUpdate(employees.map(e => e.id === me.id ? updated : e))
      setPhotoUrl(updated.photoUrl)
      setPhotoFile(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">My Profile</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Update your photo and personal details</p>
      </div>

      {/* Photo + name */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt={`${firstName} ${lastName}`} className="w-24 h-24 rounded-2xl object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-2xl font-semibold font-serif" style={{ backgroundColor: 'rgba(28,43,74,0.1)', color: navy }}>
                {(firstName[0] || '') + (lastName[0] || '')}
              </div>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhotoPick(e.target.files?.[0])}
            />
            <button
              onClick={() => photoInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-105"
              style={{ backgroundColor: gold, color: navy }}
              aria-label="Upload photo"
              title="Upload photo"
            >
              <Camera size={16} />
            </button>
          </div>

          <div className="flex-1 w-full space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">First Name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Last Name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                <IdCard size={12} /> {formatEmpId(me.id)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: navy }}>
                <Briefcase size={12} /> {me.title || roleLabels[me.role]} · {me.team}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-muted text-muted-foreground">
                {me.company}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${me.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {me.status === 'active' ? 'Active' : 'On Leave'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contact details */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Contact Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Mail size={12} /> Email</label>
            <input type="email" value={me.email} readOnly disabled title="Your registered email can't be changed — contact HR if it needs to be updated."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted text-muted-foreground cursor-not-allowed" />
            <p className="text-[11px] text-muted-foreground mt-1">This is what you sign in with — only HR can change it.</p>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Phone size={12} /> Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><MapPin size={12} /> Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
        </div>
      </div>

      {/* Employment details — HR-managed, read-only here */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Employment Details</h3>
        <p className="text-xs text-muted-foreground -mt-2">Managed by HR — contact HR to change these.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Department', value: me.department, icon: <Briefcase size={12} /> },
            { label: 'Join Date', value: me.joinDate, icon: <Calendar size={12} /> },
            ...(manager ? [{ label: 'Reporting Manager', value: manager.name, icon: <UserCog size={12} /> }] : []),
            { label: 'Employee ID', value: formatEmpId(me.id), icon: <IdCard size={12} /> },
          ].map(info => (
            <div key={info.label} className="p-3 rounded-lg bg-muted">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">{info.icon} {info.label}</p>
              <p className="text-sm font-semibold text-foreground mt-1 truncate">{info.value}</p>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-70"
        style={{ backgroundColor: saved ? '#10B981' : navy, color: '#FAF8F5' }}
      >
        {saved ? '✓ Profile updated' : saving ? 'Saving…' : 'Save Changes'}
      </button>

      {/* My Documents — every employee, regardless of role, can upload their
          own ID proofs, certificates etc. here and download them any time. */}
      <DocumentsPanel
        employeeId={me.id}
        employeeName={me.name}
        viewerId={me.id}
        viewerName={me.name}
        employees={employees}
        title="My Documents"
        description="Upload your ID proofs, certificates and other documents here — only HR and you can see these."
      />

      {/* My Payslips — visible only to me, since this is my own profile */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Wallet size={13} /> My Payslips</h3>
          <p className="text-xs text-muted-foreground mt-1">Only you can see your payslip details here.</p>
        </div>
        {myPayslips.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payslips on file yet.</p>
        ) : (
          <div className="space-y-2">
            {myPayslips.map(p => (
              <button key={p.id} onClick={() => setOpenPayslip(p)}
                className="w-full flex items-center justify-between p-3.5 rounded-lg border border-border hover:bg-muted/40 transition-colors text-left">
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.month}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{p.status.replace(/-/g, ' ')}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: navy }}>₹{p.netPay.toLocaleString('en-IN')}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Real payslip document — matches the company's own Diago Finance
          Limited salary-slip format, computed live from attendance/leave
          data plus the salary structure HR set up on the Directory screen. */}
      {openPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setOpenPayslip(null)}>
          <div className="max-w-lg w-full my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 px-1">
              <h4 className="font-serif text-base font-semibold text-white">Payslip — {openPayslip.month}</h4>
              <button onClick={() => setOpenPayslip(null)}><X size={18} className="text-white/80 hover:text-white transition-colors" /></button>
            </div>
            <PayslipDocument data={computePayslip(me, openPayslip, attendance, leaves)} />
          </div>
        </div>
      )}
    </div>
  )
}
