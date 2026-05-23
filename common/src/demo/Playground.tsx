import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useHotkey } from '@tanstack/react-hotkeys'
import { create } from 'zustand'

import { Button } from '@hollowcube/design-system'

type CounterStore = {
    count: number
    increment: () => void
}

const useCounter = create<CounterStore>((set) => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 })),
}))

export function Playground() {
    const { count, increment } = useCounter()
    const [lastHotkey, setLastHotkey] = useState<string | null>(null)
    const [pingTime, setPingTime] = useState<string | null>(null)

    useHotkey('Mod+K', () => setLastHotkey('Mod+K fired'))
    useHotkey('Mod+S', (event) => {
        event.preventDefault()
        setLastHotkey('Mod+S fired')
    })

    useEffect(() => {
        let cancelled = false
        const id = window.setTimeout(() => {
            if (!cancelled) setPingTime(new Date().toISOString())
        }, 200)
        return () => {
            cancelled = true
            window.clearTimeout(id)
        }
    }, [])

    return (
        <div className='flex min-h-svh items-center justify-center p-6'>
            <div className='flex max-w-md flex-col gap-4 text-sm leading-loose'>
                <h1 className='text-2xl font-medium'>Hollowcube Playground</h1>
                <p className='text-muted-foreground'>
                    Vite + Generouted + Tanstack Hotkeys + Zustand
                </p>

                <div className='flex flex-wrap gap-2'>
                    <Button onClick={increment}>Count: {count}</Button>
                    <Link to='/'>
                        <Button variant='secondary'>Workspace →</Button>
                    </Link>
                    <Link to='/ds'>
                        <Button variant='secondary'>Design system →</Button>
                    </Link>
                    <Link to='/editor'>
                        <Button variant='secondary'>Code editor →</Button>
                    </Link>
                </div>

                <div className='text-muted-foreground font-mono text-xs'>
                    <div>Async ping: {pingTime ?? 'loading…'}</div>
                    <div>Last hotkey: {lastHotkey ?? 'press Mod+K or Mod+S'}</div>
                </div>
            </div>
        </div>
    )
}
