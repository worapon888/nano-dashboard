import type { PointerEvent as ReactPointerEvent } from 'react'
import WidgetShell from '../../../shared/components/WidgetShell'
import type { ResizeDirection } from '../../../shared/types/resize'

type ChartStateNoticeProps = {
  title: string
  tone: 'empty' | 'error'
  heading: string
  description: string
  isMinimized?: boolean
  isMaximized?: boolean
  isDragging?: boolean
  isResizing?: boolean
  onDragPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void
  onResizeHandlePointerDown?: (
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLElement>,
  ) => void
  onResetToDefault?: () => void
  onMinimizeToggle?: () => void
  onMaximizeToggle?: () => void
  onControlPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void
}

function ChartStateNotice({
  title,
  tone,
  heading,
  description,
  isMinimized = false,
  isMaximized = false,
  isDragging = false,
  isResizing = false,
  onDragPointerDown,
  onResizeHandlePointerDown,
  onResetToDefault,
  onMinimizeToggle,
  onMaximizeToggle,
  onControlPointerDown,
}: ChartStateNoticeProps) {
  const handleControlPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    action?: () => void,
  ) => {
    onControlPointerDown?.(event)
    action?.()
  }

  const handleKeyboardClick = (
    event: ReactPointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
    action?: () => void,
  ) => {
    if (event.detail === 0) {
      action?.()
    }
  }

  const windowControls = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={isMinimized ? `Restore ${title}` : `Minimize ${title}`}
        onPointerDown={(event) => handleControlPointerDown(event, onMinimizeToggle)}
        onClick={(event) => handleKeyboardClick(event, onMinimizeToggle)}
        className="h-3 w-3 rounded-full bg-rose-500/90 transition hover:bg-rose-400"
      />
      <button
        type="button"
        aria-label={`Reset ${title} to default size`}
        onPointerDown={(event) => handleControlPointerDown(event, onResetToDefault)}
        onClick={(event) => handleKeyboardClick(event, onResetToDefault)}
        className="h-3 w-3 rounded-full bg-amber-400/90 transition hover:bg-amber-300"
      />
      <button
        type="button"
        aria-label={isMaximized ? `Restore ${title}` : `Maximize ${title}`}
        onPointerDown={(event) => handleControlPointerDown(event, onMaximizeToggle)}
        onClick={(event) => handleKeyboardClick(event, onMaximizeToggle)}
        className="h-3 w-3 rounded-full bg-emerald-500/90 transition hover:bg-emerald-400"
      />
    </div>
  )

  return (
    <WidgetShell
      title={title}
      subtitle="Chart"
      action={windowControls}
      className={`relative flex h-full flex-col ${isDragging || isResizing ? 'select-none' : ''}`}
      headerClassName={onDragPointerDown ? 'cursor-grab active:cursor-grabbing' : ''}
      bodyClassName={isMinimized ? 'overflow-hidden p-0' : 'min-h-0 overflow-hidden'}
      isResizeActive={isResizing}
      onHeaderPointerDown={onDragPointerDown}
      onResizeHandlePointerDown={
        onResizeHandlePointerDown && !isMinimized && !isMaximized
          ? onResizeHandlePointerDown
          : undefined
      }
    >
      <div className="flex h-full min-h-0 items-center justify-center p-5">
        <div
          className={`w-full max-w-sm rounded-[1.2rem] border px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
            tone === 'error'
              ? 'border-rose-400/14 bg-rose-400/[0.04]'
              : 'border-white/8 bg-white/[0.02]'
          }`}
        >
          <div
            className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full border ${
              tone === 'error'
                ? 'border-rose-400/18 bg-rose-400/[0.08] text-rose-300'
                : 'border-white/10 bg-white/[0.04] text-slate-300'
            }`}
          >
            {tone === 'error' ? '!' : '?'}
          </div>
          <h3 className="mt-4 text-sm font-semibold tracking-[0.01em] text-slate-100">
            {heading}
          </h3>
          <p className="mt-2 text-[0.82rem] leading-6 text-slate-400">{description}</p>
        </div>
      </div>
    </WidgetShell>
  )
}

export default ChartStateNotice
