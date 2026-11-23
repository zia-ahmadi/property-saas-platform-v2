import { createContext, useContext } from 'react'
export type PlatformAccess = 'loading' | 'allowed' | 'denied' | 'unavailable'
export const PlatformAccessContext = createContext<PlatformAccess>('denied')
export function usePlatformAccess() { return useContext(PlatformAccessContext) }
