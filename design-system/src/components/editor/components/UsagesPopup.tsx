import { XIcon } from 'lucide-react'
import * as React from 'react'
import { Group, Panel } from 'react-resizable-panels'

import { cn } from '../../../utils'
import { Button } from '../../button'
import { CodeEditor } from '../CodeEditor'

export type UsageMatch = {
    line: number
    col: number
    from: number
    to: number
    snippet: string
}

type Props = {
    /** Editor-relative pixel offset where the popup's top edge sits. */
    anchorTop: number
    /** Height of the anchor line, used to compute extra padding above the popup. */
    anchorHeight: number
    token: string
    source: string
    matches: UsageMatch[]
    onClose: () => void
    /** Called when the user picks a match — by row click in the list, or by
     *  clicking anywhere in the right preview. `pos` is the absolute doc
     *  offset in the source. */
    onJumpToPos: (pos: number) => void
}

export const UsagesPopup = React.forwardRef<HTMLDivElement, Props>(function UsagesPopup(
    { anchorTop, anchorHeight, token, source, matches, onClose, onJumpToPos },
    forwardedRef,
) {
    void anchorHeight // reserved for future "stay below word"-with-arrow adjustments
    const [selectedIdx, setSelectedIdx] = React.useState(0)

    React.useEffect(() => {
        setSelectedIdx(0)
    }, [token, matches])

    const selected = matches[selectedIdx]
    const selectedLineNumber = selected?.line ?? 0

    // Build yellow highlight in the snippet — the matched range (text) + the
    // matched line (full-width band). Both relative to the absolute doc.
    const snippetHighlightRanges = React.useMemo(() => {
        if (!selected) return []
        return [{ from: selected.from, to: selected.to, kind: 'yellow' as const }]
    }, [selected])

    const snippetHighlightLines = React.useMemo(() => {
        if (!selected) return []
        return [{ line: selected.line, kind: 'yellow' as const }]
    }, [selected])

    const handleSnippetPos = React.useCallback(
        (pos: number) => {
            onJumpToPos(pos)
        },
        [onJumpToPos],
    )

    return (
        <div
            ref={forwardedRef}
            role='dialog'
            aria-label={`Usages of "${token}"`}
            className={cn(
                'bg-popover p-2 absolute right-2 left-2 z-40 flex flex-col overflow-hidden rounded-2xl shadow-xl',
            )}
            style={{ top: anchorTop + 4, height: '20rem', maxHeight: '20rem' }}
            onPointerDownCapture={(e) => {
                // Block the global outside-click dismissal for events that
                // originate inside the popup.
                e.stopPropagation()
            }}
        >
            <Group
                orientation='horizontal'
                className='flex h-full w-full gap-2'
                style={{ display: 'flex' }}
                defaultLayout={{ list: 35, snippet: 65 }}
            >
                <Panel id='list' defaultSize={35} minSize={20}>
                    <div className='flex h-full min-h-0 flex-col space-y-2'>
                        <header className='text-foreground flex items-baseline justify-between text-sm'>
                            <span>Usages</span>
                        </header>
                        <ul className='min-h-0 flex-1 overflow-auto'>
                            {matches.map((m, idx) => (
                                <li key={`${m.line}:${m.col}`}>
                                    <div
                                        role='button'
                                        tabIndex={0}
                                        onClick={() => setSelectedIdx(idx)}
                                        onDoubleClick={() => onJumpToPos(m.from)}
                                        className={cn(
                                            'group/usage flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-1 text-left transition-colors',
                                            'hover:bg-muted/40',
                                            idx === selectedIdx && 'bg-primary/20',
                                        )}
                                    >
                                        <span className='text-muted-foreground w-12 shrink-0 font-mono text-[0.7rem]'>
                                            {m.line}:{m.col}
                                        </span>
                                        <div className='min-w-0 flex-1 overflow-hidden'>
                                            <CodeEditor
                                                value={m.snippet.trimStart()}
                                                readOnly
                                                singleLine
                                                enableInteractions={false}
                                                highlightRanges={listRowHighlight(m.snippet, token)}
                                            />
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </Panel>
                <Panel id='snippet' defaultSize={65} minSize={30}>
                    <div className='relative h-full w-full min-w-0 overflow-hidden rounded-lg bg-surface'>
                        {selected ? (
                            <CodeEditor
                                value={source}
                                readOnly
                                scrollToLine={selectedLineNumber}
                                highlightRanges={snippetHighlightRanges}
                                highlightLines={snippetHighlightLines}
                                enableInteractions={false}
                                onPosPointerDown={handleSnippetPos}
                            />
                        ) : (
                            <div className='text-muted-foreground flex h-full items-center justify-center text-xs'>
                                No matches
                            </div>
                        )}
                    </div>
                </Panel>
            </Group>
            <Button
                variant='ghost'
                size='icon'
                onClick={onClose}
                className='absolute top-4 right-4 bg-popover'
            >
                <XIcon className='size-4' />
            </Button>
            {/* <button
                type='button'
                aria-label='Close usages'
                onClick={onClose}
                className='hover:bg-muted/40 absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground'
            >
                ×
            </button> */}
        </div>
    )
})

// Resolve the matched-token range within the row's (trimmed) snippet so the
// embedded single-line editor can paint a yellow band on it.
function listRowHighlight(snippet: string, token: string) {
    const trimmed = snippet.trimStart()
    const idx = trimmed.indexOf(token)
    if (idx === -1) return []
    return [{ from: idx, to: idx + token.length, kind: 'yellow' as const }]
}
