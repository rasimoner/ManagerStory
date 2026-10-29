const assert = require('node:assert/strict');

function measureDurationCareer(api, simulation) {
  const ratings = api.simulationPlayerRatings(simulation);
  return simulation.teams.map((team, side) => measureTeamCareer(api, simulation, { team, side, ratings }));
}

function measureTeamCareer(api, simulation, context) {
  const { team, side, ratings } = context;
  const allPlayers = [...simulation.teams.flatMap(candidate => candidate.players), ...simulation.departed];
  const players = allPlayers.filter(player => player.teamId === team.id).map(player => ({ id: player.id, name: String(player.id), goals: 0, assists: 0, minutes: 0, yellow: 0, red: 0, morale: 70, form: 70 }));
  const state = { players, seasonIndex: 0 }, match = { userHome: side === 0, yellowByPlayer: {} };
  api.setCareer(state);
  api.setMatch(match);
  const events = writeCareerEvents(api, simulation.events, { players: allPlayers, teamId: team.id, side, match });
  for (const player of players) for (let minute = 0; minute < ratings[player.id].minutes; minute++) api.recordMinutePlayed(player);
  const result = { matchSummary: { players: players.map(player => ({ id: player.id, ...ratings[player.id] })) } };
  api.seasonRecordMatch({ experimental: true, events }, result);
  const sum = key => players.reduce((total, player) => total + player[key], 0);
  const written = Object.fromEntries(['goals', 'assists', 'yellow', 'red'].map(key => [key, sum(key)]));
  assertTeamCareer(simulation, { team, written, ratings, players });
  return { teamId: team.id, ...written, minutes: players.map(player => ({ id: player.id, minutes: player.minutes })),
    goalsByMinute: events.filter(event => event.type === 'goal' && event.fromSide === 'user').map(event => event.minute),
    shots: result.matchSummary.players.reduce((total, player) => total + player.shots, 0),
    injuryEvents: events.filter(event => event.type === 'injury' && event.fromSide === 'user').length };
}

function writeCareerEvents(api, events, context) {
  const mapping = { names: Object.fromEntries(context.players.map(player => [player.id, String(player.id)])),
    teams: Object.fromEntries(context.players.map(player => [player.id, player.teamId === context.teamId ? 'user' : 'opponent'])), userSide: context.side };
  return events.filter(event => !(event.type === 'yellow' && event.secondYellow)).map(event => {
    const converted = api.careerSimulationEvent(event, mapping);
    const minute = Number(converted.text.split("'")[0]);
    assert.equal(minute, Math.floor(event.matchTime / 60));
    if (event.type === 'yellow') context.match.yellowByPlayer[event.fromId] = (context.match.yellowByPlayer[event.fromId] ?? 0) + 1;
    if (event.type === 'red' && event.secondYellow) context.match.yellowByPlayer[event.fromId] = 2;
    api.recordMatchEvent(converted.type, converted.text, converted.data);
    return { type: converted.type, minute, ...converted.data };
  });
}

function assertTeamCareer(simulation, context) {
  const { team, written, ratings, players } = context, stats = simulation.statistics.teams[team.id];
  for (const key of ['goals', 'yellow', 'red']) assert.equal(written[key], stats[key]);
  assert.equal(written.assists, simulation.events.filter(event => event.type === 'goal' && event.teamId === team.id && event.assistId != null).length);
  for (const player of players) assert.equal(player.minutes, ratings[player.id].minutes);
}

module.exports = { measureDurationCareer };
