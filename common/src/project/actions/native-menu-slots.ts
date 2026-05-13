// Maps native-menu slot ids (defined Go-side in `desktop/menu.go`) to the
// `Action.id` they should run. Manually maintained — adding a menu item is
// a Go change AND a one-line entry here.
//
// Slots without a matching action id are ignored (with a dev-mode console
// warn). This is by design: menu structure should remain stable across
// frontend deploys even if a particular action hasn't been registered yet.

export const NATIVE_MENU_SLOTS = {
    'file.new': 'editor.newFile',
    'tab.close': 'editor.closeFocusedTab',
    'search.openAll': 'search.openAll',
    'search.openActions': 'search.openActions',
    'search.openFiles': 'search.openFiles',
    'search.openText': 'search.openText',
} as const satisfies Readonly<Record<string, string>>

export type NativeMenuSlotId = keyof typeof NATIVE_MENU_SLOTS
