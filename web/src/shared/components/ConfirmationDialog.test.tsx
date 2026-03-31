import { act, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConfirmationDialog from './ConfirmationDialog'

const { exitAnimationCompletions } = vi.hoisted(() => ({
  exitAnimationCompletions: [] as Array<() => void>,
}))

vi.mock('gsap', () => {
  const timeline = vi.fn((config?: { onComplete?: () => void }) => {
    if (config?.onComplete) {
      exitAnimationCompletions.push(config.onComplete)
    }

    return {
      to: vi.fn().mockReturnThis(),
      kill: vi.fn(),
    }
  })

  return {
    gsap: {
      killTweensOf: vi.fn(),
      set: vi.fn(),
      timeline,
    },
  }
})

function TestHarness() {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open modal
      </button>
      <ConfirmationDialog
        open={open}
        title="Reset layout?"
        description="This will restore the default dashboard arrangement."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </div>
  )
}

function openModal() {
  fireEvent.click(screen.getByRole('button', { name: 'Open modal' }))
  return screen.getByRole('dialog', { name: 'Reset layout?' })
}

function finishExitAnimation() {
  const onComplete = exitAnimationCompletions.at(-1)

  if (!onComplete) {
    throw new Error('Expected an exit animation callback to be registered')
  }

  act(() => {
    onComplete()
  })
}

describe('ConfirmationDialog', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    exitAnimationCompletions.length = 0
  })

  it('opens the modal when triggered', () => {
    render(<TestHarness />)

    const dialog = openModal()

    expect(dialog).toBeTruthy()
    expect(screen.getByText('This will restore the default dashboard arrangement.')).toBeTruthy()
  })

  it('closes on Cancel', () => {
    render(<TestHarness />)

    openModal()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('dialog', { name: 'Reset layout?' })).toBeTruthy()
    finishExitAnimation()
    expect(screen.queryByRole('dialog', { name: 'Reset layout?' })).toBeNull()
  })

  it('closes on Reset', () => {
    render(<TestHarness />)

    openModal()
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    expect(screen.getByRole('dialog', { name: 'Reset layout?' })).toBeTruthy()
    finishExitAnimation()
    expect(screen.queryByRole('dialog', { name: 'Reset layout?' })).toBeNull()
  })

  it('closes on Escape key', () => {
    render(<TestHarness />)

    openModal()
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.getByRole('dialog', { name: 'Reset layout?' })).toBeTruthy()
    finishExitAnimation()
    expect(screen.queryByRole('dialog', { name: 'Reset layout?' })).toBeNull()
  })

  it('closes on backdrop click', () => {
    const { container } = render(<TestHarness />)

    openModal()
    const backdrop = container.querySelector('.fixed.inset-0')

    if (!(backdrop instanceof HTMLDivElement)) {
      throw new Error('Expected backdrop element to exist')
    }

    fireEvent.mouseDown(backdrop)

    expect(screen.getByRole('dialog', { name: 'Reset layout?' })).toBeTruthy()
    finishExitAnimation()
    expect(screen.queryByRole('dialog', { name: 'Reset layout?' })).toBeNull()
  })

  it('keeps the modal mounted until the exit animation completes', () => {
    render(<TestHarness />)

    openModal()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('dialog', { name: 'Reset layout?' })).toBeTruthy()

    finishExitAnimation()

    expect(screen.queryByRole('dialog', { name: 'Reset layout?' })).toBeNull()
  })
})
