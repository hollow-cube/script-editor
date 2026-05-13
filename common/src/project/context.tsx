import { createContext, useContext, type ReactNode } from 'react'

export type Project = {
    id: string
    name: string
}

const ProjectContext = createContext<Project | null>(null)

export function ProjectProvider({ project, children }: { project: Project; children: ReactNode }) {
    return <ProjectContext.Provider value={project}>{children}</ProjectContext.Provider>
}

export function useProject(): Project {
    const ctx = useContext(ProjectContext)
    if (!ctx) {
        throw new Error('useProject must be used inside a <ProjectProvider>')
    }
    return ctx
}
