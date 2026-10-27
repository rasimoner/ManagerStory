# Kod düzeni

Refactor C (V7.9.13 üzerinde), D ile devam (V7.10.0 üzerinde). Kod hâlâ `dist` içinde, build yok; `src/` ve Vite son adımda (E).
Kural: çekirdek modları tanımaz; bağımlılık sadece moddan çekirdeğe akar. D'den beri bu bir test (`tests/structure.test.cjs`): hiçbir `core/` modülü `modes/`'tan bir şey almaz. Çekirdeğin bir modun yapmasını istediği şey `core/hooks.js` üzerinden söylenir, `main.js` modu bağlar (aşağıda "Çekirdeğin söyledikleri"). Hangi dosyanın nerede olduğu bu tabloda; yeri değişen dosyada bu tablo da güncellenir.

## dist/core — ortak çekirdek (her mod kullanır)

| Dosya | Önceki yer | Ne | Neden burada |
|---|---|---|---|
| `core/state.js` | (yeni, C3) | Paylaşılan durum: `S` (kariyer), `M` (canlı maç), `modal` (açık ekran), `loadError`; sadece `setCareer`/`setMatch`/`setModal`/`setLoadError` ile değişir | Herkesin okuduğu durum tek yerde |
| `core/presentation/registry.js` | (yeni, C3) | Sunum parçaları için yuvalar: `presentation.live3d`, `.view`, `.newView`, `.career3d`, `.starScene` (eskiden `window.ManagerStory…`) | Oyun sunuma `window` yerine buradan ulaşır |
| `core/hooks.js` | (yeni, C3) | Genişletme noktaları: `onHook`/`runHooks`; D4'ten beri çekirdeğin moda söyledikleri de (`changed`, `careerOpened`, `seasonStarted`…) | Ortak altyapı; çekirdek modu çağırmaz, söyler |
| `core/random.js` | `random.js` | Tohumlanabilir tek rastgele üretici (`R`) | Motorun ve kariyerin tek rastgelelik kaynağı |
| `core/save.js` | `save.js` | Kayıt yükleme/kaydetme, dışa/içe aktarma, taşıma zinciri; `save()` (D4.1, `app.js`'ten) | Kayıt ortak; mod alanları zamanla ayrı bölüme |
| `core/inbox.js` | `app.js` (D5) | Kariyerin gelen kutusu (`pushInbox`) | Her kariyerin mesajları olur; çizimi modda |
| `core/engine/match-minute.js` | `app.js` (D1) | Motorun kalbi: maçın bir dakikası (`tick`), atak (`chance`, `seqText`), sahadaki gücü (`strength`), şansı kimin bulacağı (`attacker`), topun kimde olduğu (`setUserOwner`/`setOppOwner`), rakip diziliş noktaları (`oppRadarPos`), oyuncunun oynadığı role uyumu (`positionPenaltyV61`) | Gövdeler aynen; aynı tohumlu çekilişler aynı sırada |
| `core/engine/match-support.js` | `match-support.js` | Maç durumu, maç olayları, faul/kart, taktik etkileri, maç özeti, oyuncu talimatı seçenekleri (`matchOrderOptions`, D4) | Motorun durum ve olay tarafı. Maç paneli arayüzü ve ana ekran kabuğu D4'te moda gitti |
| `core/engine/user-team.js` | (yeni, D4) | Maçta kullanıcının takımı hangisi: `userClub()`, `userSquad()`, `userOpponent()`; mod `setUserTeam()` ile söyler. Varsayılan: yönetilen kulüp ve kariyerin kadrosu | Motor "bizim takım = yönetilen takım" varsaymaz |
| `core/engine/live-match.js` | `live-match.js` | Maç saati, canlı döngü, maç bitişi | Motorun zaman tarafı. Bağırma (`shoutLive`) D4'te moda gitti; asistan metinleri hâlâ burada |
| `core/engine/pitch-v73.js` | `pitch-v73.js` | Dakika eylemleri: pas, çalım, orta, ofsayt, şut | Motorun ~900 satırı. D'de ayrılacak: baştaki 2D saha çizimi → `core/presentation/match2d` |
| `core/engine/pitch-v731.js` | `pitch-v731.js` | Özellik modeli, yorgunluk, ikili mücadele, duran toplar, serbest top | Motorun ikinci yarısı |
| `core/players/moves.js` | `app.js` (D5) | Özel hareketlerin adları (`SKILL_NAMES`) ve oyuncunun şu an açık hareketleri (`movesNow`) | Oyuncu modeli |
| `core/players/player-profiles.js` | `player-profiles.js` | Oyuncu tipi, özellik profili, antrenman odağı; başlangıç kadrosundaki oyuncu ve onun rakip stiline göre avantajı (`startingPlayer`, `styleEdge`, D1) | Oyuncu modeli; DOM ve kayıt bilgisi yok |
| `core/league/league.js` | `app.js` (D2–D3) | Lig: rakip kulüp satırları (`OPP`), takımlar, çift devreli fikstür, bu turun maçı ve rakibi (`currentFixture`, `currentOpponent`), turun diğer maçları (`simAIGame`, `simulateRoundOthers`), puan tablosu ve form | Her mod aynı ligi oynar |
| `core/clubs/clubs.js` | `app.js` (D2) | Kulüp kimliği: renkler ve desen (`CLUBSTYLE`), arma, taraftar fotoğrafı, kariyerin kulübü (`managedClubName`), ekranın ve maçın gösterdiği kimlik (`resolveClubIdentity`) | `data/clubs.js`'ten; mod bilmez |
| `core/league/opponents-v731.js` | `opponents-v731.js` | Rakip kadroları, lig seviyesi | Lig |
| `core/season/season.js` | `season.js` | Sezon sonu adım hattı, kurallar (yaşlanma, emeklilik, gelişim, kulüpten ayrılma), sezon özeti verisi, rakip kadroların yenilenmesi, yeni sezon | Sezon hattı ortak. Teknik direktör adımları ve ekranları D5'te moda gitti; `summary` adımı `screen: true` (ekranı mod çizer) |
| `core/presentation/match3d/match3d-newview.js` | `match3d-newview.js` | 3D maç görünümü ile oyun arasındaki köprü, HUD, tekrar | Sunum |
| `core/presentation/match3d/match3d-live-clock.js` | `match3d-live-clock.js` | Sunum saati, 2D/3D akış zamanlaması | Sunum (`data-layer="clock"`) |
| `core/presentation/match3d/match-view-adapter.js` | `match-view-adapter.js` | Motor durumunun salt-okunur kopyası | Sunumun motoru okuduğu sınır (`data-layer="view"`) |
| `core/presentation/match3d/match3d-career.css` | `match3d-career.css` | 3D maç stilleri | Köprü modülü yanında yükler (`import.meta.url`) |
| `core/presentation/match3d/newview/*.js` | `newview/*.js` | 3D: iskelet, mesh, hareketler, stadyum, kamera, yönetmen, tekrar | Sunum; kariyerden habersiz |
| `core/presentation/scenes/star-transfer-scene.js` | `star-transfer-scene.js` | 3D yıldız transfer sahnesi (tünel, gösteri) | Sahne ortak; tetikleyici modda |

## dist/modes/manager — teknik direktör modu

| Dosya | Önceki yer | Ne | Neden burada |
|---|---|---|---|
| `modes/manager/app.js` | `app.js` | Kariyer döngüsü, transfer, akademi, kadro/taktik/diziliş ekranları, gelen kutusu ekranı, `choose`, ekran yönlendirme ve ana ekran kabuğu (`goMain`, `setScreenMode`, `decorateMainScreen`, D4) | Çoğu teknik direktöre özgü. Motor kalbi, lig ve kulüp kimliği D1–D3'te çekirdeğe taşındı. Kalan: gelişim → `core/players`, header ve alt menü → `ui` |
| `modes/manager/match-panel.js` | `match-support.js`, `live-match.js` (D4) | Maç paneli: istatistik, ayrıntı ve kondisyon sekmeleri, maçta ve planda taktik ile takım talimatları, asistan önerileri, bağırma, düğmeleri | Teknik direktörün maç ekranı; motor sadece seçimin sonucunu (taktik olayı, maç durumu) alır |
| `modes/manager/match-career.js` | (yeni, D4) | Maçın kariyerdeki karşılığı: sezon golleri, kartlar, dakikalar, ilk maç; golün ve ilk maçın moral/formu. Motorun olaylarından (`matchEvent` kancası) ve `minutePlayed`'den, aynı anda yazar | Motor kariyere yazmaz, ne olduğunu söyler |
| `modes/manager/season-end.js` | `season.js` (D5) | Teknik direktörün sezon sonu adımları (`report`, `contracts`, `academy`, `market`, `cleanup`; hatta id ile eski yerlerine), yeni sezonun onun için anlamı (ödül, başkan, yönetim, saat), sezon sonu ekranları | Adımların id'si ve sırası aynı: yarıda kalmış kayıt aynı adımdan devam eder |
| `modes/manager/career-events.js` | `career-events.js` | Basın soruları, oyuncu görüşmeleri, konuşmanın etkisi (`applyConversationEffect`, D4) | Teknik direktöre özgü |
| `modes/manager/star-transfer.js` | `star-transfer.js` | Yıldız transfer akışı (duyuru, imza, forma), highlight kaydı | Akış teknik direktöre özgü. D'de ayrılacak: highlight kaydı → `core/highlights` |

## dist/ui — ortak arayüz

| Dosya | Önceki yer | Ne |
|---|---|---|
| `ui/actions.js` | (yeni, C2) | Tek olay dağıtıcı: `data-action` ile isimli eylemler, değerler `data-*` özniteliklerinde |
| `ui/nav.js` | `nav.js` | Gezinme: geri, kaydırma konumu, sekme |
| `ui/webmcp.js` | `webmcp.js` | Tarayıcı model bağlamına salt-okunur kariyer aracı |

Header (`header`), alt menü (`bottomNav`), ekran kabuğu (`render`) ve listeler bugün `app.js` içinde; D'de buraya gelir.

## Giriş noktası (C3)

`dist/main.js`: sayfa açılınca olan her şey burada, bu sırayla: kariyeri yükle, olay dağıtıcısını, arka plan duraklatmasını, yıldız transferini ve gezinmeyi kur, ilk ekranı çiz, tarayıcı aracını kaydet. Diğer dosyalar sadece tanımlar (ve eylemlerini, sezon sonu adımlarını, kancalarını kaydeder). `tests/structure.test.cjs` bunu ve hiçbir dosyanın başka dosyanın fonksiyonunu çalışma anında değiştirmediğini denetler.

## Çekirdeğin söyledikleri (D4–D5)

Çekirdek bir modun fonksiyonunu çağırmaz; olan şeyi söyler. `main.js` teknik direktör modunu bağlar (kariyeri açmadan önce). Her biri tek işleyiciyle, eski çağrının durduğu anda çalışır; bu yüzden hiçbir şey başka bir anda çizilmez ya da yazılmaz.

| Söylenen | Kim söyler | Teknik direktör modunda |
|---|---|---|
| `changed()` | maç saati, maç kontrolleri, 2D/3D sunum, kayıt içe aktarma, sezon sonu "devam" | `render` |
| `careerOpened()` | kayıt içe aktarma | `init` |
| `decisionsRequested()` | 3D görünümün "Değiştir" düğmesi | `openDecisionSheet` |
| `opponentsEvolved()` | rakip kadroların haftalık gelişimi, sezon sonu yenilemesi | `syncWonderOffers` |
| `seasonStarted(summary)` | sezon sonunun `newSeason` adımı | `managerSeasonStarted` (lig ödülü, başkanın mektubu, yönetimin sorusu, saat) |
| `minutePlayed(player)` | maçın her dakikası, sahadaki her oyuncumuz için | `recordMinutePlayed` (sezon dakikası) |
| `matchEvent` kancası | her maç olayı, yapılırken | `recordMatchEvent` (gol, kart, ilk maç) |

Motorun kariyerde kendisinin yazdığı ve maç içinde geri okuduğu iki şey kaldı: kondisyon (her dakika düşer, `strength` ve özellikler okur) ve sakatlık (değişiklik uygunluğu okur). Bunlar oyuncunun maçtaki fiziksel durumu; ayrılmaları maça özel bir kadro kopyası ister (oyuncu kariyeri moduyla).

Genişletme noktaları (`core/hooks.js`):

| An | Kim çalıştırır | Kim kaydolur |
|---|---|---|
| `beforeSigning(x)`, `afterSigning(player, x, fee)` | `v6Sign` (app.js) | yıldız transfer sahnesi (star-transfer.js) |
| `transferListShown()` | `showV6Transfers` (app.js) | geçici "Transfer sahnesi dene" kartı (star-transfer.js) |
| `goMain(section)` → `true`: işlendi | `goMain` (match-support.js) | aktif sekmeye dokunma (nav.js) |
| `navBack()` | geri düğmesi eylemi (app.js) | kaydırma konumuna dönüş (nav.js) |
| `screenDrawn()` | `header` (app.js) | ekran yerleşince kaydırma ve ↑ düğmesi (nav.js) |

## Yerinde kalanlar

- `data/*.js`: oyun verisi (JSON değerler).
- `index.html`, `sw.js`, `manifest.json`, ikonlar, `style.css`, `assets/`, `vendor/three/` (E'de npm'e geçer).

## Ekrandaki düğmeler (C2)

- Satır içi `onclick`/`onchange` yok. Bir düğme yaptığı işi isimle, değerlerini `data-*` ile taşır: `<button data-action="showPlayerProfile" data-id="12">`.
- Eylemi ekranı çizen dosya kaydeder: `defineActions({ showPlayerProfile: d => showPlayerProfile(+d.id) })`. Değerler metin gelir; sayıya eylem çevirir.
- Düğmeler tıklamada, form öğeleri (select, input) değişimde çalışır. Tıklanan öğe ile sayfa arasındaki her eylem içten dışa çalışır (eski satır içi işleyiciler gibi).
- Geri düğmesi gittiği eylemi adlandırır: `header(['Kadro','openSquad'])`, değerleriyle `header(['Oyuncu','lineupPlayer',{id}])`.
- Testlerde: `loadGame().click('eylem', {değerler})` ekranda çizilmiş düğmeye basar; `tests/actions.test.cjs` her çizilen eylemin kayıtlı olduğunu ve hiç satır içi işleyici kalmadığını denetler.

## ES modülleri (C3)

- Sayfada klasik script yok. `index.html` dört modül girişi yükler: `main.js` (oyun) ve sunum katmanları `core/presentation/match3d/match3d-live-clock.js` (`data-layer="clock"`), `match-view-adapter.js` (`view`), `modes/manager/match-3d.js` (`3d`: 3D görünümü yükler, olmazsa 2D).
- Her dosya neyi nereden aldığını `import` ile söyler; üst düzey her tanım `export` edilir (D'de dışa açık olanlar daralacak).
- Paylaşılan durum `core/state.js`'te; başka modülün değişkenine atama yapılamaz, ayarlayıcılar kullanılır. `window` üzerinde oyuna ait bir şey yok; tek istisna yıldız sahnesinin otomasyon için zaman ölçeği `window.__stsTimeScale`. three.js `dist/vendor`'dan modül olarak gelir (E'de npm).
- `core/` henüz `modes/manager`'dan bazı şeyler alıyor (D3 sonunda 7 dosyada 36 ad; C sonunda 11 dosyada 63). Liste `tests/structure.test.cjs` içinde sabit; sadece kısalabilir, D'de sıfırlanır.
- Testler aynı modülleri `vm.SourceTextModule` ile yükler (`tests/support/game.cjs`); `npm test` gereken `--experimental-vm-modules` bayrağını verir. Tek dosya için: `NODE_OPTIONS=--experimental-vm-modules node --test tests/<dosya>`.
- Service worker girişleri `?v=<sürüm>` ile, içe aktarılan modülleri yalın adıyla listeler.

## Testlerin oyuna erişimi (D0)

- Testler oyuna tek erişim noktasından, adla ulaşır, dosyayla değil: `loadGame()` her modülün her export'unu tek nesnede toplar (`g.api.ad`; aynı adlar `run('…')` için bağlamın globalleri). Her ad, bugün hangi modüldeyse oradan canlı okunur; `g.owner(ad)` yerini söyler. Bir fonksiyon başka modüle taşınınca hiçbir test değişmez.
- Kod okuyan testler de adla bulur: `sourceDefining(ad)` adı tanımlayan modül, `scriptsDefining([...])`, `gameSources()`.
- `tests/structure.test.cjs` hiçbir testin oyun modülünü dosya adıyla (`readDist`/`locate`) okumadığını denetler. Sunum katmanının dosyaları (3D) istisna: kendi dosyaları konuları.
- Aynı adı iki modül export ederse yükleyici hata verir (erişim noktası hangisini kastettiğini bilemez).

## Sürüm damgası (D)

- D'nin modül yolları V7.10.0 ile aynı, içerikleri farklı. Tarayıcı HTTP önbelleğinden eski bir modülü yeni sayfayla karıştırmasın diye her oyun modülü içe aktarması sürümü taşır: `import { S } from './core/state.js?v=7.10.0'`. Giriş dosyaları ve `sw.js` listesi de aynı adresleri taşır.
- Bir ES modülü adresi başına tek örnektir: bir dosyanın bütün içe aktarmaları aynı adresi kullanmalı. Bu yüzden hepsini `node tools/stamp-version.cjs` tek sürümden basar; `--check` eksik ya da eski damgada hata verir, `tests/version-labels.test.cjs` onu çalıştırır. `vendor/` yalın kalır.
- Yeni modül ya da yeni içe aktarma eklendikten sonra `node tools/stamp-version.cjs` çalıştırılır. Yayında sürüm yükseltilince (`package.json` ve etiketler) aynı komut her şeyi yeni sürüme taşır.
- E'de Vite'ın içerik hash'leri bunun yerini alır.

## Yolları etkileyen kurallar

- Test yükleyicisi modül listesini `index.html` girişlerinden ve importlardan çıkarır (`tests/support/game.cjs`).
- ES modüllerinin importları ve `new URL(..., import.meta.url)` dosyanın kendi yerine göredir.
- Bir modüldeki `import('...')` o modülün adresine göre çözülür.
- Görsel yolları (`assets/...`) sayfaya göredir; scriptin yeri değişince değişmez.
- Testler tek dosya okurken `locate(ad)` / `readDist(ad)` kullanır (`tests/support/game.cjs`): dosya klasör değiştirince test değişmez.
