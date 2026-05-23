// Synthesizes a friendly display name from a project id. The eventual project
// list endpoint will return real names — this is the dev-only placeholder so
// the launcher and window titles aren't bare ids.
export function synthesizeProjectName(id: string): string {
    return `Dev Project (${id})`
}

export type LauncherProject = {
    id: string
    name: string
}
