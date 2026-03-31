import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

import DashboardGrid from './DashboardGrid'

const authenticatedUser = {
  name: 'Worapon Jintajirakul',
  email: 'worapon@example.com',
  initials: 'WJ',
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
}

function ActionButton({
  label,
  variant = 'ghost',
}: ActionButtonProps) {
  return (
    <button
      type="button"
      className={[
        'rounded-full border px-3.5 py-2 text-[0.68rem] font-medium uppercase tracking-[0.22em] transition-all',
        variant === 'primary'
          ? 'border-emerald-400/20 bg-emerald-400/10 text-slate-100 shadow-[0_0_0_1px_rgba(74,222,128,0.04)] hover:border-emerald-300/30 hover:bg-emerald-400/14'
          : 'border-white/8 bg-white/[0.02] text-slate-300 hover:border-white/14 hover:bg-white/[0.04] hover:text-white',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function StatusBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-400/8 px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.22em] text-slate-200">
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 rounded-full bg-emerald-400/35" />
        <span className="relative rounded-full bg-emerald-300 p-1" />
      </span>
      <span className="text-slate-300">Binance</span>
      <span className="text-slate-500">&bull;</span>
      <span className="text-slate-100">Connected</span>
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
}

function UserMenuItem({
  label,
  destructive = false,
}: UserMenuItemProps) {
  return (
    <button
      type="button"
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

function UserMenu() {
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
          {authenticatedUser.initials}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-28 truncate text-[0.72rem] font-medium tracking-[0.02em] text-slate-200">
            {authenticatedUser.name}
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
            {authenticatedUser.name}
          </p>
          <p className="mt-1 text-xs text-slate-400">{authenticatedUser.email}</p>
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
          <UserMenuItem label="Logout" destructive />
        </div>
      </div>
    </div>
  )
}

function Header() {
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
          <StatusBadge />
          <ActionButton label="Refresh" />
          <ActionButton label="Edit Layout" variant="primary" />
          <UserMenu />
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

function DashboardPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070a] text-slate-100">
      <DashboardBackground />

      <div className="relative z-10 flex min-h-screen min-h-0 flex-col px-6 py-8 sm:px-8 lg:px-10">
        <Header />

        <section className="mt-6 min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/8 bg-[rgba(5,7,10,0.88)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <DashboardGrid />
        </section>
      </div>
    </main>
  )
}

export default DashboardPage
