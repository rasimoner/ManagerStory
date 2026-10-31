import MATCH_SIM_DATA from '../../data/match-sim.json';

export function simulationPitchPercent(point) {
  if (!point) return null;
  return [50 + point.x / MATCH_SIM_DATA.pitch.length * 100, 50 + point.y / MATCH_SIM_DATA.pitch.width * 100];
}

export function careerSimulationEvent(event, context) {
  const teamId = eventTeam(event, context);
  const side = teamId === 'user' ? context.userSide : 1 - context.userSide;
  const type = event.type === 'substitution' ? 'sub' : event.type === 'tactics' ? 'tactic' : event.type;
  return { type, text: careerSimulationCommentary(event, context.names), data: {
    simulationEvent: true, simulationTime: event.time, side, fromId: event.fromId, toId: event.toId,
    playerId: teamId === 'user' ? event.fromId : null, fromSide: actorSide(event.fromId, context), toSide: actorSide(event.toId, context),
    ballSide: teamId === 'user' ? 'user' : 'opp', fromPos: simulationPitchPercent(event.fromPos), toPos: simulationPitchPercent(event.toPos),
    success: event.success, assistId: event.assistId ?? null, scorer: context.names[event.fromId], xg: event.xg,
    onTarget: event.onTarget, secondYellow: event.secondYellow, penaltyPending: event.penaltyPending,
    outId: event.type === 'substitution' ? event.fromId : undefined, inId: event.type === 'substitution' ? event.toId : undefined,
  } };
}

function actorSide(id, context) {
  if (id == null) return null;
  return context.teams[id] === 'user' ? 'user' : 'opp';
}

function eventTeam(event, context) {
  return context.teams[event.fromId] ?? event.teamId ?? 'user';
}

export function careerSimulationCommentary(event, names) {
  const minute = Math.floor((event.matchTime ?? event.time) / 60), name = names[event.fromId] ?? 'Oyuncu';
  const descriptions = {
    goal: `${name} vurdu… GOL!`, shot: `${name} şut çekti.`, save: `${name} kurtardı.`, post: 'Top direkten döndü.', wide: 'Top dışarıda.',
    yellow: `${name} sarı kart gördü.`, red: `${name} ${event.secondYellow ? 'ikinci sarıdan' : 'doğrudan'} kırmızı kart gördü.`,
    injury: `${name} sakatlandı. Oyuncu değişikliği gerekiyor.`, half: 'Devre sona erdi.', kickoff: 'Santra pası verildi.',
    substitution: `${name} çıktı, ${names[event.toId] ?? 'yedek oyuncu'} oyuna girdi.`, substitutionRequested: `${name} için değişiklik bir sonraki duruşta uygulanacak.`,
    foul: `${name} faul yaptı.${event.penaltyPending ? event.positionedRestart ? ' Penaltı.' : ' Geçici ceza alanı duruşu.' : ''}`,
    ballOut: event.temporaryRestart ? 'Top dışarı çıktı; geçici yeniden başlama.' : 'Top dışarı çıktı.',
    pass: `${name} pas verdi.`, interception: `${names[event.toId] ?? 'Rakip'} pası kesti.`, tackle: `${name} müdahale yaptı.`,
    keeperDistribution: `${name} topu oyuna soktu.`, instruction: `${name}: bireysel talimat kaydedildi.`, tactics: 'Takımın taktiği güncellendi.',
    throwIn: `${name} taç atışını kullandı.`, corner: `${name} korneri kullandı.`, goalKick: `${name} aut atışını kullandı.`,
    freeKick: `${name} serbest vuruşu kullandı.`, penalty: `${name} penaltıyı kullandı.`,
  };
  return `${minute}' ${descriptions[event.type] ?? name + ' oyuna katılıyor.'}`;
}
