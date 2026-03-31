export type DateRangeType = 'day' | 'week' | 'month' | 'year'

export type DateRange = {
  start: string
  end: string
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function formatUtcDate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseInputDate(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const dateOnlyMatch = trimmedValue.match(DATE_ONLY_PATTERN)

  if (dateOnlyMatch) {
    const [, yearValue, monthValue, dayValue] = dateOnlyMatch
    const year = Number(yearValue)
    const monthIndex = Number(monthValue) - 1
    const day = Number(dayValue)
    const date = new Date(Date.UTC(year, monthIndex, day))

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== monthIndex ||
      date.getUTCDate() !== day
    ) {
      return null
    }

    return date
  }

  const parsedDate = new Date(trimmedValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  return new Date(
    Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth(),
      parsedDate.getUTCDate(),
    ),
  )
}

export function getDateRange(date: string, type: DateRangeType): DateRange {
  const parsedDate = parseInputDate(date)

  if (!parsedDate) {
    return {
      start: '',
      end: '',
    }
  }

  const year = parsedDate.getUTCFullYear()
  const monthIndex = parsedDate.getUTCMonth()
  const day = parsedDate.getUTCDate()
  let startDate = parsedDate
  let endDate = parsedDate

  switch (type) {
    case 'day':
      break
    case 'week': {
      const weekday = parsedDate.getUTCDay()
      const distanceFromMonday = (weekday + 6) % 7
      startDate = new Date(Date.UTC(year, monthIndex, day - distanceFromMonday))
      endDate = new Date(Date.UTC(year, monthIndex, day + (6 - distanceFromMonday)))
      break
    }
    case 'month':
      startDate = new Date(Date.UTC(year, monthIndex, 1))
      endDate = new Date(Date.UTC(year, monthIndex + 1, 0))
      break
    case 'year':
      startDate = new Date(Date.UTC(year, 0, 1))
      endDate = new Date(Date.UTC(year, 11, 31))
      break
    default:
      return {
        start: '',
        end: '',
      }
  }

  return {
    start: formatUtcDate(startDate),
    end: formatUtcDate(endDate),
  }
}
