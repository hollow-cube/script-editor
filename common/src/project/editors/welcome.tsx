import { Button } from '@hollowcube/design-system'

import { useProject } from '../context'
import { type EditorDefinition } from '../registry'

export const WELCOME_EDITOR_KIND = 'editor:welcome'

function WelcomeTab() {
    const project = useProject()
    return (
        <div className='flex h-full items-center justify-center p-6'>
            <div className='flex max-w-md flex-col items-center gap-3 text-center'>
                <h1 className='text-2xl font-medium tracking-tight'>Welcome to {project.name}</h1>
                <p className='text-muted-foreground text-sm'>
                    Open a file from the file tree to get started.
                </p>
                <Button variant='ghost' size='sm'>
                    Get started
                </Button>
            </div>
        </div>
    )
}

export const welcomeEditor: EditorDefinition = {
    kind: WELCOME_EDITOR_KIND,
    mimeTypes: [],
    titleFor: () => 'Welcome',
    render: () => <WelcomeTab />,
}
