import { useState, type FormEvent } from 'react'
import { login } from '../services/auth.service'

type LoginPageProps = {
  onLoginSuccess: () => void
}

function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const accessToken = await login(email.trim(), password)
      window.localStorage.setItem('accessToken', accessToken)
      onLoginSuccess()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070a] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-slate-400">
            NANODASHBOARD
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[0.01em] text-white">
            Sign in
          </h1>
        </div>

        <form
          onSubmit={(event) => { void handleSubmit(event) }}
          className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
        >
          {error ? (
            <div className="mb-4 rounded-xl border border-rose-400/18 bg-rose-400/[0.05] px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-[0.72rem] font-medium uppercase tracking-[0.2em] text-slate-400"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value) }}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition focus:border-white/20 focus:bg-white/[0.06]"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[0.72rem] font-medium uppercase tracking-[0.2em] text-slate-400"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value) }}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition focus:border-white/20 focus:bg-white/[0.06]"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-full border border-emerald-400/20 bg-emerald-400/10 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-100 transition-all hover:border-emerald-300/30 hover:bg-emerald-400/14 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default LoginPage
