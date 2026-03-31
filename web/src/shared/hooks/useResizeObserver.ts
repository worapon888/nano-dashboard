import { useCallback, useLayoutEffect, useRef, useState } from 'react'

type Size = {
  width: number
  height: number
}

const defaultSize: Size = {
  width: 0,
  height: 0,
}

function useResizeObserver<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null)
  const [size, setSize] = useState<Size>(defaultSize)
  const frameRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (!element) {
      setSize(defaultSize)
      return
    }

    const commitSize = (nextWidth: number, nextHeight: number) => {
      const roundedWidth = Math.round(nextWidth)
      const roundedHeight = Math.round(nextHeight)

      setSize((currentSize) => {
        if (
          Math.abs(currentSize.width - roundedWidth) <= 1 &&
          Math.abs(currentSize.height - roundedHeight) <= 1
        ) {
          return currentSize
        }

        return {
          width: roundedWidth,
          height: roundedHeight,
        }
      })
    }

    const scheduleSizeCommit = (nextWidth: number, nextHeight: number) => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        commitSize(nextWidth, nextHeight)
      })
    }

    if (typeof ResizeObserver === 'undefined') {
      const initialRect = element.getBoundingClientRect()
      commitSize(initialRect.width, initialRect.height)
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        return
      }

      scheduleSizeCommit(entry.contentRect.width, entry.contentRect.height)
    })

    observer.observe(element)

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }

      observer.disconnect()
    }
  }, [element])

  const ref = useCallback((node: T | null) => {
    setElement(node)
  }, [])

  return {
    ref,
    width: size.width,
    height: size.height,
  }
}

export default useResizeObserver
