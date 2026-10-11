import { Outlet } from 'react-router-dom'
import { Topbar } from '@/components/layout/Topbar'
import { SegmentSwitcher } from '@/components/layout/SegmentSwitcher'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { useCatalogRealtime } from '@/hooks/useCatalog'

export function AppShell() {
  useCatalogRealtime()

  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="app-backdrop" />
      <div className="relative z-10">
        <Topbar />
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <SegmentSwitcher />
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
