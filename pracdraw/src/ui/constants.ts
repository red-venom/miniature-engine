// constants.ts — ids and names shared between components.

/** The id of the library's search box: `/` focuses it. */
export const SEARCH_ID = 'library-search'
/** The id of the canvas: it takes the focus after an add from the search box, and when the focused control goes away. */
export const CANVAS_ID = 'canvas'
/** The id of the status bar's hint for the active tool: it describes the canvas. */
export const HINT_ID = 'tool-hint'
/** The data-transfer type of a tile dragged from the library to the canvas. */
export const DRAG_TYPE = 'application/x-pracdraw-symbol'
/** The data-transfer type of a "Tubes and lines" tile dragged to the canvas: the preset id. */
export const PRESET_DRAG_TYPE = 'application/x-pracdraw-connector'
