// Duration of the show/hide animation when a tool dock toggles visibility. Must
// stay in lockstep with the `.workspace-animating` transition in workspace.css.
export const TOGGLE_ANIM_MS = 220

// How much of a leaf's width/height counts as an "edge band" for split-drop
// targeting. 0.24 = 24% in from each edge.
export const EDGE_ZONE_PCT = 0.24

// Bias for the two sides of a newly-split editor group. 50/50 is the obvious
// default; users immediately resize from there.
export const DEFAULT_SPLIT_BIAS: readonly [number, number] = [50, 50]
