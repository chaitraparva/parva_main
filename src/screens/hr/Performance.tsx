import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { GoalStatus, ReviewStage, ReviewRecommendation, PerformanceGoal, PerformanceReview } from '../../types'
import { Target, ClipboardCheck, Star, TrendingUp, Users2 } from 'lucide-react'

const navy = '#1C2B4A'
const gold = '#C9A96E'

const goalStatusColor: Record<GoalStatus, { bg: string; text: string }> = {
  'On Track': { bg: '#ECFDF5', text: '#059669' },
  'At Risk': { bg: '#FEF2F2', text: '#DC2626' },
  Completed: { bg: '#EEF2FF', text: '#4338CA' },
  'Not Started': { bg: '#F5F2EC', text: '#7A7065' },
}

const stageColor: Record<ReviewStage, { bg: string; text: string }> = {
  'Not Started': { bg: '#F5F2EC', text: '#7A7065' },
  'Self Review': { bg: '#EFF6FF', text: '#1D4ED8' },
  'Manager Review': { bg: '#FFFBEB', text: '#D97706' },
  '360 Feedback': { bg: '#F5F3FF', text: '#7C3AED' },
  Calibration: { bg: '#FFF7ED', text: '#EA580C' },
  Completed: { bg: '#ECFDF5', text: '#059669' },
}

const recColor: Record<ReviewRecommendation, { bg: string; text: string }> = {
  Promotion: { bg: '#ECFDF5', text: '#059669' },
  Hike: { bg: '#EEF2FF', text: '#4338CA' },
  PIP: { bg: '#FEF2F2', text: '#DC2626' },
  'No Change': { bg: '#F5F2EC', text: '#7A7065' },
}

interface PerformanceProps {
  goals: PerformanceGoal[]
  reviews: PerformanceReview[]
}

export default function Performance({ goals, reviews }: PerformanceProps) {
  const [tab, setTab] = useState<'goals' | 'reviews' | 'dashboard'>('goals')

  const activeGoals = goals.filter(g => g.status !== 'Completed').length
  const inProgressReviews = reviews.filter(r => r.stage !== 'Not Started' && r.stage !== 'Completed').length
  const ratedReviews = reviews.filter(r => r.finalRating)
  const avgRating = ratedReviews.length ? (ratedReviews.reduce((s, r) => s + (r.finalRating || 0), 0) / ratedReviews.length).toFixed(1) : '—'
  const recommendedCount = reviews.filter(r => r.recommendation === 'Promotion' || r.recommendation === 'Hike').length

  const distribution = [1, 2, 3, 4, 5].map(rating => ({
    rating: `${rating} ★`,
    count: reviews.filter(r => r.finalRating === rating).length,
  }))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">Performance Management</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Goals, review cycles, 360° feedback, and calibration</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Goals', value: activeGoals, icon: <Target size={16} />, color: navy },
          { label: 'Reviews In Progress', value: inProgressReviews, icon: <ClipboardCheck size={16} />, color: '#D97706' },
          { label: 'Avg. Final Rating', value: `${avgRating} / 5`, icon: <Star size={16} />, color: '#7C3AED' },
          { label: 'Promotion / Hike Recs', value: recommendedCount, icon: <TrendingUp size={16} />, color: '#059669' },
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
        {(['goals', 'reviews', 'dashboard'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
            style={{ backgroundColor: tab === t ? navy : 'transparent', color: tab === t ? '#FAF8F5' : '#7A7065' }}>
            {t === 'dashboard' ? 'Ratings Dashboard' : t}
          </button>
        ))}
      </div>

      {tab === 'goals' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map(g => {
            const sc = goalStatusColor[g.status]
            return (
              <div key={g.id} className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{g.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{g.employeeName} · {g.quarter} · weight {g.weight}%</p>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{g.status}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{g.description}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${g.progress}%`, backgroundColor: g.status === 'At Risk' ? '#DC2626' : gold }} />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-10 text-right">{g.progress}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border">
                {['Employee', 'Cycle', 'Stage', 'Self', 'Manager', 'Final', 'Feedback', 'Recommendation'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviews.map((r, i) => {
                const sc = stageColor[r.stage]
                return (
                  <tr key={r.id} className={`border-b border-border last:border-0 hover:bg-muted/40 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-foreground">{r.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{r.role} · {r.department}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-foreground">{r.cycle}</td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{r.stage}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground">{r.selfRating ? `${r.selfRating} ★` : '—'}</td>
                    <td className="px-5 py-4 text-sm text-foreground">{r.managerRating ? `${r.managerRating} ★` : '—'}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-foreground">{r.finalRating ? `${r.finalRating} ★` : '—'}</td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users2 size={12} /> {r.feedbackCount}</span>
                    </td>
                    <td className="px-5 py-4">
                      {r.recommendation ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: recColor[r.recommendation].bg, color: recColor[r.recommendation].text }}>
                          {r.recommendation}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-sm font-semibold text-foreground mb-1">Rating Distribution</p>
            <p className="text-xs text-muted-foreground mb-4">Final ratings across completed reviews — used for bell-curve normalisation</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={distribution} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD5" vertical={false} />
                <XAxis dataKey="rating" tick={{ fontSize: 12, fill: '#7A7065' }} axisLine={{ stroke: '#E5DFD5' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#7A7065' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5DFD5', fontSize: 12 }} />
                <Bar dataKey="count" name="Employees" fill={gold} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Recommendation Mix</p>
            <div className="space-y-3">
              {(['Promotion', 'Hike', 'No Change', 'PIP'] as ReviewRecommendation[]).map(rec => {
                const count = reviews.filter(r => r.recommendation === rec).length
                const c = recColor[rec]
                return (
                  <div key={rec} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: c.bg }}>
                    <span className="text-xs font-medium" style={{ color: c.text }}>{rec}</span>
                    <span className="text-sm font-bold" style={{ color: c.text }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
