import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

type DragState = {
  startClientX: number
  startClientY: number
}

type UseWidgetDragParams = {
  onDragStart?: () => void
  onDrag: (deltaX: number, deltaY: number) => void
  onDragEnd?: () => void
}

function useWidgetDrag({ onDragStart, onDrag, onDragEnd }: UseWidgetDragParams) {
  const dragStateRef = useRef<DragState | null>(null)
  const restoreStylesRef = useRef<{
    cursor: string
    userSelect: string
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const stopDragging = useCallback(() => {
    const wasDragging = dragStateRef.current !== null
    dragStateRef.current = null
    setIsDragging(false)

    if (!restoreStylesRef.current) {
      return
    }

    document.body.style.cursor = restoreStylesRef.current.cursor
    document.body.style.userSelect = restoreStylesRef.current.userSelect
    restoreStylesRef.current = null

    if (wasDragging) {
      onDragEnd?.()
    }
  }, [onDragEnd])

  useEffect(() => {
    if (!isDragging) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current

      if (!dragState) {
        return
      }

      onDrag(
        event.clientX - dragState.startClientX,
        event.clientY - dragState.startClientY,
      )
    }

    const handleMouseUp = () => {
      stopDragging()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onDrag, stopDragging])

  useEffect(() => stopDragging, [stopDragging])

  const handleDragMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      event.preventDefault()

      dragStateRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
      }

      restoreStylesRef.current = {
        cursor: document.body.style.cursor,
        userSelect: document.body.style.userSelect,
      }

      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
      setIsDragging(true)
      onDragStart?.()
    },
    [onDragStart],
  )

  return {
    isDragging,
    onDragMouseDown: handleDragMouseDown,
  }
}

export default useWidgetDrag
