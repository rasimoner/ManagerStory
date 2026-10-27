# ManagerStory oyun kuralları ve maç motoru

Bu belge, oyunu başka bir motorda (Godot: GDScript/C#) yeniden yazacak birinin neyi aynen koruması gerektiğini anlatır. JS kodu taşınmaz; taşınan şey veri (`src/data/*.json`), bu kurallar ve testlerdir. Kaynak her bölümde yazılı; sayıların kesin hali kodda ve `data/balance.jsonon`'da.

**Doğruluk ölçütü**: aynı tohumla aynı olay günlüğü. `tests/golden/matches.json` 34 fikstürün her biri için olay günlüğünün hash'ini, skoru, istatistikleri ve maç özetini tutar; `seasons.json` üç sezonluk kariyeri. Hash: anahtarları sıralanmış JSON'un SHA-256'sının ilk 24 onaltılık karakteri (`tests/support/golden.cjs`). Yeni motor bu kayıtları üretebiliyorsa kuralları doğru taşımıştır. Bunun için rastgele sayıların **aynı sırayla** çekilmesi gerekir: aşağıdaki "dakika" sırası bu yüzden önemlidir.

## 1. Rastgelelik (`core/random.js`)

- Tek üretici: mulberry32. `R(seed)` bir fonksiyon döner; her çağrı `[0,1)` bir sayı verir:
  ```
  x = (x + 0x6D2B79F5) | 0
  t = x; t = imul(t ^ (t >>> 15), t | 1); t ^= t + imul(t ^ (t >>> 7), t | 61)
  sonuç = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  ```
  (`imul` 32 bit işaretli çarpma; `>>>` işaretsiz kaydırma.) Üretecin konumu `x`'tir (`random.state`); `R(state)` kaldığı yerden sürer.
- Metinden tohum: FNV-1a 32 bit (`hashProfileSeed`, `core/players/player-profiles.js`): `h = 2166136261`, her karakter için (kod noktası) `h ^= c; h = imul(h, 16777619)`, sonuç `h >>> 0`.
- Oyunda başka rastgelelik kaynağı yoktur (`Math.random` kullanılmaz; test denetler). Cihazdan gelen tek entropi `newMatchSalt()`: yeni kariyerin tuzu, her başlama vuruşunun tuzu, tohumsuz kariyer çekilişleri için oturum üreteci.

| Ne | Tohum |
|---|---|
| Maç | `matchSeed() = 8800 + S.fixture * 97 + S.matchSalt`; başlama vuruşunda `S.matchSalt` yenilenir. Maç `M.rand = R(...)` ile çeker; maç ortası kayıtta `rngState` saklanır. |
| Diğer kulüplerin maçları | `R(41000 + tur * 211 + maç sırası * 17 + sezon kaydırması)` |
| Sezon sonu kuralları | `R(hash("<etiket>|<sezon sırası>|<matchSalt>"))` (`seasonRnd`) |
| Oyuncu profili, akademi, harika çocuk, rakip kadro | her biri kendi metin tohumuyla (`academy|…`, `wonder|…`, `rival|…`) |

## 2. Maç (`core/engine/`)

### Saat
- Maç 90 dakika = 5400 maç saniyesi (`M.matchElapsedSeconds`). Gerçek zaman maç saniyesine `live-match.js`'te çevrilir; motor her maç dakikasında bir kez `tick()` çalıştırır. Simülasyon kare sayısından türemez; hız (0,5× / 1× / 2×) sadece gösterim hızıdır, sonucu değiştirmez.
- 45'te devre arası (maç durur), 90'da son düdük (`finalizeMatch`). İkinci yarıda takımlar yön değiştirir.

### Bir dakika (`tick`, `core/engine/match-minute.js`) — çekiliş sırası
1. Sahadaki oyuncularımızın kondisyonu düşer (`matchFatigueDrain`; pres, arkaya koşu ve bindirme talimatı ×1,35); her biri bir dakika oynamış sayılır. Rakiplerin kondisyonu da düşer.
2. **Top kimde**: `M.rand() < u / (u + opp)`. `u` = takım gücümüz (`strength`), `opp` = rakibin (hücum + orta saha + savunma) / 3 × (sahadaki rakip sayısı / 11).
3. **Dakikanın aksiyonları** (`actionMinute`, `pitch-v73.js`): oyuncular yerlerine kayar; serbest top çözülür; topu tutan taraf istenen taraf değilse en yakın savunmacı (pres mesafesi içinde) müdahale eder (`tackleChance`); sonra 1 ya da 2 aksiyon (tempo, sabır ve geçişe göre). Her aksiyon ağırlıklı seçimdir: **pas** (pas seçenekleri: mesafe, ilerleme, baskı, ofsayt), **sürme**, **topu saklama**, **şut** (şut değeri `shotValueAt`). Orta, ofsayt, faul, duran toplar, serbest top, kafa vuruşu bu aksiyonların içinden doğar.
4. İlk maçına çıkan oyuncu için olay.
5. Bu dakika şut olmadıysa ve topa sahip biri varsa: `M.rand() < clamp(0.34 × sıklık, 0.17, 0.5)` ise **fırsat** (`chanceV73`).
6. Top kuralları zorlanır (topu iki kişi tutamaz, oyun dışı oyuncu topa sahip olamaz…).
7. `M.rand() < 0.42` ise bir ikili mücadele: faul olabilir (`recordMatchFoul`, kart dahil).
8. 90'dan önce `M.rand() < 0.0015` ise kaleci olmayan bir oyuncumuz sakatlanır: kim olduğu ikinci bir `M.rand()` ile sahadaki kaleci olmayanlar arasından seçilir (`floor(rand × sayı)`); maç durur, değişiklik istenir.
9. Diziliş toparlanır; 90'da son atak; 45 ve 90'da oyun durulur; 45'te devre, 90'da bitiş.

### Takım gücü (`strength`)
Sahadaki her oyuncu için `(pas + çalım + bitiricilik + hız) / 4 × (0,55 + kondisyon/200) × (moral/85) × talimat bonusu × mevki uyumu`; ortalama × taktik kontrol etkisi × (sahadaki oyuncu / 11). Mevki uyumu (`positionPenaltyV61`): kendi mevkii 1; yakın mevki 0,72; uzak 0,45; kaleci olmayan kalede 0,12, kaleci sahada 0,22.

### Özellik modeli (`pitch-v731.js`, başı)
`taban özellik → mevki uyumsuzluğu → kondisyon → yaş = etkin özellik`. Oyuncunun kaydına hiçbiri yazılmaz. Kondisyonun etkisi özellik türüne göre (fiziksel > teknik > zihinsel; `BALANCE.engine.attributeKind`, `fitnessSensitivity`); mevki dışı ceza rol grubuna göre (`misfitWeight`). İkili olasılıklar yumuşak lojistik: `1 / (1 + e^(-(a-b)/ölçek))`, asla 0 ya da 1 değil. Özellik 35 → 0, 100 → 1 olarak normalleşir.

### Taktikler (`tacticalEffects`, `match-support.js`; `data/tactics.json`)
Mentalite, pres, tempo, savunma hattı, hücum yönü, pas stili ve genişlik; her biri kontrol, hücum, savunma, yorgunluk, atak sıklığı, pas başarısı ve pas mesafesine küçük çarpanlar ekler. Oyuncu talimatları (arkaya koş, topu sakla, içe kat et…) aksiyon ağırlıklarını ve gücü değiştirir.

### Olay günlüğü
- Motorun tek çıktısı `M.events`: her olay `{type, minute, second, text, …}` ve gerekirse oyuncu, taraf, konum (`fromPos`, `toPos`), xG. Türler: başlama vuruşu, pas, orta, top kapma, pres, müdahale, çalım, top sürme, koşu, şut, kurtarış, blok, direk, aut, gol, taç, kale vuruşu, korner, serbest vuruş, penaltı, faul, kart, ofsayt, sakatlık, değişiklik, devre, bitiş… (`PITCH_ACTIONS`).
- Sunum (2D, 3D, yorum) sadece bu günlüğü okur ve simülasyonu ilerletmez. Yeni motorun 3D'si de aynı günlüğü oynatmalı.
- Maç sonu istatistik ve özet günlükten çıkar (`matchSummary`). Asist: golcüye aynı atakta atılan son başarılı pas ya da orta (dönen top, duran top, penaltı hariç).

## 3. Oyuncular (`core/players/`, `data/players.json`)
- Bir oyuncu = mevkinin şekli + oyun tipi (Golcü, Bindiren bek…) + kişisel gürültü; mevkinin ana özelliklerinin ortalaması oyuncunun gücüne (OVR) oturtulur. Her profil kendi tohumundan üretilir (`assignPlayerProfile`).
- Gelişim profili yeni güçte yeniden türetir: çalımcı daha iyi çalımcı olur, özel hareketler özelliklere göre kendiliğinden açılır (`skillMoves`; 19 saha hareketi + kaleci hareketleri, `data/moves.json`). Antrenman odağı en fazla `BALANCE.training.cap` ekler.
- Yetenek yıldızı (1–5) özel hareketlerden; kalecide OVR'den: 1, 67+ → 2, 74+ → 3, 80+ → 4, 85+ → 5 (`data/moves.json` `starShow.keeperStars`).

## 4. Lig (`core/league/`, `data/clubs.json`)
- 18 kulüp, çift devreli 34 tur. Fikstür çember yöntemiyle: ilk kulüp sabit, diğerleri her tur bir kayar; ev/deplasman `(tur + maç) % 2` ile çevrilir; ikinci yarı ilk yarının ev/deplasman tersi (`makeLeagueSchedule`).
- Galibiyet 3, beraberlik 1. Sıralama: puan, sonra averaj, sonra atılan gol (sezon özeti ve lig ekranı; "Dünya" ekranı ve basın sorularının bağlamı atılan gole bakmıyor, tam eşitlikte sıraları farklı olabilir).
- Bizim dışımızdaki maçlar: her takımın beklenen golü hücum/orta saha/savunma ve son 5 maçın formundan (`simAIGame`), skor Poisson çekilişi (en fazla 6).
- Rakip kulüpler liste seviyesinin `BALANCE.league.lift` üstünde oynar (zorluk).

## 5. Sezon sonu (`core/season/season.js`, `modes/manager/season-end.js`)
Adımlar sırayla: özet, yaşlanma ve sezon arası gelişim, emeklilik, kiralıkların dönüşü, rapor, sözleşmeler, altyapı, rakipler, transfer havuzu, toparlama, yeni sezon. Kurallar ve tablo (gelişim, potansiyel, emeklilik ihtimali, sözleşme süreleri, maaş talebi, lig ödülü): `docs/season-transition.md`; sayılar `data/balance.json` (`development`, `retirement`, `contracts`).
- Oyuncu kimlikleri hiç tekrar kullanılmaz (`nextPlayerId`).
- Rakip kulüp seviyesinden 1,5 puandan fazla saparsa en fazla 3 hamleyle geri çekilir.

## 6. Kariyer (teknik direktör modu)
Haftalık döngü, transfer dönemleri (1–6. ve 18–21. hafta), akademi, harika çocuklar (her sezon bir tane; yaklaşık üçte bir bizde), basın, oyuncu görüşmeleri, yönetim. Kurallar `modes/manager/` ve `data/story.json`, `data/balance.jsonon`'da. Bunlar moda özgüdür; başka bir mod (oyuncu kariyeri) çekirdeği (bölüm 1–5) aynen kullanır.

## 7. Kayıt
Düz JSON, sürümlü biçim ve tek taşıma zinciri: `docs/save-format.md`. Yeni motor aynı kaydı okuyabilmeli (en azından içe aktarma ile).

## Taşırken
1. Veriyi olduğu gibi al (`src/data/*.json`; açıklamaları `src/data/README.md`).
2. Üreteci ve hash'i birebir yaz; ilk birkaç değeri JS ile karşılaştır.
3. Motoru dakika sırasına sadık yaz; `tests/golden/matches.json`'daki olay günlüğü hash'lerini (anahtarları sıralanmış JSON üzerinden) üret ve karşılaştır.
4. Lig, sezon sonu ve kariyeri `seasons.json` ile doğrula.
