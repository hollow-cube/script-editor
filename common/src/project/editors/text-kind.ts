// Standalone module for the text editor's tab kind constant. Kept separate
// from `text.tsx` so non-React-aware code (e.g. language editor-service
// bindings) can reference it without pulling in React, CodeMirror, or the
// rest of the text editor's deps.
export const TEXT_EDITOR_KIND = 'editor:text'
