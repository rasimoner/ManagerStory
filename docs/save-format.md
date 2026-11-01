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

Şu anki biçim: **8** (`SAVE_SCHEMA`).

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
| 2 | V7.13.2 | 1 → 2 |
| 3 | V7.14.0 sonrası | 2 → 3 |
| 4 | V7.15.0 | 3 → 4 |
| 5 | V7.16.0 sonrası | 4 → 5 |

**4 → 5:** `matchDurationMinutes` 3/5/7/10 seçeneklerinden biridir; eksik veya geçersiz kayıtta 7 olur. Çalışan maçın kaydı değiştirilmez. Yeni deneysel maçın `simulationCheckpoint.state.clock` nesnesi `model:"natural"`, `durationSeconds`, `totalTicks` ve gerçek faaliyet adımlarını içerir; `time`/`physicsTime` fizik, `matchTime` 0–5.400 maç saniyesidir. Süre aktif maç başlangıcında kopyalanır. Daha sonra tercih değişikliği aktif maçı ve geri yüklemesini değiştirmez. Saat modeli bulunmayan V7.15.0 checkpoint’i `restoreSimulation` içinde `reference`/5.400 fizik saniyesi olarak açılır; eski değişken hızlı gösterimiyle tamamlanır. Eski dakika/3D kayıtlarının alanlarına dokunulmaz.

**3 → 4:** `experimentalMatchEngine` yoksa `false` eklenir. Ayarlar'daki anahtar bu kariyerde saklanır; devam eden maçın motoru değiştirilmez. Eski maç kayıtlarının dakika motoru, RNG ve 3D durumu korunur.

Deneysel `activeMatchV71` ek alanları: `experimental:true`, `fieldView:"2d"`, `simulationCheckpoint`, `simulationCursor`, `simulationNames`, `simulationTeams`, `simulationPendingPasses`. Çalışma sırasında `M.simulation` saf çekirdek nesnesidir; kayda onun yerine `snapshotSimulation` format 1 JSON nesnesi yazılır. RNG, kesirli saat, geçici duruş/avantaj, bekleyen değişiklikler, ayrılan oyuncular, kondisyon/sakatlık, tüm günlük ve karar/kovalama önbelleği içindedir. Ortak referans ve JSON'da kaybolan skaler yan tabloları yeniden kurulur. Kariyere aktarılmış olay cursor'ı ve oyuncu dakika sayaçları çift gol/kart/dakika yazılmasını önler. Detay: `docs/match-sim.md`.

Son biçimde ağır alanlar (`simulationCheckpoint`, `simulationPlayback`, `simulationDisplayFrame`, `events`, `story`, `minuteEvents`) cihazda `simulationArchive:{encoding:"lzw-varint-utf16",data}` içinde kayıpsız sıkıştırılır; yüklemede düz alanlara açılır. Aynı nesneleri kullanan `minuteEvents`, arşivde `minuteEventIds` ile tam olaylara bağlanır; açıldığında referansları geri kurulur. Ön adayın `lzw-varint-base64` arşivi de okunur. `simulationPlayback` artık yalnız anlık/önceki görünüm ve yumuşak hız integrali taşır; önden hesaplanmış maç veya halka tampon yoktur. `M.matchElapsedSeconds` maç saatidir (`matchTime`); çekirdeğin `time`/`physicsTime` alanları fizik saniyesidir. Referans modelde hazırlık duruşları dışında iki değer aynıdır. Çekirdeğin kamuya açık `snapshotSimulation` sözleşmesi sıkıştırılmamış düz nesne kalır.

Tamamlanmış deneysel `matchSummary` kayıtları `engine:"continuous"` işaretlidir; yeni özetler `timeModel` ve `durationSeconds` ile oynanan aktif süresini taşır. `results` ve `v71.lastMatch` özetleri cihazda ayrı kayıpsız arşivlerdir, açılınca mevcut ekranların beklediği tam nesneler olur. Normal maçın özet/kayıt yolu değişmez. Otomatik aktif-maç sıkıştırması Worker'da, açık kaydetme/duraklatma/ihracat eşzamanlıdır; sıra numarası eski asenkron işin yeni kayıt üzerine yazmasını önler. Hızlı sonuna-geç sırasında ara otomatik kayıt yığılmaz; kullanıcı durdurursa, sakatlıkta ve maç bitiminde kayıt alınır. Testte 33 maç arşivi + aktif tam maç 5 MiB UTF-16 bütçesinde korunur.

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

