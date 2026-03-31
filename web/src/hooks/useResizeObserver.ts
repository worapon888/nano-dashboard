import { useCallback, useEffect, useState } from 'react'

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

  useEffect(() => {
    if (!element) {
      setSize(defaultSize)
      return
    }

    const updateSize = () => {
      const nextWidth = Math.round(element.clientWidth)
      const nextHeight = Math.round(element.clientHeight)

      setSize((currentSize) => {
        if (
          currentSize.width === nextWidth &&
          currentSize.height === nextHeight
        ) {
          return currentSize
        }

        return {
          width: nextWidth,
          height: nextHeight,
        }
      })
    }

    updateSize()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      updateSize()
    })

    observer.observe(element)

    return () => {
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
