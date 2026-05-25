// `NotificationService` — toast / banner state owned by the model.
//
// Replaces ad-hoc `useState<string | null>` + setTimeout-dismiss patterns
// that lived inside views (`files.tsx`'s openError, `text.tsx`'s saveError,
// future surface-an-issue paths). Any service that wants to surface a
// user-visible message now calls `notify({ ... })`; the React overlay
// subscribes and renders.
//
// Each notification has an id (auto-allocated), a level, a message, an
// optional caption (sub-line / error detail), and an optional auto-dismiss
// timeout. The service tracks timers and clears entries when they fire.
// Callers can dismiss explicitly via the returned id.

import { signal, type ReadonlySignal } from '../foundation/signal'

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export type Notification = {
    id: string
    level: NotificationLevel
    message: string
    /** Optional second line — usually the underlying error detail. */
    caption?: string
}

export type NotifyArgs = {
    level?: NotificationLevel
    message: string
    caption?: string
    /** Auto-dismiss after this many ms. Default: 4000ms for info /
     *  success / warning, never for error (errors persist until the
     *  user dismisses). Pass 0 to disable auto-dismiss. */
    autoDismissMs?: number
}

const DEFAULT_TIMEOUT_MS: Record<NotificationLevel, number> = {
    info: 4000,
    success: 4000,
    warning: 4000,
    error: 0,
}

export class NotificationService {
    private readonly _list = signal<readonly Notification[]>([])
    private readonly _timers = new Map<string, ReturnType<typeof setTimeout>>()
    private _seq = 0

    readonly list: ReadonlySignal<readonly Notification[]> = this._list

    /** Surface a notification. Returns the assigned id so callers can
     *  dismiss programmatically. */
    notify(args: NotifyArgs): string {
        const id = `n-${++this._seq}`
        const level = args.level ?? 'info'
        const entry: Notification = {
            id,
            level,
            message: args.message,
            ...(args.caption !== undefined ? { caption: args.caption } : {}),
        }
        this._list.value = [...this._list.peek(), entry]
        const timeout = args.autoDismissMs ?? DEFAULT_TIMEOUT_MS[level]
        if (timeout > 0) {
            this._timers.set(
                id,
                setTimeout(() => {
                    this._timers.delete(id)
                    this.dismiss(id)
                }, timeout),
            )
        }
        return id
    }

    /** Shorthand for `notify({ level: 'info', ... })`. */
    info(message: string, args?: Omit<NotifyArgs, 'level' | 'message'>): string {
        return this.notify({ ...args, level: 'info', message })
    }

    success(message: string, args?: Omit<NotifyArgs, 'level' | 'message'>): string {
        return this.notify({ ...args, level: 'success', message })
    }

    warning(message: string, args?: Omit<NotifyArgs, 'level' | 'message'>): string {
        return this.notify({ ...args, level: 'warning', message })
    }

    error(message: string, args?: Omit<NotifyArgs, 'level' | 'message'>): string {
        return this.notify({ ...args, level: 'error', message })
    }

    /** Dismiss a single notification by id. */
    dismiss(id: string): void {
        const cur = this._list.peek()
        const next = cur.filter((n) => n.id !== id)
        if (next.length === cur.length) return
        const timer = this._timers.get(id)
        if (timer) {
            clearTimeout(timer)
            this._timers.delete(id)
        }
        this._list.value = next
    }

    /** Drop every active notification. */
    clear(): void {
        for (const t of this._timers.values()) clearTimeout(t)
        this._timers.clear()
        this._list.value = []
    }

    dispose(): void {
        this.clear()
    }
}
