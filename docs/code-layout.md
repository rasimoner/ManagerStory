# Kod düzeni

Refactor C (V7.9.13 üzerinde), D (V7.10.0 üzerinde), E1/E7/E8 (V7.11.0 üzerinde), E2–E6 (V7.12.0 üzerinde: Vite). Kaynak `src/`'te, olduğu gibi yayınlananlar `public/`'te; `dist/` sadece build çıktısı (`npm run build`), depoda değil. Katmanlar ve akışlar: `docs/architecture.md`.
Kural: çekirdek modları tanımaz; bağımlılık sadece moddan çekirdeğe akar. D'den beri bu bir test (`tests/structure.test.cjs`): hiçbir `core/` modülü `modes/`'tan bir şey almaz. Çekirdeğin bir modun yapmasını istediği şey `core/hooks.js` üzerinden söylenir, `main.js` modu bağlar (aşağıda "Çekirdeğin söyledikleri"). Hangi dosyanın nerede olduğu bu tabloda; yeri değişen dosyada bu tablo da güncellenir.

## src/core — ortak çekirdek (her mod kullanır)

| Dosya | Önceki yer | Ne | Neden burada |
|---|---|---|---|
| `core/state.js` | (yeni, C3) | Paylaşılan durum: `S` (kariyer), `M` (canlı maç), `modal` (açık ekran), `loadError`; sadece `setCareer`/`setMatch`/`setModal`/`setLoadError` ile değişir | Herkesin okuduğu durum tek yerde |
| `core/presentation/registry.js` | (yeni, C3) | Sunum parçaları için yuvalar: `presentation.live3d`, `.view`, `.newView`, `.career3d`, `.starScene` (eskiden `window.ManagerStory…`) | Oyun sunuma `window` yerine buradan ulaşır |
| `core/hooks.js` | (yeni, C3) | Genişletme noktaları: `onHook`/`runHooks`; D4'ten beri çekirdeğin moda söyledikleri de (`changed`, `careerOpened`, `seasonStarted`…) | Ortak altyapı; çekirdek modu çağırmaz, söyler |
| `core/random.js` | `random.js` | Tohumlanabilir tek rastgele üretici (`R`) | Motorun ve kariyerin tek rastgelelik kaynağı |
| `core/save.js` | `save.js` | Kayıt yükleme/kaydetme, dışa/içe aktarma, taşıma zinciri; `save()` (D4.1, `app.js`'ten) | Kayıt ortak; mod alanları zamanla ayrı bölüme |
| `core/inbox.js` | `app.js` (D5) | Kariyerin gelen kutusu (`pushInbox`) | Her kariyerin mesajları olur; çizimi modda |
| `core/engine/match-minute.js` | `app.js` (D1) | Motorun kalbi: maçın bir dakikası (`tick`), atak (`chance`, `seqText`), sahadaki gücü (`strength`), şansı kimin bulacağı (`attacker`), topun kimde olduğu (`setUserOwner`/`setOppOwner`), rakip diziliş noktaları (`oppRadarPos`), oyuncunun oynadığı role uyumu (`positionPenalty`) | Gövdeler aynen; aynı tohumlu çekilişler aynı sırada |
| `core/engine/match-support.js` | `match-support.js` | Maç durumu, maç olayları, faul/kart, taktik etkileri, maç özeti, oyuncu talimatı seçenekleri (`matchOrderOptions`, D4) | Motorun durum ve olay tarafı. Maç paneli arayüzü ve ana ekran kabuğu D4'te moda gitti |
| `core/engine/user-team.js` | (yeni, D4) | Maçta kullanıcının takımı hangisi: `userClub()`, `userSquad()`, `userOpponent()`; mod `setUserTeam()` ile söyler. Varsayılan: yönetilen kulüp ve kariyerin kadrosu | Motor "bizim takım = yönetilen takım" varsaymaz |
| `core/engine/tactics.js` | `match-support.js`, `match-panel.js` (E1) | Taktiklerin dili: ayarlar (`MATCH_TACTICS`), adları (`TACTIC_LABELS`), takım talimatları (`TEAM_ORDERS`) | Sadece veriden; oyun modülü almaz, döngüde hangi modül önce çalışırsa çalışsın hazır |
| `core/engine/live-match.js` | `live-match.js` | Maç saati, canlı döngü, maç bitişi | Motorun zaman tarafı. Bağırma (`shoutLive`) D4'te moda gitti; asistan metinleri hâlâ burada |
| `core/engine/pitch-v73.js` | `pitch-v73.js` | Dakika eylemleri: pas, çalım, orta, ofsayt, şut | Motorun ~900 satırı. D'de ayrılacak: baştaki 2D saha çizimi → `core/presentation/match2d` |
| `core/engine/pitch-v731.js` | `pitch-v731.js` | Özellik modeli, yorgunluk, ikili mücadele, duran toplar, serbest top | Motorun ikinci yarısı |
| `core/players/moves.js` | `app.js` (D5) | Oyuncunun şu an açık hareketleri (`movesNow`) | Oyuncu modeli |
| `core/players/move-names.js` | `core/players/moves.js` (E1) | Özel hareketlerin adları (`SKILL_NAMES`) | Sadece veriden (döngüden bağımsız) |
| `core/players/player-profiles.js` | `player-profiles.js` | Oyuncu tipi, özellik profili, antrenman odağı; başlangıç kadrosundaki oyuncu ve onun rakip stiline göre avantajı (`startingPlayer`, `styleEdge`, D1) | Oyuncu modeli; DOM ve kayıt bilgisi yok |
| `core/players/shirt-numbers.js` | (yeni, V7.13.2) | Forma numaraları: kadroda alınmış ve boş numaralar, yeni gelene boş numara (`giveShirtNumber`), numarasız bir kadroyu görünen numaralarıyla numaralandırma (`numberSquadKeepingShown`, kayıt taşıması) | Saf, kadro parametre; kayıt zinciri de kullandığı için sadece veriyi alır |
| `core/league/league.js` | `app.js` (D2–D3) | Lig: takımlar, çift devreli fikstür, bu turun maçı ve rakibi (`currentFixture`, `currentOpponent`), turun diğer maçları (`simAIGame`, `simulateRoundOthers`), puan tablosu ve form | Her mod aynı ligi oynar |
| `core/league/rivals.js` | `league.js`, `opponents-v731.js` (E1) | Rakip kulüp satırları (`OPP`), lig seviyesi (`LEAGUE_LIFT`), rakip kadro rolleri ve isimleri | Sadece veriden; lig ↔ kulüp ↔ sezon döngüsünde hangi modül önce çalışırsa çalışsın hazır |
| `core/clubs/clubs.js` | `app.js` (D2) | Kulüp kimliği: arma, taraftar fotoğrafı, kariyerin kulübü (`managedClubName`), ekranın ve maçın gösterdiği kimlik (`resolveClubIdentity`) | `data/clubs.json`'dan; mod bilmez |
| `core/clubs/club-style.js` | `core/clubs/clubs.js` (E1) | Kulüp renkleri ve desen (`CLUBSTYLE`) | Sadece veriden (döngüden bağımsız) |
| `core/version.js` | `match-support.js` (E1) | Kodun sürümü (`GAME_VERSION`, kayda yazılır, başlangıç ve ayarlar ekranında): `package.json`'ın `version`'ı (E2) | Sadece `package.json`'ı alır |
| `core/league/opponents-v731.js` | `opponents-v731.js` | Rakip kadroları (lig seviyesi E1'den beri `rivals.js`'te) | Lig |
| `core/season/season.js` | `season.js` | Sezon sonu adım hattı, kurallar (yaşlanma, emeklilik, gelişim, kulüpten ayrılma), sezon özeti verisi, rakip kadroların yenilenmesi, yeni sezon | Sezon hattı ortak. Teknik direktör adımları ve ekranları D5'te moda gitti; `summary` adımı `screen: true` (ekranı mod çizer) |
| `core/presentation/match3d/match3d-newview.js` | `match3d-newview.js` | 3D maç görünümü ile oyun arasındaki köprü, HUD, tekrar | Sunum |
| `core/presentation/match3d/match3d-live-clock.js` | `match3d-live-clock.js` | Sunum saati, 2D/3D akış zamanlaması | Sunum (`data-layer="clock"`) |
| `core/presentation/match3d/match-view-adapter.js` | `match-view-adapter.js` | Motor durumunun salt-okunur kopyası | Sunumun motoru okuduğu sınır (`data-layer="view"`) |
| `core/presentation/match3d/match3d-career.css` | `match3d-career.css` | 3D maç stilleri | Köprü modülü yanında yükler (`new URL(…, import.meta.url)`; build hash'li dosya olarak yayınlar) |
| `core/presentation/match3d/newview/*.js` | `newview/*.js` | 3D: iskelet, mesh, hareketler, stadyum, kamera, yönetmen, tekrar | Sunum; kariyerden habersiz |
| `core/presentation/match3d/newview/director.js` | `newview/director.js` | Yönetmen: motorun olay günlüğünü sahada oynatır (pas, şut, ikili mücadele, duran toplar); özel hareketleri `beats/`'e bir bağlamla (`beatContext`) devreder; `stage(kind, { seed })` bir hareketi maç dışında sahneler | V7.14.0'da 2654 → ~1550 satır |
| `core/presentation/match3d/newview/motion-curves.js`, `facing.js`, `stage-roster.js` | `director.js`, `star-transfer-scene.js` (V7.14.0) | Zamanlama eğrileri (`smooth01`, `ramp`, `spline`); oyuncunun yönleri (`forwardOf`, `rightOf`, `headingOf`); maç dışı sahnenin kadrosu (`stageRoster`) | Yönetmen, beat'ler ve sahneler ortak kullanır |
| `core/presentation/match3d/newview/beats/*.js` | `director.js` (V7.14.0) | Özel hareketlerin koreografisi, sorumluluğa göre: `feints` (makas, elastico, croqueta), `turns` (Cruyff, Marsilya), `through-the-legs` (bacak arası, flair bacak arası), `over-the-top` (gökkuşağı, aşırtma, sektirme), `flair-passes` (topuk, rabona), `first-touch` (ayakla öldürme, göğüs, Bergkamp), `bicycle-kick`, `keeper-hands` (yumruk, havada tutma), `keeper-volley`, `scorpion`; paylaşılanlar `footwork`, `duel-exit`; tablolar `skill-beats` ve maç dışı sahneleme `staging`, `staging-keeper`, `stage-pitch` | Beat, sahada ne olacağını değil nasıl görüneceğini söyler; sabit girdiyle anlık görüntüsü `tests/golden/beats/`'te. Bu klasörde bir fonksiyon 40 deyime kadar çıkabilir (gerekçe `eslint.config.js`'te) |
| `core/presentation/scenes/star-transfer-scene.js` | `star-transfer-scene.js` | 3D yıldız transfer sahnesi (tünel, gösteri) | Sahne ortak; tetikleyici modda |

## src/modes/manager — teknik direktör modu

| Dosya | Önceki yer | Ne | Neden burada |
|---|---|---|---|
| `modes/manager/app.js` | `app.js` | Kariyer döngüsü, transfer, akademi, kadro/taktik/diziliş ekranları, gelen kutusu ekranı, `choose`, ekran yönlendirme ve ana ekran kabuğu (`goMain`, `setScreenMode`, `decorateMainScreen`, D4) | Çoğu teknik direktöre özgü. Motor kalbi, lig ve kulüp kimliği D1–D3'te çekirdeğe taşındı. Kalan: gelişim → `core/players`, header ve alt menü → `ui` |
| `modes/manager/market-names.js` | `app.js` (E1) | Transfer piyasasının isimleri ve mevkileri (`MARKET_FIRST_NAMES`, `MARKET_LAST_NAMES`, `MARKET_POSITIONS`) | Sadece veriden; app ↔ season-end döngüsünden bağımsız |
| `modes/manager/lineup-slots.js` | `app.js` (E1) | Diziliş sahasında her yerin konumu (`SLOT_POS`) | İmportsuz |
| `modes/manager/match-panel.js` | `match-support.js`, `live-match.js` (D4) | Maç paneli: istatistik, ayrıntı ve kondisyon sekmeleri, maçta ve planda taktik ile takım talimatları, asistan önerileri, bağırma, düğmeleri | Teknik direktörün maç ekranı; motor sadece seçimin sonucunu (taktik olayı, maç durumu) alır |
| `modes/manager/match-career.js` | (yeni, D4) | Maçın kariyerdeki karşılığı: sezon golleri, kartlar, dakikalar, ilk maç; golün ve ilk maçın moral/formu. Motorun olaylarından (`matchEvent` kancası) ve `minutePlayed`'den, aynı anda yazar | Motor kariyere yazmaz, ne olduğunu söyler |
| `modes/manager/season-end.js` | `season.js` (D5) | Teknik direktörün sezon sonu adımları (`report`, `contracts`, `academy`, `market`, `cleanup`; hatta id ile eski yerlerine), yeni sezonun onun için anlamı (ödül, başkan, yönetim, saat), sezon sonu ekranları | Adımların id'si ve sırası aynı: yarıda kalmış kayıt aynı adımdan devam eder |
| `modes/manager/career-events.js` | `career-events.js` | Basın soruları, oyuncu görüşmeleri, konuşmanın etkisi (`applyConversationEffect`, D4) | Teknik direktöre özgü |
| `modes/manager/star-transfer.js` | `star-transfer.js` | Yıldız transfer akışı (duyuru, imza, forma), highlight kaydı | Akış teknik direktöre özgü. D'de ayrılacak: highlight kaydı → `core/highlights` |
| `modes/manager/wages.js` | `app.js`, `season-end.js` (V7.13.2) | Maaş: yeni sözleşme maaşı (`baseWage`), altyapı maaşı, maaş alanı (`wageBudget`, kulüp seviyesinden), maaş gideri (`wageBill`), kalan alan (`wageRoom`, `wageFits`) | Transfer ve sözleşme kararları teknik direktöre özgü; alan kayıtta durmaz |

## src/ui — ortak arayüz

| Dosya | Önceki yer | Ne |
|---|---|---|
| `ui/actions.js` | (yeni, C2) | Tek olay dağıtıcı: `data-action` ile isimli eylemler, değerler `data-*` özniteliklerinde |
| `ui/nav.js` | `nav.js` | Gezinme: geri, kaydırma konumu, sekme |
| `ui/webmcp.js` | `webmcp.js` | Tarayıcı model bağlamına salt-okunur kariyer aracı |
| `ui/updates.js` | `index.html` (E3) | Service worker'ı kaydeder (sadece build'de) ve yeni sürüm açık sayfayı devralınca "Yeni sürüm hazır" bildirimi |

