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

  it('handles month ranges ending on 28, 29, 30, and 31 days', () => {
    expect(getDateRange('2025-02-14', 'month')).toEqual({
      start: '2025-02-01',
      end: '2025-02-28',
    })
    expect(getDateRange('2024-02-14', 'month')).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    })
    expect(getDateRange('2026-04-14', 'month')).toEqual({
      start: '2026-04-01',
      end: '2026-04-30',
    })
    expect(getDateRange('2026-03-14', 'month')).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
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

  it('handles weeks that cross from December into January', () => {
    expect(getDateRange('2025-12-31', 'week')).toEqual({
      start: '2025-12-29',
      end: '2026-01-04',
    })
  })

  it('handles leap year dates for day, week, month, and year ranges', () => {
    expect(getDateRange('2024-02-29', 'day')).toEqual({
      start: '2024-02-29',
      end: '2024-02-29',
    })
    expect(getDateRange('2024-02-29', 'week')).toEqual({
      start: '2024-02-26',
      end: '2024-03-03',
    })
    expect(getDateRange('2024-02-29', 'month')).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    })
    expect(getDateRange('2024-02-29', 'year')).toEqual({
      start: '2024-01-01',
      end: '2024-12-31',
    })
  })
})
