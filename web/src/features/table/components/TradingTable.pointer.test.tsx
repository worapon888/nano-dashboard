import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TradingTable from './TradingTable'
import { ordersMock } from '../data/orders.mock'

describe('TradingTable pointer column resize', () => {
  it('resizes a column with pointer events without breaking the table layout', async () => {
    render(<TradingTable title="Open Orders" rows={ordersMock} />)

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
    fireEvent.pointerMove(window, {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 160,
      clientY: 40,
    })
    fireEvent.pointerUp(window, {
      pointerId: 1,
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
