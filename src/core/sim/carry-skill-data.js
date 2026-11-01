import SKILL_DATA from '../../data/match-sim-skills.json';

export function simulationCarrySkillData(kind) { return SKILL_DATA.ground[kind] ?? SKILL_DATA.air?.[kind]; }
