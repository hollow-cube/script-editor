export interface SSEEvent {
    id?: string
    event?: string
    data: string
}

export async function* parseSSEStream(
    stream: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
    const reader = stream.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    const onAbort = () => {
        void reader.cancel().catch(() => {})
    }
    signal?.addEventListener('abort', onAbort)

    try {
        while (true) {
            const { value, done } = await reader.read()
            if (done) {
                buffer += decoder.decode()
                if (buffer.trim().length > 0) {
                    const frame = parseFrame(buffer)
                    if (frame) yield frame
                }
                return
            }

            buffer += decoder.decode(value, { stream: true })

            // SSE frames are separated by a blank line. Accept both LF and CRLF.
            while (true) {
                const boundary = findFrameBoundary(buffer)
                if (boundary === null) break
                const frame = buffer.slice(0, boundary.idx)
                buffer = buffer.slice(boundary.idx + boundary.len)
                const parsed = parseFrame(frame)
                if (parsed) yield parsed
            }
        }
    } finally {
        signal?.removeEventListener('abort', onAbort)
        try {
            reader.releaseLock()
        } catch {
            // ignore; reader may already be released by cancel()
        }
    }
}

// Returns the index and length of the frame separator (\n\n or \r\n\r\n), or null if none.
function findFrameBoundary(buffer: string): { idx: number; len: number } | null {
    const lflf = buffer.indexOf('\n\n')
    const crlfcrlf = buffer.indexOf('\r\n\r\n')
    if (lflf === -1 && crlfcrlf === -1) return null
    if (lflf === -1) return { idx: crlfcrlf, len: 4 }
    if (crlfcrlf === -1) return { idx: lflf, len: 2 }
    return lflf < crlfcrlf ? { idx: lflf, len: 2 } : { idx: crlfcrlf, len: 4 }
}

function parseFrame(frame: string): SSEEvent | null {
    let id: string | undefined
    let event: string | undefined
    let data = ''
    let hasData = false

    for (const rawLine of frame.split(/\r?\n/u)) {
        if (rawLine === '' || rawLine.startsWith(':')) continue
        const colon = rawLine.indexOf(':')
        let field: string
        let value: string
        if (colon === -1) {
            field = rawLine
            value = ''
        } else {
            field = rawLine.slice(0, colon)
            value = rawLine.slice(colon + 1)
            if (value.startsWith(' ')) value = value.slice(1)
        }

        switch (field) {
            case 'id':
                id = value
                break
            case 'event':
                event = value
                break
            case 'data':
                data = hasData ? `${data}\n${value}` : value
                hasData = true
                break
        }
    }

    if (!hasData && id === undefined && event === undefined) return null
    return { id, event, data }
}
