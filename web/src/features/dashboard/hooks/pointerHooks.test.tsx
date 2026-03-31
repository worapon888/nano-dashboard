import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import useWidgetDrag from './useWidgetDrag'
import useWidgetResize from './useWidgetResize'

function DragHarness() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const { isDragging, onDragPointerDown } = useWidgetDrag({
    onDragStart: () => undefined,
    onDrag: (deltaX, deltaY) => setPosition({ x: deltaX, y: deltaY }),
    onDragEnd: () => undefined,
  })

  return (
    <div>
      <div
        data-testid="drag-box"
        onPointerDown={onDragPointerDown}
      >
        drag
      </div>
      <output data-testid="drag-state">{isDragging ? 'dragging' : 'idle'}</output>
      <output data-testid="drag-position">{`${position.x},${position.y}`}</output>
    </div>
  )
}

function ResizeHarness() {
  const [size, setSize] = useState({ width: 100, height: 100 })
  const { isResizing, onResizeHandlePointerDown } = useWidgetResize({
    onResizeStart: () => undefined,
    onResize: (_direction, deltaX, deltaY) =>
      setSize({ width: 100 + deltaX, height: 100 + deltaY }),
    onResizeEnd: () => undefined,
  })

  return (
    <div>
      <button
        type="button"
        data-testid="resize-handle"
        onPointerDown={(event) => onResizeHandlePointerDown('bottomRight', event)}
      >
        resize
      </button>
      <output data-testid="resize-state">{isResizing ? 'resizing' : 'idle'}</output>
      <output data-testid="resize-size">{`${size.width},${size.height}`}</output>
    </div>
  )
}

describe('pointer interaction hooks', () => {
  it('stops widget drag when pointercancel fires', () => {
    render(<DragHarness />)

    const dragBox = screen.getByTestId('drag-box')
    fireEvent.pointerDown(dragBox, {
      pointerId: 10,
      pointerType: 'touch',
      isPrimary: true,
      clientX: 20,
      clientY: 20,
    })
    fireEvent.pointerMove(window, {
      pointerId: 10,
      pointerType: 'touch',
      isPrimary: true,
      clientX: 70,
      clientY: 90,
    })

    expect(screen.getByTestId('drag-state').textContent).toBe('dragging')
    expect(screen.getByTestId('drag-position').textContent).toBe('50,70')

    fireEvent.pointerCancel(window, {
      pointerId: 10,
      pointerType: 'touch',
      isPrimary: true,
    })

    expect(screen.getByTestId('drag-state').textContent).toBe('idle')

    fireEvent.pointerMove(window, {
      pointerId: 10,
      pointerType: 'touch',
      isPrimary: true,
      clientX: 120,
      clientY: 140,
    })

    expect(screen.getByTestId('drag-position').textContent).toBe('50,70')
  })

  it('ends widget resize when the pointer is released outside the handle element', () => {
    render(<ResizeHarness />)

    const resizeHandle = screen.getByTestId('resize-handle')
    fireEvent.pointerDown(resizeHandle, {
      pointerId: 11,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: 100,
    })
    fireEvent.pointerMove(window, {
      pointerId: 11,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 160,
      clientY: 170,
    })

    expect(screen.getByTestId('resize-state').textContent).toBe('resizing')
    expect(screen.getByTestId('resize-size').textContent).toBe('160,170')

    fireEvent.pointerUp(window, {
      pointerId: 11,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 500,
      clientY: 500,
    })

    expect(screen.getByTestId('resize-state').textContent).toBe('idle')

    fireEvent.pointerMove(window, {
      pointerId: 11,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 260,
      clientY: 280,
    })

    expect(screen.getByTestId('resize-size').textContent).toBe('160,170')
  })
})
