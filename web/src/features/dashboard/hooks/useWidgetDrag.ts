import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

type UseWidgetDragOptions = {
  onDragStart: () => void
  onDrag: (deltaX: number, deltaY: number) => void
  onDragEnd: () => void
}

type DragState = {
  pointerId: number
  x: number
  y: number
}

function useWidgetDrag({ onDragStart, onDrag, onDragEnd }: UseWidgetDragOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const dragStateRef = useRef<DragState | null>(null)

  useEffect(() => {
    if (!isDragging) {
      return
    }

    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current

      if (!dragState || event.pointerId !== dragState.pointerId) {
        return
      }

      onDrag(event.clientX - dragState.x, event.clientY - dragState.y)
    }

    function cleanup(pointerId?: number) {
      if (pointerId !== undefined && dragStateRef.current?.pointerId !== pointerId) {
        return
      }

      dragStateRef.current = null
      setIsDragging(false)
      onDragEnd()
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
  }, [isDragging, onDrag, onDragEnd])

  const onDragPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
        return
      }

      event.preventDefault()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      dragStateRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
      setIsDragging(true)
      onDragStart()
    },
    [onDragStart],
  )

  return {
    isDragging,
    onDragPointerDown,
  }
}

export default useWidgetDrag
