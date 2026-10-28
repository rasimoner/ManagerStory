import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { labTacticOptions } from './scenario.js';

export function createLaboratoryView(root) {
  root.innerHTML = laboratoryMarkup();
  populateLabSelects(root);
  return { root, field: root.querySelector('#lab-field'), metrics: root.querySelector('#lab-metrics'), error: root.querySelector('#lab-error') };
}

function laboratoryMarkup() {
  return `<header class="lab-header"><div><p class="eyebrow"><span class="live-dot"></span> MANAGERSTORY / R&D</p><h1>Maç laboratuvarı<span>01—03</span></h1></div><span class="phase-badge">TOPSUZ HAREKET</span></header>
    <section class="lab-intro"><p>Bir blok, on bir karar.</p><span>Topa dokun. Takımın nasıl tepki verdiğini izle.</span></section>
    <section id="lab-metrics" class="metrics" aria-label="Takım ölçümleri"></section>
    <section class="field-card" aria-label="Deney sahası"><div class="field-toolbar"><span><i class="status-dot"></i><b id="lab-status">ÇALIŞIYOR</b></span><output id="lab-clock" data-tick="0">00:00.0</output><span>105 × 68 m</span></div>
      <svg id="lab-field" viewBox="-4 -6 76 117" role="img" tabindex="0" aria-label="Topu yerleştirmek için sahaya dokun; ok tuşlarıyla da taşıyabilirsin."></svg>
      <div class="field-caption"><span>↑ Sarı hücum yönü <span class="blue-label">Mavi ↓</span></span><span id="ball-source">Otomatik top</span></div>
    </section>
    <section class="transport" aria-label="Simülasyon kontrolü"><button class="play-button" data-command="play" aria-label="Simülasyonu durdur">Ⅱ <span>Duraklat</span></button><div class="speed-options" aria-label="Hız">${MATCH_SIM_DATA.lab.speeds.map(speed => `<button data-command="speed" data-speed="${speed}" aria-pressed="${speed === 1}">${String(speed).replace('.', ',')}×</button>`).join('')}</div><label class="auto-switch"><input id="lab-auto" type="checkbox" checked> Otomatik</label></section>
    <div class="possession"><span>TOP KİMDE?</span>${MATCH_SIM_DATA.lab.teams.map(team => `<button data-command="owner" data-team="${team.id}" class="team-${team.id}" aria-pressed="${team.id === 'home'}"><i></i>${team.label}</button>`).join('')}</div>
    <details class="lab-settings" open><summary>Deney ayarları <span>Her iki takıma uygulanır</span></summary><div class="settings-grid">
      <label>Pres yoğunluğu<select id="lab-press"></select></label><label>Savunma hattı<select id="lab-line"></select></label>
      <label>Sarı diziliş<select id="lab-formation"></select></label><label>Mavi diziliş<select id="lab-away-formation"></select></label>
      <form id="lab-seed-form"><label>Tohum<input id="lab-seed" type="number" min="0" step="1" value="${MATCH_SIM_DATA.lab.defaultSeed}" inputmode="numeric" required></label><button type="submit" aria-label="Tohumla deneyi yeniden başlat">Yeniden kur ↻</button></form>
    </div><p class="settings-note">Pres ve hat canlı değişir. Diziliş ve tohum deneyi yeniden kurar.</p></details>
    <section class="layer-panel" aria-label="Görünür katmanlar">${[['roles','Roller',true],['shape','Hatlar ve blok',true],['velocity','Hız okları',false],['anchors','Çapalar',false]].map(([key, label, checked]) => `<label><input type="checkbox" data-layer="${key}" ${checked ? 'checked' : ''}>${label}</label>`).join('')}</section>
    <p class="role-key"><b>B</b> Basan <b>Ö</b> Örten <b>M</b> Markaj <b>H</b> Hat <b>D</b> Destek <b>K</b> Koşu <b>KL</b> Kaleci</p>
    <p id="lab-error" class="lab-error" role="alert" hidden></p><footer class="lab-footer"><span>0,1 sn sabit adım · Konumdan doğan hareket</span><p>Bu bir topsuz hareket deneyi. Otomatik top bir senaryodur; pas, şut ve müdahale motoru henüz yok. Kariyer kaydına erişmez.</p></footer>`;
}

function populateLabSelects(root) {
  const tactics = labTacticOptions();
  fillSelect(root, '#lab-press', { values: tactics.press, selected: MATCH_SIM_DATA.lab.defaultPress });
  fillSelect(root, '#lab-line', { values: tactics.line, selected: MATCH_SIM_DATA.lab.defaultLine });
  for (const id of ['#lab-formation', '#lab-away-formation']) fillSelect(root, id, { values: Object.keys(MATCH_SIM_DATA.formations), selected: MATCH_SIM_DATA.lab.defaultFormation });
}

function fillSelect(root, selector, options) {
  root.querySelector(selector).innerHTML = options.values.map(value => `<option ${value === options.selected ? 'selected' : ''}>${value}</option>`).join('');
}

export function showLaboratoryControls(view, snapshot) {
  const { root } = view;
  const play = root.querySelector('[data-command="play"]');
  play.innerHTML = snapshot.running ? 'Ⅱ <span>Duraklat</span>' : '▶ <span>Devam et</span>';
  play.setAttribute('aria-label', snapshot.running ? 'Simülasyonu durdur' : 'Simülasyonu başlat');
  root.querySelector('#lab-status').textContent = snapshot.running ? 'ÇALIŞIYOR' : 'DURAKLATILDI';
  root.querySelector('#lab-auto').checked = snapshot.automatic;
  root.querySelector('#ball-source').textContent = snapshot.automatic ? 'Otomatik top · Senaryo' : 'Elle yerleştirildi';
  for (const button of root.querySelectorAll('[data-speed]')) button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === snapshot.speed));
  for (const button of root.querySelectorAll('[data-team]')) button.setAttribute('aria-pressed', String(button.dataset.team === snapshot.simulation.ball.teamId));
  const clock = root.querySelector('#lab-clock');
  clock.textContent = formatLabClock(snapshot.simulation.time);
  clock.dataset.tick = String(snapshot.simulation.tick);
}

function formatLabClock(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${String(minutes).padStart(2, '0')}:${remainder}`;
}
