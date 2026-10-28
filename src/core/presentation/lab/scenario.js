import MATCH_SIM_DATA from '../../../data/match-sim.json';
import TACTIC_DATA from '../../../data/tactics.json';
import { R } from '../../random.js';

export function createLabScenario(options = {}) {
  const settings = MATCH_SIM_DATA.lab;
  const seed = options.seed ?? settings.defaultSeed;
  const random = R(seed);
  const teams = settings.teams.map((team, index) => createLabTeam({ team, index, options, random }));
  return { seed, teams, match: true, ball: { position: { ...settings.defaultBall }, teamId: teams[0].id } };
}

function createLabTeam({ team, index, options, random }) {
  const defaults = MATCH_SIM_DATA.lab;
  const formation = (index ? options.awayFormation : options.formation) ?? options.formation ?? defaults.defaultFormation;
  const anchors = MATCH_SIM_DATA.formations[formation];
  if (!anchors) throw new TypeError('Unknown laboratory formation.');
  return {
    id: team.id, direction: team.direction, formation,
    tactics: { mentality: options.mentality ?? MATCH_SIM_DATA.shooting.defaultMentality, press: options.press ?? defaults.defaultPress, line: options.line ?? defaults.defaultLine,
      passingStyle: options.passingStyle ?? MATCH_SIM_DATA.passing.defaultStyle, tempo: options.tempo ?? MATCH_SIM_DATA.ownerDecision.defaultTempo },
    players: anchors.map((anchor, slot) => ({ id: `${team.id}-${anchor.slot}`, number: slot + 1, slot: anchor.slot, attributes: labPlayerAttributes(random) })),
  };
}

function labPlayerAttributes(random) {
  const { attributeBase, attributeRange, fitness } = MATCH_SIM_DATA.lab;
  const rating = () => attributeBase + Math.floor(random() * attributeRange);
  const pace = rating(), acceleration = rating(), reactions = rating();
  return { pace, acceleration, reactions, fitness, passing: (pace + reactions) / 2, firstTouch: (acceleration + reactions) / 2,
    technique: (pace + acceleration) / 2, vision: reactions, dribbling: (pace + acceleration) / 2, tackling: (acceleration + reactions) / 2,
    finishing: (pace + reactions) / 2, gk: { reflexes: reactions, handling: acceleration, oneOnOne: (pace + reactions) / 2 },
    strength: acceleration, positioning: reactions, composure: reactions };
}

export function labTacticOptions() {
  return { mentality: [...TACTIC_DATA.options.mentality], press: [...TACTIC_DATA.options.press], line: [...TACTIC_DATA.options.line], passingStyle: [...TACTIC_DATA.options.passingStyle], tempo: [...TACTIC_DATA.options.tempo] };
}
