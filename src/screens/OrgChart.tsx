import { useState, useRef, useMemo, useLayoutEffect, useEffect } from 'react'
import type { Employee, JobTitle } from '../types'
import { X, Mail, Phone, MapPin, Calendar, IdCard, UserCog, Briefcase, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

const navy = '#1C2B4A'

const roleLabels: Record<JobTitle, string> = { admin: 'Director', manager: 'Sales Manager', agent: 'CRM Agent', hr: 'HR Manager', finance: 'Finance Manager' }

function formatEmpId(id: string) {
  const n = id.split('-')[1]
  return n ? `EMP-${n.padStart(3, '0')}` : id.toUpperCase()
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

interface Props {
  employees: Employee[]
}

// ───────────────────────── Chart shape ─────────────────────────
// Built directly from each employee's managerId, not hand-placed — this used
// to be a separately hand-maintained tree, which is exactly how it drifted
// out of sync with the Directory screen (this chart and the Directory used
// to show different, inconsistent reporting lines for the same people).
// Reassigning someone's manager now only ever means changing their
// managerId in mockData.ts; the chart updates itself.
type ChartNode = { kind: 'employee'; id: string; children: ChartNode[] }

function buildOrgTree(employees: Employee[]): ChartNode[] {
  const roots = employees.filter(e => !e.managerId)
  const buildNode = (emp: Employee): ChartNode => ({
    kind: 'employee',
    id: emp.id,
    children: employees
      .filter(e => e.managerId === emp.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(buildNode),
  })
  // Multiple people with no manager (shouldn't normally happen — flags a
  // data gap) all render as separate top-level trees rather than being
  // silently dropped.
  return roots.map(buildNode)
}

function NodeCard({ employee, onSelect }: { employee: Employee; onSelect: (e: Employee) => void }) {
  return (
    <button
      onClick={() => onSelect(employee)}
      className="w-[76px] sm:w-[88px] bg-card border border-border rounded-lg shadow-sm px-1 py-1 flex flex-col items-center gap-0.5 hover:shadow-md hover:border-accent/50 transition-all text-center relative"
    >
      <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${employee.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} title={employee.status === 'active' ? 'Active' : 'On Leave'} />
      {employee.photoUrl ? (
        <img src={employee.photoUrl} alt={employee.name} className="w-6 h-6 rounded-full object-cover" />
      ) : (
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: `${navy}14`, color: navy }}>
          {initials(employee.name)}
        </div>
      )}
      <p className="text-[10px] font-semibold text-foreground leading-tight truncate w-full">{employee.name}</p>
      <p className="text-[8px] text-muted-foreground leading-tight truncate w-full">{employee.title || roleLabels[employee.role]}</p>
    </button>
  )
}

function ChartTreeNode({ node, byId, onSelect }: { node: ChartNode; byId: Map<string, Employee>; onSelect: (e: Employee) => void }) {
  const employee = byId.get(node.id)
  if (!employee) return null

  return (
    <div className="flex flex-col items-center">
      <NodeCard employee={employee} onSelect={onSelect} />
      {node.children.length > 0 && (
        <div className="org-tree-row flex items-start justify-center">
          {node.children.map((k) => (
            <div key={k.id} className="org-node-wrap flex flex-col items-center px-1">
              <ChartTreeNode node={k} byId={byId} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Auto-fit shrinks the chart to show everything at once, but below this it
// stops being readable without zooming in — which defeats the point just as
// much as scrolling did. So auto-fit won't go smaller than this; if one
// branch is wide enough to need more room than that (e.g. a manager with
// 15+ direct reports), that branch alone scrolls sideways within the chart
// card instead of the whole chart shrinking to accommodate it.
const MIN_FIT_SCALE = 0.62
const MIN_ZOOM_SCALE = 0.08

export default function OrgChart({ employees }: Props) {
  const [selected, setSelected] = useState<Employee | null>(null)
  const byId = new Map(employees.map(e => [e.id, e]))
  const roots = useMemo(() => buildOrgTree(employees), [employees])

  const reportingManagerName = (emp: Employee) =>
    emp.managerId ? (employees.find(e => e.id === emp.managerId)?.name || '—') : ''

  // ───────────────────── Fit-to-screen zoom ─────────────────────
  // The chart's natural size (measured from its own unscaled layout box —
  // CSS transform: scale() never changes scrollWidth/scrollHeight, only
  // paint) vs. the available card width decide how far to shrink it so the
  // whole tree is visible without side-scrolling. People can still zoom in
  // manually with the buttons below if they want a closer look, in which
  // case the chart becomes horizontally scrollable again.
  const outerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [paddingY, setPaddingY] = useState(0)
  const [natural, setNatural] = useState({ width: 0, height: 0 })
  const [fitMode, setFitMode] = useState(true)
  const [manualScale, setManualScale] = useState(1)

  useLayoutEffect(() => {
    const measure = () => {
      const el = contentRef.current
      if (el) setNatural({ width: el.scrollWidth, height: el.scrollHeight })
    }
    measure()
    // Fonts finishing load / images loading can change intrinsic size slightly.
    const t = setTimeout(measure, 200)
    return () => clearTimeout(t)
  }, [roots])

  useLayoutEffect(() => {
    const el = outerRef.current
    if (!el) return
    // clientWidth includes the card's own padding (p-6 / sm:p-10) — subtract
    // it so the fit calculation is against the space actually available to
    // the chart content, not the outer box, which mattered most on narrow
    // (mobile) widths where the padding is a bigger share of the screen.
    const update = () => {
      const cs = getComputedStyle(el)
      const paddingX = parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0')
      setContainerWidth(Math.max(0, el.clientWidth - paddingX))
      setPaddingY(parseFloat(cs.paddingTop || '0') + parseFloat(cs.paddingBottom || '0'))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => { ro.disconnect(); window.removeEventListener('resize', update) }
  }, [])

  const fitScale = natural.width && containerWidth
    ? Math.max(MIN_FIT_SCALE, Math.min(1, containerWidth / natural.width))
    : 1
  const scale = fitMode ? fitScale : manualScale

  useEffect(() => { if (fitMode) setManualScale(fitScale) }, [fitMode, fitScale])

  const scaledWidth = natural.width * scale
  const scaledHeight = natural.height * scale
  const needsHScroll = scaledWidth > containerWidth + 1
  const offsetX = needsHScroll ? 0 : Math.max(0, (containerWidth - scaledWidth) / 2)

  function zoom(delta: number) {
    setFitMode(false)
    setManualScale(s => Math.min(1.5, Math.max(MIN_ZOOM_SCALE, +(s + delta).toFixed(2))))
  }

  return (
    <div className="space-y-5">
      <style>{`
        .org-tree-row { position: relative; padding-top: 24px; }
        .org-node-wrap { position: relative; padding-top: 24px; flex: 1 0 auto; }
        .org-node-wrap::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: rgba(201,169,110,0.5); }
        .org-node-wrap:first-child::before { left: 50%; }
        .org-node-wrap:last-child::before { right: 50%; }
        .org-node-wrap::after { content: ''; position: absolute; top: 0; left: 50%; width: 1px; height: 24px; background: rgba(201,169,110,0.5); transform: translateX(-50%); }
      `}</style>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Organisation Chart</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Click on anyone to see their basic information · built from each person's reporting manager</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1.5 py-1 shrink-0">
          <button onClick={() => zoom(-0.1)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Zoom out" title="Zoom out">
            <ZoomOut size={15} />
          </button>
          <span className="text-xs font-medium text-muted-foreground w-10 text-center tabular-nums select-none">{Math.round(scale * 100)}%</span>
          <button onClick={() => zoom(0.1)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Zoom in" title="Zoom in">
            <ZoomIn size={15} />
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button onClick={() => setFitMode(true)} disabled={fitMode}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-40"
            style={{ color: fitMode ? '#A8823C' : undefined }}
            title="Fit whole chart to screen">
            <Maximize2 size={13} /> Fit to screen
          </button>
        </div>
      </div>

      <div ref={outerRef} className="bg-card rounded-xl border border-border shadow-sm p-6 sm:p-10 relative"
        style={{
          overflowX: needsHScroll ? 'auto' : 'hidden',
          overflowY: 'hidden',
          height: roots.length > 0 && scaledHeight ? scaledHeight + paddingY : undefined,
        }}>
        {roots.length > 0 ? (
          // Two nested boxes on purpose: transform: scale() only changes how
          // this content *paints* — it does not shrink the scrollable area a
          // parent reserves for it, so scrolling a directly-transformed child
          // to its "end" overshoots into blank space past the visual content.
          // The inner box (natural size) is what actually scales; the outer
          // wrapper is sized to the true scaled footprint so outerRef's
          // scroll range matches exactly what's painted. It also needs its
          // own overflow: hidden — without it, this wrapper's *own*
          // scrollWidth balloons back up to the inner (unscaled) box's size
          // and that oversized figure is what propagates out to outerRef.
          <div style={{ width: scaledWidth + 'px', height: scaledHeight + 'px', marginLeft: offsetX, overflow: 'hidden' }}>
            <div ref={contentRef} className="inline-flex gap-3"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: natural.width ? natural.width + 'px' : undefined,
              }}>
              {roots.map(root => (
                <ChartTreeNode key={root.id} node={root} byId={byId} onSelect={setSelected} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center">No employees to show.</p>
        )}
      </div>

      {/* Basic info modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center border-b border-border relative">
              <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
                <X size={16} />
              </button>
              {selected.photoUrl ? (
                <img src={selected.photoUrl} alt={selected.name} className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3" />
              ) : (
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-semibold font-serif mx-auto mb-3" style={{ backgroundColor: `${navy}1A`, color: navy }}>
                  {initials(selected.name)}
                </div>
              )}
              <h3 className="font-serif text-lg font-semibold text-foreground">{selected.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{selected.title || roleLabels[selected.role]} · {selected.team}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{selected.company}</p>
              <p className="flex items-center justify-center gap-1 text-[10px] font-mono text-muted-foreground mt-1.5 tracking-wide">
                <IdCard size={11} /> {formatEmpId(selected.id)}
              </p>
              <span className={`inline-flex mt-2 text-xs px-2.5 py-1 rounded-full font-medium ${selected.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {selected.status === 'active' ? 'Active' : 'On Leave'}
              </span>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail size={14} className="shrink-0" /><span className="truncate">{selected.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone size={14} className="shrink-0" /><span>{selected.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin size={14} className="shrink-0" /><span className="truncate">{selected.location}</span>
              </div>
              {selected.managerId && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserCog size={14} className="shrink-0" /><span className="truncate">Reports to {reportingManagerName(selected)}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {[
                  { label: 'Department', value: selected.department, icon: <Briefcase size={12} /> },
                  { label: 'Join Date', value: selected.joinDate, icon: <Calendar size={12} /> },
                ].map(info => (
                  <div key={info.label} className="p-3 rounded-lg bg-muted">
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">{info.icon} {info.label}</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{info.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
