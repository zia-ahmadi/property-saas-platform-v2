import { useEffect } from 'react'
import { useDevicePreferences } from './devicePreferences'

export function WorkspaceAppearance() {
  const { theme } = useDevicePreferences()
  useEffect(() => {
    const system = window.matchMedia?.('(prefers-color-scheme: dark)')
    const root = document.documentElement
    const apply = () => root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && !!system?.matches))
    apply()
    if (theme === 'system') system?.addEventListener?.('change', apply)
    return () => { system?.removeEventListener?.('change', apply) }
  }, [theme])
  return null
}
