import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DashboardGrid from './DashboardGrid'
import { tradingDashboardDefinition } from '../data/dashboardDefinition'

vi.mock('../../../shared/hooks/useResizeObserver', () => ({
  default: () => ({
    ref: vi.fn(),
    width: 1440,
    height: 900,
  }),
}))

vi.mock('react-apexcharts', () => ({
  default: ({ type }: { type: string }) => <div data-testid={`apex-chart-${type}`} />,
}))

function getPanelFrame(title: string) {
  const heading = screen.getAllByRole('heading', { name: title })[0]
  const section = heading.closest('section')

  if (!section?.parentElement) {
    throw new Error(`Could not find panel frame for ${title}`)
  }

  return section.parentElement as HTMLDivElement
}

function getHeader(title: string) {
  const heading = screen.getAllByRole('heading', { name: title })[0]
  const header = heading.closest('header')

  if (!header) {
    throw new Error(`Could not find header for ${title}`)
  }

  return header as HTMLElement
}

function getMetrics(frame: HTMLElement) {
  return {
    left: Number.parseFloat(frame.style.left),
    top: Number.parseFloat(frame.style.top),
    width: Number.parseFloat(frame.style.width),
    height: Number.parseFloat(frame.style.height),
  }
}

function panelsOverlap(leftTitle: string, rightTitle: string) {
  const left = getMetrics(getPanelFrame(leftTitle))
  const right = getMetrics(getPanelFrame(rightTitle))

  return (
    left.left < right.left + right.width &&
    left.left + left.width > right.left &&
    left.top < right.top + right.height &&
    left.top + left.height > right.top
  )
}

describe('DashboardGrid integration interactions', () => {
  it('keeps a bottom panel minimized after clicking the red control', async () => {
    render(<DashboardGrid definition={tradingDashboardDefinition} />)

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Open Orders' }).length).toBeGreaterThan(0)
    })

    const frameBefore = getPanelFrame('Open Orders')
    const minimizeButton = within(frameBefore).getByRole('button', {
      name: 'Minimize Open Orders',
    })

    fireEvent.pointerDown(minimizeButton, {
      pointerId: 7,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 1400,
      clientY: 760,
    })
    fireEvent.pointerUp(window, {
      pointerId: 7,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 1400,
      clientY: 760,
    })

    await waitFor(() => {
      const frameAfter = getPanelFrame('Open Orders')

      expect(within(frameAfter).getByRole('button', { name: 'Restore Open Orders' })).toBeTruthy()
      expect(Number.parseFloat(frameAfter.style.height)).toBe(76)
    })
  })

  it('supports pointer drag and resize without breaking layout', async () => {
    render(<DashboardGrid definition={tradingDashboardDefinition} />)

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Open Orders' }).length).toBeGreaterThan(0)
      expect(screen.getAllByRole('heading', { name: 'Volume Profile' }).length).toBeGreaterThan(0)
    })

    const openOrdersBefore = getMetrics(getPanelFrame('Open Orders'))
    const volumeProfileBefore = getMetrics(getPanelFrame('Volume Profile'))

    fireEvent.pointerDown(getHeader('Open Orders'), {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 120,
      clientY: 860,
    })
    fireEvent.pointerMove(window, {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 120,
      clientY: 360,
    })
    fireEvent.pointerUp(window, {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 120,
      clientY: 360,
    })

    const resizeHandle = within(getPanelFrame('Volume Profile')).getByRole('button', {
      name: 'Resize widget from bottomRight',
    })

    fireEvent.pointerDown(resizeHandle, {
      pointerId: 2,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 420,
      clientY: 420,
    })
    fireEvent.pointerMove(window, {
      pointerId: 2,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 600,
      clientY: 520,
    })
    fireEvent.pointerUp(window, {
      pointerId: 2,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 600,
      clientY: 520,
    })

    await waitFor(() => {
      const openOrdersAfter = getMetrics(getPanelFrame('Open Orders'))
      const volumeProfileAfter = getMetrics(getPanelFrame('Volume Profile'))

      expect(openOrdersAfter.top).not.toBe(openOrdersBefore.top)
      expect(volumeProfileAfter.width).toBeGreaterThan(volumeProfileBefore.width)
      expect(volumeProfileAfter.height).toBeGreaterThan(volumeProfileBefore.height)
      expect(Number.isFinite(openOrdersAfter.left)).toBe(true)
      expect(Number.isFinite(openOrdersAfter.top)).toBe(true)
      expect(Number.isFinite(volumeProfileAfter.width)).toBe(true)
      expect(Number.isFinite(volumeProfileAfter.height)).toBe(true)
    })

    expect(panelsOverlap('Open Orders', 'Volume Profile')).toBe(false)
  })
})
