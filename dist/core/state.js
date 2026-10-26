/* Refactor C3: the state every part of the game shares, in one place.
     S          the career (what is saved)
     M          the live match, or null
     modal      which main screen is open (squad, plan, formation, settings) or null
     loadError  why the saved career could not be opened, or ""
   Code reads them by name and changes them only through the setters below (an ES module cannot assign
   another module's variable; one place to change them is also one place to look). A setter returns the
   new value, so it stands wherever the assignment stood. */
let S = null, M = null, modal = null, loadError = "";

function setCareer(career) { return S = career; }
function setMatch(match) { return M = match; }
function setModal(screen) { return modal = screen; }
function setLoadError(message) { return loadError = message; }
