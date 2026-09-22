import { useState } from 'react'
import type { Employee } from '../types'
import { Wallet, ChevronDown, ChevronUp } from 'lucide-react'

const navy = '#1C2B4A'

interface Props {
  employee: Employee
  onSave: (patch: Partial<Employee>) => void
}

/**
 * The "entered once" side of the payslip — Basic Salary, the fixed
 * allowances, and the personal-identity fields the letterhead needs (DOB,
 * Gender, Aadhar, PAN). Everything here starts blank for every employee and
 * is never guessed or pre-filled — HR types the real figures in here
 * directly, once per person, and every future payslip for them just reads
 * these values plus that cycle's live attendance.
 */
export default function SalaryStructureEditor({ employee, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [basicSalary, setBasicSalary] = useState(String(employee.baseSalary || ''))
  const [hra, setHra] = useState(String(employee.hra ?? ''))
  const [conveyanceAllowance, setConveyanceAllowance] = useState(String(employee.conveyanceAllowance ?? ''))
  const [medicalAllowance, setMedicalAllowance] = useState(String(employee.medicalAllowance ?? ''))
  const [otherAllowance, setOtherAllowance] = useState(String(employee.otherAllowance ?? ''))
  const [dob, setDob] = useState(employee.dob || '')
  const [gender, setGender] = useState(employee.gender || '')
  const [aadharNumber, setAadharNumber] = useState(employee.aadharNumber || '')
  const [panNumber, setPanNumber] = useState(employee.panNumber || '')
  const [saved, setSaved] = useState(false)

  const num = (s: string) => (s.trim() === '' ? 0 : Math.max(0, parseFloat(s) || 0))

  function handleSave() {
    onSave({
      baseSalary: num(basicSalary),
      hra: num(hra),
      conveyanceAllowance: num(conveyanceAllowance),
      medicalAllowance: num(medicalAllowance),
      otherAllowance: num(otherAllowance),
      dob: dob.trim(),
      gender: gender.trim(),
      aadharNumber: aadharNumber.trim(),
      panNumber: panNumber.trim(),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Wallet size={13} /> Salary & Personal Details
        </span>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          <p className="text-[11px] text-muted-foreground">
            Entered once per employee — every payslip for them reads these figures automatically, so nothing here needs to be re-typed each pay cycle.
          </p>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Salary Structure (₹ / month)</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                ['Basic Salary', basicSalary, setBasicSalary],
                ['HRA', hra, setHra],
                ['Conveyance Allowance', conveyanceAllowance, setConveyanceAllowance],
                ['Medical Allowance', medicalAllowance, setMedicalAllowance],
                ['Other Allowance', otherAllowance, setOtherAllowance],
              ].map(([label, val, setter]) => (
                <div key={label as string}>
                  <label className="block text-[11px] text-muted-foreground mb-1">{label as string}</label>
                  <input type="number" value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)}
                    className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Personal Details</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Date of Birth</label>
                <input type="date" value={dob} onChange={e => setDob(e.target.value)}
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Gender</label>
                <select value={gender} onChange={e => setGender(e.target.value)}
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30">
                  <option value="">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Aadhar Card</label>
                <input type="text" value={aadharNumber} onChange={e => setAadharNumber(e.target.value)} placeholder="XXXX XXXX XXXX"
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Pan Card</label>
                <input type="text" value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())} placeholder="ABCDE1234F"
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ backgroundColor: saved ? '#10B981' : navy }}
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
