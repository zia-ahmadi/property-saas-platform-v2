import { useRef } from 'react'
import { PortfolioBreadcrumbs } from '@/components/layout/PortfolioBreadcrumbs'
import { Outlet } from 'react-router'
import { AppHeader } from '@/components/layout/AppHeader'
import { AppSidebar } from '@/components/layout/AppSidebar'

export function AppShell() {
  const contentRef = useRef<HTMLElement>(null)

  return (
    <div className="min-h-dvh min-w-0 bg-background text-foreground md:flex">
      <a
        href="#main-content"
        onClick={() => contentRef.current?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:border focus:bg-background focus:px-4 focus:py-2 focus:text-foreground"
      >
        Skip to content
      </a>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main
          id="main-content"
          aria-label="Main content"
          ref={contentRef}
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-x-auto p-4 sm:p-6 lg:p-8"
        >
          <PortfolioBreadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
