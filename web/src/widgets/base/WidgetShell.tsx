import type { MouseEventHandler, PropsWithChildren, ReactNode } from 'react'

type WidgetShellProps = PropsWithChildren<{
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  headerClassName?: string
  bodyClassName?: string
  onHeaderMouseDown?: MouseEventHandler<HTMLElement>
}>

function WidgetShell({
  title,
  subtitle,
  action,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  onHeaderMouseDown,
  children,
}: WidgetShellProps) {
  return (
    <section
      className={`h-full overflow-hidden rounded-[22px] border border-white/8 bg-[#0a0a0a] shadow-[0_22px_60px_rgba(0,0,0,0.52)] ${className}`}
    >
      <header
        onMouseDown={onHeaderMouseDown}
        className={`relative flex items-start justify-between border-b border-white/8 bg-[#101010] px-4 py-3 sm:px-5 ${headerClassName}`}
      >
        <div className="min-w-0">
          <h2 className="truncate text-[0.95rem] font-semibold tracking-[0.01em] text-slate-100">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-[0.78rem] uppercase tracking-[0.28em] text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="ml-4 pt-1 text-sm text-slate-400">{action}</div> : null}
      </header>

      <div className={`bg-[#0a0a0a] text-sm text-slate-300 ${bodyClassName}`}>
        {children}
      </div>
    </section>
  )
}

export default WidgetShell
