import { XIcon } from 'lucide-react'

import { cn } from '@hollowcube/design-system'

import { useNotifications, useNotificationService } from '../model/notifications'
import type { Notification, NotificationLevel } from '../model/notifications/NotificationService'

// Stacked toast list anchored to the bottom-right of the workspace.
// Each entry mirrors a single NotificationService notification; the
// service handles auto-dismiss timers.

export function NotificationsOverlay() {
    const items = useNotifications()
    const svc = useNotificationService()
    if (items.length === 0) return null
    return (
        <div className='pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2'>
            {items.map((n) => (
                <Toast key={n.id} item={n} onDismiss={() => svc.dismiss(n.id)} />
            ))}
        </div>
    )
}

function Toast({ item, onDismiss }: { item: Notification; onDismiss: () => void }) {
    return (
        <div
            className={cn(
                'pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] gap-2 rounded-md border px-3 py-2 text-xs shadow-lg',
                CLASS_FOR_LEVEL[item.level],
            )}
            role={item.level === 'error' ? 'alert' : 'status'}
        >
            <div className='min-w-0 flex-1'>
                <div className='font-medium leading-snug'>{item.message}</div>
                {item.caption ? (
                    <div className='text-muted-foreground mt-0.5 break-words leading-snug'>
                        {item.caption}
                    </div>
                ) : null}
            </div>
            <button
                type='button'
                onClick={onDismiss}
                aria-label='Dismiss'
                className='text-muted-foreground hover:text-foreground -mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded'
            >
                <XIcon className='size-3.5' />
            </button>
        </div>
    )
}

const CLASS_FOR_LEVEL: Record<NotificationLevel, string> = {
    info: 'border-border bg-popover text-popover-foreground',
    success: 'border-emerald-400/40 bg-emerald-500/10 text-foreground',
    warning: 'border-yellow-400/40 bg-yellow-500/10 text-foreground',
    error: 'border-destructive/40 bg-destructive/10 text-destructive',
}
