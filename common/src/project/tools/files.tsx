import { FilesIcon } from 'lucide-react'

import { FileTree } from '@hollowcube/design-system'

import { type ToolDefinition } from '../registry'

export const FILES_TOOL_KIND = 'tool:files'

function FilesPane() {
    return (
        <div className='flex h-full flex-col'>
            <div className='p-2'>
                <FileTree nodes={[]} />
            </div>
            <div className='text-muted-foreground flex flex-1 items-center justify-center px-4 pb-6 text-center text-xs'>
                No files yet
            </div>
        </div>
    )
}

export const filesTool: ToolDefinition = {
    kind: FILES_TOOL_KIND,
    title: 'Files',
    icon: <FilesIcon />,
    defaultLocation: 'left',
    render: () => <FilesPane />,
}
