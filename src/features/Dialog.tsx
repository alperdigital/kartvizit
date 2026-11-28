import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({ title, children, close, opener }: {
  title: string
  children: ReactNode
  close: () => void
  opener?: HTMLElement | null
}) {
  const element = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = element.current
    const previous = opener ?? document.activeElement
    dialog?.showModal()
    return () => {
      if (dialog?.open) dialog.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [opener])
  return <dialog ref={element} onCancel={event=>{event.preventDefault();close()}} aria-labelledby={titleId}>
    <div className="section-heading dialog-heading">
      <h2 id={titleId}>{title}</h2>
      <button type="button" aria-label={title+' ×'} className="icon-button" onClick={close}><X/></button>
    </div>
    {children}
  </dialog>
}
