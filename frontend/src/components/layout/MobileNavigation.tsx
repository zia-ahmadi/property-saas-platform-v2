import { Dialog } from '@base-ui/react/dialog'
import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { AppNavigation } from './AppNavigation'

export function MobileNavigation() {
  const location = useLocation()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [openLocation, setOpenLocation] = useState<typeof location | null>(null)
  // Derive visibility from the location so all route changes dismiss the drawer.
  const open = openLocation === location

  useEffect(() => {
    const desktop = window.matchMedia?.('(min-width: 48rem)')
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpenLocation(null)
    }
    desktop?.addEventListener('change', closeOnDesktop)
    return () => desktop?.removeEventListener('change', closeOnDesktop)
  }, [])

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => setOpenLocation(nextOpen ? location : null)}
    >
      <Dialog.Trigger
        ref={triggerRef}
        render={<Button variant="outline" size="icon" className="size-11 shrink-0 md:hidden" />}
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        <Menu aria-hidden="true" className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-testid="navigation-backdrop"
          className="fixed inset-0 z-40 bg-foreground/40"
        />
        <Dialog.Popup
          className="fixed inset-y-0 left-0 z-50 w-80 max-w-[calc(100%_-_2rem)] overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl"
          finalFocus={() =>
            window.matchMedia?.('(min-width: 48rem)').matches
              ? document.getElementById('main-content')
              : triggerRef.current
          }
        >
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-sidebar-border p-4">
            <Dialog.Title className="text-base font-semibold">
              Property SaaS navigation
            </Dialog.Title>
            <Dialog.Close
              render={<Button variant="ghost" size="icon" className="size-11 shrink-0" />}
              aria-label="Close navigation menu"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Choose a section of the application.
          </Dialog.Description>
          <AppNavigation label="Mobile navigation" onNavigate={() => setOpenLocation(null)} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
