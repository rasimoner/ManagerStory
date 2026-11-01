# Kod düzeni

Ortak saat: `core/sim/simulation-clock.js` sabit fizik adımından fizik ve maç saatini üretir; `data/match-duration.json` süre seçeneklerini, `core/match/duration-setting.js` saf tercih doğrulamasını tutar. Süresiz girdi laboratuvarın 5.400 fizik saniyelik referansını korur.

Kariyer bağlantısı: `core/match/career-input.js` gerçek kadro/yuva/özellik/taktik girdisi; `career-events.js` metre → saha yüzdesi ve Türkçe olay; `career-ratings.js` olaydan oyuncu sayaçları/reyting. `core/engine/experimental-input.js`, `experimental-match.js`, `experimental-events.js`, `experimental-players.js` mevcut `M` ile komut/olay/kariyer köprüsü. `modes/manager/experimental-settings.js` varsayılan kapalı ayar; `core/presentation/sim/career-pitch.js` numaralı/renkli 2D saha.

Kesintisiz gösterim (yeni doğal / eski referans): `core/match/continuous-playback.js`, `view-tempo.js`, `playback-frames.js`; anlık durum; yeni kısa maçlarda sabit doğal tempo, eski referansta yumuşak değişken hız. Gelecek tamponu yok. `core/engine/live-match.js` mevcut saat sürücüsünden motoru ilerletir; `core/presentation/sim/frame-clock.js` yalnız kare bütçesi ve maliyet ölçümü; `archive-persistence.js` ve `archive-worker.js` arka plan kayıt sıkıştırması. `core/match/archive-codec.js`, `match-storage.js`, `history-storage.js` aktif maç/sezon özetlerini kayıpsız saklar. `tests/match-sim-continuous.test.cjs`, `match-sim-storage.test.cjs` zaman/komut/RNG/kayıt sınırını; `tests/smoke/career-sim.mjs` gerçek 1× maç süresini ve telefon boyutlu akışı korur.

