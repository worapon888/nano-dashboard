import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { ResizeDirection } from '../../../types/resize'
import { resizeCursorByDirection } from '../../../types/resize'

type ResizeState = {
  startClientX: number
  startClientY: number
  direction: ResizeDirection
}

type UseWidgetResizeParams = {
  onResizeStart?: (direction: ResizeDirection) => void
  onResize: (direction: ResizeDirection, deltaX: number, deltaY: number) => void
  onResizeEnd?: () => void
}

function useWidgetResize({
  onResizeStart,
  onResize,
  onResizeEnd,
}: UseWidgetResizeParams) {
  const resizeStateRef = useRef<ResizeState | null>(null)
  const restoreStylesRef = useRef<{
    cursor: string
    userSelect: string
  } | null>(null)
  const [isResizing, setIsResizing] = useState(false)

  const stopResizing = useCallback(() => {
    const wasResizing = resizeStateRef.current !== null
    resizeStateRef.current = null
    setIsResizing(false)

    if (!restoreStylesRef.current) {
      return
    }

    document.body.style.cursor = restoreStylesRef.current.cursor
    document.body.style.userSelect = restoreStylesRef.current.userSelect
    restoreStylesRef.current = null

    if (wasResizing) {
      onResizeEnd?.()
    }
  }, [onResizeEnd])

  useEffect(() => {
    if (!isResizing) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const resizeState = resizeStateRef.current

      if (!resizeState) {
        return
      }

      onResize(
        resizeState.direction,
        event.clientX - resizeState.startClientX,
        event.clientY - resizeState.startClientY,
      )
    }

    const handleMouseUp = () => {
      stopResizing()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, onResize, stopResizing])

  useEffect(() => stopResizing, [stopResizing])

  const handleResizeMouseDown = useCallback(
    (direction: ResizeDirection, event: ReactMouseEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()

      resizeStateRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        direction,
      }

      restoreStylesRef.current = {
        cursor: document.body.style.cursor,
        userSelect: document.body.style.userSelect,
      }

      document.body.style.cursor = resizeCursorByDirection[direction]
      document.body.style.userSelect = 'none'
      setIsResizing(true)
      onResizeStart?.(direction)
    },
    [onResizeStart],
  )

  return {
    isResizing,
    onResizeHandleMouseDown: handleResizeMouseDown,
  }
}

export default useWidgetResize
