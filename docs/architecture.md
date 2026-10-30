# ManagerStory mimarisi

Ortak saat `core/sim/simulation-clock.js` içinde, saf çekirdek seçeneğidir. Yeni deneysel kariyer maçları doğal 3/5/7/10 dakika kullanır; fizik 0,1 sn adımla, maç saati tam adım oranıyla ilerler. `core/match/duration-setting.js` tercih doğrulamasını; biçim 5 göçü varsayılanı tutar. Aktif checkpoint süresi kariyer tercihinden bağımsızdır. Önceki yarım deneysel maçın referans modeli ve eski motor/3D korunur. Dakika/kondisyon/sakatlık zaman tabanları ve 3D'nin okuyacağı sözleşme `docs/match-sim.md` içindedir.

V7.16.0'da iki motor birlikte durur. `core/match/career-input.js`, `career-events.js`, `career-ratings.js` saf adaptördür; `core/engine/experimental-*.js` yalnız açık anahtarlı kullanıcı maçını `core/sim/` ile sürer ve mevcut kariyer kancalarına iletir. Diğer lig maçları `simAIGame` ile kalır. Ayar kapalıysa eski dakika/3D akışı kullanılır. `modes/manager/experimental-settings.js` tercihi çizer; `core/presentation/sim/` salt okuyan 2D görünümdür.

Referans modelinin eski D akışı kesintisizdir: `continuous-playback.js` motoru görülen andan ileri götürmez; `view-tempo.js` yalnız duvar zamanı → oyun zamanı dönüşümünü yumuşatır. Taktik/duraklatma komutu görülen adıma uygulanır; değişiklik isteği aynı adımda sıraya girer. `live-match.js` saat sürücüsü motoru ilerletir; `frame-clock.js` yalnız ölçülen maliyet ve adım bütçesini verir. `career-pitch.js` sabit yerleşimden GPU transform ile çizer; futbol durumuna yazmaz. `archive-codec.js`, `match-storage.js`, `history-storage.js` kayıpsız ve saf saklama sınırıdır; `archive-persistence.js`/`archive-worker.js` otomatik sıkıştırmayı çizim işinden çıkarır. Gecikmiş kayıtlar sıra kontrolüyle elenir. Üretimde simülasyon `core → modes` importu yapmaz.

Yeni `core/sim/` komutları kariyerden bağımsızdır: takım kimliğiyle taktik, duruşta uygulanan değişiklik, hareketten tüketim ve hakem duruşuyla sakatlık. Kayıt salt düz nesnedir; RNG yanında algı/kovalama önbelleklerini ve JSON'da kaybolacak ortak konum referanslarını da taşır. Kariyer adaptörü bu sözleşmeyi kullanır; çekirdeğe `modes/` bağımlılığı eklenmez.