**2 → 3** (V7.14.0, highlight arşivi):
- `highlights` artık tarif listesi (aşağıda "Highlight tarifi"). V7.9.7'den beri yazılan yıldız transfer kayıtları (`kind: "star-transfer"`) `type: "starTransfer"` tarifine döner: `id`, `playerId`, `playerName`, `pos`, `move`, `stars`, `season`, `week`, `fee`, `fromClub` aynen kalır; `seed: -1` (transfer sahnesinin varsayılanı) eklenir; `keeper` (artık `pos`'tan çıkar) ve `matchday` düşer. Başka türde kayıt hiç yazılmadığı için tanınmayan kayıt bırakılmaz.
- Arşivi olmayan kayıt boş arşiv (`[]`) alır.

Ayrıca yükleyici (zincirden önce): zar tuzu (`matchSalt`) olmayan kariyere cihazdan bir tuz verir (V7.8 öncesi). Bu adım cihaza bağlı olduğu için zincirde değil; yeni kariyerin tuzunu çağıran taraf verir.

## Alanlar (biçim 5)
Kayıt alan adları "kayıt sözleşmesi"dir: kodda anlamlı adlar kullanılabilir ama kayıttaki ad değişirse zincire bir adım yazılır.

### Kariyer
| Alan | Tür | Ne |
|---|---|---|
| `schemaVersion` | sayı | Kayıt biçimi (yukarıda). |
| `matchDurationMinutes` | sayı | Yeni deneysel maçın 1× toplam süresi: 3/5/7/10, varsayılan 7; aktif maç kendi süresini korur. |
| `experimentalMatchEngine` | boolean | Deneysel 2D motor tercihi; eski kayıtta kapalı, bir sonraki maçta seçilir. |
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
| `inbox`, `history`, `news` | dizi | Gelen kutusu, kariyer geçmişi, haberler. Gelen kutusu notu bir highlight'a bağlıysa `highlight` (tarifin `id`'si) taşır: "yeni hareket öğrendi" notunda ▶ İzle. |
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
| `highlights` | dizi | Highlight arşivi: her an onu yeniden oynatacak küçük bir tarif (aşağıda "Highlight tarifi"). Oyuncu başına en iyi 10 an. |
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

### Highlight tarifi (`highlights[]`, biçim 3)
Bir highlight sahnenin kendisi değil, 3D görünümün aynı beat'i maç dışında yeniden oynatması için yeten tarif (`src/core/highlights.js`; sahne `newview/beats/staging.js`).

