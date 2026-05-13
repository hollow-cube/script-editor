import { useEffect } from 'react'

import { usePlatform } from '../../platform'
import { NATIVE_MENU_SLOTS } from './native-menu-slots'
import { useRunAction } from './registry'

// Subscribes to native menu clicks on platforms that expose one
// (`platform.menu`). Mounting this is a no-op on web; on desktop it routes
// `menu:invoke` events through the action registry.
//
// Renders nothing — it's a pure side-effect component, mounted once inside
// `<ActionRegistryProvider>` + `<ActionContextProvider>` so the registry +
// context snapshot are available.

export function NativeMenuBridge() {
    const platform = usePlatform()
    const runAction = useRunAction()

    useEffect(() => {
        const menu = platform.menu
        if (!menu) return
        menu.register?.(NATIVE_MENU_SLOTS)
        const unsubscribe = menu.onInvoke((slotId) => {
            const actionId = (NATIVE_MENU_SLOTS as Record<string, string | undefined>)[slotId]
            if (!actionId) {
                console.warn('[NativeMenuBridge] no action for slot', slotId)
                return
            }
            runAction(actionId, { source: 'native-menu' })
        })
        return unsubscribe
    }, [platform, runAction])

    return null
}
