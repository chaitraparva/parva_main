import { useEffect, useState } from 'react'
import { Loader, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import type { Employee, Role } from '../types'

// A red asterisk after a label, marking that field as required — used
// consistently across every field on this screen so it's obvious at a
// glance which ones must be filled in before continuing.
function Required() {
  return <span style={{ color: '#B3452C' }}> *</span>
}

// Password inputs with a show/hide toggle (the eye icon), so people can
// check what they've typed before submitting instead of guessing blind.
function PasswordField({ value, onChange, onKeyDown, placeholder, autoComplete, autoFocus }: {
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  placeholder: string
  autoComplete: string
  autoFocus?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="w-full px-3 py-2.5 pr-10 rounded-lg border bg-white text-sm text-foreground focus:outline-none"
        style={{ borderColor: '#E5DFD5' }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

// Role cards shown on the login screen. The first time anyone signs in with
// their registered work email, they set their own password; every sign-in
// after that just checks it. See the password-storage note below for the
// current, temporary limitation of how that password is kept.
const ROLE_CARDS: { role: Role; title: string; desc: string }[] = [
  { role: 'crm',        title: 'CRM Executive',   desc: 'Apply leave, expenses & raise tickets' },
  { role: 'manager',    title: 'Line Manager',    desc: 'Approve team requests & manage payroll' },
  { role: 'hr',          title: 'HR Manager',      desc: 'Full HR operations across both companies' },
  { role: 'management', title: 'CEO',             desc: 'Final approvals & org-wide oversight' },
  { role: 'finance',    title: 'Finance Manager', desc: 'Payroll sign-off & expense reimbursements' },
]

// JobTitle bucket to match emails against, per role.
const ELIGIBLE_JOB_TITLE: Record<Role, Employee['role']> = {
  crm: 'agent',
  manager: 'manager',
  hr: 'hr',
  management: 'admin',
  finance: 'finance',
}

// Finance Manager stays a single fixed account (Ravishankar) — unlike HR,
// which genuinely has two people who both need their own login.
const LOGIN_ONLY_IDS: Partial<Record<Role, string[]>> = {
  finance: ['DF230003'], // Ravishankar
}

// People who have the matching job title but shouldn't be able to sign in
// as that role.
const LOGIN_EXCLUDE_IDS: Partial<Record<Role, string[]>> = {
  manager: ['DF230006'], // Thejavathi J N — Operations Head, not meant to sign in as Line Manager
}

// People who should be able to sign in as a role even though it doesn't
// match their primary `role` field — e.g. Chaitra is a Director (admin) but
// also acts as a Line Manager over her direct reports, so she needs both
// the CEO/Director card and the Line Manager card to work for her.
const LOGIN_EXTRA_IDS: Partial<Record<Role, string[]>> = {
  manager: ['PA230045'], // Chaitra — Director who also signs in as Line Manager
}

function eligibleFor(role: Role, employees: Employee[]): Employee[] {
  const jobTitle = ELIGIBLE_JOB_TITLE[role]
  const extraIds = LOGIN_EXTRA_IDS[role] || []
  let pool = employees.filter(e => e.role === jobTitle || extraIds.includes(e.id))
  const onlyIds = LOGIN_ONLY_IDS[role]
  if (onlyIds) pool = pool.filter(e => onlyIds.includes(e.id) || extraIds.includes(e.id))
  const excludeIds = LOGIN_EXCLUDE_IDS[role]
  if (excludeIds) pool = pool.filter(e => !excludeIds.includes(e.id))
  return pool.sort((a, b) => a.name.localeCompare(b.name))
}

// ─────────────────────── Password storage (temporary) ───────────────────────
// There's no live backend yet (it's built — see server/ — but waiting on
// Supabase/Vercel Pro to be purchased and connected), so each person's
// password is kept in their own browser for now: hashed with SHA-256 before
// storage, never in plain text, but NOT the same thing as the real backend's
// per-person bcrypt-hashed password stored centrally. Two real limitations
// this brings until that's connected: signing in from a different device or
// browser looks like a first-ever login there too, and clearing site data
// wipes the password. Both go away once the backend is live.
const PASSWORD_KEY_PREFIX = 'parva_pwd_'

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hasPasswordSet(employeeId: string): boolean {
  return localStorage.getItem(PASSWORD_KEY_PREFIX + employeeId) !== null
}

async function setStoredPassword(employeeId: string, password: string): Promise<void> {
  localStorage.setItem(PASSWORD_KEY_PREFIX + employeeId, await sha256Hex(password))
}

async function checkStoredPassword(employeeId: string, password: string): Promise<boolean> {
  const stored = localStorage.getItem(PASSWORD_KEY_PREFIX + employeeId)
  return stored !== null && stored === (await sha256Hex(password))
}

const HIERARCHY = [
  { from: 'CRM applies leave', arrow: '→', to: 'Line Manager approves' },
  { from: 'Manager applies leave', arrow: '→', to: 'HR approves' },
  { from: 'HR applies leave', arrow: '→', to: 'Management approves' },
]

type Step = 'identify' | 'set-password' | 'sign-in' | 'reset-sent' | 'reset-password' | 'reset-invalid'

export default function Login({ onLogin, employees }: { onLogin: (role: Role, employeeId: string) => void; employees: Employee[] }) {
  const [selected, setSelected] = useState<Role>('crm')
  const [step, setStep] = useState<Step>('identify')
  const [matched, setMatched] = useState<Employee | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  // If the page was opened from a "Reset your password" email link
  // (?resetToken=...), verify it with the server before showing anything
  // sensitive — only a genuine, unexpired token gets past this. Runs once
  // on mount.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('resetToken')
    if (!token) return
    window.history.replaceState({}, '', window.location.pathname)

    ;(async () => {
      try {
        const res = await fetch('/api/auth/verify-reset-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'This reset link is invalid or has expired.')
        const emp = employees.find(e => e.id === data.employeeId) || null
        if (!emp) throw new Error('This account could not be found.')
        setMatched(emp)
        setSelected(data.role as Role)
        setStep('reset-password')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'This reset link is invalid or has expired.')
        setStep('reset-invalid')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const card = ROLE_CARDS.find(r => r.role === selected)!

  const selectRole = (role: Role) => {
    setSelected(role)
    setError('')
  }

  const resetToIdentify = () => {
    setStep('identify')
    setMatched(null)
    setPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
  }

  const handleContinue = () => {
    setError('')
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Enter your registered work email.')
      return
    }
    const match = eligibleFor(selected, employees).find(e => e.email.toLowerCase() === trimmedEmail)
    if (!match) {
      setError(`This email isn't registered as a ${card.title}.`)
      return
    }
    setMatched(match)
    setStep(hasPasswordSet(match.id) ? 'sign-in' : 'set-password')
  }

  const handleSetPassword = async () => {
    setError('')
    if (newPassword.length < 6) {
      setError('Choose a password with at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }
    setLoading(true)
    await setStoredPassword(matched!.id, newPassword)
    setLoading(false)
    onLogin(selected, matched!.id)
  }

  // Requests a reset email for a given account rather than jumping
  // straight to a "set new password" form — the form only ever appears
  // after clicking the link that email contains (see the
  // verify-reset-token effect above). This is what keeps a reset from
  // being completable by anyone who merely knows the work email.
  const requestPasswordReset = async (employeeId: string, role: Role) => {
    setForgotLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, role }),
      })
    } catch {
      // Network hiccup — still show the same confirmation below. Nothing
      // sensitive either way, and resending is just clicking again.
    }
    setForgotLoading(false)
    setPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setStep('reset-sent')
  }

  // "Forgot password?" from the sign-in step — the account is already
  // known (matched), so just request a reset for it.
  const goToForgotPassword = async () => {
    setError('')
    await requestPasswordReset(matched!.id, selected)
  }

  // "Forgot password?" from the very first screen — nothing has been
  // matched yet, so look the person up by the email they've typed (for
  // whichever role card is currently selected) the same way Continue
  // does, then request the reset for that account.
  const handleForgotFromIdentify = async () => {
    setError('')
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Enter your registered work email, then click "Forgot password?" again.')
      return
    }
    const match = eligibleFor(selected, employees).find(e => e.email.toLowerCase() === trimmedEmail)
    if (!match) {
      setError(`This email isn't registered as a ${card.title}.`)
      return
    }
    setMatched(match)
    await requestPasswordReset(match.id, selected)
  }

  const handleSignIn = async () => {
    setError('')
    if (!password) {
      setError('Enter your password.')
      return
    }
    setLoading(true)
    const ok = await checkStoredPassword(matched!.id, password)
    setLoading(false)
    if (!ok) {
      setError('Incorrect password.')
      return
    }
    onLogin(selected, matched!.id)
  }

  const handleEnterKey = (action: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') action()
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-5/12 flex-col relative overflow-hidden" style={{ backgroundColor: '#1C2B4A' }}>
        <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&h=1200&fit=crop&auto=format"
          alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,rgba(28,43,74,0.98) 0%,rgba(28,43,74,0.82) 100%)' }} />
        <div className="relative z-10 flex flex-col h-full p-12">
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#C9A96E,#A8823C)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div>
              <p className="font-serif text-xl font-bold" style={{ color: '#C9A96E' }}>Parva Group</p>
              <p className="text-xs tracking-[0.2em] uppercase" style={{ color: 'rgba(201,169,110,0.55)' }}>Portal</p>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="font-serif text-4xl font-semibold leading-tight mb-4" style={{ color: '#FAF8F5' }}>
              Built for every<br />level of your org
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgba(250,248,245,0.5)' }}>
              Leave, payroll, expenses and tickets flow through a clear approval hierarchy — from your team to leadership.
            </p>
            <div className="space-y-2.5">
              {HIERARCHY.map(h => (
                <div key={h.from} className="flex items-center gap-3 text-xs" style={{ color: 'rgba(250,248,245,0.55)' }}>
                  <span className="px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>{h.from}</span>
                  <span style={{ color: 'rgba(201,169,110,0.4)' }}>{h.arrow}</span>
                  <span className="px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'rgba(250,248,245,0.07)', color: 'rgba(250,248,245,0.7)' }}>{h.to}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[{ n: `${employees.length}`, l: 'Employees' }, { n: '2', l: 'Companies' }, { n: '3', l: 'Open Tickets' }, { n: '2', l: 'Active Exits' }].map(s => (
              <div key={s.l} className="rounded-xl p-4" style={{ backgroundColor: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.18)' }}>
                <p className="font-serif text-xl font-semibold" style={{ color: '#C9A96E' }}>{s.n}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(250,248,245,0.45)' }}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-20 py-12 bg-background">
        <div className="max-w-md w-full mx-auto">
          {step === 'identify' && (
            <>
              <div className="mb-8">
                <h1 className="font-serif text-3xl font-semibold text-foreground mb-1.5">Welcome</h1>
                <p className="text-sm text-muted-foreground">Select your role, then enter your registered work email</p>
              </div>

              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">I am a…</p>
                <div className="grid grid-cols-2 gap-3">
                  {ROLE_CARDS.map(r => (
                    <button key={r.role} onClick={() => selectRole(r.role)}
                      className="p-4 rounded-xl border text-left transition-all"
                      style={{
                        borderColor: selected === r.role ? '#C9A96E' : '#E5DFD5',
                        backgroundColor: selected === r.role ? 'rgba(201,169,110,0.06)' : '#fff',
                        boxShadow: selected === r.role ? '0 0 0 2px rgba(201,169,110,0.22)' : 'none',
                      }}>
                      <p className="text-xs font-bold text-foreground leading-tight mb-1">{r.title}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Work email<Required /></label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onKeyDown={handleEnterKey(handleContinue)}
                  placeholder="you@company.com"
                  autoComplete="username"
                  className="w-full px-3 py-2.5 rounded-lg border bg-white text-sm text-foreground focus:outline-none"
                  style={{ borderColor: '#E5DFD5' }}
                />
              </div>

              <div className="mb-4 text-right">
                <button type="button" onClick={handleForgotFromIdentify} disabled={forgotLoading}
                  className="text-xs hover:underline transition-colors disabled:opacity-60" style={{ color: '#A8823C' }}>
                  {forgotLoading ? 'Sending…' : 'Forgot password?'}
                </button>
              </div>

              {error && <p className="text-xs mb-4" style={{ color: '#B3452C' }}>{error}</p>}

              <button onClick={handleContinue}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}>
                Continue
              </button>

              <p className="text-center text-xs text-muted-foreground mt-5">
                First time signing in? You'll be asked to set your own password after this.
              </p>
            </>
          )}

          {step === 'set-password' && matched && (
            <>
              <button onClick={resetToIdentify} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ArrowLeft size={13} /> Change email or role
              </button>
              <div className="mb-8">
                <h1 className="font-serif text-3xl font-semibold text-foreground mb-1.5">Welcome, {matched.name.split(' ')[0]}</h1>
                <p className="text-sm text-muted-foreground">This is your first time signing in — set a password for your account</p>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">New password<Required /></label>
                <PasswordField
                  value={newPassword}
                  onChange={v => { setNewPassword(v); setError('') }}
                  onKeyDown={handleEnterKey(handleSetPassword)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirm password<Required /></label>
                <PasswordField
                  value={confirmPassword}
                  onChange={v => { setConfirmPassword(v); setError('') }}
                  onKeyDown={handleEnterKey(handleSetPassword)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />
              </div>

              {error && <p className="text-xs mb-4" style={{ color: '#B3452C' }}>{error}</p>}

              <button onClick={handleSetPassword} disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: loading ? 0.7 : 1 }}>
                {loading && <Loader size={15} className="animate-spin" />}
                {loading ? 'Setting up…' : 'Set Password & Sign In'}
              </button>
            </>
          )}

          {step === 'sign-in' && matched && (
            <>
              <button onClick={resetToIdentify} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ArrowLeft size={13} /> Change email or role
              </button>
              <div className="mb-8">
                <h1 className="font-serif text-3xl font-semibold text-foreground mb-1.5">Welcome back, {matched.name.split(' ')[0]}</h1>
                <p className="text-sm text-muted-foreground">Enter your password to continue</p>
              </div>

              <div className="mb-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password<Required /></label>
                <PasswordField
                  value={password}
                  onChange={v => { setPassword(v); setError('') }}
                  onKeyDown={handleEnterKey(handleSignIn)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  autoFocus
                />
              </div>

              <div className="mb-4 text-right">
                <button type="button" onClick={goToForgotPassword} disabled={forgotLoading}
                  className="text-xs hover:underline transition-colors disabled:opacity-60" style={{ color: '#A8823C' }}>
                  {forgotLoading ? 'Sending…' : 'Forgot password?'}
                </button>
              </div>

              {error && <p className="text-xs mb-4" style={{ color: '#B3452C' }}>{error}</p>}

              <button onClick={handleSignIn} disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: loading ? 0.7 : 1 }}>
                {loading && <Loader size={15} className="animate-spin" />}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </>
          )}

          {step === 'reset-sent' && (
            <>
              <button onClick={resetToIdentify} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ArrowLeft size={13} /> Change email or role
              </button>
              <div className="mb-8">
                <h1 className="font-serif text-3xl font-semibold text-foreground mb-1.5">Check your email</h1>
                <p className="text-sm text-muted-foreground">
                  If that address is registered as a {card.title}, we've sent a link to reset the password — it works for 30 minutes.
                </p>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-5">
                Didn't get it? Check spam, or{' '}
                <button type="button" onClick={goToForgotPassword} disabled={forgotLoading} className="hover:underline disabled:opacity-60" style={{ color: '#A8823C' }}>
                  send it again
                </button>.
              </p>
            </>
          )}

          {step === 'reset-invalid' && (
            <>
              <div className="mb-8">
                <h1 className="font-serif text-3xl font-semibold text-foreground mb-1.5">Link expired</h1>
                <p className="text-sm text-muted-foreground">{error || 'This reset link is invalid or has expired.'}</p>
              </div>
              <button onClick={resetToIdentify}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}>
                Back to sign in
              </button>
            </>
          )}

          {step === 'reset-password' && matched && (
            <>
              <button onClick={resetToIdentify} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ArrowLeft size={13} /> Change email or role
              </button>
              <div className="mb-8">
                <h1 className="font-serif text-3xl font-semibold text-foreground mb-1.5">Reset your password</h1>
                <p className="text-sm text-muted-foreground">Set a new password for {matched.name.split(' ')[0]}'s account ({matched.email})</p>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">New password<Required /></label>
                <PasswordField
                  value={newPassword}
                  onChange={v => { setNewPassword(v); setError('') }}
                  onKeyDown={handleEnterKey(handleSetPassword)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirm password<Required /></label>
                <PasswordField
                  value={confirmPassword}
                  onChange={v => { setConfirmPassword(v); setError('') }}
                  onKeyDown={handleEnterKey(handleSetPassword)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />
              </div>

              {error && <p className="text-xs mb-4" style={{ color: '#B3452C' }}>{error}</p>}

              <button onClick={handleSetPassword} disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: loading ? 0.7 : 1 }}>
                {loading && <Loader size={15} className="animate-spin" />}
                {loading ? 'Resetting…' : 'Reset Password & Sign In'}
              </button>

              <p className="text-center text-xs text-muted-foreground mt-5">
                You're here because you clicked the reset link we emailed to {matched.email || 'your registered address'} — go ahead and set a new password.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
