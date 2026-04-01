import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import WidgetShell from '../../../shared/components/WidgetShell'
import type { ResizeDirection } from '../../../shared/types/resize'

type ChartWidgetChromeProps = {
  title: string
  isMinimized: boolean
  isMaximized: boolean
  isDragging: boolean
  isResizing: boolean
  onDragPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void
  onResizeHandlePointerDown?: (
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLElement>,
  ) => void
  onResetToDefault?: () => void
  onMinimizeToggle?: () => void
  onMaximizeToggle?: () => void
  onControlPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  children: ReactNode
}

function ChartWidgetChrome({
  title,
  isMinimized,
  isMaximized,
  isDragging,
  isResizing,
  onDragPointerDown,
  onResizeHandlePointerDown,
  onResetToDefault,
  onMinimizeToggle,
  onMaximizeToggle,
  onControlPointerDown,
  children,
}: ChartWidgetChromeProps) {
  const handleControlPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    action?: () => void,
  ) => {
    onControlPointerDown(event)
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
      {children}
    </WidgetShell>
  )
}

export default ChartWidgetChrome
