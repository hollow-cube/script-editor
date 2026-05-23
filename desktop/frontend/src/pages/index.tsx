import { Navigate } from 'react-router'

// Desktop's root URL has no project context — bounce to the launcher window
// route. The Go-side WindowManager normally opens windows with explicit
// /#/project/:projectId or /#/launcher URLs, but this guard catches stray
// loads of `/`.
export default function Index() {
    return <Navigate to='/launcher' replace />
}
