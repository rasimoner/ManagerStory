const assert = require('node:assert/strict');
const { loadGame } = require('./game.cjs');

function startSceneCareer() {
  const game = loadGame({ quiet: true });
  game.run('S=fresh();init();S.matchSalt=73;setExperimentalMatchEngine(true);startMatch();setMatchView("3d")');
  return game;
}

function sceneCareerSnapshot(game) {
  game.api.pauseLive();
  game.api.save();
  const snapshot = game.storage.get('msv4');
  game.api.resumeLive();
  return snapshot;
}

function recordedSceneCareers() {
  const game = startSceneCareer(), scenes = { kickoff: sceneCareerSnapshot(game) };
  const labels = { pass: 'passing', shot: 'shot', save: 'save' };
  for (let tick = 0; tick < 900 && !scenes.save; tick++) {
    game.api.advanceExperimentalPlayback(.1, { maxSteps: 1 });
    for (const event of game.api.M.simulationPlayback.frame.contacts) {
      const label = labels[event.type];
      if (label && !scenes[label]) scenes[label] = sceneCareerSnapshot(game);
    }
  }
  for (const label of Object.values(labels)) assert.ok(scenes[label], `fixed career seed produced ${label}`);
  game.run(`for(let guard=0;M.reason!=='half'&&guard<10;guard++){
    if(M.requiredSubstitution){const incoming=eligibleSubstitutes()[0];if(incoming)queueExperimentalSubstitution({outId:M.requiredSubstitution.playerId,inId:incoming.id});}
    if(M.pause)resumeLive();
    advanceExperimentalSeconds(60);
  }`);
  assert.equal(game.api.M.reason, 'half');
  scenes.halftime = sceneCareerSnapshot(game);
  scenes.goal = syntheticGoalCareer();
  return scenes;
}

function syntheticGoalCareer() {
  const game = startSceneCareer();
  // This isolated fixture supplies the same geometry as the core goal-line acceptance test.
  // No fixture flag, changed seed selection or forced result is shipped to product matches.
  game.run(`
    for(const [side,team] of M.simulation.teams.entries())for(const [index,player] of team.players.entries())player.position={x:-25+side*4,y:-28+index*5};
    const shooter=M.simulation.teams[0].players.find(player=>player.slot==='ST');
    shooter.position={x:48,y:0};
    M.simulation.teams[1].players[0].position={x:51,y:-3};
    placeSimulationBall(M.simulation,{position:{...shooter.position},teamId:'user',ownerId:shooter.id});
    requestSimulationShot(M.simulation);
    const duration=Math.hypot(4.5,3)/32;
    M.simulation.ball.velocity={x:4.5/duration,y:3/duration};
    M.simulation.ball.verticalVelocity=0;
    for(let tick=0;tick<20&&!M.simulation.events.some(event=>event.type==='goal');tick++)advanceExperimentalPlayback(.1,{maxSteps:1});
  `);
  assert.equal(game.api.M.hg, 1);
  return sceneCareerSnapshot(game);
}

module.exports = { recordedSceneCareers };
