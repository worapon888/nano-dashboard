import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TradingTable from './TradingTable'
import { openOrdersSummaryMock } from '../data/orders.mock'

describe('TradingTable pointer column resize', () => {
  it('resizes a column with pointer events without breaking the table layout', async () => {
    render(<TradingTable title="Open Orders" data={openOrdersSummaryMock} />)

    const pairHeader = screen.getAllByText('Pair')[0]?.closest('th')

    if (!pairHeader) {
      throw new Error('Could not find Pair header cell')
    }

    const resizeHandle = within(pairHeader).getByRole('separator', { name: 'Resize Pair column' })
    const beforeWidth = Number.parseFloat((pairHeader as HTMLElement).style.width)

    fireEvent.pointerDown(resizeHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: 40,
    })
    fireEvent.mouseMove(window, {
      clientX: 160,
      clientY: 40,
    })
    fireEvent.mouseUp(window, {
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

  it('toggles an expandable detail panel when clicking a row', async () => {
    render(<TradingTable title="Open Orders" data={openOrdersSummaryMock} />)

    const pairCell = screen.getAllByText('BTC/USDT')[0]
    const row = pairCell.closest('tr')

    if (!row) {
      throw new Error('Could not find BTC/USDT row')
    }

    fireEvent.click(row)

    expect(await screen.findByText('Order ID')).toBeTruthy()
    expect(screen.getByText('ORD-7A2F')).toBeTruthy()
    expect(screen.getByText('Notes')).toBeTruthy()

    fireEvent.click(row)

    await waitFor(() => {
      expect(screen.queryByText('ORD-7A2F')).toBeNull()
    })
  })
})
