import { cn } from '@hollowcube/design-system'

// Acts as both the visible gap (2 tailwind units = 8px) between panels AND
// the resize hit-area. Transparent so the bg-background shows through, giving
// every panel the appearance of floating on the dark page.
export function ResizeHandle({ orientation }: { orientation: 'horizontal' | 'vertical' }) {
    return (
        <div
            data-slot='workspace-resize-handle'
            className={cn(
                'shrink-0 bg-transparent',
                orientation === 'horizontal'
                    ? 'h-full w-2 cursor-col-resize'
                    : 'h-2 w-full cursor-row-resize',
            )}
        />
    )
}
