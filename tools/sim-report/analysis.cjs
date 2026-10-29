function distribution(values) {
  if (!values.length) return { mean: null, median: null, p10: null, p90: null };
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = fraction => {
    const index = (sorted.length - 1) * fraction, lower = Math.floor(index);
    return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
  };
  return { mean: values.reduce((sum, value) => sum + value, 0) / values.length, median: percentile(0.5), p10: percentile(0.1), p90: percentile(0.9) };
}

function bucket(value, boundaries) {
  const index = boundaries.findIndex(edge => value < edge);
  if (index < 0) return `${boundaries.at(-1)}+`;
  return `${index ? boundaries[index - 1] : 0}–${boundaries[index]}`;
}

function shotRows(events, teamOf) {
  const rows = [], goals = new Map(events.filter(event => event.type === 'goal').map(event => [event.shotId, event]));
  let rebound = null, previous = null;
  events.forEach((event, index) => {
    if (event.type === 'shot') {
      const second = !!(rebound && rebound.teamId === event.teamId && event.time - rebound.time <= 3);
      rows.push({ ...event, second, rebounded: !!rebound, goal: goals.has(index), sources: opportunitySources(events, index, teamOf),
        goalSources: goals.has(index) ? opportunitySources(events, events.indexOf(goals.get(index)), teamOf) : [] });
      previous = event;
    }
    annotateSaveKind(event, rows);
    if (['save', 'block', 'post'].includes(event.type) && previous) rebound = { time: event.time, teamId: previous.teamId };
    if (breaksAttack(event, rebound?.teamId, teamOf)) { rebound = null; previous = null; }
  });
  return rows;
}

function annotateSaveKind(event, rows) {
  if (event.type === 'save' && rows.length) rows.at(-1).saveKind = event.kind;
}

function breaksAttack(event, teamId, teamOf) {
  if (['goal', 'kickoff', 'half', 'ballOut', 'referee', 'foul', 'keeperClaim'].includes(event.type)) return true;
  const control = event.type === 'interception' && event.success || event.type === 'firstTouch' && event.success || event.type === 'tackle' && event.result === 'won';
  const controllerId = event.type === 'tackle' ? event.fromId : event.toId;
  return control && teamOf(controllerId) !== teamId;
}

function opportunitySources(events, index, teamOf) {
  const shot = events[index], sources = new Set();
  for (let cursor = index - 1; cursor >= 0 && shot.time - events[cursor].time <= 10; cursor--) {
    const event = events[cursor];
    if (breaksAttack(event, shot.teamId, teamOf)) break;
    if (['save', 'block', 'post'].includes(event.type)) sources.add('rebound');
    for (const source of eventSources(event, shot.teamId, teamOf)) sources.add(source);
  }
  return sources.size ? [...sources] : ['other'];
}

function eventSources(event, teamId, teamOf) {
  if (event.type === 'interception' && event.success && teamOf(event.toId) === teamId) return ['ballWin'];
  if (teamOf(event.fromId) !== teamId) return [];
  if (event.type === 'tackle' && event.result === 'won') return ['ballWin'];
  if (event.type === 'beat') return ['dribbleBeat'];
  if (isThroughPass(event)) return ['throughPass'];
  return [];
}

function isThroughPass(event) {
  return event.type === 'pass' && event.success && event.leadDistance >= 3;
}

function sliceRows(rows, keyOf) {
  const groups = {};
  for (const row of rows) (groups[keyOf(row)] ??= []).push(row);
  return Object.fromEntries(Object.entries(groups).map(([key, group]) => [key, summarizeSlice(group)]));
}

function summarizeSlice(rows) {
  const sum = field => rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
  const xg = sum('xg'), onTarget = sum('onTarget'), goals = sum('goal');
  const saves = rows.filter(row => row.keeper?.saved).length;
  const saveKinds = Object.fromEntries(['catch', 'parry', 'tip'].map(kind => [kind, rows.filter(row => row.saveKind === kind).length]));
  const contacts = rows.filter(row => row.keeper?.contact).length;
  const evaluatedAtKeeperPlane = rows.filter(row => row.keeper?.arrival).length;
  return { count: rows.length, onTarget, goals, meanXg: xg / rows.length, goalRate: goals / rows.length,
    saves, saveKinds, savePercent: onTarget ? saves / onTarget * 100 : null, reached: contacts, evaluatedAtKeeperPlane, touchedButConceded: rows.filter(row => row.goal && row.keeper?.contact).length,
    neverReached: rows.filter(row => row.onTarget && !row.keeper?.contact).length,
    reactionSeconds: distribution(rows.filter(row => row.keeper).map(row => row.keeper.reactionSeconds)),
    extension: distribution(rows.filter(row => row.keeper?.arrival).map(row => row.keeper.extension)),
    requiredExtension: distribution(rows.filter(row => row.keeper?.arrival).map(row => row.keeper.requiredExtension)), contacts };
}

module.exports = { distribution, bucket, shotRows, sliceRows };
