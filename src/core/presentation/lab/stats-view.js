export function labStatisticsMarkup(stats) {
  const possessions = stats.teams.map(team => `<span data-stat="possession-${team.id}">${team.id === 'home' ? 'Sarı' : 'Mavi'} %${team.possessionPercent.toFixed(0)}</span>`).join(' · ');
  return `<div><b data-stat="passes">${stats.passes}</b> pas · <b data-stat="accuracy">%${stats.accuracy.toFixed(0)}</b> isabet</div>
    <div><b data-stat="distance">${stats.averageDistance.toFixed(1)} m</b> ort. · <b data-stat="interceptions">${stats.interceptions}</b> kesme</div><div>${possessions}</div>
    <div><b data-stat="dribbles">${stats.dribbles}</b> sürme · <b data-stat="dribble-distance">${stats.dribbleDistance.toFixed(0)} m</b> · <b data-stat="beats">${stats.beats}</b> geçiş</div>
    <div><b data-stat="tackles">${stats.tacklesWon} / ${stats.tacklesLoose} / ${stats.tacklesMissed}</b> müdahale (kazandı / sekti / ıska) · <b data-stat="ball-wins">${stats.ballWins}</b> top kazanma</div>
    <div><b data-stat="fouls">${stats.fouls}</b> faul · <b data-stat="yellow">${stats.yellow}</b> sarı · <b data-stat="red">${stats.red}</b> kırmızı · <b data-stat="advantages">${stats.advantages}</b> avantaj</div>`;
}
