import type { LocalHubApi } from '../electron/preload'

declare global {
  interface Window {
    api: LocalHubApi
  }
}

export {}