Header (`header`), alt menü (`bottomNav`), ekran kabuğu (`render`) ve listeler bugün `app.js` içinde; D'de buraya gelir.

## Modül sırası (E1)

Paketleyici modülleri tarayıcıdan farklı sırayla çalıştırabilir (3D'yi ayrı parçaya da böler). Bu yüzden:
- Veriden hesaplanan sabitler (`OPP`, `CLUBSTYLE`, `SKILL_NAMES`, taktik dili, `GAME_VERSION`, piyasa isimleri, diziliş yerleri) sadece veri alan küçük modüllerde. Döngüdeki bir modül başkasının sabitini yükleme anında okursa, o modül henüz çalışmamışsa hata olur; bu sabitler döngüde değil.
- `tests/module-order.test.cjs`: her modül ilk çalışan olabilir (hiçbir değer modülü çalışmadan okunmaz); sezon sonu adımları, eylemler ve kancalar modüller hangi sırayla çalışırsa çalışsın aynı (main.js'in importları ters, alfabetik ve önce mod sırasıyla denenir). Yükleyicinin `first` seçeneği modülleri istenen sırayla çalıştırır.

## Giriş noktası (C3)

`src/main.js`: sayfa açılınca olan her şey burada, bu sırayla: kariyeri yükle, olay dağıtıcısını, arka plan duraklatmasını, yıldız transferini ve gezinmeyi kur, ilk ekranı çiz, tarayıcı aracını ve (build'de) service worker'ı kaydet. Diğer dosyalar sadece tanımlar (ve eylemlerini, sezon sonu adımlarını, kancalarını kaydeder). `tests/structure.test.cjs` bunu ve hiçbir dosyanın başka dosyanın fonksiyonunu çalışma anında değiştirmediğini denetler.

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
| `beforeSigning(x)`, `afterSigning(player, x, fee)` | `signTransfer` (app.js) | yıldız transfer sahnesi (star-transfer.js) |
| `goMain(section)` → `true`: işlendi | `goMain` (match-support.js) | aktif sekmeye dokunma (nav.js) |
| `navBack()` | geri düğmesi eylemi (app.js) | kaydırma konumuna dönüş (nav.js) |
| `screenDrawn()` | `header` (app.js) | ekran yerleşince kaydırma ve ↑ düğmesi (nav.js) |

## Dışarıdakiler

- `src/data/*.json`: oyun verisi (E4); her dosyanın ne tuttuğu `src/data/README.md`'de.
- `src/index.html` (sayfa), `src/style.css`, `src/sw.js` (service worker şablonu), `src/assets/models/footballer-rig.json` (3D iskelet; build hash'li yayınlar).
- `public/`: olduğu gibi yayınlananlar: `assets/atmosphere/` (ekranların yol ile andığı resimler), ikonlar, `manifest.json` (adındaki `%APP_VERSION%`'ı build doldurur), `.nojekyll`.
- `vite.config.js`: build. three.js npm'den (`three` 0.180.0; E5'te `vendor/` kalktı).
- Çalışma kuralları: `AGENTS.md` (tek kaynak; `CLAUDE.md` onu içe aktarır). Lint: `eslint.config.js` (eşikler ve gerekçeleri), `lint-baseline.json` (bugünkü ihlaller, sadece küçülür), `tools/lint/` (`lint.js` komut, `ratchet.js` taban mantığı, `no-commented-out-code.js` yorumdaki kod kuralı). Testleri: `tests/lint-ratchet.test.cjs`, `tests/lint-rules.test.cjs`.

## Ekrandaki düğmeler (C2)

- Satır içi `onclick`/`onchange` yok. Bir düğme yaptığı işi isimle, değerlerini `data-*` ile taşır: `<button data-action="showPlayerProfile" data-id="12">`.
- Eylemi ekranı çizen dosya kaydeder: `defineActions({ showPlayerProfile: d => showPlayerProfile(+d.id) })`. Değerler metin gelir; sayıya eylem çevirir.
- Düğmeler tıklamada, form öğeleri (select, input) değişimde çalışır. Tıklanan öğe ile sayfa arasındaki her eylem içten dışa çalışır (eski satır içi işleyiciler gibi).
- Geri düğmesi gittiği eylemi adlandırır: `header(['Kadro','openSquad'])`, değerleriyle `header(['Oyuncu','lineupPlayer',{id}])`.
- Testlerde: `loadGame().click('eylem', {değerler})` ekranda çizilmiş düğmeye basar; `tests/actions.test.cjs` her çizilen eylemin kayıtlı olduğunu ve hiç satır içi işleyici kalmadığını denetler.

## ES modülleri (C3)

- Sayfada klasik script yok. `src/index.html` dört modül girişi yükler: `main.js` (oyun) ve sunum katmanları `core/presentation/match3d/match3d-live-clock.js` (`data-layer="clock"`), `match-view-adapter.js` (`view`), `modes/manager/match-3d.js` (`3d`: 3D görünümü yükler, olmazsa 2D).
- Her dosya neyi nereden aldığını `import` ile söyler; üst düzey her tanım `export` edilir (dışa açık olanlar henüz daraltılmadı; `docs/architecture.md` "Kalan borçlar").
- Paylaşılan durum `core/state.js`'te; başka modülün değişkenine atama yapılamaz, ayarlayıcılar kullanılır. `window` üzerinde oyuna ait bir şey yok (E7'den beri istisnasız; yıldız sahnesinin otomasyon zaman ölçeği `window.__stsTimeScale` kalktı). three.js npm'den gelir (`import * as THREE from 'three'`, E5).
- `core/` `modes/`'tan hiçbir şey almaz (C sonunda 11 dosyada 63 ad, D'de 0); `tests/structure.test.cjs` kuralı denetler.
- Testler aynı modülleri `vm.SourceTextModule` ile yükler (`tests/support/game.cjs`); `npm test` gereken `--experimental-vm-modules` bayrağını verir. Tek dosya için: `NODE_OPTIONS=--experimental-vm-modules node --test tests/<dosya>`.

## Testlerin oyuna erişimi (D0)

- Testler oyuna tek erişim noktasından, adla ulaşır, dosyayla değil: `loadGame()` her modülün her export'unu tek nesnede toplar (`g.api.ad`; aynı adlar `run('…')` için bağlamın globalleri). Her ad, bugün hangi modüldeyse oradan canlı okunur; `g.owner(ad)` yerini söyler. Bir fonksiyon başka modüle taşınınca hiçbir test değişmez.
- Kod okuyan testler de adla bulur: `sourceDefining(ad)` adı tanımlayan modül, `scriptsDefining([...])`, `gameSources()`.
- `tests/structure.test.cjs` hiçbir testin oyun modülünü dosya adıyla (`readSource`/`locate`) okumadığını denetler. Sunum katmanının dosyaları (3D) istisna: kendi dosyaları konuları.
- Aynı adı iki modül export ederse yükleyici hata verir (erişim noktası hangisini kastettiğini bilemez).

## Build, sürüm ve önbellek (E2–E3)

- `npm run build`: Vite `src/`'i `dist/`'e paketler. Base `/ManagerStory/` (GitHub Pages yolu, büyük-küçük harf duyarlı). Betikler, stiller ve 3D model `dist/app/<ad>-<hash>.<uzantı>`: içerik değişince ad değişir, tarayıcı eski bir dosyayı yenisiyle karıştıramaz. Bu, D'deki `?v=<sürüm>` damgasının (`tools/stamp-version.cjs`) yerini aldı.
- Parçalar: oyun tek giriş betiği (`index-<hash>.js`; sayfanın dört modül girişi aynı sırayla tek girişte); gerektiğinde gelen 3D maç (`match3d-newview`), yıldız sahnesi (`star-transfer-scene`), ikisinin paylaştığı 3D görünüm (`newview`) ve three.js (`three`).
- Sürüm sadece `package.json`'da: oyun `core/version.js` ile alır; build sayfa başlığındaki ve manifestteki `%APP_VERSION%`'ı ve `sw.js`'in `RELEASE`'ini doldurur.
- `dist/sw.js` = `RELEASE`, `BUILD` (listenin hash'i), `ASSETS` (build'in yayınladığı her dosya, `NOT_CACHED` ve noktalı dosyalar hariç) + `src/sw.js`. Önbellek adı `managerstory-v<RELEASE>-<BUILD>`. Listede olmayan bir betik isteği (eski sürümün sekmesinden) başarısız sayılır. Test: `tests/service-worker.test.cjs` (gerçek bir build üzerinde).
- Stil sayfaları `public/` resimlerini kökten anar (`url('/assets/…')`): build onları base'in altına koyar. Göreli yazılsa build'deki stil sayfasının yanına (`app/`) çözülürdü. Aynı sebeple CSS değişkenine konan resim (`--fan-photo`, `--office-photo`) tam adresle verilir (`cssPicture`).

## Yolları etkileyen kurallar

- Test yükleyicisi modül listesini `src/index.html` girişlerinden ve importlardan çıkarır (`tests/support/game.cjs`); JSON modüllerini Vite gibi yükler (değer `default`, üst anahtarlar adlı export) ve her veri dosyasını alanların verdiği adla erişim noktasına koyar.
- ES modüllerinin importları ve `new URL(..., import.meta.url)` dosyanın kendi yerine göredir.
- Bir modüldeki `import('...')` o modülün adresine göre çözülür.
- Görsel yolları (`assets/...`) sayfaya göredir; scriptin yeri değişince değişmez (stil sayfalarında kökten: yukarıda).
- Testler tek dosya okurken `locate(ad)` / `readSource(ad)` kullanır (`tests/support/game.cjs`): dosya klasör değiştirince test değişmez.
