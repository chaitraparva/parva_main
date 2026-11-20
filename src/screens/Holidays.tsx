import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Plus, Trash2, Upload, FileText, Download } from 'lucide-react'
import type { Employee, Holiday, HolidayListFile } from '../types'
import * as api from '../lib/api'
import { branchList, branchOf } from '../lib/holidays'

const navy = '#1C2B4A'
const gold = '#C9A96E'

interface Props {
  employees: Employee[]
  currentEmployee?: Employee
  holidays: Holiday[]
  // True for HR / management: they pick any branch and edit its list.
  canEdit: boolean
  onHolidaysRefresh: () => Promise<void>
}

const prettyDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

// The Annual Holiday List. Each branch has its own list. Employees see only
// their own branch's list; HR (Satish) picks a branch, adds or removes
// holidays, and can also attach the branch's list as a PDF / image.
export default function Holidays({ employees, currentEmployee, holidays, canEdit, onHolidaysRefresh }: Props) {
  const myBranch = branchOf(currentEmployee?.location)
  const branches = canEdit ? branchList(employees) : [myBranch]
  const [branch, setBranch] = useState(myBranch)
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const activeBranch = canEdit ? branch : myBranch

  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [files, setFiles] = useState<HolidayListFile[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const loadFiles = async () => {
    try { setFiles(await api.fetchHolidayListFiles()) } catch { /* leave the list as it was */ }
  }
  useEffect(() => { loadFiles() }, [])

  const list = holidays
    .filter(h => h.branch === activeBranch && h.date.startsWith(String(year)))
    .sort((a, b) => a.date.localeCompare(b.date))
  const branchFiles = files.filter(f => f.branch === activeBranch && f.year === year)

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true); setError('')
    try { await action(); after?.() } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally { setBusy(false) }
  }

  const addHoliday = () => {
    if (!date || !name.trim()) { setError('Please choose a date and write the holiday name.'); return }
    if (!date.startsWith(String(year))) { setError(`That date is not in ${year}. Change the year at the top first.`); return }
    if (list.some(h => h.date === date)) { setError('This branch already has a holiday on that date.'); return }
    run(async () => {
      await api.createHoliday({ branch: activeBranch, date, name: name.trim() })
      await onHolidaysRefresh()
    }, () => { setDate(''); setName('') })
  }

  const removeHoliday = (h: Holiday) => {
    if (!window.confirm(`Remove ${h.name} (${prettyDate(h.date)}) from the ${activeBranch} list?`)) return
    run(async () => { await api.deleteHoliday(h.id); await onHolidaysRefresh() })
  }

  const upload = (file: File | undefined) => {
    if (!file) return
    run(async () => { await api.uploadHolidayListFile({ branch: activeBranch, year, file }); await loadFiles() })
    if (fileInput.current) fileInput.current.value = ''
  }

  const openFile = (f: HolidayListFile) =>
    run(async () => { window.open(await api.fetchHolidayListDownloadUrl(f.id), '_blank', 'noopener') })

  const downloadFile = (f: HolidayListFile) =>
    run(async () => { window.location.href = await api.fetchHolidayListDownloadUrl(f.id, f.fileName) })

  const removeFile = (f: HolidayListFile) => {
    if (!window.confirm(`Delete the file ${f.fileName}?`)) return
    run(async () => { await api.deleteHolidayListFile(f.id); await loadFiles() })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Annual Holiday List</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canEdit ? 'Each branch has its own list. Pick a branch, then add its holidays or upload the list.' : `Holidays for the ${myBranch} branch.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <select value={branch} onChange={e => setBranch(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-border bg-card focus:outline-none">
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-lg border border-border bg-card focus:outline-none">
            {[thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">{error}</div>
      )}

      {canEdit && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <h3 className="font-semibold text-sm mb-3" style={{ color: navy }}>Add a holiday — {activeBranch}</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Holiday name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Republic Day"
                onKeyDown={e => { if (e.key === 'Enter') addHoliday() }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none" />
            </div>
            <button onClick={addHoliday} disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
              style={{ backgroundColor: gold, color: navy }}>
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <CalendarDays size={18} className="text-muted-foreground" />
          <h3 className="font-serif text-lg font-semibold text-foreground">{activeBranch} holidays {year}</h3>
          <span className="ml-auto text-xs text-muted-foreground">{list.length} {list.length === 1 ? 'day' : 'days'}</span>
        </div>
        {list.length === 0 ? (
          <p className="px-5 py-10 text-sm text-center text-muted-foreground">
            {canEdit ? 'No holidays added for this branch and year yet.' : 'HR has not added the holiday list for your branch yet.'}
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Holiday</th>
                {canEdit && <th className="px-5 py-3 w-12" />}
              </tr>
            </thead>
            <tbody>
              {list.map(h => (
                <tr key={h.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-5 py-3 text-sm font-medium text-foreground whitespace-nowrap">{prettyDate(h.date)}</td>
                  <td className="px-5 py-3 text-sm text-foreground">{h.name}</td>
                  {canEdit && (
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => removeHoliday(h)} disabled={busy} className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50" aria-label="Remove holiday" title="Remove">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(canEdit || branchFiles.length > 0) && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h3 className="font-semibold text-sm" style={{ color: navy }}>Holiday list file — {activeBranch} {year}</h3>
            {canEdit && (
              <>
                <input ref={fileInput} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
                <button onClick={() => fileInput.current?.click()} disabled={busy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-border bg-card hover:bg-muted disabled:opacity-60">
                  <Upload size={14} /> Upload PDF / image
                </button>
              </>
            )}
          </div>
          {branchFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No file uploaded for this branch and year.</p>
          ) : (
            <div className="space-y-2">
              {branchFiles.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border">
                  <FileText size={16} className="text-muted-foreground shrink-0" />
                  <button onClick={() => openFile(f)} className="text-sm font-medium text-left truncate hover:underline" style={{ color: navy }}>{f.fileName}</button>
                  <button onClick={() => downloadFile(f)} className="ml-auto p-1.5 rounded-md text-muted-foreground hover:bg-muted" aria-label="Download" title="Download"><Download size={15} /></button>
                  {canEdit && (
                    <button onClick={() => removeFile(f)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50" aria-label="Delete file" title="Delete"><Trash2 size={15} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
          {canEdit && <p className="text-[11px] text-muted-foreground mt-3">PDF or image, up to 5 MB. Typing the dates above is what marks those days as Holiday in Attendance.</p>}
        </div>
      )}
    </div>
  )
}
