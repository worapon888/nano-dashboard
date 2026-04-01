import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'

export type ColumnWidths = Record<string, number>

type UseColumnResizeOptions = {
  initialWidths: ColumnWidths
  minWidth?: number
  storageKey?: string
}

type ResizeState = {
  pointerId: number
  columnKey: string
  startX: number
  startWidth: number
}

function useColumnResize({
  initialWidths,
  minWidth = 60,
  storageKey,
}: UseColumnResizeOptions) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          const parsed = JSON.parse(stored) as ColumnWidths
          // Merge stored with initial so new columns always appear
          return { ...initialWidths, ...parsed }
        }
      } catch {
        // Ignore parse errors — fall through to initial widths
      }
    }
    return { ...initialWidths }
  })

  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const resizeStateRef = useRef<ResizeState | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const frameRef = useRef<number | null>(null)
  const liveColumnWidthsRef = useRef(columnWidths)

  useEffect(() => {
    liveColumnWidthsRef.current = columnWidths
  }, [columnWidths])

  // Persist to localStorage whenever widths change
  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths))
    } catch {
      // Ignore write errors
    }
  }, [columnWidths, storageKey])

  // Cleanup on unmount (handles the case where mouseup fires after unmount)
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      cleanupRef.current?.()
    }
  }, [])

  const startResize = useCallback(
    (
      columnKey: string,
      currentWidth: number,
      event: ReactPointerEvent | ReactMouseEvent,
    ) => {
      if ('button' in event && event.button !== 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      resizeStateRef.current = {
        pointerId: 'pointerId' in event ? event.pointerId : -1,
        columnKey,
        startX: event.clientX,
        startWidth: currentWidth,
      }

      setResizingColumn(columnKey)

      const savedCursor = document.body.style.cursor
      const savedUserSelect = document.body.style.userSelect
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const commitWidths = () => {
        frameRef.current = null
        setColumnWidths((prev) =>
          prev === liveColumnWidthsRef.current ? prev : liveColumnWidthsRef.current,
        )
      }

      const handleMouseMove = (e: MouseEvent) => {
        const state = resizeStateRef.current
        if (!state) return
        const delta = e.clientX - state.startX
        const nextWidth = Math.max(minWidth, Math.round(state.startWidth + delta))

        if (liveColumnWidthsRef.current[state.columnKey] === nextWidth) {
          return
        }

        liveColumnWidthsRef.current = {
          ...liveColumnWidthsRef.current,
          [state.columnKey]: nextWidth,
        }

        if (frameRef.current === null) {
          frameRef.current = window.requestAnimationFrame(commitWidths)
        }
      }

      const cleanup = () => {
        resizeStateRef.current = null
        setResizingColumn(null)
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current)
          frameRef.current = null
        }
        setColumnWidths((prev) =>
          prev === liveColumnWidthsRef.current ? prev : liveColumnWidthsRef.current,
        )
        document.body.style.cursor = savedCursor
        document.body.style.userSelect = savedUserSelect
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        cleanupRef.current = null
      }

      const handleMouseUp = () => {
        cleanup()
      }

      cleanupRef.current = cleanup
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [minWidth],
  )

  const resetColumnWidth = useCallback(
    (columnKey: string) => {
      setColumnWidths((prev) => ({
        ...prev,
        [columnKey]: initialWidths[columnKey] ?? 120,
      }))
    },
    [initialWidths],
  )

  return { columnWidths, resizingColumn, startResize, resetColumnWidth }
}

export default useColumnResize
