/* The save: what a career looks like when it is kept, and how an older one is brought up to date.
   One layer for it all: reading it from the browser, writing it back, export and import, and the chain of
   migrations. The format is described in docs/save-format.md.

   A save is the career state S as JSON, kept in localStorage under "msv4" (an export is the same JSON).
   schemaVersion says which format it is in; saves written before V7.9.13 have none and count as format 0.
   SAVE_MIGRATIONS runs in order, from the save's format up to SAVE_SCHEMA: each step brings one format to
   the next and touches only what that step is about. A new career is made in format 0 and goes through the
   same chain, so the chain is the one place that knows what the current format holds.
   S.version is a different thing: the game version that last wrote the save (backups are keyed by it).
   What the chain does not do: fill content a career needs whenever it is missing — a market, an academy,
   rival squads, player profiles, defaults for a newly signed player. That is init()'s job on every start. */
import CLUB_DATA from '../data/clubs.json';
import { newMatchSalt } from './random.js';
import { M, S, setCareer, setLoadError, setMatch, setModal } from './state.js';
import { restoreActiveMatch } from './engine/match-support.js';
import { careerOpened, changed } from './hooks.js';
import { MATCH_TACTICS } from './engine/tactics.js';
import { GAME_VERSION } from './version.js';
import { numberSquadKeepingShown } from './players/shirt-numbers.js';
import { snapshotSimulation } from './sim/simulation-checkpoint.js';
import { packExperimentalMatch, prepareExperimentalMatchArchive, completeExperimentalMatchArchive, unpackMatchSnapshot } from './match/match-storage.js';
import { packSimulationHistory, restoreSimulationHistory } from './match/history-storage.js';
import { presentation } from './presentation/registry.js';
import { normalizeMatchDurationMinutes } from './match/duration-setting.js';
export const SAVE_KEY = "msv4";
export const SAVE_SCHEMA = 7;
export let saveWarning = false;
let saveSerial = 0;

export const SAVE_MIGRATIONS = [
  {
    from: 0, to: 1,
    about: "saves from V7.0 to V7.9.13 (no schemaVersion): managed club, conversation and press state, a full " +
      "tactic plan, Turkish form letters, promise baselines and the per-version blocks v72…v733",
    run(state) {
      state.currentClubId ??= CLUB_DATA.startingClub; // legacy saves have one managed club: the starting one
      state.v71 ??= { schema: 1, preUsed: [], postUsed: [], conversations: [], serial: 0 };
      for (const key of ["preUsed", "postUsed", "conversations"]) state.v71[key] ??= [];
      state.v71.serial ??= 0;
      state.v71.meetingClock ??= {};
      state.v71.playerMeetings ??= {};
      state.v71.categoryMeetings ??= {};
      state.plan ??= {};
      for (const [key, values] of Object.entries(MATCH_TACTICS)) {
        if (!values.includes(state.plan[key])) state.plan[key] = ["mentality", "approach", "passingStyle"].includes(key) ? "Dengeli" : "Normal";
      }
      state.plan.teamInstructions ??= [];
      // V7.0 wrote form in English letters (W/D/L)
      const letters = { W: "G", D: "B", L: "M" };
      if (state.form) for (const team of Object.keys(state.form)) state.form[team] = state.form[team].map(x => letters[x] || x);
      state.promises ??= [];
      for (const promise of state.promises) {
        if (promise.type === "minutes" && promise.atMinutes == null) {
          promise.atMinutes = state.players.find(p => p.id === promise.player)?.minutes || 0;
        }
      }
      state.version = GAME_VERSION;
      state.v72 ??= { schema: 1 };
      state.v73 ??= { schema: 1 };
      state.v731 ??= { schema: 1, lastEvolvedFixture: -1 };
      state.v732 ??= { schema: 1, conversationHistory: [], feedback: null };
      state.v733 ??= { schema: 1 };
    },
  },
  {
    from: 1, to: 2,
    about: "the stored wage budget (a fixed 24M, below the real wage bill) goes, the wage room follows " +
      "the club's level; every player gets a shirt number of his own, the one he was seen wearing",
    run(state) {
      if (state.v6) delete state.v6.wageBudget;
      numberSquadKeepingShown(state.players);
    },
  },
  {
    from: 2, to: 3,
    about: "the highlight archive keeps recipes that play a moment again (type, player, move, when, seed): " +
      "the star-transfer clips become starTransfer recipes; a save without an archive gets an empty one",
    run(state) {
      const clips = Array.isArray(state.highlights) ? state.highlights : [];
      state.highlights = clips.filter(h => h?.kind === "star-transfer").map(h => ({
        id: h.id, type: "starTransfer", playerId: h.playerId, playerName: h.playerName, pos: h.pos, move: h.move, stars: h.stars,
        season: h.season, week: h.week, seed: -1, fee: h.fee, fromClub: h.fromClub,
      }));
    },
  },
  {
    from: 3, to: 4,
    about: 'opt-in experimental 2D match simulation; earlier careers continue with the legacy engine',
    run(state) { state.experimentalMatchEngine ??= false; },
  },
  {
    from: 4, to: 5,
    about: 'persistent total match duration; active matches retain their checkpoint clock or legacy reference model',
    run(state) { state.matchDurationMinutes = normalizeMatchDurationMinutes(state.matchDurationMinutes); },
  },
  {
    from: 5, to: 6,
    about: 'halftime preparation no longer consumes the match clock; existing checkpoints retain their elapsed football',
    run(state) {
      const stored = state.activeMatchV71;
      if (!stored?.experimental) return;
      const active = unpackMatchSnapshot(stored);
      if (active.simulationCheckpoint?.state.clock) active.simulationCheckpoint.state.clock.stoppedTicks ??= 0;
      state.activeMatchV71 = stored.simulationArchive ? packExperimentalMatch(active) : active;
    },
  },
  {
    from: 6, to: 7,
    about: 'optional live offside snapshot, restart delivery plan and wall reaction timestamps; retain existing football and RNG',
    run(state) {
      const stored = state.activeMatchV71;
      if (!stored?.experimental) return;
      const active = unpackMatchSnapshot(stored);
      if (active.simulationCheckpoint) active.simulationCheckpoint.state.offside ??= null;
      state.activeMatchV71 = stored.simulationArchive ? packExperimentalMatch(active) : active;
    },
  },
];

