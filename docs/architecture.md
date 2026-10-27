# ManagerStory mimarisi

Yeniden yapılanma A–E sonrası (V7.12.0). Dosyaların tek tek yeri: `docs/code-layout.md`. Kayıt: `docs/save-format.md`. Oyunun kuralları ve motor (başka bir motora taşımak için): `docs/game-rules.md`.

## Katmanlar

```
dist/
  data/           oyun verisi: değerleri JSON olan sabitler (kulüpler, kadro, isimler, oyuncu tipleri, taktikler, hareketler, denge, hikâye)
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
```

Katmanların işi:
- **data**: sadece değer. Fonksiyon, referans, yorum yok (yorumlar dosyanın başında). Kodun ayarladığı her sayı (zorluk, gelişim, sözleşme, eşikler) `data/balance.js`'te.
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

**Yayın ve önbellek**: `sw.js` oyunun dosyalarını sürümlü bir önbelleğe alır (`cache: "reload"`, HTTP önbelleğinin eski dosyasını almamak için) ve önbellekten verir. Her modül adresi `?v=<sürüm>` taşır (`tools/stamp-version.cjs`); damgasız ya da başka bir sürümün damgasını taşıyan bir oyun modülü isteği ancak açık kalmış eski bir sürüm sekmesinden gelebilir ve başarısız sayılır, böylece iki sürüm karışmaz. Yeni sürüm sayfa ikinci açılışta alınır.

## Testler

- Testler oyunu tarayıcının yüklediği gibi yükler: `index.html` girişleri ve importları, tek bir VM bağlamında (`tests/support/game.cjs`). Oyuna dosyayla değil adla ulaşırlar (`g.api.ad`, `run('…')`, `sourceDefining(ad)`); fonksiyon başka modüle taşınınca test değişmez.
- Altın kayıtlar (`tests/golden`): 34 fikstürün olay günlüğü, skorlar, maç özetleri, 3 sezonluk kariyer, ekranlar, kayıtlar. Yeniden yapılanma bunları hiç değiştirmedi.
- Kural testleri: çekirdek modları tanımaz, satır içi işleyici yok, `Math.random` yok, `window`'da oyun yok, modül sırası, veri saflığı, tek sürüm.

## Tasarım ilkeleri

Sorumluluğa göre modüller (yardımcılar torbası yok); saf oyun mantığı; veri JSON'da; sürümlü ve belgelenmiş kayıt; tohumlanabilir rastgelelik; sunum sadece olay günlüğünü okur; çekirdek modları tanımaz.

## Kalan borçlar

Yeniden yapılanmadan sonra bilerek bırakılanlar:
- **Build (E2–E6)**: Vite, `src/` ve `public/`, `dist`'in depodan çıkması, içerik hash'li dosyalar (damga ve `sw.js`'teki eski sekme kuralı yerine), service worker listesinin build'den üretilmesi ve "yeni sürüm hazır" bildirimi, `data/*.js` → `.json`, three.js npm'den, CI'da build ve duman testi. Bu oturumda npm paket deposuna erişim olmadığı için yapılamadı.
- Motorun kariyerde yazdıkları: kondisyon, sakatlık bayrağı, `S.matchSalt`. Ayrılmaları maça özel kadro kopyası ister (oyuncu kariyeri moduyla birlikte).
- Motor kullanıcı takımının ayarlarını (`S.plan`, `S.instructions`, `S.positions`) kariyerden okuyor; `user-team.js`'e taşınabilir.
- Çekirdekte DOM/tarayıcı kullanan yerler: `core/save.js` (alert, indirme), `live-match.js` (sekme görünürlüğü), `pitch-v73.js`'in 2D saha çizimi, sezon sonu "devam" (alert, kaydırma).
- `modes/manager/app.js` hâlâ büyük (~111 KB): gelişim (`evolveV6`) → `core/players`, header ve alt menü → `ui`, highlight kaydı → `core/highlights`.
- Sunum bazı yerlerde `S`/`M`'yi doğrudan okuyor ("sadece olay günlüğü" ilkesi tam değil).
- Testler iç fonksiyonlara tek erişim noktasından ulaşıyor; modüllerin dışa açtıkları daraltılmadı.
- 3D ayar panelinde geçici "Hız ayarları" (gerçek hızlar telefonda ayarlanınca kalkar).
