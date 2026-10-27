# ManagerStory kayıt biçimi

Kod: `src/core/save.js` (yükleme, kaydetme, dışa/içe aktarma, taşıma zinciri); kayda yazılan oyun sürümü `src/core/version.js` (`GAME_VERSION`). Testler: `tests/save-format.test.cjs`, `tests/saves.test.cjs`.

Yeniden yapılanma C, D ve E kayıt biçimini değiştirmedi (biçim 1). V7.13.2 biçimi 2'ye taşıdı (maaş alanı ve forma numarası); V7.9.13'ten bu yana her kayıt (ve daha eskiler zincirle) açılır.

## Kayıt nedir
- Kariyer durumu `S`'nin JSON'u. Tarayıcıda `localStorage["msv4"]` içinde durur; dışa aktarılan dosya aynı JSON'dur (girintili).
- Yedekler:
  - `msv4-v70-backup` … `msv4-v733-backup`: eski bir sürümün kaydı ilk açıldığında, değiştirilmeden önceki hali (sürüm başına bir kez).
  - `msv4-before-import`: içe aktarmadan önce açık olan kariyer.
- Maç ortasında kaydedilirse maç da kayıttadır: `activeMatchV71` (maç durumu ve zarın konumu `rngState`).

## İki farklı sürüm alanı
| Alan | Ne | Ne zaman değişir |
|---|---|---|
| `schemaVersion` | Kaydın **biçimi**. Taşıma zinciri buna bakar. | Biçim değişince (yeni taşıma adımıyla). V7.9.13 öncesi kayıtlarda yok = biçim 0. |
| `version` | Kaydı en son yazan **oyun sürümü** (ör. `"7.9.13"`). | Her yüklemede güncel sürüme yazılır. Yedek anahtarları buna göre. |

Şu anki biçim: **2** (`SAVE_SCHEMA`).

## Taşıma kuralları
- Tüm taşımalar tek yerde: `SAVE_MIGRATIONS` (`src/core/save.js`). Her adım `{from, to, about, run(state)}`; sadece bir biçimden bir sonrakine geçirir ve sadece kendi işine dokunur.
- `migrateSave(state)` kaydın biçiminden başlayıp adımları sırayla çalıştırır, sonra `schemaVersion` ve `version` yazar.
- Nerede çalışır:
  - tarayıcı kaydı açılırken (`loadCareer`);
  - içe aktarmada (`importCareer`);
  - yeni kariyerde (`fresh()`): yeni kariyer biçim 0'da kurulur ve aynı zincirden geçer. Böylece "güncel biçim ne içerir" sorusunun cevabı tek yerde.
- Oyundan **daha yeni** bir biçim (`schemaVersion > SAVE_SCHEMA`):
  - açılmaz; kayıt silinmez, ekranda sebep yazar;
  - içe aktarma da reddedilir.
- Yeni bir biçim değişikliği:
  1. `SAVE_SCHEMA`'yı bir artır.
  2. Zincire `{from: n, to: n+1}` adımını ekle.
  3. Bu belgeyi güncelle.
  4. Altın kayıtları (`tests/golden`) bilerek yenile; farkın sadece yeni alan olduğunu göster.
- Zincirin dışında kalan: `init()` her açılışta eksik olan **içeriği** üretir veya tamamlar. Bunlar biçim taşıması değil, kariyerin her an sağlaması gereken koşullar:
  - pazar, akademi, rakip kadrolar, fikstür, oyuncu profilleri, sezon alanları, sıradaki olay;
  - sonradan gelen oyuncuların varsayılanları: gol/kart sayıları, mutluluk, maaş, güven, özgüven, baskı, motivasyon.

### Biçimler
| Biçim | Oyun sürümleri | Adım (`from → to`) |
|---|---|---|
| 0 | V7.0 – V7.9.13 (schemaVersion yok) | — |
| 1 | V7.9.13 (yeniden yapılanma B) – V7.13.1 | 0 → 1 |
| 2 | V7.13.2 sonrası | 1 → 2 |

