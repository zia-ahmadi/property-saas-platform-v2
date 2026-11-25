import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'
type Preferences = { theme: Theme; showUnreadCount: boolean }

const key = 'property-saas:device-preferences'
const defaults: Preferences = { theme: 'system', showUnreadCount: true }
const listeners = new Set<() => void>()

function parse(raw: string | null): Preferences {
  try {
    const value = raw ? JSON.parse(raw) : null
    return {
      theme: value?.theme === 'light' || value?.theme === 'dark' ? value.theme : 'system',
      showUnreadCount: value?.showUnreadCount !== false,
    }
  } catch {
    return defaults
  }
}

function initial(): Preferences {
  try {
    return parse(window.localStorage.getItem(key))
  } catch {
    return defaults
  }
}

let current = initial()

function apply(next: Preferences) {
  if (current.theme === next.theme && current.showUnreadCount === next.showUnreadCount) return
  current = next
  listeners.forEach(listener => listener())
}

function storageChanged(event: StorageEvent) {
  if (event.key === key || event.key === null) apply(parse(event.newValue))
}

function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener('storage', storageChanged)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) window.removeEventListener('storage', storageChanged)
  }
}

export function updateDevicePreferences(changes: Partial<Preferences>) {
  const next = { ...current, ...changes }
  apply(next)
  try {
    window.localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // Keep preferences in memory when browser storage is unavailable.
  }
}

export function useDevicePreferences() {
  return useSyncExternalStore(subscribe, () => current, () => defaults)
}
