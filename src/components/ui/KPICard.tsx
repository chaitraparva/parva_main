interface KPICardProps {
  title: string
  value: string | number
  sub?: string
  trend?: { value: string; up: boolean }
  accent?: boolean
  icon?: React.ReactNode
}

export default function KPICard({ title, value, sub, trend, accent, icon }: KPICardProps) {
  return (
    <div className={`bg-card rounded-xl p-6 shadow-sm border border-border relative overflow-hidden ${accent ? 'border-l-4 border-l-accent' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{title}</p>
        {icon && <div className="text-muted-foreground opacity-60">{icon}</div>}
      </div>
      <p className="font-serif text-3xl font-semibold text-foreground mb-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {trend && (
        <div className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${trend.up ? 'text-emerald-600' : 'text-red-600'}`}>
          <span>{trend.up ? '↑' : '↓'}</span>
          <span>{trend.value} vs last month</span>
        </div>
      )}
    </div>
  )
}