/* Bring a save (or a new career) up to the current format. Changes and returns the same object. */
export function migrateSave(state) {
  let format = Number.isInteger(state.schemaVersion) ? state.schemaVersion : 0;
  if (format > SAVE_SCHEMA) throw new Error("Bu kariyer kaydı oyunun daha yeni bir sürümünden. Oyunu güncelleyip tekrar dene.");
  for (const step of SAVE_MIGRATIONS) {
    if (step.from !== format) continue;
    step.run(state);
    format = step.to;
  }
  state.schemaVersion = format;
  state.version = GAME_VERSION;
  state.matchDurationMinutes = normalizeMatchDurationMinutes(state.matchDurationMinutes);
  restoreSimulationHistory(state);
  return state;
}

export function loadCareer() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (!state || !Array.isArray(state.players) || !Array.isArray(state.xi)) throw new Error("Kayıt biçimi tanınamadı.");
    // a career from before V7.8 has no dice salt: it gets one, from the device, when it is opened
    if (state.matchSalt == null) state.matchSalt = newMatchSalt();
    // the save as it was, once per old version, before anything changes it
    if (!state.v71 && !localStorage.getItem("msv4-v70-backup")) localStorage.setItem("msv4-v70-backup", raw);
    if (state.v71 && state.version !== GAME_VERSION && !localStorage.getItem("msv4-v71-backup")) localStorage.setItem("msv4-v71-backup", raw);
    if (state.version === "7.2" && !localStorage.getItem("msv4-v72-backup")) localStorage.setItem("msv4-v72-backup", raw);
    if (state.version === "7.3" && !localStorage.getItem("msv4-v73-backup")) localStorage.setItem("msv4-v73-backup", raw);
    if (state.version === "7.3.1" && !localStorage.getItem("msv4-v731-backup")) localStorage.setItem("msv4-v731-backup", raw);
    if (state.version === "7.3.2" && !localStorage.getItem("msv4-v732-backup")) localStorage.setItem("msv4-v732-backup", raw);
    if (state.version === "7.3.3" && !localStorage.getItem("msv4-v733-backup")) localStorage.setItem("msv4-v733-backup", raw);
    return migrateSave(state);
  } catch (error) {
    setLoadError(/daha yeni/.test(error?.message || "") ? error.message
      : "Kariyer kaydı okunamadı. Kayıt silinmedi; Ayarlar’dan dışa aktardığın yedeği yükleyebilirsin.");
    return null;
  }
}
export function persistCareer(options = {}) {
  if (!S || skipFastForwardAutosave(options)) return;
  const serial = ++saveSerial;
  if (M) {
    const { rand, ...snapshot } = M;
    if (M.experimental) {
      snapshot.simulationCheckpoint = snapshotSimulation(M.simulation);
      delete snapshot.simulation;
    }
    const record = { ...snapshot, rngState: rand.state };
    if (M.experimental && options.automatic && backgroundExperimentalSave(record, serial)) return;
    S.activeMatchV71 = M.experimental ? packExperimentalMatch(record) : record;
  } else delete S.activeMatchV71;
  writeSerializedCareer(JSON.stringify(packSimulationHistory(S)));
}

