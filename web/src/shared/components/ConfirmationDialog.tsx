import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { gsap } from 'gsap'

type ConfirmationDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
  const [isRendered, setIsRendered] = useState(open)

  useEffect(() => {
    if (!isRendered) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isRendered, onCancel])

  useEffect(() => {
    const backdropElement = backdropRef.current
    const dialogElement = dialogRef.current

    if (open) {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null
      setIsRendered(true)
      return
    }

    if (!isRendered || !backdropElement || !dialogElement) {
      return
    }

    gsap.killTweensOf([backdropElement, dialogElement])
    const timeline = gsap.timeline({
      defaults: {
        duration: 0.24,
        ease: 'power2.in',
      },
      onComplete: () => {
        setIsRendered(false)
        previouslyFocusedElementRef.current?.focus()
      },
    })

    timeline.to(dialogElement, {
      autoAlpha: 0,
      y: 10,
      scale: 0.985,
    }, 0)
    timeline.to(backdropElement, {
      autoAlpha: 0,
    }, 0)

    return () => {
      timeline.kill()
    }
  }, [isRendered, open])

  useEffect(() => {
    const backdropElement = backdropRef.current
    const dialogElement = dialogRef.current

    if (!open || !isRendered || !backdropElement || !dialogElement) {
      return
    }

    gsap.killTweensOf([backdropElement, dialogElement])
    gsap.set(backdropElement, { autoAlpha: 0 })
    gsap.set(dialogElement, { autoAlpha: 0, y: 10, scale: 0.985 })

    const timeline = gsap.timeline({
      defaults: {
        duration: 0.24,
        ease: 'power2.out',
      },
    })

    timeline.to(backdropElement, {
      autoAlpha: 1,
    }, 0)
    timeline.to(dialogElement, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      onComplete: () => {
        cancelButtonRef.current?.focus()
      },
    }, 0)

    return () => {
      timeline.kill()
    }
  }, [isRendered, open])

  if (!isRendered) {
    return null
  }

  function handleBackdropMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onCancel()
    }
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') {
      return
    }

    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector)

    if (!focusableElements || focusableElements.length === 0) {
      event.preventDefault()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,5,8,0.72)] px-4 backdrop-blur-[3px]"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-md rounded-[1.6rem] border border-white/10 bg-[#0a0c10] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6"
      >
        <div className="inline-flex rounded-full border border-rose-400/14 bg-rose-400/[0.05] px-3 py-1 text-[0.64rem] font-medium uppercase tracking-[0.24em] text-rose-200/85">
          Layout Change
        </div>
        <h2 id={titleId} className="mt-4 text-xl font-semibold tracking-[0.01em] text-white">
          {title}
        </h2>
        <p
          id={descriptionId}
          className="mt-3 text-sm leading-6 text-slate-400"
        >
          {description}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-slate-200 transition-colors hover:border-white/16 hover:bg-white/[0.05] hover:text-white"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border border-rose-400/18 bg-rose-400/[0.10] px-4 py-2.5 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-rose-100 transition-colors hover:border-rose-300/28 hover:bg-rose-400/[0.14]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationDialog
