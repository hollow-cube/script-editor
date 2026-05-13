import { Facet, RangeSetBuilder, type Extension } from '@codemirror/state'
import {
    Decoration,
    EditorView,
    GutterMarker,
    gutterLineClass,
    ViewPlugin,
    type DecorationSet,
    type ViewUpdate,
} from '@codemirror/view'

export type HighlightKind = 'primary' | 'yellow'

export type HighlightRange = { from: number; to: number; kind?: HighlightKind }

// Lines to fill with a low-opacity highlight band — used by the usages preview
// to call out the selected match's line.
export type HighlightLine = { line: number; kind?: 'yellow' }

export const highlightRangesFacet = Facet.define<
    readonly HighlightRange[],
    readonly HighlightRange[]
>({
    combine: (values) => values.flat(),
})

export const highlightLinesFacet = Facet.define<readonly HighlightLine[], readonly HighlightLine[]>(
    {
        combine: (values) => values.flat(),
    },
)

const primaryMark = Decoration.mark({
    class: 'cm-highlightRange',
    attributes: { 'data-kind': 'primary' },
})
const yellowMark = Decoration.mark({
    class: 'cm-highlightRange',
    attributes: { 'data-kind': 'yellow' },
})
const yellowLineMark = Decoration.line({
    class: 'cm-highlightLine',
    attributes: { 'data-kind': 'yellow' },
})

function buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()
    const lines = view.state.facet(highlightLinesFacet)
    const ranges = view.state.facet(highlightRangesFacet)
    // Line decorations must be added by line-start position; collect both and
    // sort.
    type Entry = { from: number; to: number; deco: Decoration; lineOnly: boolean }
    const entries: Entry[] = []
    for (const l of lines) {
        if (l.line < 1 || l.line > view.state.doc.lines) continue
        const lineObj = view.state.doc.line(l.line)
        entries.push({ from: lineObj.from, to: lineObj.from, deco: yellowLineMark, lineOnly: true })
    }
    for (const r of ranges) {
        if (r.from >= r.to) continue
        const deco = r.kind === 'yellow' ? yellowMark : primaryMark
        entries.push({ from: r.from, to: r.to, deco, lineOnly: false })
    }
    entries.sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from
        // Line decos (zero-width) must come before mark decos at the same pos.
        if (a.lineOnly !== b.lineOnly) return a.lineOnly ? -1 : 1
        return 0
    })
    for (const e of entries) {
        if (e.lineOnly) builder.add(e.from, e.from, e.deco)
        else builder.add(e.from, e.to, e.deco)
    }
    return builder.finish()
}

const highlightPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet
        constructor(view: EditorView) {
            this.decorations = buildDecorations(view)
        }
        update(u: ViewUpdate) {
            if (
                u.docChanged ||
                u.viewportChanged ||
                u.startState.facet(highlightRangesFacet) !== u.state.facet(highlightRangesFacet) ||
                u.startState.facet(highlightLinesFacet) !== u.state.facet(highlightLinesFacet)
            ) {
                this.decorations = buildDecorations(u.view)
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    },
)

// Width of the rounded corners applied to the yellow line band so that the
// content side and the gutter side line up visually.
const LINE_BAND_RADIUS = '6px'

const highlightTheme = EditorView.theme({
    '.cm-highlightRange': {
        borderRadius: '4px',
    },
    '.cm-highlightRange[data-kind="primary"]': {
        backgroundColor: 'color-mix(in oklab, var(--primary) 25%, transparent)',
    },
    '.cm-highlightRange[data-kind="yellow"]': {
        backgroundColor: 'color-mix(in oklab, var(--warning) 45%, transparent)',
    },

    // Content side of the line band — fills the line and rounds the right edge
    // so it tucks into a continuous pill with the gutter side.
    '.cm-highlightLine[data-kind="yellow"]': {
        backgroundColor: 'color-mix(in oklab, var(--warning) 12%, transparent)',
        borderTopRightRadius: LINE_BAND_RADIUS,
        borderBottomRightRadius: LINE_BAND_RADIUS,
    },
    // Gutter side of the line band — each gutter cell in the row gets the
    // same tint, and the leftmost cell rounds its left edge.
    '.cm-highlightLineGutter-yellow': {
        backgroundColor: 'color-mix(in oklab, var(--warning) 12%, transparent)',
    },
    '.cm-gutters .cm-gutter:first-child .cm-highlightLineGutter-yellow': {
        borderTopLeftRadius: LINE_BAND_RADIUS,
        borderBottomLeftRadius: LINE_BAND_RADIUS,
    },
})

// Marker that, when added to `gutterLineClass`, paints the gutter row with the
// yellow band class — sibling to the content's `.cm-highlightLine` decoration.
class YellowGutterMarker extends GutterMarker {
    override elementClass = 'cm-highlightLineGutter-yellow'
}

const yellowGutterMarker = new YellowGutterMarker()

const gutterLineHighlights = gutterLineClass.compute([highlightLinesFacet], (state) => {
    const lines = state.facet(highlightLinesFacet)
    const builder = new RangeSetBuilder<GutterMarker>()
    for (const l of lines) {
        if (l.line < 1 || l.line > state.doc.lines) continue
        const lineObj = state.doc.line(l.line)
        builder.add(lineObj.from, lineObj.from, yellowGutterMarker)
    }
    return builder.finish()
})

export function highlightRangesExtension(): Extension {
    return [highlightPlugin, gutterLineHighlights, highlightTheme]
}
