import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router'

import { AuthGate } from '@hollowcube/common/auth'
import { usePlatform } from '@hollowcube/common/platform'
import { ProjectWorkspace } from '@hollowcube/common/project'

import { synthesizeProjectName } from '../../launcher/projects'

export default function ProjectPage() {
    const { projectId } = useParams<{ projectId: string }>()
    const platform = usePlatform()

    useEffect(() => {
        if (!projectId) return
        platform.window?.setTitle(synthesizeProjectName(projectId))
    }, [platform.window, projectId])

    if (!projectId) return <Navigate to='/launcher' replace />

    return (
        <AuthGate>
            <ProjectWorkspace projectId={projectId} />
        </AuthGate>
    )
}
