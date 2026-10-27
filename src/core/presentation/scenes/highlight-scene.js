// "İzle": a highlight played again outside the match, on the star transfer scene's stage (show-stage.js). The
// recipe's move is staged by the director exactly as the match plays it (newview/beats/staging.js), with the
// recipe's seed. The simulation runs on a fixed step whatever the phone's frame rate (two steps of 1/120 s,
// then the bodies posed, per 1/60 s of play), so a recipe plays the same every time. Short (about ten
// seconds), with a close button; the WebGL context is released when it ends.
import { createBroadcastCamera } from '../match3d/newview/camera.js';
import { presentation } from '../registry.js';
import { aimSun, drawBall, fitCanvas, loadFootballers, openShowStage, releaseShowStage, renderStage, setCrowdExcite, stageShow } from './show-stage.js';

// seconds: the move may take this long, the picture stays this long after it, and the scene never stays
// longer than cap of real time (a slow device plays the move slower, never longer than that)
export const WATCH_TIMES = { showMax: 11, after: 1.2, cap: 16 };
const TICK = 1 / 60, STEPS = 2, MAX_TICKS_A_FRAME = 4;

const css = `.hls{position:fixed;inset:0;z-index:1200;background:#0b0f14;overflow:hidden;touch-action:none}
.hls canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.hls-vig{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px 12px #000a}
.hls-top{position:absolute;left:max(12px,env(safe-area-inset-left,0px));top:calc(env(safe-area-inset-top,0px) + 12px);display:flex;border-radius:5px;overflow:hidden;font:800 12px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.08em;box-shadow:0 2px 8px #0008}
.hls-top span{background:#f4c430;color:#0d1117;padding:6px 9px}.hls-top b{background:#0d1117e0;color:#f4c430;padding:6px 8px}
.hls-close{position:absolute;right:max(12px,env(safe-area-inset-right,0px));top:calc(env(safe-area-inset-top,0px) + 8px);min-height:44px;min-width:44px;padding:0 14px;border-radius:22px;border:1px solid #ffffff55;background:#0d1117d9;color:#fff;font:700 15px/1 -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;touch-action:manipulation}
.hls-card{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 7%);transform:translateX(-50%);width:min(400px,calc(100% - 24px));text-align:center;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none}
.hls-card strong{display:inline-block;transform:skewX(-8deg);background:#f4c430;color:#0d1117;font-weight:900;font-size:clamp(20px,7vw,30px);letter-spacing:.05em;padding:2px 14px;box-shadow:0 3px 12px #0009;text-transform:uppercase}
.hls-card em{display:block;margin-top:7px;font-style:normal;font-weight:800;font-size:15px;letter-spacing:.06em;text-shadow:0 1px 4px #000}
.hls-card span{display:block;margin-top:4px;font-size:14px;font-weight:500;text-shadow:0 1px 4px #000;color:#e8edf2}
.hls-load{position:absolute;inset:0;display:grid;place-items:center;color:#cfe0d3;font:600 15px -apple-system,BlinkMacSystemFont,sans-serif;background:#10251a}`;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function overlay(opts) {
  const root = document.createElement('div'); root.className = 'hls';
  root.innerHTML = `<style>${css}</style><canvas aria-label="Highlight: ${esc(opts.moveName)}"></canvas><div class="hls-vig"></div>
<div class="hls-top"><span>HIGHLIGHT</span><b>${esc(opts.club.shortName || '')}</b></div><button type="button" class="hls-close" aria-label="Kapat">Kapat ✕</button>
<div class="hls-card"><strong>${esc(opts.moveName)}</strong><em>${esc(opts.player.name)} #${esc(opts.player.no)}</em><span>${esc(opts.line || '')}</span></div>
<div class="hls-load">Sahne hazırlanıyor…</div>`;
  return root;
}

// where the camera starts: close on him (the scorpion from the side, him and the man who shot)
function firstShot(opts, rt, star) {
  const other = rt.players.find(p => p.side === 'opp' && p.role !== 'GK');
  if (!opts.player.keeper) return { mode: 'close', a: star, b: other };
  const gk = rt.players.find(p => p.side === 'user' && p.role === 'GK');
  return opts.kind === 'scorpion' ? { mode: 'side', a: other, b: gk } : { mode: 'close', a: gk, b: null };
}

// 1/60 s of play: two simulation steps, then the bodies posed (as the beats' characterization plays them)
function playTick({ rt, director }) {
  for (let i = 0; i < STEPS; i++) {
    rt.S.t += TICK / STEPS; director.update();
    for (const p of rt.players) if (!p.offPitch) rt.move(p, TICK / STEPS);
    rt.stepBall(TICK / STEPS); rt.contacts();
  }
  for (const p of rt.players) if (!p.offPitch) rt.pose(p, TICK);
}

