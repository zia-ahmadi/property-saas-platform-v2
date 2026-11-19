import { Dialog } from '@base-ui/react/dialog'
import { useRef, type ReactElement } from 'react'
import { Button } from './button'

interface ConfirmationDialogProps {
  trigger: ReactElement
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  onCancel?: () => void
  confirmLabel?: string
  cancelLabel?: string
  loadingLabel?: string
  destructive?: boolean
  loading?: boolean
  confirmDisabled?: boolean
}

export function ConfirmationDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loadingLabel = 'Confirming…',
  destructive = false,
  loading = false,
  confirmDisabled = false,
}: ConfirmationDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <Dialog.Root
      open={open}
      disablePointerDismissal={loading}
      onOpenChange={(nextOpen, details) => {
        if (loading && !nextOpen) {
          details.cancel()
          return
        }
        onOpenChange(nextOpen)
      }}
    >
      <Dialog.Trigger render={trigger} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/40" />
        <Dialog.Popup
          initialFocus={loading ? true : cancelRef}
          className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-popover p-6 text-popover-foreground shadow-xl"
        >
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {description}
          </Dialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Dialog.Close
              ref={cancelRef}
              disabled={loading}
              render={<Button variant="outline" className="min-h-11" />}
              onClick={onCancel}
            >
              {cancelLabel}
            </Dialog.Close>
            <Button
              type="button"
              variant={destructive ? 'destructive' : 'default'}
              disabled={loading || confirmDisabled}
              aria-busy={loading}
              onClick={onConfirm}
              className="min-h-11"
            >
              {loading ? loadingLabel : confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
