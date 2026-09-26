import { useEffect, useState } from 'react'
import { Loader, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import type { Role } from '../types'
import * as api from '../lib/api'
import type { Session } from '../lib/api'

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

// Role cards shown on the login screen — which portal role to sign in as.
// Eligibility (who may actually use which role) is enforced entirely
// server-side now (employees.login_roles in Postgres), not here.
const ROLE_CARDS: { role: Role; title: string; desc: string }[] = [
  { role: 'crm', title: 'CRM Executive', desc: 'Apply leave, expenses & raise tickets' },
  { role: 'manager', title: 'Line Manager', desc: 'Approve team requests & manage payroll' },
  { role: 'hr', title: 'HR Manager', desc: 'Full HR operations across both companies' },
  { role: 'management', title: 'CEO', desc: 'Final approvals & org-wide oversight' },
  { role: 'finance', title: 'Finance Manager', desc: 'Payroll sign-off & expense reimbursements' },
]

const HIERARCHY = [
  { from: 'CRM applies leave', arrow: '→', to: 'Line Manager approves' },
  { from: 'Manager applies leave', arrow: '→', to: 'HR approves' },
  { from: 'HR applies leave', arrow: '→', to: 'Management approves' },
]

// 'sign-in' covers both returning users and first-time users alike (there's
// no separate "identify" step anymore — the backend is the only thing that
// knows whether an account/password/role combination is valid, so there's
// nothing useful to pre-check client-side before submitting). First-time
// users use "Forgot / first time?" the same as a password reset — both are
// just "prove you control the registered email, then set a password."
type Step = 'sign-in' | 'reset-sent' | 'reset-password' | 'reset-invalid'

export default function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [selected, setSelected] = useState<Role>('crm')
  const [step, setStep] = useState<Step>('sign-in')
  const [resetIdentity, setResetIdentity] = useState<{ name: string; email: string } | null>(null)
  const [resetToken, setResetToken] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [stats, setStats] = useState<api.PublicStats | null>(null)

  // A handful of live counts for the left panel — fetched once on mount, no
  // sign-in required (see server/src/routes/public.js). Failing silently is
  // fine here; the tiles just don't render rather than blocking sign-in.
  useEffect(() => {
    let cancelled = false
    api.fetchPublicStats().then(s => { if (!cancelled) setStats(s) }).catch(() => { })
    return () => { cancelled = true }
  }, [])

  // If the page was opened from a "Reset your password" (or "set up your
  // account") email link (?resetToken=...), verify it with the server
  // before showing anything sensitive — only a genuine, unexpired token
  // gets past this. Runs once on mount.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('resetToken')
    if (!token) return
    window.history.replaceState({}, '', window.location.pathname)

      ; (async () => {
        try {
          const result = await api.verifyResetToken(token)
          setResetIdentity({ name: result.name, email: '' })
          setResetToken(token)
          setSelected(result.role)
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

  const resetToSignIn = () => {
    setStep('sign-in')
    setResetIdentity(null)
    setResetToken('')
    setPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
  }

  const handleSignIn = async () => {
    setError('')
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Enter your registered work email.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }
    setLoading(true)
    try {
      const session = await api.login(selected, trimmedEmail, password)
      onLogin(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Email or password doesn't match a registered account for this role.`)
    } finally {
      setLoading(false)
    }
  }

  // Requests a setup/reset email for the currently-typed email+role — the
  // same flow covers both "I forgot my password" and "this is my first time
  // signing in", since both are just "prove you control the registered
  // email, then set a password."
  const handleForgotOrFirstTime = async () => {
    setError('')
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Enter your registered work email, then click this again.')
      return
    }
    setForgotLoading(true)
    try {
      await api.requestPasswordReset(trimmedEmail, selected)
    } catch {
      // Network hiccup — still show the same confirmation below. Nothing
      // sensitive either way, and resending is just clicking again.
    }
    setForgotLoading(false)
    setPassword('')
    setStep('reset-sent')
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
    try {
      const session = await api.setPassword(resetToken, newPassword)
      onLogin(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This reset link is invalid or has expired. Request a new one from the sign-in page.')
    } finally {
      setLoading(false)
    }
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
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
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

          {stats && (
            <div className="grid grid-cols-2 gap-3 mt-auto">
              {[
                { label: 'Employees', value: stats.employees },
                { label: 'Companies', value: stats.companies },
                { label: 'Open Tickets', value: stats.openTickets },
                { label: 'Active Exits', value: stats.activeExits },
              ].map(tile => (
                <div key={tile.label} className="rounded-xl p-4" style={{ backgroundColor: 'rgba(250,248,245,0.06)' }}>
                  <p className="font-serif text-2xl font-semibold" style={{ color: '#C9A96E' }}>{tile.value}</p>
                  <p className="text-xs" style={{ color: 'rgba(250,248,245,0.55)' }}>{tile.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-20 py-12 bg-background">
        <div className="max-w-md w-full mx-auto">
          {step === 'sign-in' && (
            <>
              <div className="mb-8">
                <h1 className="font-serif text-3xl font-semibold text-foreground mb-1.5">Welcome</h1>
                <p className="text-sm text-muted-foreground">Select your role, then sign in with your registered work email</p>
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
                  onKeyDown={handleEnterKey(handleSignIn)}
                  placeholder="you@company.com"
                  autoComplete="username"
                  className="w-full px-3 py-2.5 rounded-lg border bg-white text-sm text-foreground focus:outline-none"
                  style={{ borderColor: '#E5DFD5' }}
                />
              </div>

              <div className="mb-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password<Required /></label>
                <PasswordField
                  value={password}
                  onChange={v => { setPassword(v); setError('') }}
                  onKeyDown={handleEnterKey(handleSignIn)}
                  placeholder="Your password"
                  autoComplete="current-password"
                />
              </div>

              <div className="mb-4 text-right">
                <button type="button" onClick={handleForgotOrFirstTime} disabled={forgotLoading}
                  className="text-xs hover:underline transition-colors disabled:opacity-60" style={{ color: '#A8823C' }}>
                  {forgotLoading ? 'Sending…' : "First time, or forgot your password?"}
                </button>
              </div>

              {error && <p className="text-xs mb-4" style={{ color: '#B3452C' }}>{error}</p>}

              <button onClick={handleSignIn} disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: loading ? 0.7 : 1 }}>
                {loading && <Loader size={15} className="animate-spin" />}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <p className="text-center text-xs text-muted-foreground mt-5">
                First time signing in? Click "First time, or forgot your password?" above to set one.
              </p>
            </>
          )}

          {step === 'reset-sent' && (
            <>
              <button onClick={resetToSignIn} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ArrowLeft size={13} /> Back to sign in
              </button>
              <div className="mb-8">
                <h1 className="font-serif text-3xl font-semibold text-foreground mb-1.5">Check your email</h1>
                <p className="text-sm text-muted-foreground">
                  If that address is registered as a {card.title}, we've sent a link to set/reset the password — it works for 30 minutes.
                </p>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-5">
                Didn't get it? Check spam, or{' '}
                <button type="button" onClick={handleForgotOrFirstTime} disabled={forgotLoading} className="hover:underline disabled:opacity-60" style={{ color: '#A8823C' }}>
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
              <button onClick={resetToSignIn}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}>
                Back to sign in
              </button>
            </>
          )}

          {step === 'reset-password' && resetIdentity && (
            <>
              <button onClick={resetToSignIn} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ArrowLeft size={13} /> Change email or role
              </button>
              <div className="mb-8">
                <h1 className="font-serif text-3xl font-semibold text-foreground mb-1.5">Set your password</h1>
                <p className="text-sm text-muted-foreground">Choose a password for {resetIdentity.name.split(' ')[0]}'s account</p>
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
                {loading ? 'Setting up…' : 'Set Password & Sign In'}
              </button>

              <p className="text-center text-xs text-muted-foreground mt-5">
                You're here because you clicked the link we emailed you — go ahead and set your password.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}