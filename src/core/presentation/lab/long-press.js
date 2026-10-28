import MATCH_SIM_DATA from '../../../data/match-sim.json';

export function bindLabLongPress(context, onTap) {
  const field = context.view.field;
  let press = null, lastTap = null;
  const cancel = () => { if (press) clearTimeout(press.timer); press = null; };
  field.addEventListener('pointerdown', event => {
    if (!event.target.closest('[data-player]')) { onTap(event); return; }
    event.preventDefault();
    cancel();
    const playerId = event.target.closest('[data-player]').dataset.player;
    field.setPointerCapture(event.pointerId);
    press = { event, playerId, held: false, x: event.clientX, y: event.clientY };
    press.timer = setTimeout(() => {
      press.held = true;
      if (context.runner.snapshot().simulation.teams.flatMap(team => team.players).find(player => player.id === playerId).sentOff) return;
      context.runner.forceDribble(playerId);
      context.view.root.querySelector('#ball-source').textContent = `${playerId} · sahipken sürmeye zorlandı`;
    }, MATCH_SIM_DATA.lab.longPressMilliseconds);
  });
  field.addEventListener('pointerup', () => {
    if (press && !press.held) {
      const owner = context.runner.snapshot().simulation.ball.ownerId;
      if (owner === press.playerId) lastTap = handleOwnerTap(context, press, lastTap);
      else { lastTap = null; onTap(press.event); }
    }
    cancel();
  });
  field.addEventListener('pointercancel', cancel);
  field.addEventListener('pointermove', event => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > MATCH_SIM_DATA.lab.longPressMovePixels) cancel();
  });
  field.addEventListener('contextmenu', event => event.preventDefault());
}

function handleOwnerTap(context, press, lastTap) {
  const time = performance.now();
  if (lastTap?.playerId === press.playerId && time - lastTap.time <= MATCH_SIM_DATA.lab.doubleTapMilliseconds) {
    context.runner.shoot();
    return null;
  }
  return { playerId: press.playerId, time };
}
