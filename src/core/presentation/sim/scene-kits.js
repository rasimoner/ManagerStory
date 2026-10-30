import SIM_VIEW_DATA from '../../../data/match-sim-view.json';

export function simulationSceneKit(club, player) {
  const colors = SIM_VIEW_DATA.kits, opponent = player.teamId !== 'user', index = Number(opponent);
  const keeper = player.slot === 'GK', primary = keeper ? colors.keeperShirts[index] : club.primaryColor;
  const secondary = keeper ? colors.numberEdge : club.secondaryColor;
  return { shirt: primary, stripe: secondary, trim: secondary, shorts: secondary, socks: primary, sockTrim: secondary,
    boot: colors.boot, sole: colors.sole, stripes: Number(opponent && !keeper), number: colors.number,
    numberEdge: colors.numberEdge, glove: keeper ? colors.keeperGloves[index] : undefined };
}
