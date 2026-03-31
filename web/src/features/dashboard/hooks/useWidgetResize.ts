import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ResizeDirection } from '../../../shared/types/resize'

type UseWidgetResizeOptions = {
  onResizeStart: (direction: ResizeDirection) => void
  onResize: (direction: ResizeDirection, deltaX: number, deltaY: number) => void
  onResizeEnd: () => void
}

type ResizeState = {
  pointerId: number
  direction: ResizeDirection
  startX: number
  startY: number
}

function useWidgetResize({
  onResizeStart,
  onResize,
  onResizeEnd,
}: UseWidgetResizeOptions) {
  const [isResizing, setIsResizing] = useState(false)
  const resizeStateRef = useRef<ResizeState | null>(null)

  useEffect(() => {
    if (!isResizing) {
      return
    }

    function handlePointerMove(event: PointerEvent) {
      const resizeState = resizeStateRef.current

      if (!resizeState || event.pointerId !== resizeState.pointerId) {
        return
      }

      onResize(
        resizeState.direction,
        event.clientX - resizeState.startX,
        event.clientY - resizeState.startY,
      )
    }

    function cleanup(pointerId?: number) {
      if (pointerId !== undefined && resizeStateRef.current?.pointerId !== pointerId) {
        return
      }

      resizeStateRef.current = null
      setIsResizing(false)
      onResizeEnd()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }

    function handlePointerUp(event: PointerEvent) {
      cleanup(event.pointerId)
    }

    function handlePointerCancel(event: PointerEvent) {
      cleanup(event.pointerId)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [isResizing, onResize, onResizeEnd])

  const onResizeHandlePointerDown = useCallback(
    (direction: ResizeDirection, event: ReactPointerEvent<HTMLElement>) => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      resizeStateRef.current = {
        pointerId: event.pointerId,
        direction,
        startX: event.clientX,
        startY: event.clientY,
      }
      setIsResizing(true)
      onResizeStart(direction)
    },
    [onResizeStart],
  )

  return {
    isResizing,
    onResizeHandlePointerDown,
  }
}

export default useWidgetResize
