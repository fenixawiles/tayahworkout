import { useState } from 'react'
import { Activity, ArrowRight, Eye, EyeOff } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { authRedirectUrl, isSupabaseConfigured, supabase } from '../lib/supabase'

type AuthMode = 'signin' | 'signup' | 'forgot' | 'recovery'

interface AuthScreenProps {
  onDemo: () => void
  onAuthenticated: (user: User) => void
  recoveryMode?: boolean
}

export function AuthScreen({ onDemo, onAuthenticated, recoveryMode }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(recoveryMode ? 'recovery' : 'signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: authRedirectUrl(),
            data: {
              display_name: name.trim(),
              time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        })
        if (authError) throw authError
        if (data.user && data.session) onAuthenticated(data.user)
        else setMessage('Check your email to finish creating your account.')
      } else if (mode === 'signin') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
        onAuthenticated(data.user)
      } else if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() })
        if (authError) throw authError
        setMessage('If that email has an account, a reset link is on its way.')
      } else {
        const { data, error: authError } = await supabase.auth.updateUser({ password })
        if (authError) throw authError
        if (data.user) onAuthenticated(data.user)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'signup' ? 'Create your space' : mode === 'forgot' ? 'Reset your password' : mode === 'recovery' ? 'Choose a new password' : 'Welcome back'

  return (
    <main className="auth-shell">
      <header className="auth-masthead"><div className="auth-brand" aria-hidden="true"><Activity /></div><p className="auth-wordmark">momentum</p></header>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">YOUR WORKOUT CALENDAR</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-intro">
          {mode === 'signup' ? 'Plan your month, move at your pace, and keep every win in one calm place.' : mode === 'signin' ? 'Pick up exactly where you left off.' : 'We’ll help you get back into your account.'}
        </p>

        {!isSupabaseConfigured ? (
          <div className="demo-access">
            <p>This preview is ready to explore. Connect Supabase to turn on private accounts and cross-device sync.</p>
            <button className="primary-button" onClick={onDemo}>Preview Momentum <ArrowRight aria-hidden="true" /></button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            {mode === 'signup' && (
              <label>
                <span>Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required placeholder="What should we call you?" />
              </label>
            )}
            {mode !== 'recovery' && (
              <label>
                <span>Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com" />
              </label>
            )}
            {mode !== 'forgot' && (
              <label>
                <span>{mode === 'recovery' ? 'New password' : 'Password'}</span>
                <span className="password-field">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required placeholder="At least 8 characters" />
                  <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button>
                </span>
              </label>
            )}
            {error && <p className="form-message error" role="alert">{error}</p>}
            {message && <p className="form-message success" role="status">{message}</p>}
            <button className="primary-button" disabled={busy}>
              {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'recovery' ? 'Save new password' : 'Sign in'}
              {!busy && <ArrowRight aria-hidden="true" />}
            </button>
          </form>
        )}

        {isSupabaseConfigured && mode !== 'recovery' && (
          <div className="auth-switches">
            {mode === 'signin' ? (
              <>
                <button onClick={() => setMode('forgot')}>Forgot password?</button>
                <p>New here? <button onClick={() => setMode('signup')}>Create an account</button></p>
              </>
            ) : (
              <button onClick={() => setMode('signin')}>Back to sign in</button>
            )}
          </div>
        )}
      </section>
      <footer className="auth-legal-links"><a href="?legal=terms">Terms of use</a><span>·</span><a href="?legal=privacy">Privacy policy</a></footer>
    </main>
  )
}
