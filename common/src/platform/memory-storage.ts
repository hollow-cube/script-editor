import { type Storage } from './types'

export function createMemoryStorage(): Storage {
    const map = new Map<string, string>()
    return {
        get: (key) => map.get(key) ?? null,
        set: (key, value) => {
            map.set(key, value)
        },
        remove: (key) => {
            map.delete(key)
        },
    }
}