| Alan | Ne |
|---|---|
| `id` | `"hl<n>"`, artan; arşivde yeniden eskiye sıralar. |
| `type` | `starTransfer` (büyük transferin gösterisi), `skillMove` (maçta özel hareket), `keeperSave` (maçta yıldız kurtarış, penaltı kurtarışı ya da akrep), `newMove` (yeni açılan hareket). |
| `playerId`, `playerName`, `pos` | Oyuncu; ad ve mevki o anki hali (oyuncu ayrılsa da arşivde kalır). |
| `move` | Hareket kimliği (`data/moves.json`; kaleci için ayrıca `starsave`, `pensave`). Sahne: `stageKindFor` (`data/moves.json` `highlightStage`). |
| `stars` | O anki yetenek yıldızı (kalecide OVR'den gelen sınıf). "En iyi" kuralı buna bakar. |
| `season`, `week` | Ne zaman. |
| `opponent`, `minute` | Maçta: rakip ve dakika. Maç dışında yok. |
| `seed` | Hareketin dayandığı maç olayı (`eventId`); çalımda savunmacının hangi yanından geçtiğini belirler. Maç dışı anlarda `-1`. |
| `fee`, `fromClub` | Sadece `starTransfer`: bonservis ve önceki kulüp. |

Aynı an bir kez tutulur: bir hareket bir maçta (aynı hafta) bir kez; yeni hareket ve büyük transfer oyuncu başına bir kez. Oyuncu başına en iyi `highlights.perPlayer` (10) an kalır; kural `data/balance.json` `highlights`: önce tür önceliği (`typeRank`), sonra yıldız, ama aynı düzeyde oyuncunun henüz arşivde olmayan bir hareketi tekrarından önce gelir; sonra en yenisi.

## Godot ve diğer motorlar için
- Kayıt düz JSON'dur; fonksiyon veya döngüsel referans yok.
- Biçim numarası ve bu belge, başka bir motorun kaydı okuyup aynı zinciri uygulaması için yeterli olmalı.


## V7.18.0: çizim önbelleklerini yenileme

Kariyer ve simülasyon checkpoint'inin kalıcı alanları, komutlar/RNG ve biçim 5 değişmez; yeni kayıt göçü yoktur. `fieldView` zaten kayıttadır ve deneysel maçta artık `3d` de olabilir. Eski `simulationPlayback.frame` / `simulationDisplayFrame` çizim önbelleklerinde yeni velocity/keeper/temas kopyaları bulunmayabilir. Yüklemede yalnız bu türetilmiş önbellekler mevcut fizik checkpoint'inden yeniden kurulur; kesirli birikim, cursor, fizik/maç saati, skor ve RNG korunur. 3D hata açıklaması WeakMap'tedir, kayda eklenmez. Eski motorun kayıt yolu değişmez.

V7.19.0: `keeperPresentation`, aynı türetilmiş çizim karesindeki gözlenmiş önceki kurtarış/tepki kopyasıdır. Kalıcı checkpoint'e yeni alan veya dalış fazı eklenmez; eski önbellek bu alanı içermese de yüklemede mevcut motor/olay durumundan yeniden kurulur. Bu nedenle kayıt biçimi 5 ve göç zinciri değişmez. Kaydet/devam kalecinin mutlak fizik zamanındaki pozunu yeniden örnekler.

**5 → 6:** `simulationCheckpoint.state.clock.stoppedTicks`, devre yerleşiminin oyun saatinden düşülmüş fizik adımlarını tutar. Ham veya sıkıştırılmış eski aktif maçta alan sıfırla tamamlanır; yeni saatin `pauseHalfPreparation` işareti doğal kayıtlarda açılır, eski referans maçlarda önceki sonuç sözleşmesi için kapalı kalır; eski oynanmış süre geri alınmaz. Checkpoint yükleyicisi bağımsız eski laboratuvar kayıtlarını da kabul eder. Devre hazırlığında fizik/yerleşme ilerler; maç saati, top oyunu, yorgunluk ve sakatlık kontrolü durur. Santra fiziksel olarak hazır olduğunda 45:00’dan devam eder. Bitiş `tick - stoppedTicks === totalTicks` ile tam 90:00’dır; sona geçme aynı borcu hesaba katar.

Format 6 checkpoint’inde isteğe bağlı `ball.control`, gerçek ilk temas zamanı/ofseti/yüksekliği/dikey hızını saklar; kayıt havadan kontrolün ortasında da aynı fizik anından devam eder. Serbest bırakma veya yeni sahiplenmede temizlenir; eski kayıtta bulunması gerekmez.

Format 6 `ball.restart` için tür/takım/kullanan/alıcı, sabit top noktası, hazırlık başlangıcı, aşama, hazır anı, kadro ve oyuncu hedeflerini saklar. Yeniden yükleme hazırlığı baştan oynatmaz. Eski doğal checkpoint’in eksik konum/hedef bilgisi mevcut top ve kadrodan ilk fizik adımında tamamlanır.

Format 6 `defending.engagements` içinde isteğe bağlı `observedHeading`/`observedTurn`, gerçekleşmiş çalım gözleminin tekrar üretilmesini önler. Bunlar hareket/karar hesabına girmez; önceki kayıtta eksikse mevcut yönle başlatılır.

**6 → 7:** Eski ham/sıkıştırılmış deneysel aktif checkpoint'e isteğe bağlı `offside:null` eklenir; RNG, saat, kadro, olaylar ve sonuç yeniden hesaplanmaz. Yeni `ball.restart.delivery` karar türü ve hedefini, `stage:runup` yaklaşmayı; `duel.wallJump.start` barajın gerçek tepki zamanını saklar. Bunlar checkpoint'in normal düz nesne arşivinden kayıpsız geçer. Yeni format 7 kaydı format 6 uygulamada açılmaz. Tekrar görsel kayıtları kalıcı kariyer şemasına yazılmaz.

PR #16 sonrası: mevcut `ball.carry.touchTick` henüz topa dokunulmamış taşıma niyetinde null olabilir. Yeni alan veya göç yoktur; gerçek dokunuşta tam fizik adımı yazılır. Niyet/koruma bekleyişi ve RNG normal checkpoint ile kayıpsız devam eder.

**7 → 8:** Ortak fiziksel servis `ball.flight.cross` ve `crossEventIndex` ile gerçek orta olayını asıl pas sonucuna bağlar. Eski ham/sıkıştırılmış aktif uçuş bu alanları false/null alır; top, olaylar, saat veya RNG yeniden hesaplanmaz. Uçuş yoksa yeni nesne yaratılmaz. Kaydedilmiş restart.delivery mevcut genel nesnede servis hedefi/alıcı kimliğini korur. Görsel tekrar tamponu kalıcı kayda eklenmez. Eski golden karşılaştırmasında yalnız deneysel anahtar kapalıyken şema 8 meta verisi önceki şemaya indirgenir; hiçbir futbol/kariyer alanı silinmez ve golden dosyaları yenilenmez.
