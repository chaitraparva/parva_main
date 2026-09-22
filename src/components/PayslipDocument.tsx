import type { PayslipData } from '../lib/payslip'
import { downloadPayslipPdf } from '../lib/payslipPdf'
import { Download } from 'lucide-react'

const navy = '#1C2B4A'
const gold = '#C9A96E'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs min-w-0">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium text-foreground break-all">{value || '—'}</span>
    </div>
  )
}

/** The real payslip document — laid out to match the company's own Diago
 * Finance Limited salary-slip reference, driven entirely by computePayslip()
 * (see src/lib/payslip.ts): fixed salary structure + live attendance/leave
 * data + this cycle's discretionary entries. Used both in an employee's own
 * "My Payslips" and in HR's payroll preview — same data, same layout. */
export default function PayslipDocument({ data }: { data: PayslipData }) {
  const { employee: e, record, cycleLabel, attendance: att, earnings, deductions, netSalaryPayable, netSalaryInWords } = data

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Letterhead */}
      <div className="p-4 flex items-start justify-between gap-3" style={{ backgroundColor: navy }}>
        <div>
          <p className="font-serif text-lg font-bold" style={{ color: gold }}>Diago Finance Limited</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(250,248,245,0.6)' }}>A Parva Group company</p>
        </div>
        <div className="text-right text-[10px] leading-relaxed" style={{ color: 'rgba(250,248,245,0.75)' }}>
          <p>3404 Aspin Commercial Tower, Sheikh Zayed Road, Dubai, UAE</p>
          <p>+971 56 406 2566 · info@diagofinance.com</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <h3 className="text-center text-sm font-bold text-foreground">
          Salary Slip for the month of ({cycleLabel})
        </h3>

        {/* Employee info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 border border-border rounded-lg p-3.5">
          <Row label="Employee Name" value={e.name} />
          <Row label="Employee ID" value={e.id} />
          <Row label="DOB" value={e.dob || ''} />
          <Row label="DOJ" value={e.joinDate} />
          <Row label="Gender" value={e.gender || ''} />
          <Row label="Designation" value={e.title || e.role} />
          <Row label="Phone" value={e.phone} />
          <Row label="Department" value={e.department} />
          <Row label="Email" value={e.email} />
          <Row label="Pay Month" value={record.month} />
          <Row label="Aadhar Card" value={e.aadharNumber || ''} />
          <Row label="Pan Card" value={e.panNumber || ''} />
        </div>

        {/* Attendance Summary */}
        <div className="border border-border rounded-lg overflow-hidden">
          <p className="text-xs font-bold text-white px-3 py-1.5" style={{ backgroundColor: navy }}>Attendance Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
            {[
              ['Month Days', att.monthDays], ['Working Days', att.workingDays],
              ['National Holidays', att.nationalHolidays], ['Days Present', att.daysPresent],
              ['Paid Leave', att.paidLeave], ['Weekly Off', att.weeklyOff],
              ['LOP Days', att.lopDays], ['Net Paid Days', att.netPaidDays],
            ].map(([label, val]) => (
              <div key={label as string} className="bg-white px-3 py-2">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold text-foreground">{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Earnings / Deductions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex justify-between text-xs font-bold text-white px-3 py-1.5" style={{ backgroundColor: navy }}>
              <span>Earnings</span><span>Amount (INR)</span>
            </div>
            <div className="divide-y divide-border">
              {[
                ['Basic Salary', earnings.basicSalary], ['HRA', earnings.hra],
                ['Conveyance Allowance', earnings.conveyanceAllowance], ['Medical Allowance', earnings.medicalAllowance],
                ['Other Allowance', earnings.otherAllowance],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">₹{(val as number).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: '#F5F2EC' }}>
                <span>Net Basic Salary</span><span>₹{earnings.netBasicSalary.toLocaleString('en-IN')}</span>
              </div>
              {[
                ['Reimbursements', earnings.reimbursements], ['Incentives', earnings.incentives], ['Bonus', earnings.bonus],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">₹{(val as number).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 text-xs font-bold" style={{ color: '#059669' }}>
                <span>Total Earnings</span><span>₹{earnings.totalEarnings.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex justify-between text-xs font-bold text-white px-3 py-1.5" style={{ backgroundColor: navy }}>
              <span>Deductions</span><span>Amount (INR)</span>
            </div>
            <div className="divide-y divide-border">
              <div className="px-3 py-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LOP Deduction</span>
                  <span className="font-medium text-foreground">₹{deductions.lopDeduction.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Std Days {deductions.stdDays} · LOP {att.lopDays}d · ₹{Math.round(deductions.perDayRate).toLocaleString('en-IN')}/day</p>
              </div>
              <div className="flex justify-between px-3 py-1.5 text-xs">
                <span className="text-muted-foreground">Professional Tax</span>
                <span className="font-medium text-foreground">₹{deductions.professionalTax.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between px-3 py-1.5 text-xs">
                <span className="text-muted-foreground">Other Deductions</span>
                <span className="font-medium text-foreground">₹{deductions.otherDeductions.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between px-3 py-2 text-xs font-bold" style={{ color: '#DC2626' }}>
                <span>Total Deductions</span><span>₹{deductions.totalDeductions.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Net pay */}
        <div className="rounded-xl p-4" style={{ background: `linear-gradient(135deg, ${navy} 0%, #2d4a7a 100%)` }}>
          <p className="text-xs font-medium" style={{ color: 'rgba(201,169,110,0.7)' }}>Net Salary Payable (INR)</p>
          <p className="font-serif text-2xl font-bold text-white">₹{netSalaryPayable.toLocaleString('en-IN')}</p>
          <p className="text-[11px] italic mt-1" style={{ color: 'rgba(250,248,245,0.7)' }}>{netSalaryInWords}</p>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          This is a computer-generated sheet and does not require a signature.
        </p>

        <div className="flex justify-center">
          {[['Manager Approved', record.managerApproved], ['HR Processed', record.hrProcessed], ['Admin Approved', record.adminApproved]].map(([label, done], i) => (
            <span key={i} className={`text-[10px] px-2.5 py-1 mx-1 rounded-full font-medium ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {label as string}
            </span>
          ))}
        </div>

        <button
          onClick={() => downloadPayslipPdf(data)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
          style={{ backgroundColor: navy }}
        >
          <Download size={14} /> Download PDF
        </button>
      </div>
    </div>
  )
}