**0 → 1** (eski `migrateV71`'in yaptığı, artık tek seferlik):
- `currentClubId` yoksa başlangıç kulübü (`data/clubs.json` `startingClub`).
- `v71`: basın ve görüşme durumu (`preUsed`, `postUsed`, `conversations`, `serial`, `meetingClock`, `playerMeetings`, `categoryMeetings`).
- `plan`: her taktik ayarı geçerli bir değere (`mentality`, `approach`, `passingStyle` için "Dengeli", diğerleri "Normal"); `teamInstructions` boşsa `[]`.
- `form`: V7.0'ın İngilizce harfleri (W/D/L) Türkçeye (G/B/M).
- `promises`: dakika sözlerinde başlangıç dakikası (`atMinutes`).
- `v72`, `v73`, `v731` (`lastEvolvedFixture`), `v732` (`conversationHistory`, `feedback`), `v733`: sürüm blokları.

**1 → 2** (V7.13.2):
- `v6.wageBudget` silinir. Maaş alanı artık kayıtta durmaz; her an kulübün seviyesinden hesaplanır (`modes/manager/wages.js`, kural `data/balance.json` `contracts.wageBudget`). Eski değer sabit 24M'di ve kadronun gerçek maaş toplamının altında kalıyordu.
- Her oyuncuya kendi forma numarası (`number`): kulüpten ayrılmamış her oyuncu (`status` "Transfer oldu" değil) o güne kadar maçta gördüğü numarayı alır, yani seçtiği numarayı, yoksa kadro listesindeki sırasını (`indexOf + 1`). Önce seçilmiş numaralar, sonra sıralar yerleşir; bir numarayı başkası zaten giyiyorsa sadece o oyuncu en küçük boş numarayı alır, kimsenin numarası kaymaz. Yeni kariyerde başlangıç kadrosu bu adımla 1–16 alır.

Ayrıca yükleyici (zincirden önce): zar tuzu (`matchSalt`) olmayan kariyere cihazdan bir tuz verir (V7.8 öncesi). Bu adım cihaza bağlı olduğu için zincirde değil; yeni kariyerin tuzunu çağıran taraf verir.

## Alanlar (biçim 2)
Kayıt alan adları "kayıt sözleşmesi"dir: kodda anlamlı adlar kullanılabilir ama kayıttaki ad değişirse zincire bir adım yazılır.

### Kariyer
| Alan | Tür | Ne |
|---|---|---|
| `schemaVersion` | sayı | Kayıt biçimi (yukarıda). |
| `version` | metin | Son yazan oyun sürümü. |
| `currentClubId` | metin | Yönetilen kulüp (`managedClubName()`). Lig şimdilik başlangıç kulübünün etrafında kurulu; rakip bir kulüp adı yazılmışsa başlangıç kulübüne düşer. |
| `matchSalt` | sayı | Maç zarlarının tuzu; her başlama vuruşunda cihazdan yenilenir. Yoksa (testler) fikstürün kendi tohumu. |
| `week`, `day`, `fixture`, `clock` | sayı / metin | Takvim: hafta (1…), gün (1–7), lig turu (0–33), saat. |
| `season`, `seasonIndex` | metin / sayı | "2025/26", 0'dan başlayan sezon sırası. |
| `budget`, `board`, `fans`, `rep` | sayı | Transfer bütçesi, yönetim, taraftar, itibar. |
| `players` | dizi | Kadro (aşağıda). Ayrılanlar silinmez: `status: "Transfer oldu"`. Kimlikler tekrar kullanılmaz; 0–15 başlangıç kadrosu. |
| `xi`, `bench` | dizi | İlk 11 ve yedekler (oyuncu kimlikleri). |
| `positions` | nesne | Kimlik → saha noktası `[x, y]` (0–100). |
| `plan` | nesne | Taktik ayarları (`mentality`, `press`, `tempo`, `line`, `approach`, `passingStyle`, `width`), `teamInstructions`, `aras` (oyun kurucunun rolü). |
| `instructions` | nesne | Oyuncuya özel talimatlar. |
| `schedule` | dizi[34] | Bizim fikstür: `{opp, home}` (`opp`: `OPP` sırası). |
| `leagueSchedule` | dizi[34] | Tüm lig: tur başına 9 maç `{home, away, played, hg, ag}`. |
| `table` | dizi[18] | Puan durumu `{n, p, gf, ga, pts}`. |
| `form` | nesne | Kulüp → son sonuçlar (G/B/M). |
| `results` | dizi | Oynanan maçlarımız; eski sezonların özetleri sıkıştırılır. |
| `opponentSquads` | nesne | Rakip kulüp → oyuncular (`'o0'` biçiminde kimlik). |
| `event` | nesne | Bekleyen karar: `kind`, `title`, `text`, `choices` (`[metin, anahtar]`). Anahtarlar `choose()` dallarına bağlı, kayıt sözleşmesi. |
| `inbox`, `history`, `news` | dizi | Gelen kutusu, kariyer geçmişi, haberler. |
| `promises`, `scheduled`, `events` | dizi | Verilen sözler, planlı olaylar, geçmiş olaylar. |
| `objectives` | dizi | Sezon hedefleri. |
| `pressUsed`, `sundayEvents`, `cooldowns` | dizi / nesne | Kullanılmış basın soruları, pazar olayları, bekleme süreleri. |
| `clubMood` | nesne | Başkan, ekip ve soyunma odası durumu (metin). |
| `transferList` | dizi | Eski (V5) transfer listesi. |
| `v6` | nesne | Pazar (`transferPool`), akademi, kupa durumu, yönetim bütçe talebi haftası. Maaş alanı kayıtta değil (biçim 2'den beri hesaplanır). |
| `v71`, `v72`, `v73`, `v731`, `v732`, `v733` | nesne | Sürüm blokları: görüşmeler, basın, oyuncu gelişimi işaretleri. |
| `v795` | nesne | Harika çocuklar (`wonderkids`) ve sezon planları. |
| `v796` | nesne | Sezon geçişi: ayrılanlar (`former`), sezon özetleri, kimlik sayaçları, kaptan. |
| `seasonEnd` | nesne | Yarım kalmış sezon sonu: `steps` (adım kimlikleri, kayıt sözleşmesi), `at`, `data`. |
| `highlights` | dizi | Highlight arşivi: oyuncu, hareket, sezon/hafta. |
| `activeMatchV71` | nesne | Yarım kalmış maç (yukarıda). |
| `ui` | nesne | Arayüz tercihleri (karar çekmecesi). |

### Oyuncu (`players[]`)
| Alan | Ne |
|---|---|
| `id`, `name`, `age`, `pos` | Kimlik, ad, yaş, mevki (`"RW/LW"` gibi birden çok olabilir). |
| `overall`, `potential` | Genel güç ve potansiyel. |
| `pace`, `finishing`, `passing`, `dribbling`, `defending`, `physical`, `stamina`, `shooting`, `gk` | Temel değerler. |
| `acceleration`, `technique`, `vision`, `composure`, `tackling`, `positioning`, `offBall`, `strength` | Profilden gelen ayrıntılı özellikler. |
| `profile` | Oyuncu tipi, tohum, özel oyuncu işareti, antrenman katkıları. |
| `fitness`, `morale`, `form`, `relation`, `happiness`, `managerTrust`, `confidence`, `pressure`, `motivation` | Durum ve ilişki. |
| `minutes`, `goals`, `assists`, `yellow`, `red`, `injury`, `careerGoals`, `careerApps` | İstatistik ve sakatlık. |
| `value`, `wage`, `contract`, `status` | Değer, yıllık maaş (imzada `OVR² × 900`, altyapıdan 480.000, yenilemede talep), kalan sözleşme yılı, durum (`"Takımın parçası"`, `"Kirada"`, `"Transfer oldu"`…). |
| `personality`, `growth`, `secondary`, `debutDone`, `number` | Kişilik, gelişim, ek mevkiler, ilk maç, forma numarası (biçim 2'den beri herkeste, kulüpteki oyuncular arasında benzersiz, 1–99; kadro, profil ve 3D maç bunu gösterir). |
| `newMoves` | Henüz duyurulmamış yeni özel hareketler (gelen kutusu notu için). |

## Godot ve diğer motorlar için
- Kayıt düz JSON'dur; fonksiyon veya döngüsel referans yok.
- Biçim numarası ve bu belge, başka bir motorun kaydı okuyup aynı zinciri uygulaması için yeterli olmalı.
