import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Role, Employee } from '../../types'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface LayoutProps {
  role: Role
  screen: string
  onNavigate: (screen: string, params?: Record<string, string>) => void
  onLogout: () => void
  unreadCount?: number
  currentEmployee?: Employee
  children: ReactNode
}

export default function Layout({ role, screen, onNavigate, onLogout, unreadCount = 0, currentEmployee, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleNavigate = (s: string, p?: Record<string, string>) => {
    onNavigate(s, p)
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={role} activeScreen={screen} onNavigate={handleNavigate} onLogout={onLogout} unreadCount={unreadCount} open={sidebarOpen} onClose={() => setSidebarOpen(false)} currentEmployee={currentEmployee} />
      <TopBar role={role} screen={screen} unreadCount={unreadCount} onNavigate={handleNavigate} onMenuClick={() => setSidebarOpen(true)} currentEmployee={currentEmployee} />
      <main className="lg:ml-64 pt-16 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">{children}</div>
      </main>
    </div>
  )
}
