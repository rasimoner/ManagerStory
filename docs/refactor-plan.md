# ManagerStory — Yeniden yapılanma analizi ve planı

Dal: `chore/refactor-analysis` · Temel: `main` @ `b463a92` (V7.9.12) · Tarih: 26 Ekim 2026
Bu belge sadece analiz ve plandır. Kodda, testlerde ve `dist` içinde hiçbir şey değişmedi.

> Not: Proje notlarında canlı sürüm V7.9.7 yazıyor; `main` şu an **V7.9.12**. Analiz V7.9.12 üzerinden yapıldı.

---

## Kısa özet (telefon için)

- **`dist` derleme çıktısı değil, asıl kod orada.** Build adımı yok; elle yazılan 24 JS dosyası, CSS ve varlıklar `dist` içinde yaşıyor. GitHub Actions testleri çalıştırıp `dist`'i olduğu gibi yayınlıyor.
- **Şişkinliğin yarısı kullanılmayan görsel.** `dist` 15 MB; bunun 14 MB'ı görsel. Yaklaşık **7 MB görsele kodda hiç başvurulmuyor** (eski jpg/gif'ler ve eski webp'ler), ama service worker hepsini telefona indiriyor.
- **app.js bir "her şey" dosyası.** 163 fonksiyon: kariyer akışı, transfer, akademi, ekranlar, maç arayüzü ve maç motorunun kalbi (`tick`, `chance`) aynı dosyada. Tek satırı 3.000 karakteri geçen yerler var.
- **Maç motoru 5 dosyaya dağılmış ve kariyer verisine doğrudan yazıyor.** Oyuncu kariyeri modu için en büyük düğüm bu: motor "bizim takım = yönetilen takım" varsayımıyla yazılmış.
- **Her şey global.** Dosyalar sırayla yüklenip birbirinin fonksiyonlarını çağırıyor; bazı dosyalar başka dosyanın fonksiyonunu çalışma anında değiştiriyor (ör. `star-transfer.js`, `v6Sign`'ı sarıyor). 137 satır içi `onclick` var.
- **İyi haber:** 3D tarafı (`newview/*`) zaten temiz ES modülleri; `player-profiles.js` ve `match-view-adapter.js` iyi örnekler. Testler güçlü: 184 test, gerçek maçlar oynanıyor.
- **Bulunan gerçek hata:** `newview/replay.js` service worker listesinde yok; çevrimdışı açılışta 3D maç yüklenemeyebilir.
- **Önerilen yol:** önce güvenlik ağı (karakterizasyon testleri, tek test yükleyici), sonra ölü kod ve varlık temizliği, sonra dosyaları sorumluluğa göre bölme, en son motoru kariyerden ayırma ve ES modülü + build'e geçiş.
- **Süre:** odaklı çalışmayla kabaca 5–7 hafta. Yeni özellikler yaklaşık **3–4 hafta** (dosya taşıma ve motor ayrımı dönemi) dondurulmalı.
- **Senden kararlar:** dondurma tarihi, maç sonuçlarının birebir korunması, build adımı, kullanılmayan görsellerin silinmesi, gerçek kayıt örnekleri (10. bölüm).

---

## 1. Envanter

### 1.1 Depo genel görünümü

| Klasör | Boyut | Ne var |
|---|---|---|
| `dist/` | 15 MB, 120 dosya | Oyunun tamamı: kod, stil, görseller, 3D kütüphanesi |
| `docs/` | 28 MB | Sürüm notları + QA ekran görüntüleri (270 jpg, 17 mp4). Yayınlanmıyor ama depoyu ağırlaştırıyor |
| `tests/` | 308 KB | 18 test dosyası + `engine-harness.cjs` |
| `tools/` | 68 KB | Varlık üreten araçlar ve rapor araçları |
| Kök | — | `package.json` (sadece `dev` ve `test` scriptleri), `vite.config.js` (sadece geliştirme sunucusu), `.github/workflows/pages.yml`, `.openai/hosting.json` |

### 1.2 Kaynak dosyalar (`dist` içinde, elle yazılan)

Satır sayısı yanıltıcı: kodun çoğu çok uzun satırlara sıkıştırılmış. Bu yüzden bayt ve "en uzun satır" da verildi.

| Dosya | Satır | Bayt | En uzun satır | Tür |
|---|---:|---:|---:|---|
| `newview/director.js` | 2.693 | 197 KB | 592 | ES modülü |
| `app.js` | 576 | 120 KB | **3.033** | klasik script |
| `pitch-v73.js` | 1.284 | 90 KB | 353 | klasik script |
| `match3d-live-clock.js` | 780 | 86 KB | 817 | klasik script (tek IIFE) |
| `newview/runtime.js` | 879 | 58 KB | 250 | ES modülü |
| `pitch-v731.js` | 759 | 49 KB | 566 | klasik script |
| `match3d-newview.js` | 547 | 47 KB | 2.155 | ES modülü |
| `style.css` | 219 | 48 KB | **5.770** | CSS |
| `season.js` | 599 | 40 KB | 377 | klasik script |
| `match-support.js` | 495 | 34 KB | 778 | klasik script |
| `star-transfer-scene.js` | 380 | 29 KB | 342 | ES modülü |
| `newview/actions.js` | 349 | 26 KB | 306 | ES modülü |
| `career-events.js` | 155 | 23 KB | 370 | klasik script |
| `star-transfer.js` | 256 | 20 KB | 630 | klasik script |
| `newview/stadium.js` | 309 | 20 KB | 188 | ES modülü |
| `live-match.js` | 234 | 15 KB | 184 | klasik script |
| `newview/footballer.js` | 255 | 14 KB | 226 | ES modülü |
| `player-profiles.js` | 186 | 12 KB | 199 | klasik script |
| `newview/camera.js` | 112 | 8 KB | 170 | ES modülü |
| `newview/replay.js` | 109 | 7 KB | 163 | ES modülü |
| `match-view-adapter.js` | 89 | 6 KB | 828 | klasik script |
| `opponents-v731.js` | 65 | 4 KB | 232 | klasik script |
| `nav.js` | 82 | 4 KB | 139 | klasik script |
| `webmcp.js` | 33 | 2 KB | 124 | klasik script |
| `sw.js` | 43 | 3 KB | 600 | service worker |
| `index.html` | 17 | 2 KB | 538 | giriş sayfası |

Toplam: yaklaşık 11.300 satır, **~1,1 MB elle yazılmış JS/CSS**. 2.329 fonksiyon var; 29'u 5.000 karakterden uzun.

### 1.3 En büyük fonksiyonlar

| Fonksiyon | Yer | Boyut | Not |
|---|---|---:|---|
| `createDirector` | `newview/director.js:11` | 196 KB, 2.683 satır | Dosyanın tamamı tek fonksiyon; içinde 487 iç fonksiyon |
| (isimsiz IIFE) | `match3d-live-clock.js:2` | 86 KB, 779 satır | Dosyanın tamamı |
| `createRuntime` | `newview/runtime.js:79` | 53 KB, 801 satır | |
| `step` | `match3d-live-clock.js:315` | 50 KB, 453 satır | iç içe derinlik 10 |
| `run` | `newview/director.js:2230` | 26 KB | |
| `shot` | `newview/director.js:1803` | 25 KB | |
| `buildStadium` | `newview/stadium.js:4` | 20 KB | |
| `actionMinute` | `pitch-v73.js:693` | 16 KB, 200 satır | maç motorunun dakika kararı; derinlik 9 |
| (isimsiz) | `newview/director.js:858` | 16 KB | **iç içe derinlik 19** |
| `playStarTransferScene` | `star-transfer-scene.js:210` | 13 KB | |
| `chanceV73` | `pitch-v73.js:1051` | 8 KB | |
| `resolveShot` | `pitch-v73.js:1172` | 8 KB | |
| `showV6Transfers` | `app.js:86` | 3 KB, **tek satır** | transfer ekranı |

### 1.4 `dist` derleme çıktısı mı?

**Hayır.** `dist` asıl kaynak kod. `README.md` bunu açıkça söylüyor ("No build step is needed: `dist` contains the editable application and assets"). `package.json`'da build scripti yok; Vite sadece `npm run dev` için `dist`'i sunuyor.

`dist` içinde **üretilen** az sayıda şey var; bunlar `tools/` içindeki araçlarla elle üretilip commit ediliyor:

| Üretilen | Üreten araç | Not |
|---|---|---|
| `vendor/three/three.module.min.js`, `three.core.min.js`, `LICENSE` | `tools/sync-three-vendor.mjs` | `node_modules/three` 0.180.0'dan kopya |
| `vendor/three/addons/effects/OutlineEffect.js` | elle kopyalanmış | |
| `assets/models/footballer-rig.json` (420 KB) | `tools/build-rig.mjs` | Quaternius CC0 animasyonlarından |
| `assets/atmosphere/*-club-a/b/shade/base.webp` | `tools/build-club-layers.py` | kulüp rengi maskeleri |

Geri kalan her şey (JS, CSS, HTML, manifest, sw) elle yazılıyor.

### 1.5 Gömülü kütüphane ve varlıklar

- **three.js 0.180.0**: 720 KB (iki min dosya) + OutlineEffect 13 KB. Tek dış kütüphane. Lisans dosyası var.
- **Görseller: 14 MB, 81 dosya.**
  - Kodda kullanılanlar: `atmosphere/*-base.webp`, `*-club-*.webp`, `goal-club-0..17`, `office-club-0..17`, `fans-neutral.webp` (dinamik adlarla).
  - **Kodda hiç başvurulmayan ~7,2 MB** (sadece `sw.js` listesinde ve bir testte geçiyor):
    - `assets/stadium.jpg`, `training.jpg`, `office.jpg`, `fans.jpg`, `press.jpg` (1,9 MB)
    - `assets/cinematics/*` 8 dosya, gif ve jpg (3,0 MB)
    - `assets/atmosphere/{stadium,training,office,fans,press,signing,facilities}.webp` (1,8 MB)
    - `atmosphere/locker-base.webp`, `press-base.webp`, `fans-day/rain/night.webp` (~0,5 MB; fans-day/rain/night hava durumu için düşünülmüş olabilir)
  - Birebir aynı dosyalar: `cinematics/star_welcome.gif` = `cinematics/goal_1.gif`, `cinematics/star_welcome_still.jpg` = `assets/fans.jpg`.
- `dist/README.txt` eski (V7.4.0, "50 test" diyor).

### 1.6 Canlı site nasıl yayınlanıyor

1. `main`'e her push → `.github/workflows/pages.yml`.
2. Node 22 + Python 3.12 + Pillow kuruluyor (Pillow bir testte eski gif'lerin tek kare olduğunu doğrulamak için).
3. `npm test` (yaklaşık 15 dk). Test geçmezse yayın yok.
4. `dist` klasörü olduğu gibi GitHub Pages'e yükleniyor.

Ayrıca `.openai/hosting.json` da `dist`'i statik site olarak gösteriyor (başka bir barındırma; hâlâ kullanılıyor mu bilinmiyor).

Önbellek düzeni:
- Klasik scriptler `?v=7.9.12` ile yükleniyor; `match3d-live-clock.js`, `match-view-adapter.js` ve tüm ES modülleri `?v=` olmadan.
- `sw.js` 106 dosyalık listeyi kuruluşta indiriyor, sonra önce önbellekten veriyor. Önbellek adı her sürümde değişiyor.
- **Hata:** `newview/replay.js` (`match3d-newview.js:13` içinde import ediliyor) listede yok. Çevrimdışı açılışta 3D görünüm yüklenemez, 2D'ye düşer. Var olan test sadece listedeki dosyaların var olduğunu kontrol ediyor, yüklenen her dosyanın listede olduğunu değil.
- Sürüm numarası 8 yerde elle yazılıyor (`package.json`, kilit dosyası, README, `GAME_VERSION`, `index.html` başlık ve `?v=`'ler, manifest, `sw.js`, `app.js` iki metin). `version-labels.test.cjs` hepsinin aynı olduğunu zorluyor.

**Yeniden yapılanma bu süreci bozmamalı:** dosya taşındığında `index.html` script sırası, `sw.js` listesi ve testlerdeki dosya listeleri aynı commit'te güncellenmeli. Bu yüzden 9. bölümde ilk iş bu listeleri tek kaynağa bağlamak.

---

## 2. Sorumluluklar

| Dosya | Ne yapıyor | Tek Sorumluluk ihlali |
|---|---|---|
| `app.js` | Başlangıç kadrosu ve lig verisi, takvim, kulüp kimliği ve görselleri, transfer pazarı ve ekranları, akademi, harika çocuk, kariyer olayları, ekran yönlendirme (`render`), header/alt menü, kadro/taktik/diziliş ekranları, maç ekranı, oyuncu değişikliği, **maç motoru çekirdeği** (`tick`, `strength`, `attacker`, `chance`), diğer maçların simülasyonu, puan tablosu, basın toplantısı seçimleri | **Ağır.** En az 10 ayrı iş |
| `match-support.js` | Kayıt yükleme/kaydetme ve göç, maç durumu, maç olayları, faul ve kart, taktik etkileri, maç içi panel arayüzü, ana menü gezinmesi (`goMain`), dışa/içe aktarma | **Ağır.** Kayıt + motor + arayüz bir arada |
| `pitch-v73.js` | Üst yorumu "sunum, simülasyonu ilerletmez" diyor; ama ilk ~390 satır 2D saha çizimi, kalan ~900 satır **maç motoru** (`actionMinute`, paslar, çalım, orta, ofsayt, şut) | **Ağır ve yanıltıcı ad** |
| `pitch-v731.js` | Oyuncu özellik modeli, yorgunluk, ikili mücadele olasılıkları, taktik profili, asistan önerisi, duran toplar, serbest top, oyuncu çakışması | Orta: motorun ikinci yarısı |
| `live-match.js` | Maç saati, hız, canlı döngü, maç bitişi, devre arası analizi, bağırma | Orta: saat + asistan metinleri |
| `season.js` | Sezon sonu adım hattı (iyi tasarlanmış kayıt defteri), yaşlanma, emeklilik, sözleşmeler, rakip ve pazar yenileme, sezon sonu ekranları | Orta: genel sezon akışı ile teknik direktör kararları ve ekranlar bir arada |
| `career-events.js` | Basın soruları ve oyuncu görüşmeleri (veri + mantık) | Hafif |
| `player-profiles.js` | Oyuncu tipi ve özellik profili üretimi, antrenman odağı | **Temiz**, DOM ve kayıt bilgisi yok |
| `opponents-v731.js` | Rakip kadroları üretme ve geliştirme, lig seviyesi | Hafif |
| `star-transfer.js` | Yıldız transfer akışı ekranları, forma numaraları, highlight kaydı, **`v6Sign` ve `showV6Transfers`'ı çalışma anında sarma**, CSS enjekte etme | Orta |
| `star-transfer-scene.js` | 3D tünel ve gösteri sahnesi | Temiz modül, ama 13 KB'lık tek fonksiyon |
| `match3d-newview.js` | 3D maç görünümü ile oyun arasındaki köprü, HUD, tam ekran, tekrar, ayar paneli, CSS enjekte etme | Orta |
| `match3d-live-clock.js` | Sunum saati ve 2D/3D akış zamanlaması | Tek IIFE; içeride çok iş |
| `match-view-adapter.js` | Motor durumunu salt-okunur kopyalayan sınır katmanı | **Örnek alınacak** |
| `newview/*.js` | 3D: iskelet, mesh, hareketler, stadyum, kamera, yönetmen, tekrar | Modüller temiz ayrılmış; `director.js` tek dev fonksiyon |
| `nav.js` | Ortak gezinme, geri, kaydırma konumu | Temiz; ama `goMain`'i ikinci kez tanımlıyor |
| `webmcp.js` | Tarayıcı model bağlamına salt-okunur kariyer aracı | Temiz |

---

## 3. Bağımlılıklar

### 3.1 Nasıl bağlanıyorlar

- 14 klasik script `index.html` sırasıyla yükleniyor ve **tek global alanı paylaşıyor**. Bir dosyadaki üst düzey `function`/`let`/`const` her dosyadan görülüyor. 3D ES modülleri de globallere (`S`, `M`, `render`…) adıyla ulaşıyor.
- Global durum:
  - `S`: kariyer kaydının tamamı (45 üst alan). `app.js:26` `let S=loadCareer()`.
  - `M`: aktif maç. `modal`: açık ekran. `$`, `money`, `R` (tohumlu rastgele sayı üreticisi).
  - `window` üzerinde: `__cinematicNext` (iki dosya yazıyor), `OUT`, `MatchView`, `ManagerStoryNewView`, `ManagerStoryLive3D`, `ManagerStoryNav`, `ManagerStoryStarScene`, `ManagerStoryCareer3D`, `navBack`, `goMain`.
- **Yükleme sırası zorunlu ve kırılgan:** `app.js` son satırında `render()` çağırıyor; ardından yüklenen `nav.js` ve `star-transfer.js` zaten çizilmiş ekrana sonradan ekleme yapıyor (`star-transfer.js:202` yorumu bunu açıkça anlatıyor).
- **Çalışma anında fonksiyon değiştirme (maymun yaması):**
  - `star-transfer.js:194` → `app.js`'teki `v6Sign`'ı sarıyor.
  - `star-transfer.js:207` → `app.js`'teki `showV6Transfers`'ı sarıyor.
  - `app.js:159` → `pitch-v731.js`'teki `playerRecord`'u sarıyor.
  - `app.js:575` → kendi `choose`'unu sarıyor (`oldChoose`).
  - `goMain` iki kez tanımlı: `match-support.js:446` ve `nav.js:68` (`window.goMain`).
- **137 satır içi olay işleyici** (`onclick="fonksiyon(...)"`): 113'ü `app.js`'te. Bu, arayüzün çağırdığı her fonksiyonun global kalmasını zorunlu kılıyor; ES modülüne geçişin önündeki en büyük engel.
- İsim gölgelemesi: `newview/director.js` ve `newview/runtime.js` içinde `S` adında **başka** bir yerel nesne var (sahne zamanı). Kariyer `S`'si ile aynı ad, farklı anlam.

### 3.2 Bağımlılık haritası

Ok "kullanır" demek; parantezde başka dosyadan kullanılan global sayısı.

```
                         ┌──────────────── app.js ────────────────┐
                         │ S, M, R, render, save, header, OPP ... │
                         └───▲───────▲────────▲───────▲───────▲───┘
   season.js (28) ───────────┘       │        │       │       │
   star-transfer.js (17) ────────────┘        │       │       │
   match-support.js (16) ─────────────────────┘       │       │
   pitch-v73.js (10), pitch-v731.js (7) ──────────────┘       │
   career-events (7), live-match (6), match3d-* (5-7),        │
   opponents (5), webmcp (3), nav (1), player-profiles (1) ───┘

   app.js ──► match-support (29), player-profiles (11), live-match (10),
              pitch-v73 (9), pitch-v731 (9), season (8), career-events (5) ...

   pitch-v73.js ◄──► pitch-v731.js   (36 / 11)   motorun iki yarısı
   match3d-newview.js ──► newview/{stadium,runtime,rig,director,camera,replay}.js ──► vendor/three
   star-transfer-scene.js ──► newview/* (aynı parçalar)
   newview/* ──► (kariyerden habersiz; sadece three.js)        ✔ temiz
   player-profiles.js ──► sadece R                              ✔ neredeyse temiz
```

### 3.3 Döngüsel bağımlılıklar

Klasik scriptlerde her şey global olduğu için "döngü" karşılıklı çağrı demek. Başlıcaları:

- `app.js` ↔ `match-support.js` (29 / 16)
- `app.js` ↔ `season.js` (8 / 28)
- `app.js` ↔ `live-match.js` (10 / 6)
- `app.js` ↔ `career-events.js`, `opponents-v731.js`, `star-transfer.js`, `player-profiles.js`
- `pitch-v73.js` ↔ `pitch-v731.js` (36 / 11)
- `match-support.js` ↔ `live-match.js`, `pitch-v73.js` ↔ `live-match.js`
- `match3d-live-clock.js` ↔ `match-view-adapter.js` ↔ `match3d-newview.js`

Kısaca: neredeyse her dosya `app.js`'e bağlı, `app.js` de neredeyse her dosyaya. Döngüsüz olanlar: `newview/*`, `player-profiles.js` (sadece `R`), `webmcp.js`, `nav.js`.

---

## 4. Clean Code bulguları (önem sırasıyla)

### 4.1 Maç motoru dağınık ve kariyere yazıyor (en önemli)
- Motor 5 dosyada: `app.js:472` `tick`, `app.js:494` `strength`, `app.js:507` `attacker`, `app.js:517` `chance`, `pitch-v73.js:693` `actionMinute`, `pitch-v73.js:1051` `chanceV73`, `pitch-v73.js:1172` `resolveShot`, `pitch-v731.js:490` `executeRestart`, `match-support.js:214` `recordMatchFoul`, `live-match.js:109` `finalizeMatch`.
- `tick` kariyer verisini doğrudan değiştiriyor: `app.js:477` kondisyon ve dakika, `app.js:481` ilk maç morali, `app.js:485` sakatlık. Motor "sonucu bildir, kariyer uygulasın" yerine kariyerin içine yazıyor.
- İki takım farklı temsil ediliyor: bizimkiler `S.players` (sayı kimlik), rakip `OPP` dizisi + `S.opponentSquads` (`'o0'` gibi metin kimlik). Rakip şutçusu bile diziden uyduruluyor: `app.js:518` `{name:r[0].split(" ")[0]+" forvet", finishing:r[3], ...}`.
- Dosya adı ve yorum yanıltıcı: `pitch-v73.js:1` "Presentation ... never advances the seeded simulation" diyor, ama dosyanın üçte ikisi simülasyon.

### 4.2 `app.js` tanrı dosyası
- 163 fonksiyon, 120 KB. 111 satırı 300 karakterden uzun.
- Tek satırlık dev fonksiyonlar: `app.js:86` `showV6Transfers` (3.033 karakter), `app.js:449` maç ekranı şablonu (2.841), `app.js:573` `finishMatch` (2.153), `app.js:206` `promoteV6` (2.105), `app.js:37` `init` (1.756).
- `render()` (`app.js:234`) her çizimde `init()` ve `save()` çağırıyor: çizim yan etkili.
- `choose(x)` (`app.js:290`, 5,5 KB) metin protokolüyle dallanıyor: `"dynPromise:12"`, `"meeting:3:..."`; `app.js:575`'te ikinci bir `choose` ile sarılıyor.

### 4.3 Dev fonksiyonlar ve derin iç içe yapı
- `newview/director.js:11` `createDirector`: dosyanın tamamı, 2.683 satır. `director.js:858` iç içe derinlik 19.
- `match3d-live-clock.js:2`: dosyanın tamamı tek IIFE; `step` (`:315`) 450 satır, derinlik 10.
- `newview/camera.js:10` `shot` derinlik 11; `pitch-v73.js:693` `actionMinute` derinlik 9; `pitch-v731.js:381` `placeRestartPlayers` derinlik 8.
- Çok parametre: `match3d-live-clock.js:297` `keyframeTransition` (9), `app.js:88` `cinematic` (8), `season.js:389` `seasonMakeRival` (7).

### 4.4 Global durum ve çalışma anında yama
3.1'deki maymun yamaları, 137 satır içi `onclick`, iki kez tanımlı `goMain`, `window.OUT` (`app.js:542`), iki dosyanın yazdığı `window.__cinematicNext`. Bunlar okuyanın "bu fonksiyon gerçekte ne yapıyor" sorusunu tek dosyadan cevaplayamamasına yol açıyor.

### 4.5 Sihirli sayılar ve dizi indeksleri
- Rakip takımlar konumsal dizi: `app.js:5` `["Boğaz Yıldızı",69,"deep",66,68,74,72,58,82,"..."]`. Kodda `r[2]==="high"`, `(r[3]+r[4]+r[5])/3` (`app.js:479`), `r[6]` kaleci (`app.js:526`). Hangi indeksin ne olduğu yazmıyor.
- Başlangıç kadrosu da konumsal dizi: `app.js:2` `P0`.
- Oyuncu adına özel kural: `app.js:510` `p.name==="Mensah"&&r[2]==="high"?1.55`, `p.name==="Oğuz"`.
- Kadro sırasına özel kural: `app.js:310` `S.players[12].morale-=2` (13. oyuncu kim olursa olsun); aynı blokta sabit kulüp ve bedel ("Kuzey Liman ₺11.5M", `app.js:307`).
- Kulüp adı 43 yerde sabit: `"Anadolu Hisarı"` (33'ü `app.js`'te, ör. `app.js:207`). Teknik direktör kariyerindeki "takım seçimi" için doğrudan engel.
- Talimatlar Türkçe arayüz metniyle karşılaştırılıyor: `app.js:497` `ins==="Merkeze yaklaş"`. Metin değişirse oyun mantığı bozulur.
- Olasılıklar isimsiz: `app.js:484` `M.rand()<.42` (faul), `app.js:485` `.0015` (sakatlık), `app.js:527` `.38+q/360`, `.20+(q-keeper)/210`.
- Sayısal sabit yoğunluğu: `director.js` 1.831, `actions.js` 1.034 (anahtar kare verisi, kabul edilebilir), `app.js` 907, `pitch-v73.js` 849.

### 4.6 Sürüm adlı isimler
- Dosyalar: `pitch-v73.js`, `pitch-v731.js`, `opponents-v731.js`, `match3d-live-clock.js`.
- 41 farklı tanımlayıcı: `pitchV73` (35 kullanım), `showV6Transfers`, `v6Sign`, `positionPenaltyV61`, `chanceV73`, `crossV79`, `managerDecisionV72`, `halfAnalysisV72`, `makeV71PrePress`; CSS sınıfları `premium v72 v73`.
- Koddaki 158 "V7.x" yorumu fiilen bir değişiklik günlüğü. Ad, "ne işe yaradığını" değil "ne zaman yazıldığını" söylüyor.

### 4.7 Tekrar eden kod
- `p.status!="Transfer oldu"` filtresi en az 12 kez (`app.js`'te 17 "Transfer oldu" geçişi).
- `S.players.find(p=>p.id==id)` 29 kez, `M.active.includes(p.id)` 23 kez.
- Yardımcıların kopyaları: `season.js` kendi `seasonClamp`, `seasonEsc`'ini tanımlıyor; `star-transfer-scene.js:49` kendi `esc`'i; `newview/runtime.js` kendi `clamp`'i.
- CSS iki yerden JS ile enjekte ediliyor (`star-transfer.js:217`, `match3d-newview.js:16`); `style.css` içinde 97 `!important`, 5.770 karakterlik tek satır.

### 4.8 Belirsiz isimler
`S`, `M`, `R`, `r`, `x`, `q`, `a`, `vr`, `flow`, `tick`. Kariyer `S`'si ile 3D yönetmenin yerel `S`'si aynı ad. `v6Talk`, `v6Home` ne yaptığını söylemiyor.

### 4.9 Ölü kod
Oyunda hiçbir yerden çağrılmayan fonksiyonlar:
- `app.js:207` `v6Home`, `app.js:288` `contextCards`, `app.js:417` `radarUserPos`, `app.js:466` `matchDecision`, `app.js:537` `stopCheck` (hep `false` döndürüyor), `app.js:565` `matchField`, `app.js:574` `choosePost` (boş gövde).
- `live-match.js:122` `matchSyncDebug`, `live-match.js:134` `choosePassTarget`: sadece testlerden çağrılıyor.
- ~7,2 MB kullanılmayan görsel (1.5), eski `dist/README.txt`.
- Yorum satırına alınmış kod pek yok (iyi).

### 4.10 Olumlu bulgular (korunacak)
- `newview/*` ES modülleri: DOM'suz, kariyerden habersiz, testlenebilir.
- `match-view-adapter.js`: salt-okunur sınır katmanı; motor ile görünüm arasında doğru desen.
- `player-profiles.js`: saf fonksiyonlar.
- `season.js`'teki adım kayıt defteri (`seasonEndStep(step, {after|before})`): modların kendi adımını eklemesi için hazır bir genişleme noktası.
- Tohumlu RNG (`R`) ve "motor `Math.random` kullanmaz" kuralı testle korunuyor.

---

## 5. Test kapsaması

### 5.1 Mevcut durum
- 18 test dosyası; `node --test` ile **184 test**. Bu dalda yerelde tam test çalıştırıldı; sonuç aşağıdaki satırda.
  - Yerel sonuç: (çalışıyor; tamamlanınca güncellenecek)
- Ne koruyor:
  - Maç motoru bütünlüğü (faz 1–3): top sahipliği, takım izolasyonu, saha sınırları, taktiklerin etkisi, duran toplar, tam süre dondurma, hızdan bağımsız aynı olay akışı.
  - Maç saati, devre arası, oyuncu değişikliği, sakatlık.
  - 3D yönetmen: olay günlüğünü sahaya doğru oynatma (varsayılan 2 fikstür; "34 maç 272/272" `NV_FIXTURES=0,...,33` ile elle çalıştırılıyor).
  - Sezon geçişi, oyuncu profilleri, yıldız transfer akışı, gezinme, sürüm etiketleri.
  - Eski kayıt göçü: V7.1, V7.2, V7.3, V7.3.1, V7.3.2.

### 5.2 Yeniden yapılanmayı zorlaştıran test alışkanlıkları
- **Script listesi 6 yerde kopya:** `tests/engine-harness.cjs:7`, `managerstory.test.cjs:7`, `navigation.test.cjs:9`, `season-transition.test.cjs`, `star-transfer.test.cjs`, `matchengine-phase1/3`. Her dosya taşımada hepsi değişmeli.
- **Kaynak metnine bakan testler** (davranış değil dosya içeriği):
  - `matchengine-phase1.test.cjs:305`: belirli fonksiyonların belirli 5 dosyada en fazla bir kez tanımlandığını sayıyor.
  - `matchengine-phase3.test.cjs:63` ve `:493`, `matchengine-phase2.test.cjs:268`: belirli dosyalarda `Math.random` ve `M.press` geçmediğini kontrol ediyor.
  - `star-transfer.test.cjs:37`, `outline-scale.test.cjs:31`, `footballer-mesh.test.cjs:61`, `version-labels.test.cjs`.
  - Bu kurallar değerli; ama dosya adına bağlı. Klasör bazlı kurala çevrilmeli (ör. "`src/core/engine/**` içinde `Math.random` yok").
- **Görsel testi kullanılmayan dosyaları zorunlu kılıyor:** `managerstory.test.cjs:146` eski 7 webp'in ve eski gif'lerin varlığını bekliyor (CI'daki Pillow bağımlılığı da bu yüzden).
- **Tam test 15 dakika.** Küçük adımlarla ilerlemek için hızlı bir alt küme gerekli.

### 5.3 Boşluklar
- Kayıt dışa/içe aktarma (`exportCareer`, `importCareer`, `validateCareerImport`) test edilmiyor.
- V7.3.3 sonrası kayıtlar (V7.9.5 profilleri, V7.9.6 sezon sonu ortası, maç ortası kayıt) için gerçek kayıt örneği yok.
- Transfer ve akademi ekranlarının akışı, basın ve görüşme seçimleri (`choose`) az test ediliyor.
- 3D köprü (`match3d-newview.js`), stadyum, tekrar, yıldız sahnesinin 3D bölümü neredeyse hiç.
- Service worker listesinin eksiksizliği (replay.js hatası bu yüzden kaçtı).
- Maç olay günlüğünün tamamını sabitleyen bir "altın kayıt" yok; testler kuralları (değişmezleri) kontrol ediyor, birebir sonucu değil.

### 5.4 Refactor öncesi gereken karakterizasyon testleri
1. **Maç altın kaydı:** 34 fikstür × sabit tohum; her maç için olay günlüğünün özeti (hash) ve skor. Motor dosyaları taşınırken bit bit aynı kalmalı. Rastgele sayı çağrı sırası değişirse yakalar.
2. **Sezon altın kaydı:** 2 sezonu hızlı oynatıp kaydın (`S`) hash'i: tablo, oyuncular, transfer havuzu, akademi.
3. **Ekran anlık görüntüleri:** sabit bir kayıtla ana sayfa, kadro, taktik, transfer, akademi, lig, maç ekranı, sezon sonu ekranlarının HTML'i.
4. **Gerçek kayıt örnekleri:** senin telefonundan dışa aktarılmış 3–4 kayıt (sezon ortası, sezon sonu ekranında, maç ortasında, eski bir sürümden) yüklenip birkaç hafta oynanabiliyor mu.
5. **Dışa/içe aktarma** gidiş-dönüş testi.
6. **Service worker eksiksizliği:** `index.html`'in yüklediği her dosya ve ES modüllerinin import zinciri `sw.js` listesinde.

---

## 6. Çekirdek / mod ayrımı

Kural: **çekirdek hiçbir moddan haberdar olmamalı; bağımlılık sadece moddan çekirdeğe akmalı.**

### 6.1 Modüllerin yerleşimi

| Grup | Bugünkü yer | Hedef |
|---|---|---|
| **Ortak çekirdek — maç motoru** | `app.js` (`tick`, `strength`, `attacker`, `chance`, `R`, `matchSeed`), `pitch-v73.js` simülasyon kısmı, `pitch-v731.js`, `match-support.js` maç kısmı (`ensureMatchState`, `matchEvent`, faul/kart, `tacticalEffects`), `live-match.js` saat ve bitiş | `core/engine` |
| **Ortak çekirdek — oyuncu** | `player-profiles.js`, `pitch-v731.js` özellik modeli, `app.js` gelişim (`evolveV6`), özel hareketler (`movesNow`, `recordMoves`, `SKILL_NAMES`), `season.js` yaşlanma ve emeklilik | `core/players` |
| **Ortak çekirdek — lig** | `app.js` (`allTeams`, `makeLeagueSchedule`, `simAIGame`, `applyTableGame`, `recordForm`), `opponents-v731.js`, `OPP`, kulüp kimliği (`CLUBSTYLE`, `crest`, `resolveClubIdentity`) | `core/league`, `core/clubs` |
| **Ortak çekirdek — sezon** | `season.js` adım hattı ve genel adımlar (`summary`, `aging`, `retire`, `loans`, `rivals`, `cleanup`, `newSeason`) | `core/season` |
| **Ortak çekirdek — kayıt** | `match-support.js` (`loadCareer`, `persistCareer`, `migrateV71`, dışa/içe aktarma), `app.js:30` `save` | `core/save` |
| **Ortak çekirdek — 3D ve highlight** | `newview/*`, `match3d-newview.js`, `match3d-live-clock.js`, `match-view-adapter.js`, `star-transfer-scene.js` (sahne), `S.highlights` kaydı | `core/presentation`, `core/highlights` |
| **Teknik direktör modu** | `app.js`: transfer pazarı ve ekranları, akademi, harika çocuk teklifleri, kadro/diziliş/taktik ekranları, talimatlar, yönetim, gelen kutusu, `choose`, günün kararı; `career-events.js` (basın, görüşmeler); `star-transfer.js` akışı; `season.js` adımları `report`, `contracts`, `academy`, `market` ve sezon sonu ekranları | `modes/manager` |
| **Ortak arayüz** | `nav.js`, `header`, `cinematic`, `escapeHTML`, `money`, ekran kabuğu (`render`'ın iskeleti), `style.css`, maç ekranının çatısı, `webmcp.js` | `ui` |

Not: alt menüdeki sekmeler (Kadro, Taktik, Transfer, Akademi) teknik direktöre özgü; menü bileşeni ortak, sekme listesi moddan gelmeli.

### 6.2 Birbirine dolanmış yerler
1. **Motorun "bizim takım" varsayımı.** Motor yönetilen takımı `S.players`/`S.xi`/`S.instructions`/`S.positions`'tan, rakibi `OPP` dizisi ve `S.opponentSquads`'tan okuyor. Taraf bile kimlik türünden anlaşılıyor (sayı = biz, metin = rakip). Oyuncu kariyerinde oyuncunun takımı herhangi bir takım olabilir; motorun iki takımı **aynı biçimde** alması gerekiyor.
2. **Motor kariyere yazıyor** (4.1). Kondisyon, dakika, moral, sakatlık, gol/asist sayıları maç sonucunda moda bildirilmeli.
3. **`match-support.js` dört işi karıştırıyor:** kayıt, motor, maç arayüzü, ana menü gezinmesi.
4. **Sezon hattı** genel ama içine teknik direktör adımları ve ekranları gömülü; adımların mod tarafından kaydedilmesi gerekiyor (altyapı hazır).
5. **Yıldız transferi** `v6Sign`'ı sarıyor. Sahne (3D) ortak; tetikleyici (transfer) teknik direktöre özgü. Highlight kaydı ortak olmalı.
6. **Kulüp adı sabit** (`"Anadolu Hisarı"` 43 yer). Her iki mod da "kahramanın kulübü" kavramına ihtiyaç duyuyor.
7. **Maç ekranı** taktik ve oyuncu değişikliğini (teknik direktör) saat, skor ve 3D görünümle (ortak) aynı şablonda üretiyor (`app.js:444` `matchUI`).

### 6.3 Oyuncu kariyeri modunun çekirdekten ihtiyaçları
- İki takımı simetrik alan, dışarıdan "odak oyuncu" verilebilen maç motoru (olay günlüğü, oyuncu bazlı istatistik ve not).
- Oyuncu modeli: profil, özellikler, gelişim, yaşlanma, özel hareketler, antrenman odağı.
- Lig: takvim, tablo, diğer maçların simülasyonu, kulüpler ve kadrolar.
- Sezon hattı: genel adımlar + modun kendi adımları (ör. kulüp teklifi, menajer görüşmesi).
- Kayıt: ortak çekirdek alanları + moda ait ayrı bir bölüm.
- 3D maç görünümü, tekrar, highlight arşivi, özel hareket sahnesi.
- Ortak arayüz parçaları: header, gezinme, sinematik, stil.

### 6.4 Kuralın korunması
Modüller ayrıldığında bir test, `core/**` içindeki hiçbir dosyanın `modes/**` veya `ui/**`'ı içe aktarmadığını kontrol etmeli. Klasik script döneminde de aynı test "çekirdek dosyalar mod dosyalarında tanımlı global adları kullanmıyor" diye yazılabilir (bu analizdeki araç bunu yapabiliyor).

---

## 7. Kayıt uyumluluğu

### 7.1 Bugünkü kayıt
- `localStorage` anahtarı `"msv4"`; değer `S`'nin JSON'u. Yeni kariyer ~218 KB, sezon başına ~30–35 KB büyüyor.
- `S` 45 üst alan taşıyor; bunların bir kısmı sürüm adlı: `v6`, `v71`, `v72`, `v73`, `v731`, `v732`, `v733`, `v795`, `v796`.
- Maç ortası kayıt: `S.activeMatchV71` içinde `M`'nin kopyası ve rastgele üreticinin durumu (`rngState`).
- Sezon sonu ortası kayıt: `S.seasonEnd` adım kimliklerini (`summary`, `aging`, …, `newSeason`) ve konumu tutuyor.
- Bekleyen olay `S.event` içinde; seçenek anahtarları `choose(x)` dallarına bağlı (`"dynPromise:12"` gibi).
- Eski sürüm yedekleri: `msv4-v70-backup` … `msv4-v733-backup`, içe aktarma öncesi `msv4-before-import`.
- Göçler dağınık: `match-support.js` (54 varsayılan atama), `season.js` (12), `match3d-live-clock.js` (12), `live-match.js`, `app.js` vb.

### 7.2 Riskler
1. **Alan adı değişikliği.** `S.v6` gibi adları "temizlemek" eski kayıtları bozar. → Yeniden yapılanma süresince kayıt şeması **dondurulur**; kod içinde anlamlı adlar, kayıtta eski adlar; arada tek bir okuma/yazma katmanı.
2. **Rastgele sayı çağrı sırası.** Motor fonksiyonları taşınırken `M.rand()` çağrılarının sırası değişirse maç ortası kayıt farklı devam eder ve aynı tohum farklı maç üretir. → Maç altın kaydı (5.4/1).
3. **Kayıtta saklanan metin anahtarlar.** Olay türleri (`kind`), seçenek anahtarları, sezon adım kimlikleri, talimat metinleri (`"Merkeze yaklaş"`). Bunlar yeniden adlandırılırsa bekleyen olay veya yarım kalmış sezon sonu açılmaz. → Bu metinler "kayıt sözleşmesi" sayılır; değişirse göç yazılır.
4. **Kimlikler.** Oyuncu kimlikleri tekrar kullanılmıyor (highlight arşivi buna dayanıyor); rakiplerin `'o0'` biçimi motorda taraf ayrımı için kullanılıyor. Rakip temsili değişirse göç gerekir.
5. **Service worker geçişi.** Dosya adları değiştiğinde eski önbellek ile yeni HTML karışmamalı. Önbellek adı her sürümde değiştiği için risk düşük; ama dosya listesi elle tutulduğu sürece eksik dosya riski var (replay.js örneği).
6. **İçe aktarma.** Eski sürümlerden dışa aktarılmış dosyalar `validateCareerImport`'tan geçmeye devam etmeli.

### 7.3 Önlemler
- Gerçek kayıt örnekleri test klasörüne (5.4/4).
- Kayıt şemasına tek bir sürüm alanı (`schemaVersion`) ve sıralı göç zinciri: her göç bir fonksiyon, testli. Bu, yeniden yapılanmanın sonunda yapılır; arada şema değişmez.
- Mod ayrımında kayıt: çekirdek alanlar aynı yerde kalır; teknik direktöre özgü alanlar zamanla `S.manager` altına göç ettirilir (yedek alınarak, tek seferde, testle).

---

## 8. Hedef yapı önerisi

```
src/
  core/
    rng/            tohumlu üretici, tohum kuralları
    engine/         maç durumu, dakika döngüsü, pas/çalım/orta/şut, duran toplar,
                    faul/kart, ofsayt, saat, maç sonucu (kariyere değil, sonuca yazar)
    players/        profil, özellikler, gelişim, yaşlanma, özel hareketler
    league/         takvim, tablo, diğer maçlar, rakip kadroları
    clubs/          kulüp verisi ve kimliği (renk, arma)
    season/         adım hattı + genel adımlar
    save/           yükleme, kaydetme, göçler, dışa/içe aktarma
    highlights/     highlight kaydı ve arşiv
    presentation/
      match2d/      2D saha çizimi (pitch-v73'ün çizim yarısı)
      match3d/      newview/*, köprü, sunum saati, görünüm adaptörü
      scenes/       yıldız transfer sahnesi ve gelecekteki sahneler
  modes/
    manager/        kariyer döngüsü, transfer, akademi, kadro/taktik ekranları,
                    basın ve görüşmeler, gelen kutusu, yönetim, sezon adımları
                    (sözleşme, pazar, akademi raporu), yıldız transfer akışı
    player/         (ileride) oyuncu kariyeri
  ui/               ekran kabuğu ve yönlendirme, header, alt menü, gezinme,
                    sinematik, ortak bileşenler, stiller (ekran başına CSS)
  main.js           giriş: kaydı yükle, modu seç, kabuğu başlat
public/             görseller, ikonlar, manifest, rig json (olduğu gibi kopyalanır)
tools/              varlık üreticileri (değişmez)
tests/              tek oyun yükleyici + birim + altın kayıt + kayıt örnekleri
dist/               SADECE derleme çıktısı; depoda tutulmaz (.gitignore)
```

**`dist`'in yeni rolü:** CI'da `vite build` ile üretilen çıktı. Build aşaması:
- `package.json`'daki sürümü koda ve dosya adlarına yazar (8 yerde elle güncelleme biter);
- three.js'i `node_modules`'tan alır (vendor kopyası biter);
- service worker dosya listesini otomatik üretir (replay.js türü hatalar biter);
- dosya adlarına içerik hash'i ekler (`?v=` biter).

Bu geçiş en sonda yapılır (9. bölüm, 6. aşama). O zamana kadar oyun bugünkü gibi build'siz çalışır; klasörler ilk aşamalarda `dist` içinde oluşturulup en son `src`'ye alınabilir. Böylece her adımda canlı site aynı yolla yayınlanmaya devam eder.

---

## 9. Adım adım plan

Her adımın ortak kuralı: ayrı dal → `npm test` yeşil + maç altın kaydı birebir aynı → telefonda en fazla 3 kontrol → `main`. Davranış değişmez; değişen tek şey kodun yeri ve biçimi.

Büyüklük: **S** ≈ yarım gün, **M** ≈ 1–3 gün, **L** ≈ 4–7 gün, **XL** ≈ 1–2 hafta.

### Aşama 0 — Güvenlik ağı (özellik geliştirme ile paralel yürüyebilir)
| # | Adım | Büyüklük | Risk |
|---|---|---|---|
| 0.1 | Tek oyun yükleyici: testler dosya listesini `index.html`'den okusun; 6 kopya liste kalksın | S | Düşük |
| 0.2 | Maç altın kaydı (34 fikstür, olay günlüğü hash'i) | M | Düşük |
| 0.3 | Sezon altın kaydı ve ekran HTML anlık görüntüleri | M | Düşük |
| 0.4 | Gerçek kayıt örnekleri + dışa/içe aktarma testi | S | Düşük |
| 0.5 | Service worker eksiksizlik testi (bugün kırmızı çıkar: replay.js) | S | Düşük |
| 0.6 | Hızlı test profili (`npm run test:fast`, birkaç dakika) ve tam test ayrımı | S | Düşük |

### Aşama 1 — Düşük riskli temizlik
| # | Adım | Büyüklük |
|---|---|---|
| 1.1 | replay.js'i service worker listesine ekle (ayrı küçük hata düzeltmesi; karar 7) | S |
| 1.2 | Ölü fonksiyonları sil (4.9) | S |
| 1.3 | Kullanılmayan görselleri sil ve görsel testini güncelle (karar 4) | S |
| 1.4 | Geçici test butonlarını kaldır (sen "kapat" dersen; taşınacak kodu azaltır) | S |
| 1.5 | `dist/README.txt` güncelle veya kaldır | S |

### Aşama 2 — Dosyaları sorumluluğa göre bölme (davranış aynı, hâlâ klasik script)
Klasik scriptler aynı global alanı paylaştığı için bir fonksiyonu kelimesi kelimesine başka dosyaya taşımak davranışı değiştirmez; yeter ki yükleme sırası korunsun.
| # | Adım | Büyüklük |
|---|---|---|
| 2.1 | `match-support.js`'i böl: kayıt / maç durumu ve olaylar / maç paneli arayüzü / gezinme | M |
| 2.2 | `app.js`'ten veri tablolarını ayır (`P0`, `OPP`, `CLUBSTYLE`, `SKILL_NAMES`, isim listeleri) | S |
| 2.3 | `app.js`'ten lig (takvim, tablo, diğer maçlar) ve kulüp kimliğini ayır | M |
| 2.4 | `app.js`'ten teknik direktör ekranlarını ayır: transfer, akademi, kadro, taktik, gelen kutusu, ayarlar | L |
| 2.5 | `goMain` tekrarını ve `star-transfer.js` yamalarını açık bir "transfer tamamlandı" çağrısına çevir | S |

### Aşama 3 — Maç motorunu tek yerde toplama
| # | Adım | Büyüklük |
|---|---|---|
| 3.1 | `pitch-v73.js`'i ikiye böl: 2D çizim ve simülasyon | M |
| 3.2 | Motor parçalarını (`tick`, `strength`, `attacker`, `chance`, `pitch-v731`, faul/kart, saat) `core/engine` dosyalarına topla; sürüm adlı dosya ve fonksiyon adlarını anlamlı adlara çevir (kayıt alanları hariç) | L |
| 3.3 | Kaynak metnine bakan testleri klasör kuralına çevir (5.2) | S |

### Aşama 4 — Motoru kariyerden ayırma (en riskli)
| # | Adım | Büyüklük |
|---|---|---|
| 4.1 | Motora "takım girdisi" katmanı: iki takım aynı biçimde (oyuncular, ilk 11, taktik, talimatlar); bugünkü kaynaklardan dolduran adaptör | L |
| 4.2 | Motorun kariyere yazdıklarını (kondisyon, dakika, moral, sakatlık, istatistik) "maç sonucu" olarak döndürmesi; teknik direktör modunun uygulaması. RNG sırası korunur | XL |
| 4.3 | "Kahramanın kulübü" kavramı; `"Anadolu Hisarı"` sabitlerinin kaldırılması (teknik direktör takım seçimini de hazırlar) | M |

### Aşama 5 — ES modülleri ve mod sınırı
| # | Adım | Büyüklük |
|---|---|---|
| 5.1 | Satır içi `onclick`'leri tek bir olay dağıtıcısına çevir (`data-action`) — ekran ekran | L |
| 5.2 | Klasik scriptleri ES modüllerine çevir; globaller yerine açık `import` | L |
| 5.3 | `core` → `modes` bağımlılığını yasaklayan test; sezon adımlarını mod kaydetsin | S |

### Aşama 6 — Build ve `dist`'in yeni rolü
| # | Adım | Büyüklük |
|---|---|---|
| 6.1 | `src/` + `public/` yapısı, `vite build`, sürüm enjeksiyonu, otomatik service worker listesi | M |
| 6.2 | CI: test → build → yayın; `dist` `.gitignore`'a | S |

### Aşama 7 — Sürekli iç iyileştirmeler (yeni özelliklerle birlikte)
- `newview/director.js`'i sahnelere böl (pas, şut, kaleci, duran top, özel hareketler).
- `match3d-live-clock.js`'i böl.
- `OPP`/`P0` dizilerini adlandırılmış nesnelere çevir (kayıtta göçle).
- Sihirli olasılıkları adlandırılmış ayar dosyasına taşı.
- CSS'i ekran başına böl, `!important`'ları azalt, JS'ten enjekte edilen CSS'i dosyaya al.

### Süre ve dondurma
| Aşama | Süre (odaklı çalışma) | Yeni özellik |
|---|---|---|
| 0–1 | ~1 hafta | Devam edebilir (ayrı dallarda) |
| 2–3 | ~2 hafta | **Dondurulur** |
| 4–5 | ~2–3 hafta | **Dondurulur** (küçük görsel düzeltmeler, taşınmayan dosyalarda olabilir) |
| 6 | ~3–4 gün | Devam edebilir |
| 7 | sürekli | Devam |

**Toplam: kabaca 5–7 hafta. Dondurma: yaklaşık 3–4 hafta (Aşama 2'nin başından Aşama 5'in sonuna kadar).** Paralel sohbetlerde aynı dosyaya dokunan özellik dalları taşıma dallarıyla çakışır; dondurmanın asıl sebebi bu.

---

## 10. Riskler ve senin vermen gereken kararlar

### Riskler
| Risk | Etki | Önlem |
|---|---|---|
| Maç sonuçlarının sessizce değişmesi (RNG sırası) | Denge bozulur, maç ortası kayıt farklı devam eder | Maç altın kaydı; motor adımlarında birebir eşitlik |
| Eski kayıtların açılmaması | Oyuncu kariyerini kaybeder | Şema dondurma, gerçek kayıt örnekleri, yedek anahtarları |
| Service worker'da eksik dosya | Çevrimdışı 3D bozulur | Eksiksizlik testi, sonra otomatik liste |
| 15 dakikalık test süresi | Küçük adımlar yavaşlar | Hızlı test profili |
| Kaynak metnine bakan testler | Taşımada yanlış alarm | Klasör kuralına çevirme |
| Paralel özellik dallarıyla çakışma | Birleştirme kaosu | Dondurma dönemi |
| Aşama 4'te motorun ayrılması | En büyük davranış riski | En sona yakın, en çok testle, gerekirse 2 deneme sonra geri al |
| Telefonda performans (çok sayıda ES modülü) | İlk açılış yavaşlar | Aşama 6'daki build paketlemesi |

### Kararlar
1. **Dondurma dönemi:** Aşama 2–5 için yaklaşık 3–4 hafta. Ne zaman başlasın?
2. **Maç sonuçları birebir korunsun mu?** Önerim: Aşama 2–3'te kesinlikle evet (altın kayıt). Aşama 4'te de evet; olmuyorsa "istatistik aralığı" testleriyle yeni bir temel kabul edilebilir mi?
3. **Build adımı:** Vite build + `dist` depodan çıkar (önerim) mi, yoksa build'siz ES modülleriyle devam mı?
4. **Kullanılmayan ~7 MB görsel:** silinsin mi? `fans-day/rain/night.webp` hava durumu için tutulsun mu?
5. **`docs/qa-*` ekran görüntüleri (~28 MB, docs klasörünün neredeyse tamamı):** depoda kalsın mı, başka yere (ör. GitHub Release eki) mi taşınsın?
6. **Gerçek kayıt örnekleri:** telefonundan 3–4 dışa aktarılmış kayıt (sezon ortası, sezon sonu ekranında, maç ortasında, mümkünse eski bir sürümden) verebilir misin?
7. **replay.js çevrimdışı hatası:** yeniden yapılanmadan önce ayrı küçük bir düzeltme olarak mı alınsın?
8. **Kayıt şeması:** `msv4` ve sürüm adlı alanlar okuma katmanıyla sonsuza dek korunsun (önerim) mu, yoksa sonunda yedekli tek seferlik göçle temiz şemaya mı geçilsin?
9. **Rakip temsili:** rakiplerin de tam oyuncu nesnesi olması oyuncu kariyeri için gerekli ve dengeyi etkileyebilir. Aşama 4'te mi, sonra mı?
10. **Geçici test butonları** ("Yıldız anı dene", "Kaleci sahnesi", "Transfer sahnesi dene"): yeniden yapılanmadan önce kaldırılsın mı?
11. **`.openai/hosting.json`:** bu barındırma hâlâ kullanılıyor mu?
12. **Kod dili:** fonksiyon adları İngilizce, arayüz metinleri Türkçe (bugünkü fiili durum) kural olarak yazılsın mı? Oyun mantığının Türkçe arayüz metinlerini karşılaştırması (4.5) kaldırılacak.

---

## Ek: Bu analiz nasıl yapıldı
- Dosya ve varlık envanteri kabuk komutlarıyla; JS dosyaları `acorn` ayrıştırıcısıyla tarandı (fonksiyon boyutu, iç içe derinlik, üst düzey tanımlar, dosyalar arası global kullanımı, çalışma anında yeniden atanan fonksiyonlar).
- "Kullanılmayan" görsel ve fonksiyonlar, oyun kodunda (`dist` JS/HTML/CSS) adıyla hiç geçmeyenler olarak bulundu; dinamik adlar (`goal-club-${i}`) ayrıca kontrol edildi.
- Testler bu dalda yerelde çalıştırıldı (5.1).