function skipFastForwardAutosave(options) {
  return options.automatic && M?.skipExperimental && !M.pause && !M.finished;
}

function writeSerializedCareer(serialized) {
  try { localStorage.setItem(SAVE_KEY, serialized); saveWarning = false; }
  catch (error) {
    if (!saveWarning) alert("Cihazda kayıt için yeterli alan yok. Kariyer yedeğini Ayarlar’dan dışa aktar.");
    saveWarning = true;
  }
}

function backgroundExperimentalSave(record, serial) {
  if (!presentation.archivePersistence) return false;
  const { packed, json } = prepareExperimentalMatchArchive(record);
  const career = { ...packSimulationHistory(S) }, owner = S;
  delete career.activeMatchV71;
  const serialized = JSON.stringify(career);
  const commit = data => {
    if (serial !== saveSerial || S !== owner) return;
    S.activeMatchV71 = completeExperimentalMatchArchive(packed, data);
    writeSerializedCareer(serialized.slice(0, -1) + ',"activeMatchV71":' + JSON.stringify(S.activeMatchV71) + '}');
  };
  presentation.archivePersistence.compress(json).then(commit).catch(error => {
    console.warn('Background match save failed; saving on the main thread.', error);
    if (serial === saveSerial && S === owner) { S.activeMatchV71 = packExperimentalMatch(record); writeSerializedCareer(JSON.stringify(packSimulationHistory(S))); }
  });
  return true;
}
export function exportCareer() {
  if (!S) return;
  save();
  const blob = new Blob([JSON.stringify(packSimulationHistory(S), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = `ManagerStory-V7.3-Hafta-${S.week}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function validateCareerImport(data) {
  if (!data || !Array.isArray(data.players) || !data.players.length || !Array.isArray(data.xi) ||
      !Array.isArray(data.table) || data.table.length !== 18 || !Number.isFinite(data.budget) ||
      !Number.isInteger(data.fixture) || data.fixture < 0 || data.fixture > 33 ||
      !data.players.every(p => Number.isInteger(p.id) && typeof p.name === 'string' && typeof p.pos === 'string') ||
      !data.xi.every(id => data.players.some(p => p.id === id))) throw new Error("Geçerli bir ManagerStory kariyer yedeği seç.");
  if (data.schemaVersion != null && !(Number.isInteger(data.schemaVersion) && data.schemaVersion >= 0)) throw new Error("Geçerli bir ManagerStory kariyer yedeği seç.");
  if (data.schemaVersion > SAVE_SCHEMA) throw new Error("Bu kariyer yedeği oyunun daha yeni bir sürümünden. Oyunu güncelleyip tekrar dene.");
  // Imported saves are data, never a source of HTML or inline event handlers.
  if (/[<>]/.test(JSON.stringify(data)) ||
      data.event?.choices?.some(choice => !Array.isArray(choice) || typeof choice[1] !== 'string' || !/^[\w:-]+$/.test(choice[1])) ||
      data.v6?.transferPool?.some(player => typeof player.id !== 'string' || !/^v6(?:wk|fa|n)?\d+$/.test(player.id))) {
    throw new Error("Kariyer yedeğinde güvenli olmayan içerik var.");
  }
  return data;
}
export async function importCareer(file) {
  if (!file) return;
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error("Yedek dosyası çok büyük.");
    const data = validateCareerImport(JSON.parse(await file.text()));
    if (S && !confirm("Bu yedek mevcut kariyerin yerine yüklensin mi? Mevcut kayıt ayrıca yedeklenecek.")) return;
    if (S) localStorage.setItem("msv4-before-import", JSON.stringify(S));
    setCareer(migrateSave(data)); setMatch(null); setModal(null); setLoadError(""); careerOpened(); restoreActiveMatch(); save(); changed();
  } catch (error) { alert(error.message || "Kariyer yedeği yüklenemedi. Mevcut kayıt korundu."); }
}
// the game keeps the career after every change it makes (D4: moved from app.js; core no longer asks the mode to save)
export function save(options){persistCareer(options)}
