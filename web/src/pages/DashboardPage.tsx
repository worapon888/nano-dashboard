import { useEffect, useRef, useState } from 'react'
import DashboardWorkspace from '../features/dashboard/components/DashboardPage'
import { useDashboardSocket } from '../features/dashboard/hooks/useDashboardSocket'
import { getDashboardSummary } from '../services/dashboard.service'
import {
  getAuthenticatedUser,
  login,
  loginDemoUser,
  register,
  type AuthenticatedUser,
} from '../services/auth.service'
import {
  clearAuthTokens,
  getAccessToken,
  setAuthTokens,
  type AuthTokens,
} from '../services/auth-storage'
import {
  listUsers,
  softDeleteUser,
  updateUserDisplayName,
  type ManagedUser,
} from '../services/users.service'
import type {
  BtcLivePriceUpdate,
  BtcLiveVolumeUpdate,
  BtcTrendRange,
  DailyPnlRange,
  DashboardSummaryData,
  RealtimeUserEvent,
} from '../types/dashboard'

// ---------------------------------------------------------------------------
// Auth error mapper
// ---------------------------------------------------------------------------

function mapAuthError(err: unknown): string {
  if (err !== null && typeof err === 'object' && 'response' in err) {
    const status = (err as { response?: { status?: number } }).response?.status
    if (status === 404) return 'Auth endpoint not found. Check API base URL.'
    if (status === 401) return 'Invalid email or password.'
    if (status === 409) return 'An account with that email already exists.'
    if (status === 400) return 'Please check your input and try again.'
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong. Please try again.'
}

function getHttpStatus(err: unknown): number | null {
  if (err !== null && typeof err === 'object' && 'response' in err) {
    const status = (err as { response?: { status?: number } }).response?.status
    return typeof status === 'number' ? status : null
  }

  return null
}

// ---------------------------------------------------------------------------
// Unauthenticated view — demo login / sign in / register panel
// ---------------------------------------------------------------------------

type AuthMode = 'demo' | 'login' | 'register'

const AUTH_TABS: { mode: AuthMode; label: string }[] = [
  { mode: 'demo', label: 'Demo' },
  { mode: 'login', label: 'Sign In' },
  { mode: 'register', label: 'Register' },
]

type UnauthenticatedViewProps = {
  authLoading: boolean
  authError: string | null
  onDemoLogin: () => void
  onLogin: (email: string, password: string) => void
  onRegister: (email: string, password: string, displayName: string) => void
}

function UnauthenticatedView({
  authLoading,
  authError,
  onDemoLogin,
  onLogin,
  onRegister,
}: UnauthenticatedViewProps) {
  const [mode, setMode] = useState<AuthMode>('demo')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  function handleModeChange(next: AuthMode) {
    setMode(next)
    setEmail('')
    setPassword('')
    setDisplayName('')
  }

  const submitLabel = mode === 'login' ? 'Sign In' : 'Create Account'
  const loadingLabel = mode === 'login' ? 'Signing in…' : 'Creating account…'

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05070a] text-slate-100">
      {/* Background — matches DashboardBackground */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[#05070a]" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 18% 14%, rgba(22, 163, 74, 0.045), transparent 30%),
              radial-gradient(circle at 82% 10%, rgba(37, 99, 235, 0.04), transparent 28%),
              radial-gradient(circle at 50% 120%, rgba(255, 255, 255, 0.015), transparent 38%)
            `,
          }}
        />
        <div className="dashboard-grid-overlay absolute inset-0" />
        <div className="dashboard-noise-overlay absolute inset-0" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Wordmark */}
        <p className="mb-6 text-center text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-slate-400">
          NANODASHBOARD
        </p>

        {/* Card */}
        <div className="rounded-[1.4rem] border border-white/8 bg-white/3 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          {/* Icon */}
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/4">
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-slate-400" aria-hidden="true">
              <rect x="3" y="9" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="mt-5 text-lg font-semibold tracking-[0.01em] text-white">
            Authentication required
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-slate-400">
            Use the demo account for a quick preview, or sign in with your credentials.
          </p>

          {/* Mode tabs */}
          <div className="mt-5 flex gap-1 rounded-xl border border-white/6 bg-white/2 p-1">
            {AUTH_TABS.map(({ mode: tabMode, label }) => (
              <button
                key={tabMode}
                type="button"
                onClick={() => { handleModeChange(tabMode) }}
                className={[
                  'flex-1 rounded-lg py-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] transition-all',
                  mode === tabMode
                    ? 'bg-white/8 text-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.4)]'
                    : 'text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Error banner */}
          {authError ? (
            <div className="mt-4 rounded-xl border border-rose-400/18 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">
              {authError}
            </div>
          ) : null}

          {/* ── Demo mode ───────────────────────────────────────────────── */}
          {mode === 'demo' ? (
            <div className="mt-5">
              <p className="mb-4 rounded-xl border border-white/6 bg-white/2 px-4 py-3 text-[0.78rem] leading-5 text-slate-400">
                Logs in as{' '}
                <span className="font-medium text-slate-300">admin@example.com</span>{' '}
                — no credentials needed.
              </p>
              <button
                type="button"
                onClick={onDemoLogin}
                disabled={authLoading}
                data-testid="demo-login-button"
                className="w-full rounded-full border border-emerald-400/20 bg-emerald-400/10 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-100 shadow-[0_0_0_1px_rgba(74,222,128,0.04)] transition-all hover:border-emerald-300/30 hover:bg-emerald-400/14 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading ? 'Signing in…' : 'Demo Login'}
              </button>
            </div>
          ) : null}

          {/* ── Login / Register form ───────────────────────────────────── */}
          {mode === 'login' || mode === 'register' ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (mode === 'login') onLogin(email.trim(), password)
                if (mode === 'register') onRegister(email.trim(), password, displayName.trim())
              }}
              className="mt-5 space-y-3"
            >
              {mode === 'register' ? (
                <div>
                  <label
                    htmlFor="auth-display-name"
                    className="block text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-500"
                  >
                    Display name
                  </label>
                  <input
                    id="auth-display-name"
                    type="text"
                    autoComplete="name"
                    required
                    maxLength={120}
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value) }}
                    placeholder="Your name"
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-white/18 focus:bg-white/6"
                  />
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  data-testid="auth-email-input"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value) }}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-white/18 focus:bg-white/6"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                  minLength={8}
                  data-testid="auth-password-input"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value) }}
                  placeholder="Min. 8 characters"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-white/18 focus:bg-white/6"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                data-testid={mode === 'login' ? 'sign-in-button' : 'register-button'}
                className="w-full rounded-full border border-white/10 bg-white/4 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-200 transition-all hover:border-white/16 hover:bg-white/7 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading ? loadingLabel : submitLabel}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Route page — owns auth state + dashboard data; single source of truth
// ---------------------------------------------------------------------------

const GENERIC_LOAD_ERROR_MESSAGE = 'Unable to load dashboard summary right now.'
const REALTIME_NOTICE_DURATION_MS = 4000
const REALTIME_SUMMARY_REFRESH_DELAY_MS = 300

function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(getAccessToken()),
  )

  // Dashboard data states
  const [data, setData] = useState<DashboardSummaryData | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null)
  const [loading, setLoading] = useState(
    () => Boolean(getAccessToken()),
  )
  const [error, setError] = useState<string | null>(null)
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null)
  const [btcTrendRange, setBtcTrendRange] = useState<BtcTrendRange>('1h')
  const [dailyPnlRange, setDailyPnlRange] = useState<DailyPnlRange>('week')
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  // Auth panel states (separate from dashboard loading)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const realtimeNoticeTimerRef = useRef<number | null>(null)
  const realtimeSummaryRefreshTimerRef = useRef<number | null>(null)

  const btcLiveStatus = useDashboardSocket({
    enabled: isAuthenticated,
    onBtcPriceUpdated: handleBtcPriceUpdated,
    onBtcVolumeUpdated: handleBtcVolumeUpdated,
    onUserCreated: handleUserCreatedRealtime,
    onUserUpdated: handleUserUpdatedRealtime,
  })

  // ------------------------------------------------------------------
  // Dashboard data fetch
  // ------------------------------------------------------------------

  async function loadDashboardSummary() {
    setLoading(true)
    setError(null)

    const token = getAccessToken()

    if (!token) {
      setIsAuthenticated(false)
      setLoading(false)
      return
    }

    try {
      const summary = await getDashboardSummary(
        token,
        btcTrendRange,
        btcTrendRange,
        dailyPnlRange,
      )
      setData(summary)
    } catch (loadError) {
      const status = getHttpStatus(loadError)

      if (status === 401) {
        clearAuthTokens()
        setData(null)
        setError(null)
        setAuthError('Session expired. Please sign in again.')
        setIsAuthenticated(false)
        return
      }

      const message =
        loadError instanceof Error ? loadError.message : GENERIC_LOAD_ERROR_MESSAGE
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function loadCurrentUser() {
    const token = getAccessToken()

    if (!token) {
      setCurrentUser(null)
      return
    }

    try {
      const user = await getAuthenticatedUser(token)
      setCurrentUser(user)
    } catch (loadError) {
      const status = getHttpStatus(loadError)

      if (status === 401) {
        clearAuthTokens()
        setCurrentUser(null)
        setData(null)
        setError(null)
        setAuthError('Session expired. Please sign in again.')
        setIsAuthenticated(false)
      }
    }
  }

  async function loadManagedUsers() {
    const token = getAccessToken()

    if (!token) {
      setManagedUsers([])
      return
    }

    setUsersLoading(true)
    setUsersError(null)

    try {
      const users = await listUsers(token)
      setManagedUsers(users)
    } catch (loadError) {
      const status = getHttpStatus(loadError)

      if (status === 401) {
        return
      }

      setUsersError(loadError instanceof Error ? loadError.message : 'Unable to load users.')
    } finally {
      setUsersLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (realtimeNoticeTimerRef.current !== null) {
        window.clearTimeout(realtimeNoticeTimerRef.current)
      }

      if (realtimeSummaryRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeSummaryRefreshTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      void loadCurrentUser()
      void loadDashboardSummary()
      void loadManagedUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [btcTrendRange, dailyPnlRange, isAuthenticated])

  function handleBtcTrendRangeChange(nextRange: BtcTrendRange) {
    setBtcTrendRange((currentRange) =>
      currentRange === nextRange ? currentRange : nextRange,
    )
  }

  function handleDailyPnlRangeChange(nextRange: DailyPnlRange) {
    setDailyPnlRange((currentRange) =>
      currentRange === nextRange ? currentRange : nextRange,
    )
  }

  function handleBtcPriceUpdated(update: BtcLivePriceUpdate) {
    if (update.symbol !== 'BTCUSDT') {
      return
    }

    setData((current) => {
      if (!current?.btcPriceTrend) {
        return current
      }

      const currentTrend = current.btcPriceTrend
      const hasUsableSeries =
        currentTrend.labels.length > 0 &&
        currentTrend.labels.length === currentTrend.series.length

      const nextSeries = hasUsableSeries
        ? currentTrend.series.map((value, index, sourceSeries) =>
            index === sourceSeries.length - 1 ? update.price : value,
          )
        : currentTrend.series

      const nextHigh =
        typeof update.high24h === 'number'
          ? update.high24h
          : currentTrend.high
      const nextLow =
        typeof update.low24h === 'number'
          ? update.low24h
          : currentTrend.low

      return {
        ...current,
        btcPriceTrend: {
          ...currentTrend,
          livePrice: update.price,
          change24h:
            typeof update.change24h === 'number'
              ? update.change24h
              : currentTrend.change24h,
          change24hPercent:
            typeof update.change24hPercent === 'number'
              ? update.change24hPercent
              : currentTrend.change24hPercent,
          high: nextHigh,
          low: nextLow,
          updatedAt: update.updatedAt,
          series: nextSeries,
        },
      }
    })
  }

  function handleBtcVolumeUpdated(update: BtcLiveVolumeUpdate) {
    if (update.symbol !== 'BTCUSDT') {
      return
    }

    setData((current) => {
      if (!current?.volumeProfile || current.volumeProfile.timeframe !== update.timeframe) {
        return current
      }

      const currentProfile = current.volumeProfile
      const pointCount = Math.min(
        currentProfile.labels.length,
        currentProfile.volume.length,
        currentProfile.colors.length,
      )

      if (pointCount === 0) {
        return current
      }

      const nextLabels = currentProfile.labels.slice(0, pointCount)
      const nextVolume = currentProfile.volume.slice(0, pointCount)
      const nextColors = currentProfile.colors.slice(0, pointCount)
      const matchedIndex = nextLabels.lastIndexOf(update.label)
      const targetIndex = matchedIndex >= 0 ? matchedIndex : pointCount - 1

      nextLabels[targetIndex] = update.label
      nextVolume[targetIndex] = update.volume
      nextColors[targetIndex] = update.color

      return {
        ...current,
        volumeProfile: {
          ...currentProfile,
          labels: nextLabels,
          volume: nextVolume,
          colors: nextColors,
          updatedAt: update.updatedAt,
        },
      }
    })
  }

  function showRealtimeNotice(message: string) {
    setRealtimeNotice(message)

    if (realtimeNoticeTimerRef.current !== null) {
      window.clearTimeout(realtimeNoticeTimerRef.current)
    }

    realtimeNoticeTimerRef.current = window.setTimeout(() => {
      setRealtimeNotice(null)
      realtimeNoticeTimerRef.current = null
    }, REALTIME_NOTICE_DURATION_MS)
  }

  function scheduleRealtimeSummaryRefresh() {
    if (realtimeSummaryRefreshTimerRef.current !== null) {
      return
    }

    realtimeSummaryRefreshTimerRef.current = window.setTimeout(() => {
      realtimeSummaryRefreshTimerRef.current = null
      void loadDashboardSummary()
    }, REALTIME_SUMMARY_REFRESH_DELAY_MS)
  }

  function handleUserCreatedRealtime(user: RealtimeUserEvent) {
    setData((current) => {
      if (!current || current.userCount === null) {
        return current
      }

      return {
        ...current,
        userCount: current.userCount + 1,
      }
    })

    showRealtimeNotice(`New user joined: ${user.displayName}`)
    scheduleRealtimeSummaryRefresh()
  }

  function handleUserUpdatedRealtime(user: RealtimeUserEvent) {
    setCurrentUser((current) => {
      if (!current || current.id !== user.id) {
        return current
      }

      return {
        ...current,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        createdAt: current.createdAt,
      }
    })

    showRealtimeNotice(`User updated: ${user.displayName}`)
    scheduleRealtimeSummaryRefresh()
  }

  function handleLogout() {
    clearAuthTokens()
    if (realtimeNoticeTimerRef.current !== null) {
      window.clearTimeout(realtimeNoticeTimerRef.current)
      realtimeNoticeTimerRef.current = null
    }
    if (realtimeSummaryRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeSummaryRefreshTimerRef.current)
      realtimeSummaryRefreshTimerRef.current = null
    }
    setRealtimeNotice(null)
    setCurrentUser(null)
    setManagedUsers([])
    setUsersError(null)
    setUsersLoading(false)
    setData(null)
    setError(null)
    setAuthError(null)
    setLoading(false)
    setIsAuthenticated(false)
  }

  // ------------------------------------------------------------------
  // Unified auth handler — wraps demo login, login, and register
  // ------------------------------------------------------------------

  async function handleAuth(getTokens: () => Promise<AuthTokens>) {
    setAuthLoading(true)
    setAuthError(null)

    try {
      const tokens = await getTokens()
      setAuthTokens(tokens)
      const user = await getAuthenticatedUser(tokens.accessToken)
      setCurrentUser(user)
      setData(null)
      setError(null)
      setIsAuthenticated(true)
    } catch (err) {
      setAuthError(mapAuthError(err))
    } finally {
      setAuthLoading(false)
    }
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (!isAuthenticated) {
    return (
      <UnauthenticatedView
        authLoading={authLoading}
        authError={authError}
        onDemoLogin={() => { void handleAuth(loginDemoUser) }}
        onLogin={(email, password) => { void handleAuth(() => login(email, password)) }}
        onRegister={(email, password, displayName) => {
          void handleAuth(() => register(email, password, displayName))
        }}
      />
    )
  }

  return (
    <DashboardWorkspace
      currentUser={currentUser}
      data={data}
      managedUsers={managedUsers}
      usersLoading={usersLoading}
      usersError={usersError}
      updatingUserId={updatingUserId}
      deletingUserId={deletingUserId}
      loading={loading}
      error={error}
      realtimeNotice={realtimeNotice}
      btcTrendRange={btcTrendRange}
      btcLiveStatus={btcLiveStatus}
      onBtcTrendRangeChange={handleBtcTrendRangeChange}
      dailyPnlRange={dailyPnlRange}
      onDailyPnlRangeChange={handleDailyPnlRangeChange}
      onLogout={handleLogout}
      onRefresh={loadDashboardSummary}
      onRefreshUsers={loadManagedUsers}
      onUpdateDisplayName={async (userId, displayName) => {
        const token = getAccessToken()

        if (!token) {
          return
        }

        setUpdatingUserId(userId)
        setUsersError(null)

        try {
          const updatedUser = await updateUserDisplayName(token, userId, displayName)
          setManagedUsers((current) =>
            current.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
          )
          setCurrentUser((current) =>
            current && current.id === updatedUser.id
              ? { ...current, displayName: updatedUser.displayName }
              : current,
          )
          showRealtimeNotice(`User updated: ${updatedUser.displayName}`)
        } catch (updateError) {
          const status = getHttpStatus(updateError)

          if (status === 401) {
            handleLogout()
            setAuthError('Session expired. Please sign in again.')
            return
          }

          setUsersError(
            updateError instanceof Error ? updateError.message : 'Unable to update profile.',
          )
        } finally {
          setUpdatingUserId(null)
        }
      }}
      onDeleteUser={async (userId) => {
        const token = getAccessToken()

        if (!token) {
          return
        }

        setDeletingUserId(userId)
        setUsersError(null)

        try {
          await softDeleteUser(token, userId)

          if (currentUser?.id === userId) {
            handleLogout()
            return
          }

          setManagedUsers((current) => current.filter((user) => user.id !== userId))
          void loadDashboardSummary()
        } catch (deleteError) {
          const status = getHttpStatus(deleteError)

          if (status === 401) {
            handleLogout()
            setAuthError('Session expired. Please sign in again.')
            return
          }

          setUsersError(
            deleteError instanceof Error ? deleteError.message : 'Unable to delete user.',
          )
        } finally {
          setDeletingUserId(null)
        }
      }}
    />
  )
}

export default DashboardPage
