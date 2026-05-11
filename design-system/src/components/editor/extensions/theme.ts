import { EditorView } from '@codemirror/view'

import { type EditorPalette } from '../themes'

export function editorTheme(p: EditorPalette) {
    return EditorView.theme(
        {
            '&': {
                color: p.foreground,
                backgroundColor: 'transparent',
                fontFamily: "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, monospace",
                fontSize: '13px',
                height: '100%',
            },
            // CodeMirror's default focused outline is a 1px dotted ring; suppress it.
            '&.cm-focused': { outline: 'none' },
            '.cm-scroller': {
                fontFamily: 'inherit',
                lineHeight: '1.55',
            },
            '.cm-content': {
                caretColor: p.caret,
                padding: '8px 0',
            },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: p.caret },
            // Synthetic selection layer: full-opacity primary band.
            '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground':
                {
                    background: 'var(--primary)',
                },
            // Native selection on top of the layer: transparent background so we
            // don't double-paint, white text so syntax colors give way to a
            // legible high-contrast reading on the band.
            '.cm-content ::selection': {
                background: 'transparent',
                color: '#ffffff',
            },
            '&:not(.cm-focused) .cm-selectionBackground': {
                background: p.selectionInactiveBg,
            },

            // Gutters
            '.cm-gutters': {
                backgroundColor: 'transparent',
                color: 'var(--foreground)',
                border: 'none',
            },
            '.cm-gutterElement': {
                padding: '0 6px 0 8px',
            },
            '.cm-lineNumbers .cm-gutterElement': {
                color: 'var(--foreground)',
                minWidth: '2ch',
            },
            '.cm-iconNumberGutter .cm-gutterElement': {
                color: 'var(--foreground)',
            },
            '.cm-activeLineGutter': {
                backgroundColor: 'transparent',
                color: 'var(--foreground)',
            },

            // Indent guides (if extension enabled later)
            '.cm-indent-guide': {
                borderLeft: `1px solid ${p.indentGuide}`,
            },

            // Tooltips / autocomplete popup (defaults — re-themed per feature later)
            '.cm-tooltip': {
                backgroundColor: 'var(--popover)',
                color: 'var(--popover-foreground)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
            },
        },
        { dark: true },
    )
}