Kariyer komut arayüzleri: `core/sim/substitutions.js` duruşta uygulanan kadro kuyruğu; `team-commands.js` tek takım taktik/diziliş ve bireysel talimat; `player-workload.js` gerçek mesafeden kondisyon/seyrek sakatlık; `player-injuries.js` oyuncuyu çıkaran hakem duruşu; `simulation-checkpoint.js` ve `checkpoint-values.js` RNG/önbellek/ortak referansları JSON'da koruyan kayıt. Motor kariyer veya DOM tanımaz.

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
| `core/presentation/scenes/show-stage.js` | `star-transfer-scene.js` (V7.14.0) | Maç dışı gösteri sahnesi: kendi WebGL'i, stadyum, tribün, top, küçük kadro ve hareketi sahneleyen yönetmen; bitince GPU'yu bırakır | Yıldız transfer sahnesi ve "İzle" ortak kullanır |
| `core/presentation/scenes/highlight-scene.js` | (yeni, V7.14.0) | "İzle": tariften beat'i sabit adımla oynatır (her kare hızında aynı), ~10 sn, Kapat düğmesi | Gerektiğinde yüklenen ayrı parça |
| `core/highlights.js` | `star-transfer.js` (V7.14.0) | Highlight arşivi: tarif biçimi, aynı anın tek tutulması, oyuncu başına en iyi 10 kuralı (`balance.json` `highlights`), arşiv görünümü, tarifin sahnesi (`stageKindFor`) | Saf; kaydı mod yazar |

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
| `modes/manager/star-transfer.js` | `star-transfer.js` | Yıldız transfer akışı (duyuru, imza, forma); gösterisini `starTransfer` tarifi olarak arşive yazar (`core/highlights`) | Akış teknik direktöre özgü |
| `modes/manager/highlight-recorder.js` | (yeni, V7.14.0) | Arşive ne girer: 3D maçtaki yıldız anları (`starMoment`), antrenmanda (`announceNewMoves`, gelen kutusu notu ▶ İzle ile) ve yazın (`movesLearned`) açılan hareketler | Neyin "an" olduğu moda özgü |
| `modes/manager/highlight-screens.js` | (yeni, V7.14.0) | Arşiv ekranı (Kadro sekmesinin detay ekranı; oyuncu/tür/sezon filtresi, yeniden eskiye), profilde "Highlight'lar", gelen kutusunda ▶ İzle, "İzle"yi başlatma | Teknik direktörün ekranları |
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
| `starMoment(moment)` | 3D maç: bizim oyuncunun özel hareketi ya da yıldız/penaltı kurtarışı, akrep (`match3d-newview.js`, yönetmenin `noteSkill`'inden; `seed` maç olayının kimliği) | `recordStarMoment` (highlight arşivi, `highlight-recorder.js`) |
| `movesLearned(player, moves)` | sezon sonunun `aging` adımı | `recordNewMoves` (highlight arşivi) |

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
- Parçalar: oyun tek giriş betiği (`index-<hash>.js`; sayfanın dört modül girişi aynı sırayla tek girişte); gerektiğinde gelen 3D maç (`match3d-newview`), yıldız sahnesi (`star-transfer-scene`), "İzle" sahnesi (`highlight-scene`), paylaştıkları 3D görünüm (`newview`) ve three.js (`three`).
- Sürüm sadece `package.json`'da: oyun `core/version.js` ile alır; build sayfa başlığındaki ve manifestteki `%APP_VERSION%`'ı ve `sw.js`'in `RELEASE`'ini doldurur.
- `dist/sw.js` = `RELEASE`, `BUILD` (listenin hash'i), `ASSETS` (build'in yayınladığı her dosya, `NOT_CACHED` ve noktalı dosyalar hariç) + `src/sw.js`. Önbellek adı `managerstory-v<RELEASE>-<BUILD>`. Listede olmayan bir betik isteği (eski sürümün sekmesinden) başarısız sayılır. Test: `tests/service-worker.test.cjs` (gerçek bir build üzerinde).
- Stil sayfaları `public/` resimlerini kökten anar (`url('/assets/…')`): build onları base'in altına koyar. Göreli yazılsa build'deki stil sayfasının yanına (`app/`) çözülürdü. Aynı sebeple CSS değişkenine konan resim (`--fan-photo`, `--office-photo`) tam adresle verilir (`cssPicture`).

## Yolları etkileyen kurallar

- Test yükleyicisi modül listesini `src/index.html` girişlerinden ve importlardan çıkarır (`tests/support/game.cjs`); JSON modüllerini Vite gibi yükler (değer `default`, üst anahtarlar adlı export) ve her veri dosyasını alanların verdiği adla erişim noktasına koyar.
- ES modüllerinin importları ve `new URL(..., import.meta.url)` dosyanın kendi yerine göredir.
- Bir modüldeki `import('...')` o modülün adresine göre çözülür.
- Görsel yolları (`assets/...`) sayfaya göredir; scriptin yeri değişince değişmez (stil sayfalarında kökten: yukarıda).
- Testler tek dosya okurken `locate(ad)` / `readSource(ad)` kullanır (`tests/support/game.cjs`): dosya klasör değiştirince test değişmez.


## Faz 4 — saniyelik motor ve ayrı deney sayfası

| Dosya | Sorumluluk |
|---|---|
| `src/lab.html` | Oyunla bağlantısız ikinci Vite girişi; `/ManagerStory/lab.html` |
| `core/sim/simulation-state.js` | Girdi kopyası, takım/oyuncu durumu ve salt-okunur bağımsız çıktı kopyası |
| `core/sim/simulation-step.js` | 0,1 sn adım, kare zamanı birikimi, sahiplik geçişleri ve faz saati |
| `core/sim/player-movement.js`, `pitch-movement.js` | Özelliklerden kapasite, aciliyet/yürüyüş, ivme ve dönüş; çizgide vektör ivme bütçesiyle önceden frenleme |
| `core/sim/team-shape.js` | Top/taktikten blok, hat çapaları, ortak hedef zarfı ve kaleci |
| `core/sim/off-ball-roles.js`, `off-ball-targets.js` | Ayrı karar saatleri; basan, örten, markaj, destek, derin koşu; gerçek rakip pas çizgisi |
| `core/sim/team-measurements.js` | Kaleci hariç, basan dahil gerçek boy/en; pres uzaklığı ve ilk tepki |
| `core/sim/tactic-settings.js`, `validation.js`, `geometry.js` | Canlı taktik API'si, açık girdi hataları, metre vektör işlemleri |
| `core/presentation/lab/main.js`, `controller.js`, `session.js` | Deneyi açma, dokunma/klavye/kontroller, sabit adım sürücüsü; kariyer durumuna erişim yok |
| `core/presentation/lab/scenario.js`, `automatic-ball.js` | Seed'li örnek takımlar; eski otomatik betik yalnız değişmemiş topsuz tekrar testleri için, canlı oturumda kullanılmaz |
| `core/presentation/lab/screen.js`, `field-view.js`, `field-layers.js`, `field-markings.js`, `laboratory.css` | Telefon arayüzü, SVG saha/22 oyuncu, rol/hat/hız/çapa katmanları, canlı ölçümler |
| `core/sim/ball-physics.js`, `ball-state.js` | Analitik sürtünme/parabol ve tahmin; top girdisi, hakem müdahalesi/erişim doğrulaması |
| `core/sim/player-arrival.js`, `pass-evaluation.js` | Fiziksel varış zamanları; alıcı/koşu alanı ve tüm pas yolunun rakip güvenliği; deterministik puan |
| `core/sim/owner-decision.js`, `pass-execution.js` | Tutma/baskı/dönüş, bırakırken yeniden değerlendirme, seed'li yön/hız uygulama hatası |
| `core/sim/ball-chasing.js`, `ball-contact.js`, `ball-possession.js` | Pas/bağımsız boş top karşılama hedefi (sürmede taktik rol korunur), süpürülmüş gerçek temas/erişilebilir yükseklik, ilk dokunuş ve sekme |
| `core/sim/ball-step.js`, `ball-restart.js`, `goal-line-restart.js` | Serbest top adımı ve temas/çizgi sırası; **geçici** taç, kalecinin elinden başlatma ve kısa korner |
| `core/sim/ball-events.js`, `simulation-runtime.js`, `simulation-phases.js` | Gerçek anlı olaylar/istatistikler, simülasyona özel dizin/zar, sahiplik faz geçişleri |
| `core/presentation/lab/pass-layers.js`, `stats-view.js` | Güvenli/riskli seçenekler, seçilen pas, alıcı/rakip saniyeleri, yol ve canlı pas/sahiplik sayıları |
| `tools/match-sim-report.cjs`, `tests/match-sim-performance.test.cjs` | Derlemeyi zaman dışına alan yerel Node 22 ölçümü; 3 sn topsuz / 2 sn şut ve kaleci dahil tam maç seri bütçesi; en az 50 tohum ölçümü, güç farkı ve koordinat özeti |
| `tests/match-sim-ball.test.cjs`, `tests/match-sim-passing.test.cjs`, `tests/smoke/lab-passing.mjs` | Sentetik kesme/yükseklik/ilk dokunuş/çizgi, deterministik maç/fizik, telefonda dokunarak pas ve hızlı 90 dk |
| `core/sim/owner-options.js`, `owner-pass-scan.js`, `dribble-evaluation.js`, `dribbling.js` | Tepki anında pas/sür/koru karşılaştırması, geçerli çıkış algısı, varış farkıyla sürme yönü, serbest dokunuş ve taşıma metriği |
| `core/sim/duel-state.js`, `defending.js`, `tackle-contact.js`, `tackle-resolution.js` | Uygunluk/kalkış, kale tarafı jokey, seed'li uygulama hatası, süpürülmüş ayak–top/bacak ilk teması ve kazanma/sekme/ıska |
| `core/sim/shoulder-duels.js`, `beat-tracking.js` | Güçten ivmeyle yavaşlama; gerçek birebirden çıkış kaydı, özel hareket seçimi yok |
| `core/sim/foul-severity.js`, `refereeing.js`, `foul-restart.js` | Temastan faul/kart/DOGSO adayı, avantaj ve geri çağırma; 7. işe kadar **geçici** 9,15 m ve ceza alanı dışı kısa pas |
| `core/presentation/lab/duel-layers.js`, `event-view.js`, `long-press.js` | Seçenek puanları/ok, savunmacı durumu/temas, son 10 olay ve işaret, telefonda native uzun basma |
| `tests/match-sim-duels.test.cjs`, `tests/smoke/lab-duels.mjs` | Önce kırmızı çalışan sentetik geometri/kart/avantaj/yeniden başlama senaryoları ve telefonda uzun basma; tam 90 dk deterministik koordinat/olay ve her faulün teması hız testinde |
| `docs/match-sim-duels-report.md` | 28 Ekim 2026 karşılaştırması, üç tohum, hedef dışı sayılar, hız ve doğrulama |
| `data/match-sim.json` | Yeni çekirdeğin tüm oyun değerleri, iki diziliş ve deney ayarları; `data/README.md` açıklar |
| `tests/support/lab.cjs`, `tests/match-sim*.test.cjs` | Sayfa grafiğinden adla API erişimi, davranış/saat/fizik/blok ve yayın sınırı testleri |
| `docs/match-sim.md` | Yeni motorun Türkçe şartnamesi, ölçümleri ve sonraki adımların açık soruları |

Build iki HTML girişini bağımsız grafiklerle paketler; laboratuvar için oyuna yeni ortak parça yükletilmez. Laboratuvarın `.mjs` girişi eski oyun worker'larıyla da doğrudan açılır; sabit ad alanı çevrimdışı listeden çıkarılır; HTML sorguları içerik hash'i taşır. Oyun paketinin import grafiğine deney girmez. `tests/support/game.cjs` varsayılan `index.html` dışında `page: 'lab.html'` de yükler; adla erişim kuralı her iki sayfada aynıdır. Veri testleri iki girişin JSON kullanımını denetler.

### Şut, kaleci ve maç akışı

| Dosya | Sorumluluk |
|---|---|
| `core/sim/shot-evaluation.js`, `shot-pass-value.js` | Mesafe/açı/örtülen açı/kaleci/baskı/vücut durumundan deterministik xG; daha iyi konumdaki pasın fırsat değeri |
| `core/sim/shot-execution.js`, `shot-trajectory.js` | Özelliklerden köşe, stil ve güç; seed'li uygulama sapması; aynı parabol ve sürtünmeyle gerçek kale varış noktası |
| `core/sim/shot-step.js`, `shot-blocks.js`, `goal-frame.js` | Adım içindeki en erken temas; gerçek blok/kaleci/direk sırası ve sekme; topun tamamının çizgi geçişi |
| `core/sim/keeper-positioning.js`, `keeper-reaction.js` | Açıortayda konum, set, şuta tepki saati, adım/plonjon erişim zarfı ve gerçek temas |
| `core/sim/keeper-saves.js`, `keeper-possession.js`, `keeper-rushing.js` | Tutma/çelme/saptırma, zorluk/son an kaydı, elde dokunulmaz top/dağıtım, geri pas ve ceza alanı sınırı, birebir çıkış ve DOGSO'da erişim |
| `core/sim/match-lifecycle.js` | Skor, gerçek santra pası için fiziksel yerleşme, gol duruşu, devre/yön değişimi ve bitiş |
| `core/presentation/lab/shot-layers.js` | Görünen kale açısı, gerçek şut izi, kalecinin erişimi/tepki saati/kurtarış türü ve kısa gol işareti |
| `tests/match-sim-shooting.test.cjs`, `tests/smoke/lab-shooting.mjs` | Sentetik kabul sahneleri; telefonda çift dokunma, skor/istatistik, yön değişimi ve maç bitişi |
| `.github/workflows/match-sim-verify.yml` | Main'e birleşmeden önce Node 22, tam test, build ve değişmemiş 12 duman kontrolü + laboratuvar kontrolleri; 50 tohum/güç farkı ve telefon görüntüsü |
| `docs/match-sim-shooting-report.md` | Tarihli beş tohum, gerçek futbol hedefleriyle farklar, süre, doğrulama ve oyun bağlantısı için arayüz eksikleri |

### Denge 1

| Dosya | Sorumluluk |
|---|---|
| `core/sim/box-defending.js` | Canlı top son üçte birdeyken ortak bloğu derinleştirme/daraltma, iki kale tarafı markaj ve dönen top ekranı; eski topsuz tekrar değişmez |
| `core/sim/player-arrival.js`, `defending.js` | Pasın varış hesabıyla aynı hareket sınırları; müdahale anına kadar taşıyıcının ivme/fren/dönüş öngörüsü, gerçek çıkış noktasından ayak uzatma |
| `core/sim/ball-contact.js`, `shot-evaluation.js` | Şut kararında ve fiziksel blokta tek `shooting.blockRadius`; yavaş top/pas kontrolü `ball.controlRadius` olarak kalır |
| `core/sim/tackle-contact.js`, `tackle-resolution.js` | İlk top/bacak teması yanında gerçek devam bacak kesişimi; yüksek hızlı devam temasından faul, sonuç zarı yok |
| `core/presentation/lab/shot-map.js` | Olay cursor'ıyla maç boyunca şut konumu/xG/nihai sonucunu biriktirme; katmanın açılıp kapanması kaydı silmez |
| `tools/match-sim-report.cjs`, `tools/sim-report/` | En az 50 ayrı tohum, dağılım/yüzdelik/dilim/xG kalibrasyonu, güç farkı ve iki yön deneyi; pahalı deneyler arasında kısmi dosya checkpoint'i |
| `tests/match-sim-balance.test.cjs`, `tests/match-sim-report.test.cjs`, `tests/match-sim-shot-map.test.cjs`, `tests/smoke/lab-balance.mjs` | Önce kırmızı davranış/rapor/harita testleri, ortak blok geometrisi ve temas sonrası faul; telefonda harita/sayaç/katman/sıfırlama |
| `docs/match-sim-balance-report.md`, `docs/measurements/match-sim-balance-*.json` | Ayardan önce teşhis, aynı tohumlarla önce/sonra, yayılım, istisnalar ve tek özellik deneyleri |
| `tools/sim-report/finishing.cjs` | Aynı 50 tohum ve beş konumda eşlenmiş 250 şut: yalnız finishing / yalnız kaleci reflexes değişimi, stil/güç karışmasını ayıran gerçek uçuş deneyi |
| `tools/sim-report/compare.cjs` | CI’da kaydedilmiş 50 maç/güç/tek özellik sonuçlarını yeni koşuyla karşılaştırır; duvar süresi karşılaştırılmaz |
| `tests/match-sim-balance-metrics.test.cjs` | Futbol aralıkları, açıkça belirtilen istisnalar, kontrollü özellik etkisi ve bağımsız 100 maçtaki ilk 50’nin birebir tekrarı |

Süre ölçümü: `tools/match-sim-duration-report.cjs`, `tools/duration-report/measure.cjs`, `career.cjs`, `summary.cjs`; aynı 50 tohum/eşit kadro, beş süre, gerçek kariyer gol/kart/dakika/asist yazıcıları. `tests/match-sim-duration*.test.cjs` saat/fizik/ayar/eski kayıt/rapor; `tests/support/native.cjs` adla bulunan oyun API'sini yerel ölçüme paketler. Ham veriler `docs/measurements/match-sim-duration*.json`.

Doğal süreli maçın hücum alanı değeri: `core/sim/attacking-space.js` hücum kalesine mesafe kazancını hesaplar; `dribble-evaluation.js` ve `owner-options.js` aynı ölçeği okur. `off-ball-roles.js` ayrı taşıyıcı/derin koşu ve ileri/geri destek planlar. Katsayılar `data/balance.json.shortMatchFlow`; kabul testleri `tests/match-sim-short-flow.test.cjs`, küçük eşlenmiş ölçüm `docs/measurements/match-sim-short-flow.json`. Yeni rapor aracı yoktur.


### Yeni motorun kariyer 3D bağlantısı (V7.18.0)

- `presentation/sim/career-scene.js`, `career-scene.css`: sahne yaşam döngüsü, gerçek saat/skor, temel gol bildirimi, tam ekran ve 2D geri dönüşü.
- `scene-frame.js`: metre/yükseklik/heading dönüşümü ve gözlenmiş fizik kareleri arasında salt çizim örneği.
- `scene-stage.js`, `scene-kits.js`: mevcut stadyum/rig/formalar; `scene-actors.js`: gerçek kökler ve mevcut animasyonlar, yerel fizik yok.
- `scene-camera.js`, `scene-radar.js`: yayın kamerası/top-kale-kaleci zarfı ve aynı konumların radarı.
- `view-status.js`: geçici hata açıklaması; `data/match-sim-view.json`: yalnız çizim değerleri.
- `tests/match-sim-3d*.test.cjs`, `tests/support/simulation-scene.cjs`: gerçek rig/salt okuma/kadro/kamera ve iki görünümün aynı futbolu.
- `tests/smoke/career-sim-3d.mjs`, `tests/support/scene-careers.cjs`: 390×844 WebGL, gerçek kayıtlarla beş görüntü, kontroller/devre/bitiş ve bağlam kaybı. Test gol geometrisi ürün koduna girmez.

### Yeni motorun 3D kaleci zinciri (V7.19.0)

- `presentation/sim/keeper-animation.js`: yalnız fizik zamanından hazır/itiş/uzanma/iniş/destek/kalkış; yeni şut ve gerçek dağıtıma geçiş.
- `keeper-rig-pose.js`: mevcut klipleri mutlak zamanda örnekleme, yansıtma, kemik karışımı, gerçek krampon yüzeyinden zemin payı.
- `core/match/keeper-presentation.js`: gözlenmiş önceki kurtarışın bağımsız çizim kopyası; motora ve RNG'ye yazmaz.
- `data/match-sim-keeper-animation.json`: yalnız görsel süre ve poz değerleri.
- `tests/match-sim-keeper-{animation,boundary}.test.cjs`: gerçek rig, yüzey/zemin, süreklilik, aynı fizik anında eşit poz, çekirdeğin değişmemesi.
- `tests/smoke/keeper-animation.mjs`, `keeper-fixture.mjs`: ürüne bağlanmayan test sahnesi; iki telefon yönünde hareket videoları ve ayrı olağan kariyer UI kanıtı.

V7.19.1: `core/presentation/sim/scene-atmosphere.js` gözlenmiş gol ve tribün zamanını, `scene-goal-overlay.js` mevcut kulüp fotoğrafını, `scene-footwork.js` yalnız görsel ayak desteğini yönetir. `scene-camera.js` ortak eski yayın açılarını güncel salt okuma kareden seçer. Ayrıntı: [sunum raporu](match-sim-presentation-report.md).

## Eski/yeni 3D sunum uyarlaması

| Dosya | Sorumluluk |
|---|---|
| `core/match/presentation-contacts.js` | Gerçek olaylardan bağımsız çizim verisi; eski final üçüncü bölge/her ikinci mücadele kamera işareti. Motor günlüğüne yazmaz. |
| `core/presentation/match3d/newview/ball.js` | İki görünümün ortak eski top geometrisi, kaplaması ve temas gölgesi. |
| `core/presentation/match3d/newview/pose-base.js` | Klip örneğini IK'den önce geri kurma ve yeni sahnede sürekli dirsek bükülme yönü. |
| `core/presentation/sim/ball-sample.js`, `scene-ball.js`, `scene-grip.js` | Gözlenmiş ilk temastan ara konum, mesafeden dönüş; ikinci top fiziği yok. |
| `core/presentation/sim/scene-actions.js`, `scene-contact-feet.js`, `scene-hands.js`, `scene-gait.js` | Gerçek eyleme eski poz/klip ve görsel temas; motor kökü/topu değişmez. |
| `core/presentation/sim/scene-hud.js`, `scene-status.js` | Kulüp/oyuncu bilgisi ve devre hazırlığının ortak görünür durumu. |

Özellik envanteri, kapsam ve açık Safari/motor sınırları: [3D restorasyon raporu](3d-restoration-report.md).

Faz 2 duran top modülleri: `core/sim/restart-state.js` yalnız hazırlık durumu/katılımcıları; `restart-layout.js` yasal hedefler/baraj/penaltı düzeni; `restart-step.js` mevcut hareketle yerleşme ve hazır kontrolü; `restart-release.js` gerçek olay ve mevcut pas/şut çıkışı. `first-control.js` gerçek temasın sürekliliğini taşır. Sunum bunları salt okur; ikinci top veya oyuncu fiziği kurmaz.

### 3D özellik eşitliği adayı (1 Kasım 2026)

- `core/sim/restart-decision.js`, `wall-reaction.js`, `penalty-decision.js`: saf duran top kararı, fiziksel baraj ve penaltı erken yönelimi/Panenka.
- `core/sim/offside.js`: konum kaydı, katılım, istisna ve düdük; ortak restart düzenini çağırır.
- `core/presentation/sim/scene-offside.js`, `scene-replay.js`, `scene-replay-panel.js`: eski sarı çizgi ve eski gerçek gövde/top kaydedicisine bağlı salt okuma görünümü.
- `tests/reproductions/`: varsayılan paketi kırmadan saklanan açık dönüş/orta regresyonları; ilerleme günlüğü hangi ürün yaklaşımının geri alındığını anlatır.
- `tools/match-sim-parity-report.cjs`: aynı 20 tohumda eşlenmiş kısa maç ölçümü; tarihli ham sonuçlar `docs/measurements/3d-feature-parity/`.

## PR #16 sonrası ortak servis

`core/sim/cross-delivery.js` servis seçimi, ortak pas uçuşu ve orta olayını; `cross-layout.js` gerçek koşucu/markajcı/kaleci yerleşim hedeflerini kurar. Eski director çalıştırılmaz. Kabul: `tests/match-sim-cross-delivery.test.cjs`.

`core/sim/aerial-choice.js` gerçek temas yüksekliği, mesafe/yön ve güvenli çıkışla kafa/vole/uzaklaştırma niyetini seçer. `aerial-contact.js` aynı topun gerçek temasını ve kalan fizik adımını yürütür. Motor sonucu animasyondan okunmaz. Kabul `match-sim-aerial-finishes.test.cjs`; başarısız röveşata ayrı `tests/reproductions/remaining-bicycle.cjs`.

`core/players/move-eligibility.js` eski movesFor kurallarının saf tek kaynağıdır; eski motor ve yeni fizik aynı yetenek listesini okur. `sim/ground-skill-choice.js` gerçek alan/baskı/hız ve beceriden seçim; `ground-skills.js` aynı taşıma içindeki fiziksel temas dizileri; `presentation/sim/scene-skill-feet.js` eski salt ayak eğrileriyle çizimdir. Eski beat jeneratörleri veya hareket/top çözücüleri çalışmaz.

`sim/no-look-pass.js` gerçek alternatif bakış hedefini saf olarak seçer; `presentation/sim/scene-pass-gaze.js` eski nolook pozunda yalnız baş kemiğini o oyuncuya çevirir.
