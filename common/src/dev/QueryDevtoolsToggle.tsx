import { useState } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

/** Dev-only toggle for the TanStack Query devtools panel.
 *
 *  The floating corner button is part of `ReactQueryDevtools`; mounting it
 *  opens the panel and unmounting hides everything (button included). Bound to
 *  Mod+Shift+O so it stays out of the way until needed. */
export function QueryDevtoolsToggle() {
    const [open, setOpen] = useState(false)
    useHotkey('Mod+Shift+O', () => setOpen((o) => !o))
    if (!open) return null
    return <ReactQueryDevtools initialIsOpen />
}
