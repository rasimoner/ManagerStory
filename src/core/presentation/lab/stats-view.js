export function labStatisticsMarkup(stats) {
  const possessions = stats.teams.map(team => `<span data-stat="possession-${team.id}">${team.id === 'home' ? 'Sarı' : 'Mavi'} %${team.possessionPercent.toFixed(0)}</span>`).join(' · ');
  return `<div class="shot-summary"><b data-stat="xg-total">${stats.xg.toFixed(2)} xG</b> · <b data-stat="save-percent">${stats.shotsOnTarget ? `%${(stats.saves / stats.shotsOnTarget * 100).toFixed(0)}` : '—'}</b> kurtarış</div><div><b data-stat="passes">${stats.passes}</b> pas · <b data-stat="accuracy">%${stats.accuracy.toFixed(0)}</b> isabet</div>
    <div><b data-stat="distance">${stats.averageDistance.toFixed(1)} m</b> ort. · <b data-stat="interceptions">${stats.interceptions}</b> kesme</div><div>${possessions}</div>
    <div><b data-stat="dribbles">${stats.dribbles}</b> sürme · <b data-stat="dribble-distance">${stats.dribbleDistance.toFixed(0)} m</b> · <b data-stat="beats">${stats.beats}</b> geçiş</div>
    <div><b data-stat="tackles">${stats.tacklesWon} / ${stats.tacklesLoose} / ${stats.tacklesMissed}</b> müdahale (kazandı / sekti / ıska) · <b data-stat="ball-wins">${stats.ballWins}</b> top kazanma</div>
    <div><b data-stat="fouls">${stats.fouls}</b> faul · <b data-stat="yellow">${stats.yellow}</b> sarı · <b data-stat="red">${stats.red}</b> kırmızı · <b data-stat="advantages">${stats.advantages}</b> avantaj</div>${labShootingStatisticsMarkup(stats)}`;
}

function labShootingStatisticsMarkup(stats) {
  const fields = ['shots', 'shotsOnTarget', 'goals', 'xg', 'blocks', 'saves', 'posts'];
  const rows = stats.teams.map(team => `<tr data-shot-team="${team.id}"><th>${team.id === 'home' ? 'Sarı' : 'Mavi'}</th>${fields.map(field => `<td data-stat="${field}-${team.id}">${field === 'xg' ? team[field].toFixed(2) : team[field]}</td>`).join('')}</tr>`).join('');
  return `<table class="shot-stats"><thead><tr><th></th><th>Şut</th><th>İsb.</th><th>Gol</th><th>xG</th><th>Blok</th><th>Krt.</th><th>Direk</th></tr></thead><tbody>${rows}</tbody></table>`;
}
