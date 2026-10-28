import MATCH_SIM_DATA from '../../data/match-sim.json';

const { isFinite, isSafeInteger, isInteger } = Number;
const { abs } = Math;

export function validateSimBall(ball, teams) {
  if (!ball || !teams.some(team => team.id === ball.teamId)) throw new TypeError('Ball team must identify a simulation team.');
  validateSimPosition(ball.position);
}

export function validateSimPosition(position) {
  const pitch = MATCH_SIM_DATA.pitch;
  if (!position || !isFinite(position.x) || !isFinite(position.y)) throw new TypeError('Player or ball position must be finite.');
  if (abs(position.x) > pitch.length / 2 || abs(position.y) > pitch.width / 2) throw new RangeError('Position must be inside the pitch.');
}

export function validateSimulationInput(input) {
  if (!isSafeInteger(input.seed) || input.seed < 0) throw new TypeError('Simulation seed must be a non-negative safe integer.');
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
  validateInitialPassingStyle(team.tactics);
  team.players.forEach(validateSimPlayer);
}

function validateInitialPassingStyle(tactics) {
  if (tactics.mentality !== undefined && !(tactics.mentality in MATCH_SIM_DATA.shooting.mentalities)) throw new TypeError('Unknown team mentality.');
  const style = tactics.passingStyle ?? MATCH_SIM_DATA.passing.defaultStyle;
  if (tactics.tempo !== undefined && !(tactics.tempo in MATCH_SIM_DATA.ownerDecision.tempos)) throw new TypeError('Unknown team tempo.');
  if (!(style in MATCH_SIM_DATA.passing.styles)) throw new TypeError('Unknown team passing style.');
}

function validateSimPlayer(player) {
  validateSimAttributes(player.attributes);
  validateKeeperAttributes(player.gk ?? player.attributes?.gk);
  if (player.position) validateSimPosition(player.position);
  if (player.id == null || !isInteger(player.number)) throw new TypeError('Player identity and shirt number are required.');
}

function validateSimAttributes(attributes) {
  for (const attribute of ['pace', 'acceleration', 'reactions', 'fitness']) {
    validateSimAttribute(attribute, attributes?.[attribute]);
  }
  for (const attribute of ['finishing', 'passing', 'vision', 'technique', 'firstTouch', 'dribbling', 'strength', 'composure', 'tackling', 'positioning']) {
    validateSimAttribute(attribute, attributes?.[attribute] ?? MATCH_SIM_DATA.ball.defaultAttribute);
  }
}

function validateSimAttribute(attribute, value) {
  const { minimum, maximum } = MATCH_SIM_DATA.attributes;
  if (!isFinite(value) || value < minimum || value > maximum) throw new RangeError(`Invalid player attribute: ${attribute}.`);
}

function validateKeeperAttributes(attributes) {
  for (const name of ['reflexes', 'handling', 'oneOnOne']) validateSimAttribute(`gk.${name}`, attributes?.[name] ?? MATCH_SIM_DATA.ball.defaultAttribute);
}
