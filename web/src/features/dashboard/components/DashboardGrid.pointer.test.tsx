import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DashboardGrid from './DashboardGrid'
import { tradingDashboardDefinition } from '../data/dashboardDefinition'
import TradingTable from '../../table/components/TradingTable'
import { ordersMock } from '../../table/data/orders.mock'

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

function expectNoOverlap(titles: string[]) {
  const frames = titles.map((title) => getPanelFrame(title)).map(getMetrics)

  for (let index = 0; index < frames.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < frames.length; compareIndex += 1) {
      const left = frames[index]
      const right = frames[compareIndex]
      const overlaps =
        left.left < right.left + right.width &&
        left.left + left.width > right.left &&
        left.top < right.top + right.height &&
        left.top + left.height > right.top

      expect(overlaps).toBe(false)
    }
  }
}

describe('DashboardGrid pointer interactions', () => {
  it('drags a widget via pointer events and keeps the layout non-overlapping', async () => {
    render(<DashboardGrid definition={tradingDashboardDefinition} />)

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Open Orders' }).length).toBeGreaterThan(0)
    })

    const before = getMetrics(getPanelFrame('Open Orders'))
    const header = getHeader('Open Orders')

    fireEvent.pointerDown(header, {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: 900,
    })
    fireEvent.pointerMove(window, {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 100,
      clientY: 300,
    })
    fireEvent.pointerUp(window, {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 100,
      clientY: 300,
    })

    await waitFor(() => {
      const after = getMetrics(getPanelFrame('Open Orders'))
      expect(after.top).not.toBe(before.top)
    })

    expectNoOverlap([
      'BTC Price Trend',
      'Portfolio Breakdown',
      'Volume Profile',
      'Daily PNL',
      'Open Orders',
    ])
  })

  it('resizes a widget with pointer events and preserves a valid layout', async () => {
    render(<DashboardGrid definition={tradingDashboardDefinition} />)

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Volume Profile' }).length).toBeGreaterThan(0)
    })

    const frame = getPanelFrame('Volume Profile')
    const before = getMetrics(frame)
    const resizeHandle = within(frame).getByRole('button', { name: 'Resize widget from bottomRight' })

    fireEvent.pointerDown(resizeHandle, {
      pointerId: 2,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 400,
      clientY: 400,
    })
    fireEvent.pointerMove(window, {
      pointerId: 2,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 620,
      clientY: 520,
    })
    fireEvent.pointerUp(window, {
      pointerId: 2,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 620,
      clientY: 520,
    })

    await waitFor(() => {
      const after = getMetrics(getPanelFrame('Volume Profile'))
      expect(after.width).toBeGreaterThan(before.width)
      expect(after.height).toBeGreaterThan(before.height)
    })

    expectNoOverlap([
      'BTC Price Trend',
      'Portfolio Breakdown',
      'Volume Profile',
      'Daily PNL',
      'Open Orders',
    ])
  })

  it('remains usable after quick pointer drag and resize sequences', async () => {
    render(<DashboardGrid definition={tradingDashboardDefinition} />)

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Volume Profile' }).length).toBeGreaterThan(0)
    })

    const header = getHeader('Volume Profile')
    fireEvent.pointerDown(header, {
      pointerId: 3,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 80,
      clientY: 500,
    })
    fireEvent.pointerMove(window, {
      pointerId: 3,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 180,
      clientY: 540,
    })
    fireEvent.pointerUp(window, {
      pointerId: 3,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 180,
      clientY: 540,
    })

    const resizeHandle = within(getPanelFrame('Volume Profile')).getByRole('button', {
      name: 'Resize widget from right',
    })
    fireEvent.pointerDown(resizeHandle, {
      pointerId: 4,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 420,
      clientY: 520,
    })
    fireEvent.pointerMove(window, {
      pointerId: 4,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 560,
      clientY: 520,
    })
    fireEvent.pointerUp(window, {
      pointerId: 4,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 560,
      clientY: 520,
    })

    const titles = [
      'BTC Price Trend',
      'Portfolio Breakdown',
      'Volume Profile',
      'Daily PNL',
      'Open Orders',
    ]

    await waitFor(() => {
      for (const title of titles) {
        const metrics = getMetrics(getPanelFrame(title))
        expect(Number.isFinite(metrics.left)).toBe(true)
        expect(Number.isFinite(metrics.top)).toBe(true)
        expect(Number.isFinite(metrics.width)).toBe(true)
        expect(Number.isFinite(metrics.height)).toBe(true)
        expect(metrics.width).toBeGreaterThan(0)
        expect(metrics.height).toBeGreaterThan(0)
      }
    })

    expectNoOverlap(titles)
  })
})

describe('TradingTable pointer column resizing', () => {
  it('resizes a column via pointer events and keeps the table intact', async () => {
    render(<TradingTable title="Open Orders" rows={ordersMock} />)

    const pairHeader = screen.getAllByText('Pair')[0]?.closest('th')

    if (!pairHeader) {
      throw new Error('Could not find Pair header cell')
    }

    const beforeWidth = Number.parseFloat((pairHeader as HTMLElement).style.width)
    const resizeHandle = within(pairHeader).getByRole('separator', { name: 'Resize Pair column' })

    fireEvent.pointerDown(resizeHandle, {
      pointerId: 5,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: 40,
    })
    fireEvent.pointerMove(window, {
      pointerId: 5,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 160,
      clientY: 40,
    })
    fireEvent.pointerUp(window, {
      pointerId: 5,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 160,
      clientY: 40,
    })

    await waitFor(() => {
      const updatedPairHeader = screen.getAllByText('Pair')[0]?.closest('th')

      if (!updatedPairHeader) {
        throw new Error('Could not find Pair header cell after resize')
      }

      const afterWidth = Number.parseFloat((updatedPairHeader as HTMLElement).style.width)
      expect(afterWidth).toBeGreaterThan(beforeWidth)
    })

    expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Status').length).toBeGreaterThan(0)
  })
})
