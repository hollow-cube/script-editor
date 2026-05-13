import { Events } from '@wailsio/runtime'

import type { MenuController } from '@hollowcube/common/platform'

// Concrete MenuController for the desktop platform. Subscribes to the
// `menu:invoke` event emitted by the Go menu items (see desktop/menu.go).
//
// We treat `register` as a no-op — the slot table is owned by the frontend
// (common/src/project/actions/native-menu-slots.ts), so there's nothing for
// the Wails layer to validate against.

const MENU_INVOKE_EVENT = 'menu:invoke'

export const desktopMenuController: MenuController = {
    register: () => undefined,
    onInvoke: (handler) => {
        return Events.On(MENU_INVOKE_EVENT, (ev) => {
            const data = ev.data
            if (typeof data !== 'string') return
            handler(data)
        })
    },
}
