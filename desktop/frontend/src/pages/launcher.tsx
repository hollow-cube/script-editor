import { AuthGate } from '@hollowcube/common/auth'

import { Launcher } from '../launcher/Launcher'

export default function LauncherPage() {
    return (
        <AuthGate>
            <Launcher />
        </AuthGate>
    )
}
