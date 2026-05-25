import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { NotificationService } from './NotificationService'

let svc: NotificationService
beforeEach(() => {
    svc = new NotificationService()
})
afterEach(() => {
    svc.dispose()
})

describe('NotificationService — notify', () => {
    test('returns an id and adds the entry to list', () => {
        const id = svc.notify({ level: 'info', message: 'hi' })
        const list = svc.list.peek()
        expect(list).toHaveLength(1)
        expect(list[0]?.id).toBe(id)
        expect(list[0]?.message).toBe('hi')
        expect(list[0]?.level).toBe('info')
    })

    test('defaults to info level when none specified', () => {
        svc.notify({ message: 'hi' })
        expect(svc.list.peek()[0]?.level).toBe('info')
    })

    test('captures optional caption', () => {
        svc.notify({ level: 'error', message: 'boom', caption: 'details' })
        expect(svc.list.peek()[0]?.caption).toBe('details')
    })

    test('multiple entries accumulate in order', () => {
        svc.notify({ message: 'one' })
        svc.notify({ message: 'two' })
        const list = svc.list.peek()
        expect(list.map((n) => n.message)).toEqual(['one', 'two'])
    })

    test('shorthand helpers set level', () => {
        const a = svc.info('a')
        const b = svc.success('b')
        const c = svc.warning('c')
        const d = svc.error('d')
        const list = svc.list.peek()
        expect(list.find((n) => n.id === a)?.level).toBe('info')
        expect(list.find((n) => n.id === b)?.level).toBe('success')
        expect(list.find((n) => n.id === c)?.level).toBe('warning')
        expect(list.find((n) => n.id === d)?.level).toBe('error')
    })
})

describe('NotificationService — dismiss', () => {
    test('removes by id', () => {
        const a = svc.notify({ message: 'a' })
        svc.notify({ message: 'b' })
        svc.dismiss(a)
        expect(svc.list.peek()).toHaveLength(1)
        expect(svc.list.peek()[0]?.message).toBe('b')
    })

    test('dismiss of unknown id is a no-op', () => {
        svc.notify({ message: 'a' })
        svc.dismiss('does-not-exist')
        expect(svc.list.peek()).toHaveLength(1)
    })

    test('clear removes all entries', () => {
        svc.notify({ message: 'a' })
        svc.notify({ message: 'b' })
        svc.clear()
        expect(svc.list.peek()).toEqual([])
    })
})

describe('NotificationService — auto-dismiss', () => {
    test('explicit autoDismissMs: 0 keeps the entry forever', async () => {
        svc.notify({ message: 'persistent', level: 'info', autoDismissMs: 0 })
        await new Promise((r) => setTimeout(r, 30))
        expect(svc.list.peek()).toHaveLength(1)
    })

    test('error level defaults to no auto-dismiss', async () => {
        svc.notify({ level: 'error', message: 'boom' })
        await new Promise((r) => setTimeout(r, 30))
        expect(svc.list.peek()).toHaveLength(1)
    })

    test('info auto-dismisses after the configured ms', async () => {
        svc.notify({ level: 'info', message: 'gone soon', autoDismissMs: 20 })
        await new Promise((r) => setTimeout(r, 50))
        expect(svc.list.peek()).toEqual([])
    })

    test('manually dismissing before the timer clears the timer', async () => {
        const id = svc.notify({ message: 'a', autoDismissMs: 20 })
        svc.dismiss(id)
        await new Promise((r) => setTimeout(r, 30))
        expect(svc.list.peek()).toEqual([])
    })
})

describe('NotificationService — disposal', () => {
    test('dispose clears entries and pending timers', async () => {
        svc.notify({ message: 'a', autoDismissMs: 20 })
        svc.dispose()
        expect(svc.list.peek()).toEqual([])
        await new Promise((r) => setTimeout(r, 30))
        // No throw, no resurrection — clean.
        expect(svc.list.peek()).toEqual([])
    })
})
