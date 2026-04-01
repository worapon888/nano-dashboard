import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

import type {
  BtcTrendRange,
  DailyPnlRange,
  DashboardMarketOverview,
  DashboardSummaryData,
  DashboardTopMover,
} from '../../../types/dashboard'
import type { AuthenticatedUser } from '../../../services/auth.service'
import DashboardGrid from './DashboardGrid'
import ConfirmationDialog from '../../../shared/components/ConfirmationDialog'
import { createTradingDashboardDefinition } from '../data/dashboardDefinition'

function getUserInitials(displayName?: string | null, email?: string | null) {
  const source = displayName?.trim() || email?.trim() || 'User'
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }

  return source.slice(0, 2).toUpperCase()
}

type NavItemProps = {
  label: string
  active?: boolean
}

function NavItem({ label, active = false }: NavItemProps) {
  return (
    <button
      type="button"
      className={[
        'rounded-full border px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.24em] transition-colors',
        active
          ? 'border-emerald-400/25 bg-emerald-400/8 text-slate-100'
          : 'border-white/6 bg-white/[0.02] text-slate-500 hover:border-white/12 hover:text-slate-300',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

type ActionButtonProps = {
  label: string
  variant?: 'ghost' | 'primary'
  disabled?: boolean
  onClick?: () => void
}

function ActionButton({
  label,
  variant = 'ghost',
  disabled = false,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded-full border px-3.5 py-2 text-[0.68rem] font-medium uppercase tracking-[0.22em] transition-all',
        variant === 'primary'
          ? 'border-emerald-400/20 bg-emerald-400/10 text-slate-100 shadow-[0_0_0_1px_rgba(74,222,128,0.04)] hover:border-emerald-300/30 hover:bg-emerald-400/14'
          : 'border-white/8 bg-white/[0.02] text-slate-300 hover:border-white/14 hover:bg-white/[0.04] hover:text-white',
        disabled ? 'cursor-not-allowed opacity-60 hover:border-white/8 hover:bg-white/[0.02] hover:text-slate-300' : '',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

type StatusBadgeProps = {
  loading: boolean
  error: string | null
  stale?: boolean
}

function StatusBadge({ loading, error, stale = false }: StatusBadgeProps) {
  const label = error || stale ? 'Summary delayed' : loading ? 'Refreshing' : 'Connected'
  const toneClass = error || stale
    ? 'border-amber-400/18 bg-amber-400/8'
    : 'border-emerald-400/18 bg-emerald-400/8'
  const dotClass = error || stale ? 'bg-amber-300' : 'bg-emerald-300'
  const pulseClass = error || stale ? 'bg-amber-400/35' : 'bg-emerald-400/35'

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.22em] text-slate-200 ${toneClass}`}>
      <span className="relative flex h-2 w-2">
        <span className={`absolute inset-0 rounded-full ${pulseClass}`} />
        <span className={`relative rounded-full p-1 ${dotClass}`} />
      </span>
      <span className="text-slate-300">Dashboard API</span>
      <span className="text-slate-500">&bull;</span>
      <span className="text-slate-100">{label}</span>
    </div>
  )
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={[
        'h-4 w-4 text-slate-500 transition-transform duration-150',
        open ? 'translate-y-[1px] rotate-180 text-slate-300' : '',
      ].join(' ')}
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type UserMenuItemProps = {
  label: string
  destructive?: boolean
  onClick?: () => void
}

function UserMenuItem({
  label,
  destructive = false,
  onClick,
}: UserMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors',
        destructive
          ? 'text-rose-300 hover:bg-rose-400/10 hover:text-rose-200'
          : 'text-slate-300 hover:bg-white/[0.04] hover:text-white',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function UserMenu({
  currentUser,
  onLogout,
}: {
  currentUser: AuthenticatedUser | null
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  function handleLogout() {
    setOpen(false)
    onLogout()
  }

  const displayName = currentUser?.displayName?.trim() || 'Authenticated User'
  const email = currentUser?.email?.trim() || 'unknown@example.com'
  const initials = getUserInitials(displayName, email)

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        className={[
          'flex h-10 items-center gap-2 rounded-full border px-2.5 pr-3 transition-all',
          open
            ? 'border-white/16 bg-white/[0.06] text-white'
            : 'border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/16 hover:bg-white/[0.05] hover:text-white',
        ].join(' ')}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-100">
          {initials}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-28 truncate text-[0.72rem] font-medium tracking-[0.02em] text-slate-200">
            {displayName}
          </span>
        </span>
        <ChevronDownIcon open={open} />
      </button>

      <div
        id={menuId}
        ref={menuRef}
        role="menu"
        aria-label="User menu"
        className={[
          'absolute right-0 z-20 mt-2 w-[280px] origin-top-right rounded-2xl border border-white/10 bg-[#0c0c0c] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.6)] transition duration-150 ease-out',
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-1 opacity-0',
        ].join(' ')}
      >
        <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
          <p className="text-sm font-medium tracking-[0.01em] text-white">
            {displayName}
          </p>
          <p className="mt-1 text-xs text-slate-400">{email}</p>
        </div>

        <div className="my-2 h-px bg-white/8" />

        <div className="space-y-1">
          <UserMenuItem label="Profile" />
          <UserMenuItem label="Account Settings" />
          <UserMenuItem label="Notifications" />
        </div>

        <div className="my-2 h-px bg-white/8" />

        <div className="space-y-1">
          <UserMenuItem label="Appearance" />
          <UserMenuItem label="Logout" destructive onClick={handleLogout} />
        </div>
      </div>
    </div>
  )
}

type HeaderProps = {
  currentUser: AuthenticatedUser | null
  isLayoutEditing: boolean
  loading: boolean
  error: string | null
  warnings?: string[]
  stale?: boolean
  realtimeNotice: string | null
  onLogout: () => void
  onRefresh: () => void
  onToggleLayoutEditing: () => void
  onResetLayout: () => void
  onAutoArrange: () => void
}

function Header({
  currentUser,
  isLayoutEditing,
  loading,
  error,
  warnings = [],
  stale = false,
  realtimeNotice,
  onLogout,
  onRefresh,
  onToggleLayoutEditing,
  onResetLayout,
  onAutoArrange,
}: HeaderProps) {
  return (
    <header className="border-b border-white/8 pb-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between xl:max-w-[72%] xl:gap-8">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center gap-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-slate-400">
                NANODASHBOARD
              </p>
              <span className="hidden h-1 w-1 rounded-full bg-emerald-300/80 sm:block" />
              <p className="hidden text-[0.68rem] uppercase tracking-[0.24em] text-slate-500 sm:block">
                Authenticated Workspace
              </p>
            </div>

            <nav aria-label="Primary" className="flex flex-wrap items-center gap-2">
              <NavItem label="Dashboard" active />
              <NavItem label="Portfolio" />
              <NavItem label="Orders" />
            </nav>
          </div>

          <div className="min-w-0 xl:pb-0.5">
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-slate-500">
              Live market overview
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[0.01em] text-white sm:text-3xl">
              Trading Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Customizable trading workspace for monitoring price action,
              positions, and execution flow.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
          {realtimeNotice ? (
            <div
              data-testid="realtime-notice"
              className="inline-flex items-center rounded-full border border-sky-400/16 bg-sky-400/8 px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-sky-100"
            >
              {realtimeNotice}
            </div>
          ) : null}
          {stale ? (
            <div className="inline-flex items-center rounded-full border border-amber-400/16 bg-amber-400/8 px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-amber-100">
              Showing cached snapshot
            </div>
          ) : null}
          {warnings.length > 0 ? (
            <div className="inline-flex items-center rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-200">
              {warnings.length} section{warnings.length === 1 ? '' : 's'} delayed
            </div>
          ) : null}
          <StatusBadge loading={loading} error={error} stale={stale} />
          <ActionButton
            label={loading ? 'Refreshing...' : 'Refresh'}
            onClick={onRefresh}
            disabled={loading}
          />
          {isLayoutEditing ? (
            <>
              <ActionButton label="Auto Arrange" onClick={onAutoArrange} />
              <ActionButton label="Reset to Default" onClick={onResetLayout} />
            </>
          ) : null}
          <ActionButton
            label={isLayoutEditing ? 'Done' : 'Edit Layout'}
            variant="primary"
            onClick={onToggleLayoutEditing}
          />
          <UserMenu currentUser={currentUser} onLogout={onLogout} />
        </div>
      </div>
    </header>
  )
}

function DashboardBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[#05070a]" />

      <div
        className="absolute inset-0 opacity-100"
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
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 2 : 4,
  }).format(value)
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function formatTopMoverTimestamp(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown fetch time'
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function LoadingSkeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-white/[0.07] ${className}`} />
}

type SummaryCardProps = {
  eyebrow: string
  title: string
  children: ReactNode
}

function SummaryCard({ eyebrow, title, children }: SummaryCardProps) {
  return (
    <article className="flex h-full min-h-[14rem] flex-col rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] xl:h-[15rem]">
      <p className="text-[0.66rem] uppercase tracking-[0.26em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-2 text-sm font-semibold tracking-[0.02em] text-white">{title}</h2>
      <div className="mt-4 min-h-0 flex-1">{children}</div>
    </article>
  )
}

function SummaryMessage({
  title,
  description,
  tone = 'neutral',
}: {
  title: string
  description: string
  tone?: 'neutral' | 'error'
}) {
  return (
    <div className={tone === 'error' ? 'text-rose-200' : 'text-slate-300'}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  )
}

export type ActiveUsersWidgetProps = {
  userCount: number | null
  loading: boolean
  error: string | null
}

function ActiveUsersWidget({
  userCount,
  loading,
  error,
}: ActiveUsersWidgetProps) {
  if (loading && userCount === null && !error) {
    return (
      <div className="space-y-3">
        <LoadingSkeleton className="h-10 w-28" />
        <LoadingSkeleton className="h-4 w-40" />
      </div>
    )
  }

  if (userCount === null && error) {
    return (
      <SummaryMessage
        title="User count unavailable"
        description={error}
        tone="error"
      />
    )
  }

  if (userCount === null) {
    return (
      <SummaryMessage
        title="No user summary yet"
        description="The dashboard is ready, but no user metrics have been returned yet."
      />
    )
  }

  return (
    <div>
      <p className="text-4xl font-semibold tracking-[-0.03em] text-white">
        {formatNumber(userCount)}
      </p>
      <p className="mt-2 text-sm text-slate-400">
        Authenticated users currently included in the backend dashboard summary.
      </p>
    </div>
  )
}

export type MarketOverviewWidgetProps = {
  marketOverview: DashboardMarketOverview | null
  loading: boolean
  error: string | null
}

function MarketOverviewWidget({
  marketOverview,
  loading,
  error,
}: MarketOverviewWidgetProps) {
  if (loading && !marketOverview) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <LoadingSkeleton className="h-24 w-full rounded-2xl" />
        <LoadingSkeleton className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  if (!marketOverview && error) {
    return (
      <SummaryMessage
        title="Market overview unavailable"
        description={error}
        tone="error"
      />
    )
  }

  if (!marketOverview) {
    return (
      <SummaryMessage
        title="No market overview yet"
        description="BTC dominance and the fear and greed index will appear here once the API returns data."
      />
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-white/8 bg-[#0b0f14] px-4 py-4">
        <p className="text-[0.66rem] uppercase tracking-[0.22em] text-slate-500">
          BTC Dominance
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">
          {marketOverview.btcDominance.toFixed(2)}%
        </p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-[#0b0f14] px-4 py-4">
        <p className="text-[0.66rem] uppercase tracking-[0.22em] text-slate-500">
          Fear &amp; Greed
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">
          {formatNumber(marketOverview.fearGreedIndex)}
        </p>
      </div>
    </div>
  )
}

function TopMoverRow({ mover }: { mover: DashboardTopMover }) {
  const changeTone =
    mover.priceChange24h > 0
      ? 'text-emerald-200'
      : mover.priceChange24h < 0
        ? 'text-rose-200'
        : 'text-slate-200'

  return (
    <li className="group relative overflow-hidden rounded-[1rem] border border-white/7 bg-[linear-gradient(180deg,rgba(13,18,26,0.98),rgba(10,14,20,0.94))] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_20px_rgba(0,0,0,0.15)] transition-all duration-200 hover:border-white/12 hover:bg-[linear-gradient(180deg,rgba(15,20,29,0.99),rgba(11,15,22,0.96))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_24px_rgba(0,0,0,0.18)]">
      <span
        aria-hidden="true"
        className={[
          'absolute inset-y-2.5 left-0 w-px rounded-full opacity-70 transition-opacity duration-200 group-hover:opacity-100',
          mover.priceChange24h > 0
            ? 'bg-emerald-300/45'
            : mover.priceChange24h < 0
              ? 'bg-rose-300/40'
              : 'bg-slate-400/25',
        ].join(' ')}
      />

      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 space-y-0.5">
          <p className="text-[0.9rem] font-semibold uppercase tracking-[0.06em] text-white">
            {mover.symbol}
          </p>
          <p className="text-[0.64rem] tracking-[0.03em] text-slate-500">
            Updated {formatTopMoverTimestamp(mover.fetchedAt)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[0.9rem] font-semibold tracking-[-0.03em] text-white">
            ${formatCurrency(mover.price)}
          </p>
          <p className={`mt-0.5 text-[0.68rem] font-medium tracking-[0.01em] ${changeTone}`}>
            {formatPercent(mover.priceChange24h)}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-white/6 pt-2">
        <div className="rounded-[0.8rem] border border-white/6 bg-white/[0.02] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
          <p className="text-[0.58rem] uppercase tracking-[0.18em] text-slate-600">Volume</p>
          <p className="mt-0.5 text-[0.77rem] font-medium tracking-[0.01em] text-slate-100">
            {formatCompactNumber(mover.volume24h)}
          </p>
        </div>
        <div className="rounded-[0.8rem] border border-white/6 bg-white/[0.02] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
          <p className="text-[0.58rem] uppercase tracking-[0.18em] text-slate-600">High</p>
          <p className="mt-0.5 text-[0.77rem] font-medium tracking-[0.01em] text-slate-100">
            ${formatCurrency(mover.high24h)}
          </p>
        </div>
        <div className="rounded-[0.8rem] border border-white/6 bg-white/[0.02] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
          <p className="text-[0.58rem] uppercase tracking-[0.18em] text-slate-600">Low</p>
          <p className="mt-0.5 text-[0.77rem] font-medium tracking-[0.01em] text-slate-100">
            ${formatCurrency(mover.low24h)}
          </p>
        </div>
      </div>
    </li>
  )
}

export type TopMoversWidgetProps = {
  items: DashboardTopMover[]
  loading: boolean
  error: string | null
}

function TopMoversWidget({
  items,
  loading,
  error,
}: TopMoversWidgetProps) {
  if (loading && items.length === 0 && !error) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((item) => (
          <LoadingSkeleton key={item} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (items.length === 0 && error) {
    return (
      <SummaryMessage
        title="Top movers unavailable"
        description={error}
        tone="error"
      />
    )
  }

  if (items.length === 0) {
    return (
      <SummaryMessage
        title="No movers returned"
        description="The request succeeded, but the summary did not include any top mover rows."
      />
    )
  }

  return (
    <div className="dashboard-themed-scroll h-full min-h-0 overflow-y-auto pr-1">
      <ul className="space-y-3">
        {items.map((mover) => (
          <TopMoverRow key={`${mover.symbol}-${mover.fetchedAt}`} mover={mover} />
        ))}
      </ul>
    </div>
  )
}

function DashboardSummarySection({
  userCount,
  topMovers,
  marketOverview,
  loading,
  error,
  warnings = [],
  stale = false,
}: {
  userCount: number | null
  topMovers: DashboardTopMover[]
  marketOverview: DashboardMarketOverview | null
  loading: boolean
  error: string | null
  warnings?: string[]
  stale?: boolean
}) {
  return (
    <section className="mt-5 space-y-4">
      {error ? (
        <div className="rounded-[1.3rem] border border-rose-400/18 bg-rose-400/[0.05] px-4 py-3 text-sm text-rose-200">
          {userCount !== null || topMovers.length > 0 || marketOverview
            ? `Summary refresh failed. Showing the last loaded dashboard data. ${error}`
            : error}
        </div>
      ) : null}
      {!error && (stale || warnings.length > 0) ? (
        <div className="rounded-[1.3rem] border border-amber-400/18 bg-amber-400/[0.05] px-4 py-3 text-sm text-amber-100">
          {stale
            ? 'Dashboard is showing the last cached summary because live refresh failed.'
            : 'Some dashboard sections are temporarily unavailable and may show empty states until the next successful refresh.'}
        </div>
      ) : null}

      <div className="grid items-stretch gap-4 xl:grid-cols-[0.9fr_1.1fr_1.5fr]">
        <SummaryCard eyebrow="Users" title="Active Users">
          <ActiveUsersWidget userCount={userCount} loading={loading} error={error} />
        </SummaryCard>

        <SummaryCard eyebrow="Market" title="Overview">
          <MarketOverviewWidget
            marketOverview={marketOverview}
            loading={loading}
            error={error}
          />
        </SummaryCard>

        <SummaryCard eyebrow="Movers" title="Top Movers">
          <TopMoversWidget items={topMovers} loading={loading} error={error} />
        </SummaryCard>
      </div>
    </section>
  )
}

type DashboardWorkspaceProps = {
  currentUser: AuthenticatedUser | null
  data: DashboardSummaryData | null
  loading: boolean
  error: string | null
  realtimeNotice: string | null
  btcTrendRange: BtcTrendRange
  btcLiveStatus: 'connecting' | 'live' | 'offline'
  onBtcTrendRangeChange: (range: BtcTrendRange) => void
  dailyPnlRange: DailyPnlRange
  onDailyPnlRangeChange: (range: DailyPnlRange) => void
  onLogout: () => void
  onRefresh: () => void
}

function DashboardWorkspace({
  currentUser,
  data,
  loading,
  error,
  realtimeNotice,
  btcTrendRange,
  btcLiveStatus,
  onBtcTrendRangeChange,
  dailyPnlRange,
  onDailyPnlRangeChange,
  onLogout,
  onRefresh,
}: DashboardWorkspaceProps) {
  const summary = data ?? null
  const userCount = summary?.userCount ?? null
  const topMovers = summary?.topMovers ?? []
  const marketOverview = summary?.marketOverview ?? null
  const btcPriceTrend = summary?.btcPriceTrend ?? null
  const volumeProfile = summary?.volumeProfile ?? null
  const dailyPnl = summary?.dailyPnl ?? null
  const openOrders = summary?.openOrders ?? null
  const marketShare = summary?.marketShare ?? []
  const warnings = summary?.warnings ?? []
  const stale = summary?.stale === true
  const marketShareSeries = marketShare.map((item) => item.dominance)
  const marketShareLabels = marketShare.map((item) => item.symbol)

  const dashboardDefinition = useMemo(
    () =>
      createTradingDashboardDefinition({
        btcPriceTrendWidget: {
          trend: btcPriceTrend,
          selectedRange: btcTrendRange,
          liveStatus: btcLiveStatus,
          onRangeChange: onBtcTrendRangeChange,
          loading,
          error,
        },
        volumeProfileWidget: {
          data: volumeProfile,
          selectedTimeframe: btcTrendRange,
          onTimeframeChange: onBtcTrendRangeChange,
          loading,
        },
        dailyPnlWidget: {
          data: dailyPnl,
          selectedRange: dailyPnlRange,
          onRangeChange: onDailyPnlRangeChange,
          loading,
        },
        openOrdersWidget: {
          data: openOrders,
          loading,
          error,
        },
        marketShareWidget: {
          items: marketShare,
          series: marketShareSeries,
          labels: marketShareLabels,
        },
      }),
    [
      btcLiveStatus,
      btcPriceTrend,
      btcTrendRange,
      dailyPnlRange,
      dailyPnl,
      openOrders,
      volumeProfile,
      error,
      loading,
      marketShare,
      marketShareLabels,
      marketShareSeries,
      onBtcTrendRangeChange,
      onDailyPnlRangeChange,
    ],
  )
  const [isLayoutEditing, setIsLayoutEditing] = useState(false)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [resetRequestId, setResetRequestId] = useState(0)
  const [autoArrangeRequestId, setAutoArrangeRequestId] = useState(0)

  function handleToggleLayoutEditing() {
    setIsLayoutEditing((current) => !current)
  }

  function handleResetLayout() {
    setIsResetDialogOpen(true)
  }

  function handleCancelResetLayout() {
    setIsResetDialogOpen(false)
  }

  function handleConfirmResetLayout() {
    setResetRequestId((current) => current + 1)
    setIsResetDialogOpen(false)
    setIsLayoutEditing(false)
  }

  function handleAutoArrange() {
    setAutoArrangeRequestId((current) => current + 1)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070a] text-slate-100">
      <DashboardBackground />

      <div className="relative z-10 flex min-h-screen min-h-0 w-full flex-col px-3 py-4 sm:px-5 sm:py-6 md:px-6 lg:px-10 lg:py-8">
        <Header
          currentUser={currentUser}
          isLayoutEditing={isLayoutEditing}
          loading={loading}
          error={error}
          warnings={warnings}
          stale={stale}
          realtimeNotice={realtimeNotice}
          onLogout={onLogout}
          onRefresh={onRefresh}
          onToggleLayoutEditing={handleToggleLayoutEditing}
          onResetLayout={handleResetLayout}
          onAutoArrange={handleAutoArrange}
        />

        <DashboardSummarySection
          userCount={userCount}
          topMovers={topMovers}
          marketOverview={marketOverview}
          loading={loading}
          error={error}
          warnings={warnings}
          stale={stale}
        />

        <section className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[1.5rem] border border-white/8 bg-[rgba(5,7,10,0.88)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:mt-5 sm:rounded-[1.75rem] sm:p-3 lg:mt-6 lg:rounded-3xl lg:p-4">
          <DashboardGrid
            definition={dashboardDefinition}
            resetRequestId={resetRequestId}
            autoArrangeRequestId={autoArrangeRequestId}
          />
        </section>
      </div>

      <ConfirmationDialog
        open={isResetDialogOpen}
        title="Reset layout?"
        description="This will restore the default dashboard arrangement and remove your saved custom layout."
        confirmLabel="Reset to Default"
        cancelLabel="Cancel"
        onCancel={handleCancelResetLayout}
        onConfirm={handleConfirmResetLayout}
      />
    </main>
  )
}

export default DashboardWorkspace
