# Gol artışı — 8. yaklaşım: baskı altında şut sapması karar modeliyle tutarlı

Dal `fix/3d-goal-regression`, ürün `87d5786`, main `d86ac72`, Node 22.23.4. G1 geçmişi 1–7 korunur; bu tur **8** eklenir (toplam 8). 8. yaklaşım koda alındı; 9. yaklaşım uygulanmadı. Main'e merge, PR veya yayın yapılmadı.

## Yeni ayrıştırma (20 tohum, 90 dakika, referans saat)

| Kaynak | Şut/maç | Gol/maç | Gol/xG |
|---|---:|---:|---:|
| Açık oyun | 13,15 | 1,30 | 0,90 |
| Korner ortası sonrası | 11,15 | 3,45 | 3,14 |
| Frikik ortası sonrası | 8,35 | 3,20 | 3,79 |

- Ortadan sonraki şutlar neredeyse tamamen ayakla atılıyor (19,9/maç; kafa 0,05/maç). Baskı ortalaması 0,69 (diğer şutlarda 0,33).
- İsabetli şutta kurtarış oranı açık oyunda %84, ortadan sonra %45–62 arası. Ortadan sonra kaleci neredeyse hiç hazır değil (%1; açık oyunda %26).
- Kontrollü 11 m şutta baskı **0,7** ile baskısız aynı sonucu veriyor (gol %39 → %39, isabet %100 → %93). `shotExpectedGoals` ise baskıyı 0,65 logit ücretlendiriyor (xG %20 → %14). Karar modeli baskının şutu bozduğunu varsayıyor, `shotErrors` baskıdan yalnız 0,045 × 0,7 ≈ 0,03 rad sapma ekliyor.

## 8. yaklaşım

Kırmızı kabul (`tests/reproductions/shot-pressure-consistency.cjs`, varsayılan CI dışında): arkadan baskı yiyen şutçu, 8 ve 11 m'de baskısız şutçuya göre gollerin xG modelinin öngördüğü oranı (±0,12) kadarını korumalı. Başlangıçta 2/2 kırmızı (korunan oran 0,91 / 0,98, modelin 0,72 / 0,69).

Öneri (`tests/reproductions/goal-shot-pressure-attempt8.patch`): `shooting.pressureAngleError` 0,045 → 0,09. Başka katsayı, hedef, kaleci, RNG, eşik veya sonuç kotası değişmez. Yama ile kabul 2/2 geçti. Korunan markaj/kaleci/orta testleri ve `match-sim-shooting` geçti; lint temiz.

| Ölçüm | Önceki ürün | Yama ile | Main |
|---|---:|---:|---:|
| 901/731/42 toplam gol | 20 (5/9/6) | 18 (6/4/8) | — |
| 20 tohum (1–20) gol ortalaması | 8,60 | 7,80 | — |
| **50 tohum** gol ortalaması | 8,62 | **7,38** | 2,76 |
| **20 kısa maç** gol ortalaması | 1,10 | **0,70** | 0,55 |

Ayrıntı: [attempt-eight.json](measurements/goal-regression/attempt-eight.json).

## Karar ve uygulama

`test:fast` yamayla tek test kırdı: V7.15.0 kayıtlı yarım maç testi (maç 1–5 yerine 3–0 bitiyor). Kullanıcı bunu bilinçli davranış değişikliği olarak kabul etti (“1-evet”). Ürün farkı (`pressureAngleError` 0,09) ve kabul testi (`tests/match-sim-shot-pressure.test.cjs`, artık CI içinde) ayrı bir commit'te, beklenen sonuç dosyasının yeniden üretimi (`tests/fixtures/saves/duration/v7.15.0-expected.json`) ondan ayrı ikinci commit'te. Yeniden üretim yöntemi, eski kodla çalıştırıldığında mevcut dosyayla bayt bayt aynı çıktığı için doğrulandı. `test:fast` 609/609 geçti.

Performans paketi bu ortamda 3. testi (2 sn bütçe) geçemiyor; aynı sonuç eski JSON ile de çıkıyor (2459 ms eski, 2198 ms yeni), yani yama kaynaklı bir yavaşlama yok, ortam yavaş.

## Kalan fark ve açık aday (uygulanmadı)

- Yama sonrası bile korner ve frikik ortası sonrası gol/xG ≈ 2,4–2,5; genel gol 7,38 ile main 2,76'nın çok üstünde. G1 kapısı **açık**.
- Baskısız şutta da fizik karar modelinden iyi: 8 m'de gol %91 / xG %31, 11 m'de %39 / %20 (isabet ~%100). Hedef noktası köşeye çok yakın ve sapma küçük. Bu genel bir şut doğruluğu kalibrasyonudur; sizin “genel şut katsayısıyla düşürme” yasağınıza girebileceği için ayrı yetki olmadan denenmedi. İki prob (açı sapması üç terimde 2×: 8,60→6,80; kaleci dalışı güçlendirme: →6,35) yalnız bilgi amaçlıdır, ürün değildir.
- Koşu ve gövde dönüşü maliyeti de xG'de var, yürütmede zayıf (11 m: model 0,80, oynanan 0,97), etkisi küçük.

## Karar

Baskısız şut doğruluğunu hizalama (9. aday) kullanıcı kararıyla denenmeyecek: kaleye çok yakın mesafede yüksek gol oranı doğal kabul edildi.
