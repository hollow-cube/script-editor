import { type Storage } from './types'

export function createBrowserStorage(): Storage {
    return {
        get(key) {
            try {
                return window.localStorage.getItem(key)
            } catch {
                return null
            }
        },
        set(key, value) {
            try {
                window.localStorage.setItem(key, value)
            } catch {
                /* quota / disabled — ignore */
            }
        },
        remove(key) {
            try {
                window.localStorage.removeItem(key)
            } catch {
                /* ignore */
            }
        },
    }
}
