import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

export type ColumnWidths = Record<string, number>

type UseColumnResizeOptions = {
  initialWidths: ColumnWidths
  minWidth?: number
  storageKey?: string
}

type ResizeState = {
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
      cleanupRef.current?.()
    }
  }, [])

  const startResize = useCallback(
    (columnKey: string, currentWidth: number, event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      resizeStateRef.current = {
        columnKey,
        startX: event.clientX,
        startWidth: currentWidth,
      }

      setResizingColumn(columnKey)

      const savedCursor = document.body.style.cursor
      const savedUserSelect = document.body.style.userSelect
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (e: MouseEvent) => {
        const state = resizeStateRef.current
        if (!state) return
        const delta = e.clientX - state.startX
        const nextWidth = Math.max(minWidth, Math.round(state.startWidth + delta))
        setColumnWidths((prev) => {
          if (prev[state.columnKey] === nextWidth) return prev
          return { ...prev, [state.columnKey]: nextWidth }
        })
      }

      const cleanup = () => {
        resizeStateRef.current = null
        setResizingColumn(null)
        document.body.style.cursor = savedCursor
        document.body.style.userSelect = savedUserSelect
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', cleanup)
        cleanupRef.current = null
      }

      cleanupRef.current = cleanup
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', cleanup)
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
