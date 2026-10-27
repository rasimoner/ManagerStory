# ManagerStory: yapay zeka ajanları için çalışma kuralları

Bu projede her değişiklik Robert C. Martin'in (Uncle Bob) Clean Code ilkelerine göre yapılır. Kuralların tek kaynağı bu dosya.

## Kod
- İsimler niyeti anlatır; yeni kodda kısaltma ve sürüm ekli ad (`evolveV6`, `v6Sign`, `pitchV73`) yok.
- Fonksiyon tek iş yapar, kısadır, az parametre alır (en çok 3; fazlası nesne olur); yan etkisi adından anlaşılır.
- Modül tek sorumluluk taşır; utils/helpers torbası yok.
- Sihirli sayı yok: denge ve oyun değerleri `src/data/*.json`'da (ayarlanan sayılar `balance.json`'da).
- Yorum "neden"i anlatır; yorum satırına alınmış kod ve ölü kod bırakılmaz (git geçmişi saklar).
- Tekrar yok; hatalar açıkça ele alınır, sessizce yutulmaz (boş `catch` yok).
- İzci kuralı: dokunduğun kodu biraz daha temiz bırak, ama davranışı değiştirmeden ve işin kapsamını şişirmeden. İlgisiz büyük temizlik ayrı iş olur.
- Kod, kod yorumları ve commit mesajları İngilizce; `docs/` Türkçe.

## Mimari (ayrıntı: docs/architecture.md, docs/code-layout.md)
- Bağımlılık aşağı akar: `main.js → src/modes → src/core → src/data`; `src/ui` ortak. `src/core` modları tanımaz; bir modun bilmesi gerekeni `core/hooks.js` ile söyler.
- Oyun mantığı (`src/core`, `presentation/` hariç) saftır: DOM, tarayıcı API'si, three.js yok. Paylaşılan durum sadece `core/state.js`'te, ayarlayıcılarla değişir; `window`'a oyuna ait bir şey konmaz.
- Rastgelelik yalnızca seed'li üreteçten (`core/random.js`); `Math.random` kullanılmaz.
- Motor kariyere yazmaz, olayları söyler; sunum olay günlüğünü okur, simülasyonu ilerletmez.
- Kayıt formatı sürümlüdür: alan değişikliği = `SAVE_MIGRATIONS`'a (`core/save.js`) yeni adım + `docs/save-format.md`.
- Bilinen borçlar `docs/architecture.md` "Kalan borçlar"da; yeni borç eklenirse oraya yazılır.

## Testler ve lint
- Önce test (TDD), sonra kod. Testler oyuna dosyayla değil adla ulaşır (`tests/support/game.cjs`).
- Altın kayıtlar (`tests/golden`) yalnızca bilinçli davranış değişikliğinde güncellenir: `UPDATE_GOLDEN=1 node --test tests/<dosya>`, ayrı commit, gerekçesi `tests/golden/README.md`'de.
- `npm run lint`: ESLint, `lint-baseline.json` tabanına göre. Yeni ihlal hata verir; ihlal azalınca taban kendiliğinden sıkılaşır, güncellenen dosyayı commit'le. Taban büyütülmez (test korur); eşikler ve gerekçeleri `eslint.config.js`'te.
- Her commit'te `npm run lint` ve `npm run test:fast`; birleştirmeden önce `npm test`, `npm run build`, `npm run smoke`.

## İş akışı
- Her iş ayrı dalda; main'e sadece tam doğrulamadan sonra birleştirilir. Commit'ler küçük ve tek konulu.
- Birleşen dallar silinmez; hangilerinin silinebileceği raporlanır.
- Sürüm `package.json`'da (`npm version <x.y.z> --no-git-tag-version`) ve README başlığında; oyun kodu değişmiyorsa sürüm artmaz. Her yayına `docs/v<x.y.z>-release.md`.
- Değişiklikle ilgili belgeler (code-layout, architecture, game-rules, save-format) aynı işte güncellenir.
- Bir kuraldan sapmak gerekiyorsa gerekçesi yazılır: kodda `// eslint-disable-next-line <kural> -- <gerekçe>`, değilse commit mesajında.
