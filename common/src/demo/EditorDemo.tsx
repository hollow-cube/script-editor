import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@hollowcube/design-system'

import { CodeEditor } from '../editor'

export const SAMPLE_TEXT = JSON.stringify(
    {
        name: '@hollowcube/editor',
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
            start: 'vite',
            build: 'tsc -b && vite build',
            preview: 'vite preview',
            test: 'bun test',
        },
        dependencies: {
            '@codemirror/state': '^6.6.0',
            '@codemirror/view': '^6.42.1',
            '@codemirror/language': '^6.12.3',
            '@codemirror/lang-json': '^6.0.2',
            react: '^19.2.4',
            'react-dom': '^19.2.4',
        },
        devDependencies: {
            vite: '^7.3.2',
            typescript: '^5.6.3',
        },
        engines: {
            node: '>=20',
            bun: '>=1.3',
        },
        keywords: ['editor', 'codemirror', 'monorepo'],
        metadata: {
            createdAt: '2026-05-10',
            owner: 'hollowcube',
            tags: ['wip', 'internal'],
            config: {
                theme: 'armada-dark',
                fontSize: 13,
                lineHeight: 1.55,
                tabSize: 4,
            },
        },
    },
    null,
    4,
)

const PLAY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#10b981" stroke="#10b981" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
  <polygon points="6 3 20 12 6 21 6 3"/>
</svg>`

const GUTTER_ICONS: Record<number, string> = {
    7: PLAY_ICON,
}

// Lines 13-19 of the sample — used to demo a range embed.
const RANGE_LINES_FROM = 13
const RANGE_LINES_TO = 19
const sampleLines = SAMPLE_TEXT.split('\n')
const RANGE_TEXT = sampleLines.slice(RANGE_LINES_FROM - 1, RANGE_LINES_TO).join('\n')

// Highlight the first occurrence of `@codemirror/state` in the range, relative
// to the slice text (caller-side math; the editor takes char offsets as-is).
const RANGE_HIGHLIGHT_TARGET = '@codemirror/state'
const rangeHighlightStart = RANGE_TEXT.indexOf(RANGE_HIGHLIGHT_TARGET)
const RANGE_HIGHLIGHTS =
    rangeHighlightStart >= 0
        ? [{ from: rangeHighlightStart, to: rangeHighlightStart + RANGE_HIGHLIGHT_TARGET.length }]
        : []

// Single-line snippet — for hover/blame style use.
const SINGLE_LINE = sampleLines[6] ?? '' // line 7 = the "start" script
const SINGLE_LINE_NO = 7

export function EditorDemo() {
    return (
        <div className='flex h-svh w-full flex-col bg-background'>
            <header className='flex flex-col gap-2 border-b border-border bg-surface px-6 py-3'>
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink href='/'>hollowcube</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink href='/ds'>Design system</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Code editor</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                <h1 className='text-xl font-medium tracking-tight'>Code editor</h1>
                <p className='text-muted-foreground max-w-3xl text-xs'>
                    Right-click a string to find usages (or select + F7). Press{' '}
                    <kbd className='rounded-sm border border-border px-1'>⌘</kbd>
                    <kbd className='rounded-sm border border-border px-1'>Space</kbd> in a string
                    position for completions. ⌘F opens search. Active-line tint shifts when the
                    editor loses focus.
                </p>
            </header>

            <div className='flex min-h-0 flex-1 gap-4 overflow-hidden p-4'>
                <div className='flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-md border border-border'>
                    <CodeEditor value={SAMPLE_TEXT} gutterIcons={GUTTER_ICONS} />
                </div>

                <aside className='flex w-[320px] shrink-0 flex-col gap-4 overflow-y-auto'>
                    <section className='flex flex-col gap-2'>
                        <h2 className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
                            Range embed (lines {RANGE_LINES_FROM}–{RANGE_LINES_TO})
                        </h2>
                        <p className='text-muted-foreground text-[0.7rem]'>
                            Read-only slice, line numbers preserved, target highlighted in primary.
                        </p>
                        <div className='h-44 overflow-hidden rounded-md border border-border'>
                            <CodeEditor
                                value={RANGE_TEXT}
                                readOnly
                                lineOffset={RANGE_LINES_FROM - 1}
                                highlightRanges={RANGE_HIGHLIGHTS}
                                enableInteractions={false}
                            />
                        </div>
                    </section>

                    <section className='flex flex-col gap-2'>
                        <h2 className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
                            Single line (line {SINGLE_LINE_NO})
                        </h2>
                        <p className='text-muted-foreground text-[0.7rem]'>
                            Hover/blame style — one line of context.
                        </p>
                        <div className='h-8 overflow-hidden rounded-md border border-border'>
                            <CodeEditor
                                value={SINGLE_LINE}
                                readOnly
                                lineOffset={SINGLE_LINE_NO - 1}
                                enableInteractions={false}
                            />
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    )
}
