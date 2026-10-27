/* The release this code is (refactor E1): package.json's version (E2: the one place it is written; the build and
   the tests read it from there). It goes into every save (core/save.js) and on the start and settings screens.
   Its only import is package.json (no game module): ready before any module that reads it. */
import { version } from '../../package.json';

export const GAME_VERSION = version;
