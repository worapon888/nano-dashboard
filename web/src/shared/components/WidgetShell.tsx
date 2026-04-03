import type {
  PointerEvent as ReactPointerEvent,
  PointerEventHandler,
  PropsWithChildren,
  ReactNode,
} from 'react'
import type { ResizeDirection } from '../types/resize'

const resizeHandleClassByDirection: Record<ResizeDirection, string> = {
  top: 'inset-x-3 top-0 h-3 -translate-y-1/2 cursor-ns-resize',
  right: 'right-0 top-3 bottom-3 w-3 translate-x-1/2 cursor-ew-resize',
  bottom: 'inset-x-3 bottom-0 h-3 translate-y-1/2 cursor-ns-resize',
  left: 'left-0 top-3 bottom-3 w-3 -translate-x-1/2 cursor-ew-resize',
  topRight: 'right-0 top-0 h-4 w-4 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
  bottomRight: 'bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
  bottomLeft: 'bottom-0 left-0 h-4 w-4 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
  topLeft: 'left-0 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
}

const resizeDirections: ResizeDirection[] = [
  'top',
  'right',
  'bottom',
  'left',
  'topRight',
  'bottomRight',
  'bottomLeft',
  'topLeft',
]

type WidgetShellProps = PropsWithChildren<{
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  headerClassName?: string
  bodyClassName?: string
  isResizeActive?: boolean
  onHeaderPointerDown?: PointerEventHandler<HTMLElement>
  onResizeHandlePointerDown?: (
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLElement>,
  ) => void
}>

function WidgetShell({
  title,
  subtitle,
  action,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  isResizeActive = false,
  onHeaderPointerDown,
  onResizeHandlePointerDown,
  children,
}: WidgetShellProps) {
  const widgetTestId = `widget-shell-${title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`

  return (
    <section
      data-testid={widgetTestId}
      className={`relative h-full overflow-visible rounded-[22px] border border-white/8 bg-[#0a0a0a] shadow-[0_22px_60px_rgba(0,0,0,0.52)] ${
        isResizeActive ? 'border-sky-400/45 shadow-[0_0_0_1px_rgba(56,189,248,0.28),0_22px_60px_rgba(0,0,0,0.52)]' : ''
      } ${className}`}
    >
      {onResizeHandlePointerDown
        ? resizeDirections.map((direction) => (
            <button
              key={direction}
              type="button"
              aria-label={`Resize widget from ${direction}`}
              onPointerDown={(event) => onResizeHandlePointerDown(direction, event)}
              className={`absolute z-20 rounded-full border-0 bg-transparent p-0 opacity-0 outline-none transition-opacity duration-150 hover:opacity-100 focus:opacity-100 touch-none ${resizeHandleClassByDirection[direction]}`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 rounded-full ${
                  isResizeActive ? 'bg-sky-400/10' : ''
                }`}
              />
            </button>
          ))
        : null}
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit]">
        <header
          onPointerDown={onHeaderPointerDown}
          className={`relative flex flex-wrap items-start justify-between gap-3 border-b border-white/8 bg-[#101010] px-4 py-3 sm:px-5 ${onHeaderPointerDown ? 'touch-none' : ''} ${headerClassName}`}
        >
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[0.95rem] font-semibold tracking-[0.01em] text-slate-100">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-[0.72rem] tracking-[0.18em] text-slate-400 sm:text-[0.78rem] sm:uppercase sm:tracking-[0.24em]">
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0 self-start pt-1 text-sm text-slate-400 sm:ml-4">{action}</div> : null}
        </header>

        <div className={`flex min-h-0 flex-1 flex-col bg-[#0a0a0a] text-sm text-slate-300 ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </section>
  )
}

export default WidgetShell
