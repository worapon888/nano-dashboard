import { describe, expect, it } from 'vitest'
import { getDateRange } from './dateRange'

describe('getDateRange', () => {
  it('returns the same date for a day range', () => {
    expect(getDateRange('2026-03-31', 'day')).toEqual({
      start: '2026-03-31',
      end: '2026-03-31',
    })
  })

  it('returns an ISO week range from Monday to Sunday', () => {
    expect(getDateRange('2026-03-31', 'week')).toEqual({
      start: '2026-03-30',
      end: '2026-04-05',
    })
  })

  it('handles month boundaries correctly', () => {
    expect(getDateRange('2024-02-14', 'month')).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    })
  })

  it('handles year boundaries correctly', () => {
    expect(getDateRange('2025-12-31', 'year')).toEqual({
      start: '2025-01-01',
      end: '2025-12-31',
    })
  })

  it('accepts ISO timestamps and normalizes them to UTC dates', () => {
    expect(getDateRange('2026-01-01T18:45:00.000Z', 'month')).toEqual({
      start: '2026-01-01',
      end: '2026-01-31',
    })
  })

  it('returns empty strings for invalid dates', () => {
    expect(getDateRange('not-a-date', 'month')).toEqual({
      start: '',
      end: '',
    })
  })

  it('returns empty strings for impossible calendar dates', () => {
    expect(getDateRange('2025-02-30', 'day')).toEqual({
      start: '',
      end: '',
    })
  })
})
