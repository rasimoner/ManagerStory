// Diagnostic replay of the same natural checkpoint, outside the default test suite.
const fs = require('node:fs');
const { inflateSync } = require('node:zlib');
const root = process.argv[2];
const checkpointPath = process.argv[4] ?? 'tests/reproductions/corner-before-delivery.json';
(async () => {
  const { loadNativeLab } = require(root + '/tests/support/lab.cjs');
  const api = await loadNativeLab(['restoreSimulation', 'stepSimulation']);
  const archive = require(root + '/' + checkpointPath);
  const simulation = api.restoreSimulation(JSON.parse(inflateSync(Buffer.from(archive.data, 'base64'))));
  const rows = [], start = simulation.time;
  for (let tick = 0; tick < 100; tick++) {
    const old = simulation.teams.flatMap(team => team.players.map(player => ({ id: player.id, position: { ...player.position } })));
    const count = simulation.events.length;
    api.stepSimulation(simulation);
    for (const event of simulation.events.slice(count)) {
      if (!['pass', 'cross', 'firstTouch', 'aerialContact', 'shot', 'goal', 'intercept', 'tackle', 'save'].includes(event.type)) continue;
      const fraction = Math.max(0, Math.min(1, (event.time - (simulation.time - .1)) / .1));
      const players = simulation.teams.flatMap(team => team.players.map(player => {
        const before = old.find(item => item.id === player.id).position;
        return { id: player.id, teamId: team.id, role: player.role, position: {
          x: before.x + (player.position.x - before.x) * fraction,
          y: before.y + (player.position.y - before.y) * fraction
        } };
      }));
      const receiver = players.find(player => player.id === (event.type === 'firstTouch' ? event.toId : event.fromId));
      const point = event.fromPos ?? simulation.ball.position;
      const opponents = players.filter(player => player.teamId !== receiver?.teamId).map(player => ({
        ...player, distance: Math.hypot(player.position.x - point.x, player.position.y - point.y)
      })).sort((a, b) => a.distance - b.distance).slice(0, 3);
      rows.push({ event, nearestOpponents: opponents, ball: { position: { ...simulation.ball.position }, height: simulation.ball.height } });
    }
  }
  const output = { node: process.version, checkpoint: checkpointPath, start, end: simulation.time, rows };
  fs.writeFileSync(process.argv[3], JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(rows.map(row => ({ type: row.event.type, time: row.event.time, from: row.event.fromId, to: row.event.toId, nearest: row.nearestOpponents[0] }))));
})().catch(error => { console.error(error); process.exitCode = 1; });
