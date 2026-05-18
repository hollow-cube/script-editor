// Per-tab active project id.
//
// The in-game launch grant carries the project the tester opened from. We
// stash it in `sessionStorage` — deliberately NOT the URL, NOT IndexedDB, and
// NOT the workspace `Storage` abstraction:
//
//   • per-tab — two tabs (two in-game launches) target different projects
//     without colliding
//   • cleared on tab close — there is intentionally no resume-without-grant
//     path in v0; re-entry from in-game re-establishes it each session
//
// v0 scope only: no recent-projects list, no picker, no `/:projectId`
// routing. Full multi-project navigation is Phase 2.

const KEY = 'hc-active-project'

export function setActiveProjectId(id: string | null): void {
    try {
        if (id) window.sessionStorage.setItem(KEY, id)
        else window.sessionStorage.removeItem(KEY)
    } catch {
        // sessionStorage disabled/unavailable — degrade to "no project",
        // which surfaces the "open from in-game" screen rather than crashing.
    }
}

export function getActiveProjectId(): string | null {
    try {
        return window.sessionStorage.getItem(KEY)
    } catch {
        return null
    }
}
