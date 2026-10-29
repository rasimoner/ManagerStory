import MATCH_DURATION_DATA from '../../data/match-duration.json';

export function validMatchDurationMinutes(value) {
  return MATCH_DURATION_DATA.minutes.includes(value);
}

export function normalizeMatchDurationMinutes(value) {
  return validMatchDurationMinutes(value) ? value : MATCH_DURATION_DATA.defaultMinutes;
}

export function matchDurationSeconds(minutes) {
  return normalizeMatchDurationMinutes(minutes) * MATCH_DURATION_DATA.secondsPerMinute;
}
