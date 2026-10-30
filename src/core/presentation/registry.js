/* Refactor C3: the presentation parts the game talks to, when they are loaded. They load after the
   game (and not at all in most tests), so the game asks for them here instead of on window:
     live3d     the presentation clock that paces the live match (match3d-live-clock.js)
     view       the read-only view of the match the 3D view reads (match-view-adapter.js)
     newView    the 3D match view (match3d-newview.js)
     career3d   its mount on the match screen (match3d-newview.js)
     starScene  the star transfer scene (star-transfer-scene.js)
   A part puts itself in its slot when it loads; until then the slot is null. */
export const presentation = { live3d: null, view: null, newView: null, career3d: null, simulation3d: null, starScene: null, archivePersistence: null };
