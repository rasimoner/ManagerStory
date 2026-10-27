# Altın kayıtlar (golden master)

Oyunun bugün ürettiği sonuçlar; yeniden yapılanma bunları değiştirmemeli. Kaydedildiği sürüm: V7.9.13.

Yenilemeler:
- Refactor C2 (satır içi işleyiciler → `data-action`): 17 ekranın hepsi yenilendi. Olay öznitelikleri ve `data-*` çıkarılınca eski ve yeni ekranlar birebir aynı; her ekranda kaldırılan `onclick`/`onchange` sayısı eklenen `data-action` sayısına eşit (toplam 435). Yeni değer öznitelikleri: `data-id`, `data-section`, `data-to`, `data-choice`, `data-index`, `data-focus`, `data-topic`, `data-sort`, `data-pos`, `data-key`, `data-scope`, `data-value`, `data-view`, `data-step`, `data-years`; kalkan tek öznitelik geri düğmesinin `data-target`'ı (yerine `data-to`). `matches.json`, `seasons.json`, `saves.json` değişmedi.
- Refactor B4 (sürümlü kayıt): kariyer hash'leri (`careerAfterHash`, `careerHash`, `afterSummerHash`) kayda eklenen `schemaVersion` alanı için yenilendi. Bu alan çıkarılınca eski değerlerin hepsi birebir tuttu; olay günlükleri, skorlar, maç özetleri ve ekranlar değişmedi.

| Dosya | Testi | Ne |
|---|---|---|
| `matches.json` | `characterization-matches.test.cjs` | 34 fikstürün her biri yeni kariyerle sonuna kadar: olay günlüğünün tamamı (hash), skor, istatistik, maç sonrası kariyer (hash), okunur maç özeti, olay türü sayıları |
| `seasons.json` | `characterization-career.test.cjs` | 3 sezon üst üste: final tablo, kadro, rakip kadrolar, pazar, akademi, harika çocuklar, kariyer kaydı (hash) |
| `screens/*.html` | `characterization-career.test.cjs` | Ana ekranlar, profiller, gelen kutusu, canlı maç ekranı ve her sezon sonu ekranı (HTML, birebir) |
| `beats/*.json` | `newview-beats.test.cjs` | 3D görünümün sahnelediği her özel hareket ve kaleci senaryosu (`director.stage`), sabit adımla: her karede oyuncuların yeri, yönü ve kemik pozları, top (hash), kare sayısı, kaydedilen yıldız anları, kamera ve ağır çekim çağrıları (hash). Beat'ler dosya değiştirirken birebir aynı kalmalı (V7.14.0'da kaydedildi) |
| `saves.json` | `saves.test.cjs` | `tests/fixtures/saves/generated` ve `legacy` kayıtları yüklenip oynanınca çıkan sonuç |

- Hash'ler anahtarları sıralanmış JSON üzerinden alınır; alanın nerede kurulduğu fark etmez, değeri veya sırası değişirse yakalanır.
- Oyunun sürüm numarası kayıtlardan ve ekranlardan çıkarılır (`<VERSION>`); sürüm artışı altın kaydı bozmaz.
- Bilerek değişen bir davranışta yeniden üret: `UPDATE_GOLDEN=1 node --test tests/<dosya>` ve farkı commit'te gözden geçir.
- Satır içi `onclick`'ler `data-action`'a çevrilirken: `GOLDEN_SCREENS=structure` ekranları olay öznitelikleri olmadan karşılaştırır.
- Tek fikstür denemek için: `GOLDEN_FIXTURES=3,7 node --test tests/characterization-matches.test.cjs`.
- Kayıt örnekleri `node tests/support/make-saves.cjs` ile üretilir (eski sürümler git geçmişinden alınır).
