import MATCH_SIM_DATA from '../../../data/match-sim.json';

export function laboratoryPitchMarkup() {
  const pitch = MATCH_SIM_DATA.pitch;
  const centerX = pitch.width / 2;
  const centerY = pitch.length / 2;
  return `<defs><pattern id="grass" width="${pitch.width}" height="${pitch.length / 10}" patternUnits="userSpaceOnUse"><rect width="${pitch.width}" height="${pitch.length / 10}" fill="#173e35"/><rect width="${pitch.width}" height="${pitch.length / 20}" fill="#1a443a"/></pattern><marker id="velocity-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4" fill="#c8e4d7"/></marker></defs>
    <rect x="-4" y="-6" width="76" height="117" fill="#102b28"/><rect width="${pitch.width}" height="${pitch.length}" fill="url(#grass)"/>
    <g fill="none" stroke="#8cae94" stroke-width=".22" opacity=".7"><rect width="${pitch.width}" height="${pitch.length}"/>
    <path d="M0,${centerY} H${pitch.width}"/><circle cx="${centerX}" cy="${centerY}" r="${pitch.centerCircleRadius}"/>
    ${penaltyBoxMarkup(0, pitch.penaltyDepth)}${penaltyBoxMarkup(pitch.length - pitch.penaltyDepth, pitch.penaltyDepth)}
    <rect x="${(pitch.width - pitch.goalWidth) / 2}" y="-1.8" width="${pitch.goalWidth}" height="1.8"/><rect x="${(pitch.width - pitch.goalWidth) / 2}" y="${pitch.length}" width="${pitch.goalWidth}" height="1.8"/></g>
    <circle cx="${centerX}" cy="${centerY}" r=".35" fill="#b4c6b4"/>`;
}

function penaltyBoxMarkup(top, depth) {
  const pitch = MATCH_SIM_DATA.pitch;
  return `<rect x="${(pitch.width - pitch.penaltyWidth) / 2}" y="${top}" width="${pitch.penaltyWidth}" height="${depth}"/>`;
}

export function toLabFieldPoint(position) {
  return { x: MATCH_SIM_DATA.pitch.width / 2 + position.y, y: MATCH_SIM_DATA.pitch.length / 2 - position.x };
}
