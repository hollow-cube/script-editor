// Standalone module for the docs editor's tab kind constant. Kept separate
// from `docs.tsx` so non-React-aware code (language editor-service bindings)
// can reference it without pulling in React or the docs UI.
export const DOCS_EDITOR_KIND = 'editor:docs'
