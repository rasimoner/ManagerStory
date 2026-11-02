# Eski 3D ile yeni 3D farkı — kayıp çalım, yakın plan ve tekrar notu

2 Kasım 2026, dal `fix/3d-goal-regression`, Node 22.23.4. Bu belge **yalnız tanı ve düzeltme notudur**; ürün kodu değişmedi. Amaç: yeni fizik tabanlı 3D'yi (oyunun akışını alt yazıdan saha görüntüsüne taşımak) korurken, eski 3D'de görülen yakın plan, çalım ve çalım tekrarlarının neden azaldığını göstermek.

## Kısa sonuç

Kayıp tek bir hata değil, dört ayrı nedenin toplamı:

1. **Çalım neredeyse hiç üretilmiyor.** Eski görünümde motor olay günlüğüne adlandırılmış hareketler (`moves.json`'daki 20 hareket) yazıyor, yönetmen bunları kamera ve beat ile sahneliyordu. Yeni motor çalımı fizikten çıkarıyor ve çok sıkı koşullarla yalnız birkaçını veriyor.
2. **Yakın plan çok dar bir koşula bağlı.** Yalnız top/olay sahanın uç bölgesindeyse ve bayrak işaretliyse çalışıyor.
3. **Otomatik tekrar çalımları neredeyse hiç seçmiyor.** Aday çoğunlukla pas ve kurtarış.
4. **Rakibin özel tepkisi ve altı özel hareket eksik** (daha önceki raporlarda "açık").

## Ölçüm (20 tohum; sürekli 90 dk ve 7 dk doğal süre)

| Olay (maç başına) | 7 dk doğal | 90 dk lab |
|---|---:|---:|
| Taşıma/dribble | 49,4 | 653 |
| Mücadele (tackle) | 8,3 | 104 |
| `skill` olayı toplam | **3,55** | 19,9 |
| ...kesme / dönüş (gözlenmiş etiket) | 2,7 / 0,4 | 15,5 / 3,2 |
| ...gerçek gösterişli çalım (bodyFeint, elastico, croqueta, stepover) | **≈0,45** | ≈1,2 |
| Otomatik tekrar adayı: flair pas / bakmadan pas / rabona | 1,95 / 1,2 / 0,35 | — |
| Otomatik tekrar adayı: zor kurtarış | 0,85 | — |
| Otomatik tekrar adayı: çalım (elastico+croqueta) | **0,15** | — |

Yani 7 dakikalık bir maçta yaklaşık **iki maçta bir** gösterişli çalım, **yedi maçta bir** çalım tekrarı adayı çıkıyor.

## 1. Çalım neden az?

`src/core/sim/ground-skill-choice.js` → `simulationSkillSituation` ve `src/data/match-sim-skills.json`. Çalım ancak şu koşulların hepsi birlikte sağlanınca denenir:

- oyuncunun `technique` ve `dribbling` değerlerinin ikisi de **≥ 85**,
- hız **≤ 2,5 m/sn** (neredeyse duruyor),
- top yüksekliği ≤ 0,12 m, saha genişliği içinde |y| ≤ 29,
- **rakip kale yönünde x ≥ 20 m** (yalnız hücum üçte biri),
- en yakın rakip **≤ 3,2 m**,
- aynı oyuncu için **12 sn soğuma**,
- hareket seçimi `movesFor` yıldız/özellik şartlarına bağlı (`moves.json`).

Bu üretim yolu orta sahada hiç çalışmaz; hızlı koşan oyuncuda da çalışmaz. Ayrıca 49 dribbling'in neredeyse tamamı `observed` etiketi olan `cut/turn/bodyFeint` olarak kalır (`dribble-observation.js`); bunlar fizikten sonradan tanımlanan etiketlerdir, bir çalım animasyonu değildir.

## 2. Yakın plan neden az?

`src/core/match/presentation-contacts.js` ve `src/core/presentation/sim/scene-camera.js`:

- `closeUp` bayrağı yalnız `|x| > 26 m` (`challengeZoneMetres`) bölgesindeki olaylara verilir,
- mücadelelerde **her ikinci** uygun tackle'a verilir (eski sözleşmenin aynısı),
- `skill` olayında yalnız aynı bölgede,
- yakın plan süresi 1,1 sn (`challengeCloseSeconds`), kart için 1,5 sn.

Eski sözleşmeyle uyumlu; fakat çalım zaten seyrek olduğu için yakın plan fiilen yalnız mücadelede ve golde görünüyor. Orta sahadaki çalım hiç yakın plan almıyor.

## 3. Tekrar neden çalımı seçmiyor?

`src/core/presentation/sim/scene-replay.js` (`automaticStar`, `recordedStarKind`):

- yalnız `STAR_MOVES` içindeki türler ve `observed` olmayan `skill` olayları,
- otomatik tekrar arası **30 sn**,
- gol otomatik tekrardan çıkarılmış (elle tekrar var).

`cut/turn/bodyFeint` tekrar almaz; `stepover/nutmeg/cruyff/roulette/rainbow/...` için ise motor olay üretmediği için aday yoktur.

## 4. Açık eksikler (önceki raporlarda kayıtlı, bu notla birleştirildi)

`docs/3d-restoration-report.md` envanterine göre eski `beats/feints.js`, `turns.js`, `through-the-legs.js`, `over-the-top.js`, `first-touch.js`, `scorpion.js` ve `SKILL_BEATS` yeni yola taşınmadı. Rakibin özel tepkisi (`actions.js:stumble/spread`) yok. Altı özel hareket (röveşata, flair bacak arası, gökkuşağı, juggle, Bergkamp, akrep) `3d-remaining-parity-follow-ups.md` içinde R7/R14/R16/R18/R23/R25 olarak ayrı görevdir.

## Düzeltme önerisi (sıra ve kabul)

Her adım ayrı dal/commit, test önce. **Kural:** çalım sıklığını artırmak top sahipliğini ve şut/gol dengesini değiştirebilir; her adımdan sonra 50 tohum gol ortalaması (şu an 7,38) ve 20 kısa maç (0,70) tekrar ölçülür, bozulursa geri alınır. Eşiği yalnız sayı büyüterek "daha çok çalım" diye gevşetme; koşulun bir anlamı olmalı.

1. **Başarılı çalımla geçmeyi (`beat`) yakın plana bağla — YAPILDI.** İlk tasarım (`turn`/`bodyFeint` gözlem etiketlerini bölgeden bağımsız yakın plana almak) ölçüldü: 7 dk maçta yakın plan 2,30 → 2,35, yani etkisiz; uygulanmadı. Asıl çalımla-geçme anı `beat` olayı (7 dk maçta ≈7,25, hepsi `success`). `presentation-contacts.js` başarılı `beat`'e her yerde `closeUp` verir; `scene-camera.js` `beat`'i mücadele kamerasına katar ve atılımcı ile geçilen savunmacıyı birlikte çerçeveler. Yalnız sunum katmanı: fizik, RNG ve olay günlüğü değişmez. Kabul testleri `tests/match-sim-beat-close-up.test.cjs` (3, ilk ikisi önce kırmızıydı). `test:fast` 612+5 geçti. Gerçek WebGL/iPhone görseli üretilmedi; kullanıcı gözüyle onay bekler.
2. **Çalım koşullarını oyuncu ve durumla anlamlı genişlet (dengeyi etkiler).** `minimumAttackX` 20 → orta sahaya, `maximumSpeed` 2,5 → gerçek bir hız aralığına, 12 sn soğuma oyuncu başına yerine takım başına. Her biri tek tek ölçülür, tek değişkenli test. Kabul: 7 dk'da gösterişli çalım ≥ 2/maç, top kaybı ve gol bozulmaz.
3. **Tekrar adayını çalıma aç.** Başarılı bir çalımdan sonra savunmacıyı geçip şut/pas/ilerleme gelirse otomatik tekrar adayı yap (30 sn aralık korunur). Kabul: 7 dk'da ≥ 1 çalım tekrarı, pas/kurtarış tekrarlarını silmeden.
4. **Rakibin tepkisini gerçek olaya bağla.** Motor olayında hareket kimliği varsa `stumble/spread`; olay yoksa uydurma düşüş gösterme (önceki rapordaki kural).
5. **Altı özel hareket**: mevcut R7–R25 görevleri, bu notun dışında kalır.

## Doğrulanmayanlar

- Eski 3D'nin bire bir gerçek tarayıcı davranışı bu belgede yalnız koddan ve önceki raporlardan çıkarıldı; yeni WebGL/iPhone kanıtı üretilmedi.
- `movesFor` şartlarına göre kadroda kaç oyuncunun çalım yapabildiği ayrıca sayılmadı (adım 2 öncesi yapılmalı).
- Maç başına sayılar 20 sabit tohumdur; dağılım geniştir.
