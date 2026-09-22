import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PayslipData } from './payslip'
import { downloadBlob } from './files'

const NAVY: [number, number, number] = [28, 43, 74]
const GOLD: [number, number, number] = [201, 169, 110]
const INR = (n: number) => n.toLocaleString('en-IN')

function formatDDMMMYY(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-')
}

/** Renders one payslip to a jsPDF document — used both for a single download and for bundling many into one HR export. `startY` lets callers stack several payslips into one PDF, one per page. */
export function renderPayslipPage(doc: jsPDF, data: PayslipData) {
  const { employee: e, record, cycleLabel, attendance: att, earnings, deductions, netSalaryPayable, netSalaryInWords } = data
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  // Letterhead
  doc.setFillColor(...NAVY)
  doc.rect(margin, 10, contentWidth, 20, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Diago Finance Limited', margin + 4, 21)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('3404 Aspin Commercial Tower, Sheikh Zayed Road, Dubai, UAE', pageWidth - margin - 4, 16, { align: 'right' })
  doc.text('+971 56 406 2566  ·  info@diagofinance.com  ·  www.diagofinance.com', pageWidth - margin - 4, 21, { align: 'right' })
  doc.text('A Parva Group company', pageWidth - margin - 4, 26.5, { align: 'right' })

  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Salary Slip for the month of (${cycleLabel})`, pageWidth / 2, 38, { align: 'center' })

  // Employee info grid
  autoTable(doc, {
    startY: 43,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2, textColor: [40, 40, 40] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 }, 1: { cellWidth: 62 }, 2: { fontStyle: 'bold', cellWidth: 32 }, 3: { cellWidth: 'auto' } },
    body: [
      ['Employee Name', e.name, 'Employee ID', e.id],
      ['DOB', e.dob || '—', 'DOJ', e.joinDate || '—'],
      ['Gender', e.gender || '—', 'Designation', e.title || e.role],
      ['Phone', e.phone || '—', 'Department', e.department || '—'],
      ['Email', e.email || '—', 'Pay Month', record.month],
      ['Aadhar Card', e.aadharNumber || '—', 'Pan Card', e.panNumber || '—'],
    ],
  })

  // Attendance Summary
  const afterInfoY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2
  autoTable(doc, {
    startY: afterInfoY,
    theme: 'grid',
    head: [[{ content: 'Attendance Summary', colSpan: 2, styles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' } }]],
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: contentWidth - 40 }, 1: { cellWidth: 40, halign: 'center' } },
    body: [
      ['Month Days', String(att.monthDays)],
      ['Working Days', String(att.workingDays)],
      ['National Holidays', String(att.nationalHolidays)],
      ['Days Present', String(att.daysPresent)],
      ['Paid Leave', String(att.paidLeave)],
      ['Weekly Off', String(att.weeklyOff)],
      ['LOP Days', String(att.lopDays)],
      ['Net Paid Days', String(att.netPaidDays)],
    ],
  })

  // Earnings / Deductions
  const afterAttY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2
  const half = contentWidth / 2
  const lastAutoTable = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
  autoTable(doc, {
    startY: afterAttY,
    theme: 'grid',
    head: [['Earnings', 'Amount (INR)']],
    headStyles: { fillColor: NAVY, textColor: 255 },
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: half - 30 }, 1: { cellWidth: 30, halign: 'right' } },
    tableWidth: half,
    margin: { left: margin },
    body: [
      ['Basic Salary', INR(earnings.basicSalary)],
      ['HRA', INR(earnings.hra)],
      ['Conveyance Allowance', INR(earnings.conveyanceAllowance)],
      ['Medical Allowance', INR(earnings.medicalAllowance)],
      ['Other Allowance', INR(earnings.otherAllowance)],
      [{ content: 'Net Basic Salary', styles: { fontStyle: 'bold' } }, { content: INR(earnings.netBasicSalary), styles: { fontStyle: 'bold' } }],
      ['Reimbursements', INR(earnings.reimbursements)],
      ['Incentives', INR(earnings.incentives)],
      ['Bonus', INR(earnings.bonus)],
      [{ content: 'Total Earnings', styles: { fontStyle: 'bold', fillColor: [245, 242, 236] } }, { content: INR(earnings.totalEarnings), styles: { fontStyle: 'bold', fillColor: [245, 242, 236] } }],
    ],
  })
  const earningsFinalY = lastAutoTable().finalY

  autoTable(doc, {
    startY: afterAttY,
    theme: 'grid',
    head: [['Deductions', 'Amount (INR)']],
    headStyles: { fillColor: NAVY, textColor: 255 },
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: half - 30 }, 1: { cellWidth: 30, halign: 'right' } },
    tableWidth: half,
    margin: { left: margin + half },
    body: [
      ['LOP Deduction', INR(deductions.lopDeduction)],
      [`(Std Days ${deductions.stdDays} · LOP ${att.lopDays} d · Rs.${Math.round(deductions.perDayRate)}/day)`, ''],
      ['Professional Tax', INR(deductions.professionalTax)],
      ['Other Deductions', INR(deductions.otherDeductions)],
      [{ content: 'Total Deductions', styles: { fontStyle: 'bold', fillColor: [245, 242, 236] } }, { content: INR(deductions.totalDeductions), styles: { fontStyle: 'bold', fillColor: [245, 242, 236] } }],
    ],
    didParseCell: (hookData) => {
      if (hookData.row.index === 1) { hookData.cell.styles.fontSize = 6.5; hookData.cell.styles.textColor = [120, 112, 101] }
    },
  })
  const deductionsFinalY = lastAutoTable().finalY

  const afterEarnY = Math.max(earningsFinalY, deductionsFinalY) + 4

  // Net pay banner
  doc.setFillColor(...NAVY)
  doc.rect(margin, afterEarnY, contentWidth, 16, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Net Salary Payable (INR)', margin + 4, afterEarnY + 6)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(`Rs. ${INR(netSalaryPayable)}`, margin + 4, afterEarnY + 13)

  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.text(`Net Salary in Words: ${netSalaryInWords}`, margin, afterEarnY + 24)

  doc.setFont('helvetica', 'normal')
  doc.text(`Date: ${formatDDMMMYY(new Date().toISOString())}`, margin, afterEarnY + 30)
  doc.setFontSize(7)
  doc.setTextColor(120, 112, 101)
  doc.text('This is a computer-generated sheet and does not require a signature.', margin, afterEarnY + 37)
}

export function downloadPayslipPdf(data: PayslipData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  renderPayslipPage(doc, data)
  const blob = doc.output('blob')
  downloadBlob(`Payslip_${data.employee.name.replace(/\s+/g, '_')}_${data.record.month.replace(/\s+/g, '_')}.pdf`, blob)
}

/** Bundles several payslips into one PDF, one page each — for HR to export a whole cycle at once. */
export function downloadPayslipsPdf(filename: string, payslips: PayslipData[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  payslips.forEach((data, i) => {
    if (i > 0) doc.addPage()
    renderPayslipPage(doc, data)
  })
  const blob = doc.output('blob')
  downloadBlob(filename, blob)
}
