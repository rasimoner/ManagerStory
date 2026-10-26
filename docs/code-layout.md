# Kod düzeni

Refactor C (V7.9.13 üzerinde). Kod hâlâ `dist` içinde, build yok; `src/` ve Vite son adımda (E).
Kural: çekirdek modları tanımaz; bağımlılık sadece moddan çekirdeğe akar. Bugün dosyalar bütün olarak taşındı, içleri bölünmedi: bazı dosyalar birden çok işi taşıyor (aşağıda "D'de ayrılacak"). Hangi dosyanın nerede olduğu bu tabloda; yeri değişen dosyada bu tablo da güncellenir.

## dist/core — ortak çekirdek (her mod kullanır)

| Dosya | Önceki yer | Ne | Neden burada |
|---|---|---|---|
| `core/random.js` | `random.js` | Tohumlanabilir tek rastgele üretici (`R`) | Motorun ve kariyerin tek rastgelelik kaynağı |
| `core/save.js` | `save.js` | Kayıt yükleme/kaydetme, dışa/içe aktarma, taşıma zinciri | Kayıt ortak; mod alanları zamanla ayrı bölüme |
| `core/engine/match-support.js` | `match-support.js` | Maç durumu, maç olayları, faul/kart, taktik etkileri, maç özeti | Motorun durum ve olay tarafı. D'de ayrılacak: maç paneli arayüzü (`matchStatsUI`, `tacticsControls`…), `goMain`, `decorateMainScreen` |
| `core/engine/live-match.js` | `live-match.js` | Maç saati, canlı döngü, maç bitişi | Motorun zaman tarafı. D'de ayrılacak: asistan metinleri, bağırma |
| `core/engine/pitch-v73.js` | `pitch-v73.js` | Dakika eylemleri: pas, çalım, orta, ofsayt, şut | Motorun ~900 satırı. D'de ayrılacak: baştaki 2D saha çizimi → `core/presentation/match2d` |
| `core/engine/pitch-v731.js` | `pitch-v731.js` | Özellik modeli, yorgunluk, ikili mücadele, duran toplar, serbest top | Motorun ikinci yarısı |
| `core/players/player-profiles.js` | `player-profiles.js` | Oyuncu tipi, özellik profili, antrenman odağı | Oyuncu modeli; DOM ve kayıt bilgisi yok |
| `core/league/opponents-v731.js` | `opponents-v731.js` | Rakip kadroları, lig seviyesi | Lig |
| `core/season/season.js` | `season.js` | Sezon sonu adım hattı, yaşlanma, emeklilik, rakip ve pazar yenileme | Sezon hattı ortak. D'de ayrılacak: teknik direktör adımları (`report`, `contracts`, `academy`, `market`) ve sezon sonu ekranları |
| `core/presentation/match3d/match3d-newview.js` | `match3d-newview.js` | 3D maç görünümü ile oyun arasındaki köprü, HUD, tekrar | Sunum |
| `core/presentation/match3d/match3d-live-clock.js` | `match3d-live-clock.js` | Sunum saati, 2D/3D akış zamanlaması | Sunum (`data-layer="clock"`) |
| `core/presentation/match3d/match-view-adapter.js` | `match-view-adapter.js` | Motor durumunun salt-okunur kopyası | Sunumun motoru okuduğu sınır (`data-layer="view"`) |
| `core/presentation/match3d/match3d-career.css` | `match3d-career.css` | 3D maç stilleri | Köprü modülü yanında yükler (`import.meta.url`) |
| `core/presentation/match3d/newview/*.js` | `newview/*.js` | 3D: iskelet, mesh, hareketler, stadyum, kamera, yönetmen, tekrar | Sunum; kariyerden habersiz |
| `core/presentation/scenes/star-transfer-scene.js` | `star-transfer-scene.js` | 3D yıldız transfer sahnesi (tünel, gösteri) | Sahne ortak; tetikleyici modda |

## dist/modes/manager — teknik direktör modu

| Dosya | Önceki yer | Ne | Neden burada |
|---|---|---|---|
| `modes/manager/app.js` | `app.js` | Kariyer döngüsü, transfer, akademi, kadro/taktik/diziliş ekranları, gelen kutusu, `choose`, ekran yönlendirme | Çoğu teknik direktöre özgü. D'de ayrılacak: motor kalbi (`tick`, `chance`, `strength`…) → `core/engine`, lig (`allTeams`, `simAIGame`…) → `core/league`, kulüp kimliği → `core/clubs`, gelişim → `core/players`, ekran kabuğu ve header → `ui` |
| `modes/manager/career-events.js` | `career-events.js` | Basın soruları, oyuncu görüşmeleri | Teknik direktöre özgü |
| `modes/manager/star-transfer.js` | `star-transfer.js` | Yıldız transfer akışı (duyuru, imza, forma), highlight kaydı | Akış teknik direktöre özgü. D'de ayrılacak: highlight kaydı → `core/highlights` |

## dist/ui — ortak arayüz

| Dosya | Önceki yer | Ne |
|---|---|---|
| `ui/actions.js` | (yeni, C2) | Tek olay dağıtıcı: `data-action` ile isimli eylemler, değerler `data-*` özniteliklerinde |
| `ui/nav.js` | `nav.js` | Gezinme: geri, kaydırma konumu, sekme |
| `ui/webmcp.js` | `webmcp.js` | Tarayıcı model bağlamına salt-okunur kariyer aracı |

Header (`header`), alt menü (`bottomNav`), ekran kabuğu (`render`) ve listeler bugün `app.js` içinde; D'de buraya gelir.

## Yerinde kalanlar

- `data/*.js`: oyun verisi (JSON değerler).
- `index.html`, `sw.js`, `manifest.json`, ikonlar, `style.css`, `assets/`, `vendor/three/` (E'de npm'e geçer).

## Ekrandaki düğmeler (C2)

- Satır içi `onclick`/`onchange` yok. Bir düğme yaptığı işi isimle, değerlerini `data-*` ile taşır: `<button data-action="showPlayerProfile" data-id="12">`.
- Eylemi ekranı çizen dosya kaydeder: `defineActions({ showPlayerProfile: d => showPlayerProfile(+d.id) })`. Değerler metin gelir; sayıya eylem çevirir.
- Düğmeler tıklamada, form öğeleri (select, input) değişimde çalışır. Tıklanan öğe ile sayfa arasındaki her eylem içten dışa çalışır (eski satır içi işleyiciler gibi).
- Geri düğmesi gittiği eylemi adlandırır: `header(['Kadro','openSquad'])`, değerleriyle `header(['Oyuncu','lineupPlayer',{id}])`.
- Testlerde: `loadGame().click('eylem', {değerler})` ekranda çizilmiş düğmeye basar; `tests/actions.test.cjs` her çizilen eylemin kayıtlı olduğunu ve hiç satır içi işleyici kalmadığını denetler.

## Yolları etkileyen kurallar

- Sayfa scriptleri `index.html` sırasıyla yüklenir; test yükleyicisi listeyi oradan okur (`tests/support/game.cjs`).
- ES modüllerinin importları ve `new URL(..., import.meta.url)` dosyanın kendi yerine göredir.
- Bir scriptteki `import('...')` o scriptin adresine göre çözülür.
- Görsel yolları (`assets/...`) sayfaya göredir; scriptin yeri değişince değişmez.
- Testler tek dosya okurken `locate(ad)` / `readDist(ad)` kullanır (`tests/support/game.cjs`): dosya klasör değiştirince test değişmez.