Yeniden yapılanma A–E sonrası (V7.13.0: E'nin tamamı, Vite ile build dahil). Dosyaların tek tek yeri: `docs/code-layout.md`. Kayıt: `docs/save-format.md`. Oyunun kuralları ve motor (başka bir motora taşımak için): `docs/game-rules.md`.

## Katmanlar

```
src/              kaynak (npm run build → dist/, depoda değil)
  index.html      sayfa: oyunun modül girişleri
  data/           oyun verisi: JSON dosyaları (kulüpler, kadro, isimler, oyuncu tipleri, taktikler, hareketler, denge, hikâye); açıklamaları data/README.md
  core/           ortak çekirdek: her mod kullanır, hiçbir modu tanımaz
    state.js        paylaşılan durum (S: kariyer, M: canlı maç, modal, loadError)
    random.js       tohumlanabilir tek rastgele üretici
    hooks.js        çekirdeğin söyledikleri ve genişletme noktaları
    save.js         kayıt, taşıma zinciri
    sim/            saf saniyelik çekirdek; deneysel kariyer adaptörü bağlı, 3D ayrı
    match/          saf kariyer eşlemesi/olay/reyting, kesintisiz izleme saati ve kayıt arşivi
    engine/         maç motoru: dakika, aksiyonlar, özellik modeli, duran toplar, saat, kullanıcı takımı
    league/ clubs/  lig, fikstür, puan tablosu, rakipler; kulüp kimliği
    players/        oyuncu tipleri, profiller, özel hareketler
    season/         sezon sonu adım hattı
    highlights.js   highlight arşivi: tarif biçimi ve "en iyi" kuralı
    presentation/   2D/3D maç görünümü (özel hareket koreografisi newview/beats/), yıldız ve "İzle" sahneleri (sadece okur)
  modes/manager/  teknik direktör modu: kariyer döngüsü, ekranlar, maç paneli, sezon sonu ekranları, yıldız transfer akışı
  ui/             ortak arayüz: olay dağıtıcısı, gezinme, tarayıcı aracı
  main.js         tek giriş: modülleri sırayla yükler, modu çekirdeğe bağlar, oyunu açar
  sw.js           service worker şablonu (build listesini ekleyip dist/sw.js'i yazar)
public/           olduğu gibi yayınlananlar: ekranların yol ile andığı resimler, ikonlar, web manifesti
vite.config.js    build: base /ManagerStory/, içerik hash'li dosyalar (dist/app/), sürüm, service worker
```

Katmanların işi:
- **data**: sadece değer, JSON (E4). Kod dosyayı adıyla alır (`import BALANCE from '../../data/balance.json'`). Kodun ayarladığı her sayı (zorluk, gelişim, sözleşme, eşikler) `data/balance.json`'da.
- **core**: oyunun kuralları. Saf mantık olmaya çalışır; ekran çizmez, modu çağırmaz. Bir modun bilmesi gereken bir şey olunca kancayla söyler.
- **modes/manager**: oyuncunun yaptığı her şey (seçimler, ekranlar, kariyerin maçtaki karşılığı). Çekirdeği kullanır.
- **ui**: modlardan bağımsız arayüz altyapısı.
- **core/presentation**: maçı gösterir. Motorun durumunu yazmaz; olay günlüğünü ve salt-okunur kopyayı okur.

## Bağımlılık kuralı

Bağımlılık sadece aşağı akar: `main.js → modes → core → data`, `ui` her yerden kullanılabilir.
- Hiçbir `core/` modülü `modes/`'tan bir şey almaz (import, re-export, dinamik import). `tests/structure.test.cjs` denetler; kuralı çiğneyen bir import gerçekten yakalanıyor.
- Hiçbir dosya başka bir dosyanın fonksiyonunu çalışma anında değiştirmez (sarma yok). Bir dosya başka bir dosyanın işine ekleme yapacaksa kancaya kaydolur.
- `window` üzerinde oyuna ait bir şey yok. Paylaşılan durum `core/state.js`'te, sadece ayarlayıcılarla (`setCareer`, `setMatch`, `setModal`, `setLoadError`) değişir.
- Veriden hesaplanan sabitler (`OPP`, `CLUBSTYLE`, `SKILL_NAMES`, taktik dili…) sadece veri alan küçük modüllerde: import döngülerinin dışında, modüller hangi sırayla çalışırsa çalışsın hazır (`tests/module-order.test.cjs`).

## Çekirdeğin söyledikleri (kancalar)

Çekirdek bir modun fonksiyonunu çağırmaz, olanı söyler (`core/hooks.js`). `main.js` teknik direktör modunu bağlar:

| Söylenen | Ne zaman | Teknik direktör modu |
|---|---|---|
| `changed()` | kariyer ya da maç değişti | ekranı yeniden çizer (`render`) |
| `careerOpened()` | bir kariyer yerine kondu (içe aktarma) | kariyeri hazırlar (`init`) |
| `decisionsRequested()` | 3D görünümde "Değiştir" | maç kararlarını açar |
| `opponentsEvolved()` | rakip kadrolar gelişti | harika çocuk tekliflerini günceller |
| `seasonStarted(summary)` | yeni sezon kuruldu | lig ödülü, başkanın mektubu, yönetimin sorusu, saat |
| `minutePlayed(player)` | oyuncumuz bir dakika daha oynadı | sezon dakikası |
| `matchEvent` kancası | her maç olayı, olurken | gol, kart, ilk maç kariyere yazılır |

Genişletme noktaları: `beforeSigning` / `afterSigning` (yıldız transfer sahnesi), `goMain`, `navBack`, `screenDrawn` (gezinme). Her kancanın işleyicileri kaydoldukları sırayla çalışır; sıra `main.js`'te sabit.

Başka bir mod (oyuncu kariyeri) kendi işleyicilerini bağlar; çekirdek değişmez. Maçta kullanıcının takımı `core/engine/user-team.js` ile söylenir (`setUserTeam`), motor "bizim takım = yönetilen kulüp" varsaymaz.

## Kayıtlar (yükleme anında)

Modüller yüklenirken sadece tanımlar ve kaydeder; hiçbir şey çalışmaz:
- **Eylemler** (`ui/actions.js`): ekranı çizen dosya düğmelerinin eylemlerini `defineActions({...})` ile kaydeder. Sayfada satır içi işleyici yok; tek dağıtıcı `data-action` adına bakar, değerleri `data-*`'tan verir.
- **Sezon sonu adımları** (`core/season/season.js` `seasonEndStep`): çekirdek kendi adımlarını, mod kendininkileri `{ after: 'id' }` ile yerine koyar. Mod çekirdeğe bağımlı olduğu için çekirdeğin adımları her zaman önce kaydolur. Sıra: `summary, aging, retire, loans, report, contracts, academy, rivals, market, cleanup, newSeason` (testte sabit).
- **Kancalar**: yukarıda.

## Akışlar

**Açılış** (`main.js`): veri → çekirdek → mod → ui modülleri yüklenir (sadece tanım); mod kancalara bağlanır; kayıt açılır (`loadCareer`: taşıma zinciri); dağıtıcı, arka plan duraklatması, yıldız transferi ve gezinme kurulur; ilk ekran çizilir. Sunum katmanları (`index.html`'deki saat, görünüm bağdaştırıcısı, 3D) ayrı girişlerdir; 3D yüklenemezse maç 2D sürer.

**Kariyer döngüsü** (`modes/manager/app.js`): `nextEvent` sıradaki kararı (`S.event`) kurar, oyuncu seçer (`choose`), `advance` günü ilerletir. Haftalık gelişim, transfer dönemi, akademi, basın ve görüşmeler bu döngüde.

**Maç**:
1. `startMatch`: maç durumu `M` kurulur, başlama vuruşunda tohum yenilenir (`kickoffSeed`), `M.rand = R(matchSeed())`.
2. Canlı döngü (`core/engine/live-match.js`) gerçek zamanı maç saniyesine çevirir; her maç dakikasında motor bir kez `tick` çalıştırır (`core/engine/match-minute.js`).
3. Motor olayları `matchEvent` ile olay günlüğüne (`M.events`) yazar ve `matchEvent` kancasıyla söyler. Aynı tohum aynı günlüğü üretir.
4. Sunum (2D saha, 3D görünüm, yorum) günlüğü ve `match-view-adapter`'ın salt-okunur kopyasını okur; simülasyonu ilerletmez.
5. 45'te devre arası, 90'da `finalizeMatch`; sonuç `finishMatch` ile kariyere ve tabloya işlenir, turun diğer maçları simüle edilir.
6. Maç ortasında kayıt: maç durumu ve zarın konumu (`rngState`) kayıtta; açılınca aynı zarla devam eder.

**Sezon sonu**: 34. tur bitince `beginSeasonEnd` adım listesini kayda yazar (`S.seasonEnd.steps`); `runSeasonEnd` adımları sırayla çalıştırır, ekranı olan adımda durur, "devam" ile sürer. Yarıda kalan kayıt aynı adımdan devam eder. Ayrıntı: `docs/season-transition.md`.

**Kayıt**: `S` düz JSON; `localStorage["msv4"]`. Sürümlü biçim (`schemaVersion`) ve tek taşıma zinciri (`SAVE_MIGRATIONS`). Yeni kariyer de zincirden geçer.

**Build ve yayın (E2–E6)**: Vite `src/`'i `dist/`'e paketler. Oyun tek giriş betiği (`app/index-<hash>.js`) olarak açılır; 3D maç ile yıldız sahnesi (three.js ve ortak 3D görünüm) ayrı parçalar halinde, gerektiğinde gelir. Her betik, stil ve 3D model adında içeriğinin hash'ini taşır: tarayıcı eski bir dosyayı yenisiyle karıştıramaz (eski `?v=<sürüm>` damgasının yerini aldı). Sürüm sadece `package.json`'da yazılı: oyun onu import eder, build sayfa başlığına, manifeste ve service worker'a koyar.

**Önbellek**: build `dist/sw.js`'i `src/sw.js`'ten, yayınladığı her dosyanın listesiyle yazar (iş görmeyen birkaç resim hariç: `vite.config.js` `NOT_CACHED`). Önbellek adı `managerstory-v<sürüm>-<build hash'i>`; dosyalar HTTP önbelleğinin ötesinden alınır (`cache: "reload"`). Service worker sadece bu build'in betiklerini verir: listede olmayan bir betik isteği (V7.10.0'ın yalın yolları, V7.11.0/V7.12.0'ın `?v=` adresleri, eski bir build'in parçaları) ancak açık kalmış eski bir sürüm sekmesinden gelir ve başarısız sayılır, böylece iki sürüm karışmaz. Yeni sürümün worker'ı açık sayfayı devralınca sayfa "Yeni sürüm hazır" der; "Yenile" kariyeri kaydedip yeni sürümü açar (`ui/updates.js`).

## Testler

- Testler oyunu kaynaktan, tarayıcının yüklediği gibi yükler: `src/index.html` girişleri ve importları (JSON veri dahil), tek bir VM bağlamında (`tests/support/game.cjs`). Oyuna dosyayla değil adla ulaşırlar (`g.api.ad`, `run('…')`, `sourceDefining(ad)`); fonksiyon başka modüle taşınınca test değişmez.
- Altın kayıtlar (`tests/golden`): 34 fikstürün olay günlüğü, skorlar, maç özetleri, 3 sezonluk kariyer, ekranlar, kayıtlar. Yeniden yapılanma bunları hiç değiştirmedi.
- Kural testleri: çekirdek modları tanımaz, satır içi işleyici yok, `Math.random` yok, `window`'da oyun yok, modül sırası, veri saflığı, tek sürüm.
- Lint (`npm run lint`, CI'da testlerden önce): ölçülebilir Clean Code kuralları (fonksiyon boyu ve deyim sayısı, karmaşıklık, iç içelik, parametre, dosya boyu, ölü kod, yutulan hata, sürüm ekli ad, `Math.random`, çekirdekten moda import). Bugünkü ihlaller `lint-baseline.json`'da; sadece yenisi hata verir, taban sadece küçülür. Kurallar: `AGENTS.md`.
- Yayınlananla ilgili testler (service worker listesi ve kuralı, başlık, manifest, önbelleğe alınan resimler) geçici bir klasöre gerçek bir build alır (`tests/support/build.cjs`).
- Duman testi (`npm run smoke`, `tests/smoke/smoke.mjs`): build GitHub Pages gibi sunulur ve Chromium'da açılır: açılış, ana ekranlar, eski ve yeni kayıtlar, sezon sonu, 3D maç, yeni sürüm bildirimi, çevrimdışı. CI her yayından önce çalıştırır.

## Tasarım ilkeleri

Sorumluluğa göre modüller (yardımcılar torbası yok); saf oyun mantığı; veri JSON'da; sürümlü ve belgelenmiş kayıt; tohumlanabilir rastgelelik; sunum sadece olay günlüğünü okur; çekirdek modları tanımaz.

## Kalan borçlar

Yeniden yapılanmadan sonra bilerek bırakılanlar:
- Kısa maçların %80–92'si golsüz; gerçek atak üretimi ve kısa format dengesi tamamlanmadı (`docs/match-sim-duration-report.md`).
- Deneysel motorda gerçek duran toplar/orta/kafa/ofsayt ve 3D henüz bağlı değil; desteklenmeyen talimatlar açık eşleme tablosunda. 1× süre ve CPU emülasyonundaki uzun kayıt/yeniden çizim kareleri `docs/match-sim-career-report.md` içinde ölçülür; CPU emülasyonu gerçek telefon/Safari denemesinin yerini tutmaz.
- Motorun kariyerde yazdıkları: kondisyon, sakatlık bayrağı, `S.matchSalt`. Ayrılmaları maça özel kadro kopyası ister (oyuncu kariyeri moduyla birlikte).
- Motor kullanıcı takımının ayarlarını (`S.plan`, `S.instructions`, `S.positions`) kariyerden okuyor; `user-team.js`'e taşınabilir.
- Çekirdekte DOM/tarayıcı kullanan yerler: `core/save.js` (alert, indirme), `live-match.js` (sekme görünürlüğü), `pitch-v73.js`'in 2D saha çizimi, sezon sonu "devam" (alert, kaydırma).
- `modes/manager/app.js` hâlâ büyük (~111 KB): gelişim (`evolvePlayers`) → `core/players`, header ve alt menü → `ui` (highlight kaydı V7.14.0'da `core/highlights` ve `highlight-recorder.js`'e gitti).
- Maçtaki yıldız anları sadece maç 3D izlenirken oluşur (özel hareketi motor değil 3D yönetmen seçer); 2D izlenen ya da hızlı geçilen maçtan arşive bir şey girmez. Motor özel hareketi kendisi seçerse arşiv her maçtan yazılabilir.
- "İzle" maçtaki anı birebir değil, aynı beat'i aynı tohumla maç dışı sahnede oynatır: savunmacının yeri ve kamera sahnenin kendisinin. Kaleci kurtarışlarında tohum sahneyi değiştirmez (sahne sabit).
- 3D sunum katmanında `director.js` hâlâ ~1550 satır (`shot`, `run`, `pass`); `createDirector` dört parametreli.
- Sunum bazı yerlerde `S`/`M`'yi doğrudan okuyor ("sadece olay günlüğü" ilkesi tam değil).
- Testler iç fonksiyonlara tek erişim noktasından ulaşıyor; modüllerin dışa açtıkları daraltılmadı.
- 3D ayar panelinde geçici "Hız ayarları" (gerçek hızlar telefonda ayarlanınca kalkar).
- Eski (V5) transfer listesi (`bidPlayer`, `S.transferList`) yeni oyuncuya maaş ve forma numarası veriyor ama maaş alanına bakmıyor; ekranına sadece eski bir olay akışı (`newSigningRole`) götürüyor. Kaldırılması ya da yeni pazara bağlanması ayrı iş (V7.13.2).
- "Transfer oldu" durumu `core/players/shirt-numbers.js`'te ayrıca yazılı (sezon modülünü almasın, kayıt zinciri döngüsüz kalsın diye); durum adları tek bir veri/çekirdek sabitine toplanınca kalkar.


## Faz 4: saniyelik simülasyon ve laboratuvar

`core/sim/` ayrı durum nesnesiyle çalışan saf çekirdektir: `createSimulation`, `stepSimulation`, `advanceSimulation`, `readSimulation`. İki takım, özellikler, taktik ve başlangıç topunu alır; konum/hız/rol, top fiziği, pas/sür/koru/şut kararı, jokey/müdahale, kaleci erişimi, fiziksel gol/skor/santra/devre ve temastan faul/kart/avantaj günlüğü üretir. Varsayılan adımda top dışarıdan verilmez. Eski ikinci top parametresi yalnız topsuz tekrar testlerinde kalır. DOM, three.js, kariyer (`S`), maç (`M`) veya mod bağımlılığı yoktur. Mevcut `core/engine/` ve 3D yönetmeni kullanılmaya devam eder. Yeni motorun kural kaynağı `docs/match-sim.md`; değerleri `data/match-sim.json`.

`lab.html` ikinci Vite girişidir. `core/presentation/lab/` içindeki oturum sürücüsü çekirdeği API'sinden ilerletir; SVG görünümü yalnız durum kopyasını okur. Otomatik mod doğrudan çekirdeğin kendi pas/sürme/mücadele/şut/kaleci oyunudur; oturum top rotası veya başarı belirlemez. Elle yerleştirme doğrulanan hakem müdahalesidir, oyuncuya kısa dokunma pas isteği, uzun basma o oyuncunun sahipken sürme tercihini, top sahibine çift dokunma hemen şut isteğini yollar. Çizim anlık kopyayı `includeEvents:false` ile alır; tüm geçmiş her karede klonlanmaz. Duraklatılan SVG sabitken yeniden kurulmaz. 90 dakika hızlı tamamlama da aynı 54.000 fizik adımını çizimsiz işler. Oyun girişinden laboratuvara import veya ekran bağlantısı yoktur; kayıt biçimi değişmez.

Yalnız laboratuvara ait üç çıktı (`lab.html`, `lab/laboratory.mjs`, `lab/laboratory.css`) `NOT_CACHED` listesindedir. Sabit adları HTML'de içerik hash'i sorgusuyla sürümlenir; Vite bu ikinci girişi bağımsız bir paketleme grafiğiyle kurar; mevcut oyunun betiklerine yeni ortak parça veya import eklenmez. Service worker yalnız laboratuvar sayfası/ad alanını ağdan geçirir; eski oyun betiklerini engelleyen kuralı korunur. Deney kendi worker'ını kaydetmez. `.mjs` girişi eski, henüz güncellenmemiş oyun worker'ının bilinmeyen `.js` engeline takılmaz; geçiş `tests/smoke/lab-legacy-worker.mjs` ile eski worker fikstürü altında doğrulanır. Test yükleyicisi `page` seçeneğiyle her girişin gerçek modül grafiğini ayrı yükler; kariyer testleri varsayılan oyunda, laboratuvar testleri ayrı sayfada kalır.

Top teması, ilk dokunuş, pas kesilmesi, gerçek serbest sürme dokunuşları, jokey/ayakla-kayarak müdahale, omuz yavaşlaması ve temastan faul/kart/avantaj uygulandı. Şut/kaleci, kale çerçevesinden fiziksel sekme, gol/skor ve 45/90 dakika maç akışı da uygulandı. Kariyerin olay biçimine çeviri V7.15.0 adaptöründe uygulanmıştır. Genel sert gövde çarpışması, ofsayt/gerçek duran toplar, 3D entegrasyonu ve son futbol dengesi sonraki işlerdir. Taç çizgisindeki rakip kısa pası ile kale çizgisindeki kaleci elinden dağıtımı/kısa korner **geçici** borçtur; duran toplar işinde kaldırılacaktır. 1,8 m erişim zarfı da henüz sıçrama/kafa mücadelesi modeli değildir; kararlar ve takip soruları şartnamededir.

Çekirdeğin `simulation-runtime` dizinleri ve seed'li üreteci simülasyon nesnesine bağlı özel WeakMap kaydındadır; kopyaya işlev, Map veya kariyer başvurusu sızmaz. Rol planı/kadro dizini takım bazında yeniden kullanılır. Hareketin saha fren hesabı, azami hızda bile çizgiye erişilemeyeceği kanıtlı iç bölgede tam eşdeğer serbest ivme yolunu kullanır; sınırda eski vektör freni aynen korunur. 54.000 adımın koordinat özeti bu optimizasyonun korumasıdır. Hız testi ağır testlerle yarışmadan seri çalışır; profil ve yerel paket/test VM ayrımı `docs/match-sim-passing-report.md`'dedir.

Sürme, müdahale ve hakem kararları `core/sim/` içinde ayrı sorumluluklardır. Hareket her adımda ortak hız/ivme/saha sınırından geçer; yerden kalkana kadar ve kırmızı karttan sonra oyuncu rol/temas listesine giremez. Sonucun sahibi temas çözümüdür: hedef seçimi ve seed'li ayak uygulama hatası başarı kararı yazmaz. Her `foul` gerçek `tackle`/`duel` kaydının hemen arkasındadır. `beat` yalnız gerçek birebir çıkışını kaydeder; `moves.json` veya 3D yönetmeni yeni motora bağlanmadı.

Fauldeki kısa pas, ceza alanı içini `penaltyPending` ile alan dışından başlatma ve 9,15 m yerleşimi **7. işe kadar geçici** borçtur. Kart kararı bu aşamada temas anında kayda girer; avantajda kartın sonraki duruşta gösterilmesi ve gol sonucuna bağlı DOGSO istisnaları gerçek duran top işine kalır. Bunlar uygulanmış penaltı olarak sunulmaz; DOGSO adayı artık kalecinin perspektifteki erişimini de kullanır.

Algı planı simülasyona özel çalışma kaydında bir geçerli pas çıkışını en çok beş tepki aralığı tutar; çizgi her tepki ve ayak çıkışında günceldir, geçersizleşirse tarama hemen yenilenir. Tepki başına pas/sür/koru karşılaştırması sürer. 90 dakikanın bütün konumları ve bütün olayları aynı tohumda iki kez özetlenerek karşılaştırılır; eski topsuz koordinat özeti ayrıca aynen korunur. Hız testinin sürme/mücadele sınırı 2 sn'dir. Ölçümler ve hedef dışı faul/kart dengesi `docs/match-sim-duels-report.md` içindedir.

Sürme dokunuşunun kısa serbest yuvarlanması genel boş top takibi başlatmaz. Taşıyıcının destekleri/derin koşuları ile savunmanın jokey/örtme hedefleri korunur; bütün uygun oyuncuların gerçek temas yarışı sürer. Kontrol zarfından uzak kalan taşıyıcı gerçek top noktasına döner. Bu ayrım `match-sim-duels.test.cjs` içinde tepki süresi dolduktan sonra rol ve hedef değişmemesiyle korunur.

Şutun `xg` değeri yalnız seçenek puanı ve istatistiktir. Sonuç, ortak top fiziğinde oyuncu/direk/kaleci temaslarının adım içindeki sırasından ve topun tamamının kale çizgisini geçmesinden doğar. Kalecinin adım ve kol/plonjon erişimi kendi hız/ivme ve tepki sınırındadır; handling zarı yalnız temas sonrası kaliteyi belirler. Yüksek zorluk ve son an bilgisi `save` olayına yazılır; özel hareket seçilmez. Golde santraya yerleşen oyuncular aynı hareket integrasyonunu kullanır; top duran yeniden başlama noktasına alınır. `match: true` tam maç akışını etkinleştirir; mevcut sentetik/topsuz tekrar yüzeyi korunur.

Kariyer bağlantısı, değişiklik/komut kuyruğu, kondisyon/sakatlık ve durumdan devam V7.15.0'da eklendi; V7.16.0 süre ve doğal gösterimi getirir. Gerçek duran toplar ve son futbol dengesi açık borçtur. Şut/kaleci dahil tam 90 dakika için üç ayrı koşunun her birinde 2 saniye bütçesi ve bütün oyuncu/top konumları, olaylar ve skorun deterministik tekrarı test edilir. Eski altınlara ve oyun girişine dokunulmaz.


## V7.18.0: deneysel 3D çizim sınırı

`core/presentation/sim/career-scene.js` ayrı mount/paint bağlantısıdır. `scene-frame.js` saf ve bağımsız çizim kopyasını örnekler; `scene-actors.js` mevcut rig'i pozlar, fizik çalıştırmaz. `scene-stage.js` mevcut stadyumu/rig'i yükler; `scene-camera.js` mevcut yayın kamerasını gerçek top/kale/kaleci zarfına sığdırır; `scene-radar.js` aynı örneği çizer. Çizim sürücüsü yine `liveFrameStep`; 3D'nin ikinci RAF simülasyon döngüsü yoktur. Eski `match3d-newview` deneysel maçta mount olmaz.

V7.19.0 ile `keeper-animation` mevcut rig üzerinde tam gövde uzanma, iniş ve el/diz desteğiyle kalkışı fizik zamanından çizer. `keeper-rig-pose` yalnız kemiklere yazar; yeni fizik, kök veya top yörüngesi üretmez. `keeper-presentation` gözlenmiş önceki kurtarışın kısa bağımsız kopyasını taşır; checkpoint ve RNG değişmez. Görsel önbellek klip örnekleyicileridir; ilerleyen dalış fazı saklanmaz.

Yeni görünümün açık borcu: vuruş/el–top hizası her temasta anatomik olarak garanti değildir; fiziksel kök plonjonu motorda henüz temsil edilmez. Kökü veya topu bunu tamamlamak için kaydırmak yasaktır. Şut kadrajı ve hareket zinciri sentetik iki yön/iki en-boy testiyle ve Chromium görüntü/video dizileriyle doğrulanır; fiziksel iPhone/Safari onayı ayrıdır.
