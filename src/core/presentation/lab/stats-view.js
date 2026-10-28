export function labStatisticsMarkup(stats) {
  const possessions = stats.teams.map(team => `<span data-stat="possession-${team.id}">${team.id === 'home' ? 'Sarı' : 'Mavi'} %${team.possessionPercent.toFixed(0)}</span>`).join(' · ');
  return `<div><b data-stat="passes">${stats.passes}</b> pas · <b data-stat="accuracy">%${stats.accuracy.toFixed(0)}</b> isabet</div>
    <div><b data-stat="distance">${stats.averageDistance.toFixed(1)} m</b> ort. · <b data-stat="interceptions">${stats.interceptions}</b> kesme</div><div>${possessions}</div>`;
}
