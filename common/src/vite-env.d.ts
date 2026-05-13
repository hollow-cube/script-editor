/// <reference types="vite/client" />

// Vite's `*?raw` declaration uses a glob that doesn't always match filenames
// containing a leading `.d.`, so be explicit for the Luau definition files.
declare module '*.d.luau?raw' {
    const src: string
    export default src
}

declare module '*.luau?raw' {
    const src: string
    export default src
}
