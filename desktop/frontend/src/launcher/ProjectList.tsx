import { FolderIcon } from 'lucide-react'

import { Button } from '@hollowcube/design-system'

import type { LauncherProject } from './projects'

type Props = {
    projects: readonly LauncherProject[]
    onOpen: (project: LauncherProject) => void
    disabled?: boolean
}

export function ProjectList({ projects, onOpen, disabled }: Props) {
    if (projects.length === 0) {
        return (
            <div className='text-muted-foreground flex flex-col items-center gap-2 px-6 py-12 text-center text-sm'>
                <span className='text-foreground text-base font-medium'>No projects yet</span>
                <span>Launch the editor from the in-game menu to open a project.</span>
            </div>
        )
    }

    return (
        <ul className='flex w-full flex-col gap-1'>
            {projects.map((project) => (
                <li key={project.id}>
                    <Button
                        variant='ghost'
                        className='h-auto w-full justify-start gap-3 px-3 py-3 text-left'
                        disabled={disabled}
                        onClick={() => onOpen(project)}
                    >
                        <FolderIcon className='text-muted-foreground size-5 shrink-0' />
                        <div className='flex min-w-0 flex-col'>
                            <span className='text-foreground truncate text-sm font-medium'>
                                {project.name}
                            </span>
                            <span className='text-muted-foreground truncate font-mono text-xs'>
                                {project.id}
                            </span>
                        </div>
                    </Button>
                </li>
            ))}
        </ul>
    )
}
