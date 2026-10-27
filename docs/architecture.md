# ManagerStory mimarisi

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
    engine/         maç motoru: dakika, aksiyonlar, özellik modeli, duran toplar, saat, kullanıcı takımı
    league/ clubs/  lig, fikstür, puan tablosu, rakipler; kulüp kimliği
    players/        oyuncu tipleri, profiller, özel hareketler
    season/         sezon sonu adım hattı
    presentation/   2D/3D maç görünümü, yıldız sahnesi (sadece okur)
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
- Yayınlananla ilgili testler (service worker listesi ve kuralı, başlık, manifest, önbelleğe alınan resimler) geçici bir klasöre gerçek bir build alır (`tests/support/build.cjs`).
- Duman testi (`npm run smoke`, `tests/smoke/smoke.mjs`): build GitHub Pages gibi sunulur ve Chromium'da açılır: açılış, ana ekranlar, eski ve yeni kayıtlar, sezon sonu, 3D maç, yeni sürüm bildirimi, çevrimdışı. CI her yayından önce çalıştırır.

## Tasarım ilkeleri

Sorumluluğa göre modüller (yardımcılar torbası yok); saf oyun mantığı; veri JSON'da; sürümlü ve belgelenmiş kayıt; tohumlanabilir rastgelelik; sunum sadece olay günlüğünü okur; çekirdek modları tanımaz.

## Kalan borçlar

Yeniden yapılanmadan sonra bilerek bırakılanlar:
- Motorun kariyerde yazdıkları: kondisyon, sakatlık bayrağı, `S.matchSalt`. Ayrılmaları maça özel kadro kopyası ister (oyuncu kariyeri moduyla birlikte).
- Motor kullanıcı takımının ayarlarını (`S.plan`, `S.instructions`, `S.positions`) kariyerden okuyor; `user-team.js`'e taşınabilir.
- Çekirdekte DOM/tarayıcı kullanan yerler: `core/save.js` (alert, indirme), `live-match.js` (sekme görünürlüğü), `pitch-v73.js`'in 2D saha çizimi, sezon sonu "devam" (alert, kaydırma).
- `modes/manager/app.js` hâlâ büyük (~111 KB): gelişim (`evolveV6`) → `core/players`, header ve alt menü → `ui`, highlight kaydı → `core/highlights`.
- Sunum bazı yerlerde `S`/`M`'yi doğrudan okuyor ("sadece olay günlüğü" ilkesi tam değil).
- Testler iç fonksiyonlara tek erişim noktasından ulaşıyor; modüllerin dışa açtıkları daraltılmadı.
- 3D ayar panelinde geçici "Hız ayarları" (gerçek hızlar telefonda ayarlanınca kalkar).
