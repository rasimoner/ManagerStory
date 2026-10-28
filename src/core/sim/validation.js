import MATCH_SIM_DATA from '../../data/match-sim.json';

export function validateSimBall(ball, teams) {
  if (!ball || !teams.some(team => team.id === ball.teamId)) throw new TypeError('Ball team must identify a simulation team.');
  validateSimPosition(ball.position);
}

export function validateSimPosition(position) {
  const pitch = MATCH_SIM_DATA.pitch;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new TypeError('Player or ball position must be finite.');
  if (Math.abs(position.x) > pitch.length / 2 || Math.abs(position.y) > pitch.width / 2) throw new RangeError('Position must be inside the pitch.');
}

export function validateSimulationInput(input) {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0) throw new TypeError('Simulation seed must be a non-negative safe integer.');
  if (!Array.isArray(input.teams) || input.teams.length !== 2) throw new TypeError('Simulation requires two teams.');
  input.teams.forEach(validateSimTeam);
  if (input.teams[0].direction === input.teams[1].direction) throw new TypeError('Teams must attack in opposite directions.');
  const identities = input.teams.flatMap(team => [team.id, ...team.players.map(player => player.id)]);
  if (new Set(identities).size !== identities.length) throw new TypeError('Team and player identities must be unique.');
  validateSimBall(input.ball, input.teams);
}

function validateSimTeam(team) {
  const formation = MATCH_SIM_DATA.formations[team.formation];
  if (!team.id || ![1, -1].includes(team.direction) || !formation) throw new TypeError('Invalid team identity, direction or formation.');
  if (!Array.isArray(team.players) || team.players.length !== formation.length) throw new TypeError('A formation requires eleven players.');
  const slots = new Set(team.players.map(player => player.slot));
  if (!formation.every(anchor => slots.has(anchor.slot))) throw new TypeError('Players must fill each formation slot once.');
  if (!(team.tactics.press in MATCH_SIM_DATA.tactics.pressDistance) || !(team.tactics.line in MATCH_SIM_DATA.tactics.lineShift)) throw new TypeError('Unknown team tactic.');
  team.players.forEach(validateSimPlayer);
}

function validateSimPlayer(player) {
  const { minimum, maximum } = MATCH_SIM_DATA.attributes;
  for (const attribute of ['pace', 'acceleration', 'reactions', 'fitness']) {
    const value = player.attributes?.[attribute];
    if (!Number.isFinite(value) || value < minimum || value > maximum) throw new RangeError(`Invalid player attribute: ${attribute}.`);
  }
  if (player.position) validateSimPosition(player.position);
  if (player.id == null || !Number.isInteger(player.number)) throw new TypeError('Player identity and shirt number are required.');
}