// the play that this frame's real time (slowed in the slow motion) is due, in whole ticks
function advance(show, dtReal) {
  show.owed += dtReal * show.slow;
  let ticks = 0;
  while (show.owed >= TICK && ticks < MAX_TICKS_A_FRAME) { playTick(show); show.owed -= TICK; ticks++; show.ticks++; }
  if (ticks === MAX_TICKS_A_FRAME) show.owed = Math.min(show.owed, TICK);      // a slow phone plays slower, never jumps
  return ticks * TICK;
}

function nextPhase(show, dtReal) {
  show.phaseT += dtReal;
  if (show.phase === 'show' && (!show.director.staging || show.phaseT > WATCH_TIMES.showMax)) { show.phase = 'after'; show.phaseT = 0; show.slow = 1; }
  return show.phase === 'after' && show.phaseT > WATCH_TIMES.after;
}

function draw(stage, show, { dtReal, played, now }) {
  drawBall(stage, show.rt, played);
  const aspect = fitCanvas(stage);
  if (show.cut) { show.broadcast.cut(); show.cut = false; }
  show.broadcast.update(show.rt, show.cam, dtReal, aspect);
  aimSun(stage, show.broadcast.look);
  renderStage(stage, { rt: show.rt, now });
}

// the scene's hooks: the camera stays close on the move (the far TV picture is for matches), slow motion at half speed
function sceneHooks(show, stage, excite) {
  return {
    excite: v => setCrowdExcite(stage, Math.max(excite, v)),
    cam: (mode, a = null, b = null) => { show.cam = mode === 'tv' ? { mode: 'close', a: show.star, b: null } : { mode, a, b }; },
    slow: s => { show.slow = s < 1 ? 0.5 : 1; },
  };
}

function startShow(stage, opts, assets) {
  const show = { phase: 'show', phaseT: 0, owed: 0, ticks: 0, slow: 1, cut: true, cam: null };
  Object.assign(show, stageShow(stage, { assets, player: opts.player, move: opts.kind, club: opts.club, hooks: sceneHooks(show, stage, opts.excite ?? 0.8) }));
  show.broadcast = createBroadcastCamera(stage.camera);
  show.staged = show.director.stage(opts.kind, { seed: opts.seed });
  if (!show.staged) show.phase = 'after';
  show.cam = firstShot(opts, show.rt, show.star);
  setCrowdExcite(stage, opts.excite ?? 0.8);
  return show;
}

// automated checks only: where the scene is
function expose(show, close) {
  presentation.highlightScene = { get phase() { return show.phase; }, get ticks() { return show.ticks; }, get staged() { return show.staged; },
    get skills() { return (show.director.stats.skills || []).map(a => a.kind); }, close };
}

/* opts: { player:{id,name,no,pos,keeper}, kind (the stage: core/highlights stageKindFor), seed, moveName, line,
   club:{name,primaryColor,secondaryColor,shortName}, excite }
   resolves { done:true } when it has played, { closed:true } when closed early, null when 3D is not available */
export function playHighlightScene(opts) {
  return new Promise(resolve => {
    const root = overlay(opts);
    document.body.append(root); document.documentElement.classList.add('nv-lock');
    const canvas = root.querySelector('canvas');
    let raf = null, finished = false, stage = null, last = performance.now();
    const finish = result => {
      if (finished) return; finished = true;
      if (raf) cancelAnimationFrame(raf);
      releaseShowStage(stage); presentation.highlightScene = null;
      document.documentElement.classList.remove('nv-lock'); root.remove();
      resolve(result);
    };
    root.querySelector('.hls-close').addEventListener('click', () => finish({ closed: true }));
    stage = openShowStage(canvas, opts.club);
    if (!stage) { finish(null); return; }
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); finish(null); });
    loadFootballers().then(assets => {
      if (finished) return;
      const show = startShow(stage, opts, assets), started = performance.now();
      root.querySelector('.hls-load').remove();
      expose(show, () => finish({ closed: true }));
      const frame = now => {
        if (finished) return;
        raf = requestAnimationFrame(frame);
        const dtReal = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
        const played = advance(show, dtReal);
        if (nextPhase(show, dtReal) || now - started > WATCH_TIMES.cap * 1000) { finish({ done: true }); return; }
        draw(stage, show, { dtReal, played, now });
      };
      raf = requestAnimationFrame(frame);
    }).catch(e => { console.warn('Highlight sahnesi', e); finish(null); });
  });
}
