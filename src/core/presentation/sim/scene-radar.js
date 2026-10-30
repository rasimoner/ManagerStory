import SIM_VIEW_DATA from '../../../data/match-sim-view.json';
import MATCH_SIM_DATA from '../../../data/match-sim.json';

export function paintSimulationRadar(canvas, frame, clubs) {
  const paint = canvas.getContext('2d'), settings = SIM_VIEW_DATA.radar;
  const width = settings.width, height = settings.height, padding = settings.padding;
  paint.clearRect(0, 0, width, height);
  paint.strokeStyle = '#d5e2cd';
  paint.strokeRect(padding, padding, width - 2 * padding, height - 2 * padding);
  paint.beginPath(); paint.moveTo(width / 2, padding); paint.lineTo(width / 2, height - padding); paint.stroke();
  for (const player of frame.players) radarDot(paint, player.position, { color: clubs[player.teamId].primaryColor, radius: settings.playerRadius });
  radarDot(paint, frame.ball.position, { color: 'white', radius: settings.ballRadius });
}

function radarDot(paint, position, style) {
  const settings = SIM_VIEW_DATA.radar, padding = settings.padding;
  const x = padding + (position.x / MATCH_SIM_DATA.pitch.length + 0.5) * (settings.width - 2 * padding);
  const y = padding + (position.z / MATCH_SIM_DATA.pitch.width + 0.5) * (settings.height - 2 * padding);
  paint.fillStyle = style.color;
  paint.beginPath(); paint.arc(x, y, style.radius, 0, Math.PI * 2); paint.fill();
}
