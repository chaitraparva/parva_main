import { useEffect, useState } from 'react'
import { Bell, AlertTriangle, Clock, CreditCard, UserCheck, TrendingDown } from 'lucide-react'
import type { Notification } from '../types'

const typeIcons: Record<Notification['type'], React.ReactNode> = {
  'missed-followup': <Clock size={16} />,
  'unassigned-lead': <Bell size={16} />,
  'pending-payroll': <CreditCard size={16} />,
  'leave-request': <UserCheck size={16} />,
  flag: <AlertTriangle size={16} />,
}

const typeColors: Record<Notification['type'], { bg: string; color: string }> = {
  'missed-followup': { bg: '#FEF3C7', color: '#D97706' },
  'unassigned-lead': { bg: '#DBEAFE', color: '#2563EB' },
  'pending-payroll': { bg: '#F3F4F6', color: '#6B7280' },
  'leave-request': { bg: '#F5F3FF', color: '#7C3AED' },
  flag: { bg: '#FEF2F2', color: '#DC2626' },
}

const priorityBadge: Record<Notification['priority'], string> = {
  high: 'bg-red-50 text-red-600',
  medium: 'bg-amber-50 text-amber-600',
  low: 'bg-blue-50 text-blue-600',
}

interface NotificationsProps {
  notifications: Notification[]
  onNotificationsUpdate: (next: Notification[]) => void
}

export default function Notifications({ notifications: initial, onNotificationsUpdate }: NotificationsProps) {
  const [notifs, setNotifs] = useState(initial)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  // Re-sync if the parent's persisted copy changes underneath us (e.g. the
  // initial backend fetch finishing after this screen has already mounted).
  useEffect(() => { setNotifs(initial) }, [initial])

  const markRead = (id: string) => {
    const next = notifs.map((n) => n.id === id ? { ...n, read: true } : n)
    setNotifs(next)
    onNotificationsUpdate(next)
  }
  const markAllRead = () => {
    const next = notifs.map((n) => ({ ...n, read: true }))
    setNotifs(next)
    onNotificationsUpdate(next)
  }

  const filtered = filter === 'unread' ? notifs.filter((n) => !n.read) : notifs
  const unreadCount = notifs.filter((n) => !n.read).length

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {(['all', 'unread'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={{ backgroundColor: filter === f ? '#1C2B4A' : '#F5F2EC', color: filter === f ? '#FAF8F5' : '#7A7065' }}>
              {f === 'all' ? 'All Notifications' : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-sm font-medium text-accent hover:underline">
            Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {filtered.map((notif) => {
          const icon = typeIcons[notif.type]
          const colors = typeColors[notif.type]
          return (
            <div
              key={notif.id}
              onClick={() => markRead(notif.id)}
              className="bg-card rounded-xl border border-border shadow-sm p-5 cursor-pointer transition-all hover:shadow-md"
              style={{ borderLeft: !notif.read ? '3px solid #C9A96E' : undefined }}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: colors.bg, color: colors.color }}>
                  {icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-sm font-semibold text-foreground">{notif.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${priorityBadge[notif.priority]}`}>{notif.priority}</span>
                    {!notif.read && <span className="w-2 h-2 rounded-full bg-accent ml-auto shrink-0" />}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{notif.timestamp}</p>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-16 text-center">
            <TrendingDown size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="font-medium text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">No unread notifications right now.</p>
          </div>
        )}
      </div>
    </div>
  )
}
