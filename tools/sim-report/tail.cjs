function analyseGoalTail(events) {
  const goals = events.filter(event => event.type === 'goal');
  return { goals: goals.map((goal, index) => goalContext(events, { goal, previous: goals[index - 1] })) };
}

function goalContext(events, { goal, previous }) {
  const before = events.filter(event => event.time >= goal.time - 30 && event.time <= goal.time);
  const kickoff = events.findLast(event => event.type === 'kickoff' && event.time <= goal.time);
  const firstPass = kickoff && events.find(event => event.type === 'pass' && event.time >= kickoff.time);
  return { time: goal.time, teamId: goal.teamId, intervalSeconds: previous ? goal.time - previous.time : null,
    sinceKickoffSeconds: kickoff ? goal.time - kickoff.time : null,
    restartTurnover: !!(firstPass && firstPass.time >= goal.time - 30 && firstPass.success === false), before };
}

module.exports = { analyseGoalTail };
