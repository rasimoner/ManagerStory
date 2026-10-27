/* The manager's match panel (refactor D4): the statistics, details and fitness tabs, the tactics and team
   orders he can change during a match (and in his plan before it), the assistant's suggestions next to
   them, and the buttons that do it. Moved from core/engine/match-support.js: the engine only takes what
   they decide (a tactic event, the match state), never draws them. */
import { userSquad } from '../../core/engine/user-team.js';
import { M, S } from '../../core/state.js';
import { clamp, escapeHTML, matchEvent, matchPossession, presentationEvent } from '../../core/engine/match-support.js';
import { assistantAdvice, matchTeamName } from '../../core/engine/pitch-v731.js';
import { save } from '../../core/save.js';
import { render } from './app.js';
import { defineActions } from '../../ui/actions.js';
import { MATCH_TACTICS, TACTIC_LABELS, TEAM_ORDERS } from '../../core/engine/tactics.js';
export function matchFitnessUI() {
  const ps = userSquad().filter(p => M.active.includes(p.id)).sort((a, b) => a.fitness - b.fitness);
  return `<div class="fitnessstrip" aria-label="Sahadaki oyuncuların fitness durumu">${ps.map(p => `<button class="fitnessmini ${p.fitness < 45 ? "critical" : p.fitness < 60 ? "warning" : ""}" data-action="openMatchPlayer" data-id="${p.id}" aria-label="${escapeHTML(p.name)}, fitness yüzde ${Math.round(p.fitness)}${p.fitness < 45 ? ', kritik' : p.fitness < 60 ? ', yorgun' : ''}"><b>${escapeHTML(p.name)}</b><span>%${Math.round(p.fitness)} ${p.fitness < 45 ? "‼" : p.fitness < 60 ? "!" : ""}</span><i style="--fitness:${clamp(p.fitness, 0, 100)}%"></i></button>`).join("")}</div>`;
}
export function matchStatsUI() {
  const st = M.stats, poss = matchPossession();
  const percent = side => st.passes[side] ? Math.round(st.completedPasses[side] * 100 / st.passes[side]) + "%" : "—";
  const rows = [
    ["Şut", ...M.shots], ["İsabetli şut", ...M.ont], ["Topa sahip olma", ...poss.map(x => x + "%")],
    ["xG", ...st.xg.map(x => x.toFixed(2))], ["Korner", ...st.corners], ["Faul", ...st.fouls],
    ["Pas yüzdesi", percent(0), percent(1)], ["İsabetli / toplam pas", `${st.completedPasses[0]} / ${st.passes[0]}`, `${st.completedPasses[1]} / ${st.passes[1]}`],
    ["Büyük fırsatlar", ...st.bigChances], ["Top kazanma", ...st.possessionsWon], ["Başarılı müdahale", ...st.tackles], ["Sarı kart", ...st.yellow], ["Kırmızı kart", ...st.red]
  ];
  return `<section class="matchstats"><h2>Maç İstatistikleri</h2><div class="statteamnames"><b>${M.home}</b><b>${M.away}</b></div>${rows.map(([label, a, b]) => `<div class="statrow"><b>${a}</b><span>${label}</span><b>${b}</b></div>`).join("")}</section>`;
}
export function matchDetailsUI() {
  const labels = { goal: "Gol", yellow: "Sarı kart", red: "Kırmızı kart", sub: "Değişiklik", chance: "Pozisyon", injury: "Sakatlık", half: "Devre arası", end: "Son düdük", tactic: "Taktik", order: "Talimat", corner: "Korner", penalty: "Penaltı", freeKick: "Serbest vuruş", offside:"Ofsayt",save: "Kurtarış", block: "Blok", post: "Direk", wide: "Aut", throwIn: "Taç", goalKick: "Kale vuruşu", tackle: "Müdahale" };
  const events = M.events.filter(e => labels[e.type]).slice().reverse();
  return `<section class="matchdetails"><h2>${M.min}' • ${M.home} ${M.hg}–${M.ag} ${M.away}</h2><ol>${events.map(e => `<li class="event-${e.type}"><span>${e.minute}' · ${presentationEvent(e).presentationLabel||labels[e.type]}</span><p>${escapeHTML(presentationEvent(e).text)}</p></li>`).join("") || "<li>Henüz önemli bir olay yaşanmadı.</li>"}</ol></section>`;
}
export function assistHint(target, key) {
  if (target !== "match" || typeof assistantAdvice !== "function") return "";
  const a = assistantAdvice().tactics?.[key];
  return a ? `<button type="button" class="assist" data-assist="${key}" title="${escapeHTML(a.reason)}" data-action="applyAssistantAdvice" data-value="${escapeHTML(a.value)}">💡 ${a.value}<small>${escapeHTML(a.reason)}</small></button>` : "";
}
export function assistTeamHint(target, key) {
  if (target !== "match" || typeof assistantAdvice !== "function") return "";
  const a = assistantAdvice().team?.[key];
  return a ? `<button type="button" class="assist" data-assist="${key}" title="${escapeHTML(a.reason)}" data-action="applyAssistantAdvice">💡<small>${escapeHTML(a.reason)}</small></button>` : "";
}
// Tapping a recommendation is the user's own action: it selects exactly that control's option.
export function applyAssistantAdvice(key, value) {
  if (!M || M.finished) return;
  if (MATCH_TACTICS[key]) { setMatchTactic(key, value); return; }
  if (TEAM_ORDERS[key] && value === true && !M.teamInstructions?.includes(key)) toggleTeamOrder(key, "match");
}
export function tacticsControls(target = "match") {
  const plan = target === "match" ? M : S.plan;
  return `<div class="tacticfields">${Object.entries(MATCH_TACTICS).map(([key, values]) => `<label>${TACTIC_LABELS[key]}<select aria-label="${TACTIC_LABELS[key]}" data-action="${target === 'match' ? 'setMatchTactic' : 'setCareerTactic'}" data-key="${key}">${values.map(value => `<option${plan[key] === value ? ' selected' : ''}>${value}</option>`).join("")}</select>${assistHint(target, key)}</label>`).join("")}</div><h3>Takım Talimatları</h3><div class="teamorders">${Object.entries(TEAM_ORDERS).map(([key, label]) => `<button class="${plan.teamInstructions?.includes(key) ? 'selected' : 'secondary'}" aria-pressed="${!!plan.teamInstructions?.includes(key)}" data-action="toggleTeamOrder" data-key="${key}" data-scope="${target}">${label}</button>${assistTeamHint(target, key)}`).join("")}</div>`;
}
export function setCareerTactic(key, value) {
  if (!MATCH_TACTICS[key]?.includes(value)) return;
  S.plan[key] = value; S.v71.lastTacticWeek = S.week; save(); render();
}
export function setMatchTactic(key, value) {
  if (!M || M.finished || !MATCH_TACTICS[key]?.includes(value)) return;
  if (M[key] === value) return;
  if (!M.pause) { M.pause = true; M.reason = 'manual'; }
  M[key] = value;
  M.tacticChanges.push({ minute: M.min, key, value });
  const descriptions={mentality:{Cesur:'bütün hatlarıyla ileri çıkıyor',Temkinli:'daha kompakt savunmaya yerleşiyor'},press:{Yüksek:'önde baskıya geçti',Düşük:'presi düşürüp blok halinde bekliyor'},tempo:{Yüksek:'oyunu hızlandırıyor',Düşük:'pas temposunu düşürüyor'},line:{Önde:'savunma çizgisini ileri taşıyor',Geride:'savunmayı geriye çekiyor'}};
  matchEvent("tactic", `🧠 ${M.min}' ${matchTeamName('user')} ${descriptions[key]?.[value] || `${TACTIC_LABELS[key]}: ${value}`}.`,{key,value});
  save(); render();
}
export function toggleTeamOrder(key, target) {
  if (!TEAM_ORDERS[key]) return;
  const plan = target === "match" ? M : S.plan;
  if (!plan || (target === "match" && M.finished)) return;
  if (target === "match" && !M.pause) { M.pause = true; M.reason = 'manual'; }
  plan.teamInstructions ??= [];
  plan.teamInstructions = plan.teamInstructions.includes(key) ? plan.teamInstructions.filter(x => x !== key) : [...plan.teamInstructions, key];
  if (target === "match") matchEvent("tactic", `🧠 ${M.min}' ${TEAM_ORDERS[key]}: ${plan.teamInstructions.includes(key) ? 'açık' : 'kapalı'}.`);
  else S.v71.lastTacticWeek = S.week;
  save(); render();
}
export function switchMatchTab(tab) {
  if (!M || !["details", "pitch", "stats", "tactics"].includes(tab)) return;
  M.activeTab = tab;
  if (tab === 'tactics' && !M.pause && !M.finished) { M.pause = true; M.reason = 'manual'; }
  render();
}
export function closeMatchOverlay() {
  if (M) delete M.uiOverlay;
  render();
}
/* Refactor C2: the match controls this file draws (moved with them in D4) */
defineActions({
  applyAssistantAdvice: d => applyAssistantAdvice(d.assist, d.value ?? true),
  setMatchTactic: (d, el) => setMatchTactic(d.key, el.value),
  setCareerTactic: (d, el) => setCareerTactic(d.key, el.value),
  toggleTeamOrder: d => toggleTeamOrder(d.key, d.scope),
  switchMatchTab: d => switchMatchTab(d.key),
  closeMatchOverlay: () => closeMatchOverlay(),
});
export function shoutLive(type, id = null) {
  if (!M || M.finished || !M.pause) return;
  const labels = { calm:'Sakin olun!', forward:'Öne çıkın!', press:'Presi artırın!', hold:'Topu tutun!', brave:'Daha cesur!', fight:'Sonuna kadar!' };
  if (!labels[type]) return;
  const key = `${type}:${id ?? 'team'}`;
  if (M.min - (M.shoutLast[key] ?? -100) < 10) { alert('Bu seslenişin etkisi için yaklaşık 10 oyun dakikası bekle.'); return; }
  M.shoutLast[key] = M.min;
  const targets = id == null ? userSquad().filter(p => M.active.includes(p.id)) : userSquad().filter(p => p.id === id && M.active.includes(id));
  for (const p of targets) {
    const temperament = p.age >= 29 || p.personality === 'Lider' ? 1 : p.age < 21 ? .5 : .8;
    const response = (p.form || 70) >= 55 ? 1 : -1;
    const delta = Math.round((type === 'calm' || type === 'hold' ? 1 : 2) * temperament * response);
    p.morale = clamp(p.morale + delta, 25, 100);
  }
  matchEvent('shout', `📣 ${M.min}' ${id == null ? 'Takıma' : targets[0]?.name + ' oyuncusuna'}: ${labels[type]}`, { playerId:id });
  save(); render();
}
