# Altın kayıtlar (golden master)

Oyunun bugün ürettiği sonuçlar; yeniden yapılanma bunları değiştirmemeli. Kaydedildiği sürüm: V7.9.13.

Yenilemeler:
- Refactor C2 (satır içi işleyiciler → `data-action`): 17 ekranın hepsi yenilendi. Olay öznitelikleri ve `data-*` çıkarılınca eski ve yeni ekranlar birebir aynı; her ekranda kaldırılan `onclick`/`onchange` sayısı eklenen `data-action` sayısına eşit (toplam 435). Yeni değer öznitelikleri: `data-id`, `data-section`, `data-to`, `data-choice`, `data-index`, `data-focus`, `data-topic`, `data-sort`, `data-pos`, `data-key`, `data-scope`, `data-value`, `data-view`, `data-step`, `data-years`; kalkan tek öznitelik geri düğmesinin `data-target`'ı (yerine `data-to`). `matches.json`, `seasons.json`, `saves.json` değişmedi.
- Refactor B4 (sürümlü kayıt): kariyer hash'leri (`careerAfterHash`, `careerHash`, `afterSummerHash`) kayda eklenen `schemaVersion` alanı için yenilendi. Bu alan çıkarılınca eski değerlerin hepsi birebir tuttu; olay günlükleri, skorlar, maç özetleri ve ekranlar değişmedi.

- V7.13.2 (maaş alanı ve forma numarası, kayıt formatı 2): kariyer hash'leri (`matches.json`'da 34 `careerAfterHash`, `seasons.json`'da 3 `careerHash` ve 3 `afterSummerHash`, `saves.json`'da 9 `careerHash`) ve dört ekran yenilendi. Değişen sadece iki konu: oyunculara eklenen `number` alanı ve kayıttan çıkan `v6.wageBudget` (formatla birlikte `schemaVersion` 1 → 2). Kontrol: hash alınmadan önce `number` silinip `wageBudget: 24000000` ve `schemaVersion: 1` geri konunca 34 fikstürün, 3 sezonun ve 9 kaydın eski hash'lerinin hepsi birebir tuttu. `eventsHash`, `statsHash`, skorlar, maç özetleri ve olay sayıları hiç değişmedi. Ekranlar: `squad.html` (16 satırda `<span class=shirtno>` ve "Yıllık maaş ₺70.3M / ₺24.0M" → "/ ₺97.0M"), `profile-squad.html` (başlıkta numara), `transfer.html` ("Maaş alanı ₺0.0M/yıl" → "₺26.7M/yıl"), `season-end-03-contracts.html` (yeni "Maaş alanı ₺97.0M" satırı; uyarı yok). Bunların dışında ekranlar birebir aynı.
- V7.14.0 (highlight arşivi, kayıt formatı 3): kariyer hash'leri (`matches.json`'da 34 `careerAfterHash`, `seasons.json`'da 3 `careerHash` ve 3 `afterSummerHash`, `saves.json`'da 9 `careerHash`) yenilendi. Değişen sadece kayıt biçimi: `schemaVersion` 2 → 3 ve her kariyerde `highlights` alanı (bu senaryolarda yıldız transferi ve 3D maç olmadığından boş liste `[]`). Kontrol: hash alınmadan önce `schemaVersion: 3` → `2` yapılıp boş `highlights` silinince 34 fikstürün, 3 sezonun ve 9 kaydın eski hash'lerinin hepsi birebir tuttu. `eventsHash`, `statsHash`, skorlar, maç özetleri, olay sayıları ve ekranlar bu adımda değişmedi.

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
