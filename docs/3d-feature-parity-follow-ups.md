# Dar kapsamlı devam promptları

Bunlar mevcut görevde yeniden çalıştırılmadı. Her blok ayrı bir yeni görev için kopyalanabilir. Önce ortak bağımlılıklar kapatılmalı; önceki iki başarısız denemenin sayacı bu teslimde sıfırlanmadı.

## P1 — Tekrarlı dönüş

```text
ManagerStory — P1 — Tekrarlı dönüş
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Videodaki dar alan döngüsünü düzelt. Özgün kariyer seed/checkpoint yok; video ile aynı kök nedeni kanıtladığını varsayma. tests/reproductions/turn-release.cjs, turning-seed9-checkpoint.json ve turning-seed9-trace.json üzerinden başla. Önceki iki başarısız yaklaşım: hizalanana kadar dokunuşu bekletmek kaleci carry niyetini; carry niyetini erken başlatmak uzak boş top hedefini bozdu. Bu kez taşıma niyeti, dokunuş ve kovalama durumlarının sözleşmesini birlikte test et. İki yön/dört süre/kayıt-devam; normal koruma ve kalecinin ayakla sürmesi korunmalı. Rastgele pas/top kaybı ve görsel gizleme yok.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P3a — Korner ve servis uçuşu

```text
ManagerStory — P3a — Korner ve servis uçuşu
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Korner ve uygun servis frikiğinde kısa seçenek ile gerçek ceza alanı ortasını tamamla. tests/reproductions/cross-delivery.cjs ve cross-delivery-attempt2.patch bulgularını oku; patch hazır çözüm değil. Önceki yaklaşımlar: saha dışı koşu hedefi kilitlendi; saha içi hedef düzeltmesi legacy V7.15.0 sonucunu ve restartKind bilgisini bozdu. Normal hava kontrolünü bitiriş sayma. Bu dar işte henüz kafa/vole/röveşata ekleme; önce iki yönde fiziksel yerleşim, hareketli alıcı, boşa servis/defans kesmesi, gerçek uçuş ve eski referans uyumluluğunu kapat.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P3b — Kafa şutu, pası ve uzaklaştırma

```text
ManagerStory — P3b — Kafa şutu, pası ve uzaklaştırma
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
P3a gerçek servis temeli başarılı olmadan başlama. Aynı gerçek hava temasından kafa şutu, kafa pası ve uzaklaştırmayı ekle. Kafa kontrolünü şut sayma; temas öncesi/sonrası top yolu, en erken gerçek savunma teması ve kayıt-devam testli olsun. Önceki geniş P3 işinde iki yaklaşım başarısız oldu ve ürün geri alındı; bu dar kabul için ayrı doğrulama gerekir.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P3c — Vole

```text
ManagerStory — P3c — Vole
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
P3a/P3b ortak hava teması başarılı olmadan başlama. Uygun gerçek yükseklik, vücut yönü ve teknikle vole ekle; başarısız temas, rakibin önce yetişmesi ve seken top devamı korunmalı. Eski shot/volley davranışlarını oku; normal pası veya kafa kontrolünü vole diye etiketleme.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P3d — Röveşata

```text
ManagerStory — P3d — Röveşata
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Ortak hava teması başarılı olmadan başlama. Eski bicycle-kick ve director seçicisini doğrula. Yalnız gerçek top yüksekliği/yönü ve güvenli alan uygunsa röveşata; gerçek ayak teması, kesintisiz top, savunma müdahalesi ve normal koşuya dönüş. Sonucu/kaleci kurtarışını zorlayan eski sahnelemeyi yeni motorun üstünde çalıştırma.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P4 — Stepover

```text
ManagerStory — P4 — Stepover
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Önce P1 taşıma/dönüş kabulünün çözüldüğünü doğrula; çözülmediyse bu bağımlı işi başlatma. Yalnız Stepover hareketini tamamla: feints.js: ayak topun önünden dönerken topun ilk anda kalması, sonra gerçek yan dokunuş ve savunmacının kendi tepkisi. Oyuncu becerisi, hız, baskı ve alanla seç; başarı/başarısızlık gerçek savunma ve top temasından doğsun. Eski animasyon, seyrek yakın kamera ve koşuya dönüş bağlansın. Önceki işte bu hareket uygulanmadı (0 deneme; P1/P3 bağımlılığı).
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P4 — Nutmeg

```text
ManagerStory — P4 — Nutmeg
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Önce P1 taşıma/dönüş kabulünün çözüldüğünü doğrula; çözülmediyse bu bağımlı işi başlatma. Yalnız Nutmeg hareketini tamamla: through-the-legs.js: gerçek bacak aralığı/ayak teması; topun gövde içinden geçmesine özel muafiyet vermeden savunmacının kesebilmesi. Oyuncu becerisi, hız, baskı ve alanla seç; başarı/başarısızlık gerçek savunma ve top temasından doğsun. Eski animasyon, seyrek yakın kamera ve koşuya dönüş bağlansın. Önceki işte bu hareket uygulanmadı (0 deneme; P1/P3 bağımlılığı).
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P4 — Elastico

```text
ManagerStory — P4 — Elastico
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Önce P1 taşıma/dönüş kabulünün çözüldüğünü doğrula; çözülmediyse bu bağımlı işi başlatma. Yalnız Elastico hareketini tamamla: feints.js: aynı ayakla dış ve iç iki ayrı gerçek dokunuş; savunmacının müdahale hakkı. Oyuncu becerisi, hız, baskı ve alanla seç; başarı/başarısızlık gerçek savunma ve top temasından doğsun. Eski animasyon, seyrek yakın kamera ve koşuya dönüş bağlansın. Önceki işte bu hareket uygulanmadı (0 deneme; P1/P3 bağımlılığı).
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P4 — Cruyff

```text
ManagerStory — P4 — Cruyff
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Önce P1 taşıma/dönüş kabulünün çözüldüğünü doğrula; çözülmediyse bu bağımlı işi başlatma. Yalnız Cruyff hareketini tamamla: turns.js: gerçek sahte vuruş hazırlığı, destek ayağı arkasından top çekişi ve fiziksel dönüş. Oyuncu becerisi, hız, baskı ve alanla seç; başarı/başarısızlık gerçek savunma ve top temasından doğsun. Eski animasyon, seyrek yakın kamera ve koşuya dönüş bağlansın. Önceki işte bu hareket uygulanmadı (0 deneme; P1/P3 bağımlılığı).
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P4 — Croqueta

```text
ManagerStory — P4 — Croqueta
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Önce P1 taşıma/dönüş kabulünün çözüldüğünü doğrula; çözülmediyse bu bağımlı işi başlatma. Yalnız Croqueta hareketini tamamla: feints.js: iki ayak arasındaki gerçek yatay transfer, ikinci dokunuş ve savunma teması. Oyuncu becerisi, hız, baskı ve alanla seç; başarı/başarısızlık gerçek savunma ve top temasından doğsun. Eski animasyon, seyrek yakın kamera ve koşuya dönüş bağlansın. Önceki işte bu hareket uygulanmadı (0 deneme; P1/P3 bağımlılığı).
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P4 — Roulette

```text
ManagerStory — P4 — Roulette
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Önce P1 taşıma/dönüş kabulünün çözüldüğünü doğrula; çözülmediyse bu bağımlı işi başlatma. Yalnız Roulette hareketini tamamla: turns.js: gerçek taban dokunuşları ve gövde dönüşü; genel heading değişimi etiketi değil. Oyuncu becerisi, hız, baskı ve alanla seç; başarı/başarısızlık gerçek savunma ve top temasından doğsun. Eski animasyon, seyrek yakın kamera ve koşuya dönüş bağlansın. Önceki işte bu hareket uygulanmadı (0 deneme; P1/P3 bağımlılığı).
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P4 — Flair nutmeg

```text
ManagerStory — P4 — Flair nutmeg
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Önce P1 taşıma/dönüş kabulünün çözüldüğünü doğrula; çözülmediyse bu bağımlı işi başlatma. Yalnız Flair nutmeg hareketini tamamla: through-the-legs.js: arka/topuk temasından gerçek bacak arası yolu; savunmacının topu alabilmesi. Oyuncu becerisi, hız, baskı ve alanla seç; başarı/başarısızlık gerçek savunma ve top temasından doğsun. Eski animasyon, seyrek yakın kamera ve koşuya dönüş bağlansın. Önceki işte bu hareket uygulanmadı (0 deneme; P1/P3 bağımlılığı).
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P4 — Rainbow

```text
ManagerStory — P4 — Rainbow
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Önce P1 taşıma/dönüş kabulünün çözüldüğünü doğrula; çözülmediyse bu bağımlı işi başlatma. Yalnız Rainbow hareketini tamamla: over-the-top.js: önce gerçek geri yuvarlama, ardından topuk kaldırışı ve gerçek havadan top; alıcı ışınlanması yok. Oyuncu becerisi, hız, baskı ve alanla seç; başarı/başarısızlık gerçek savunma ve top temasından doğsun. Eski animasyon, seyrek yakın kamera ve koşuya dönüş bağlansın. Önceki işte bu hareket uygulanmadı (0 deneme; P1/P3 bağımlılığı).
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P4 — Sombrero

```text
ManagerStory — P4 — Sombrero
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Önce P1 taşıma/dönüş kabulünün çözüldüğünü doğrula; çözülmediyse bu bağımlı işi başlatma. Yalnız Sombrero hareketini tamamla: over-the-top.js: gerçek ayak kaldırışıyla rakibin üstüne çıkan top; çevresinden fiziksel koşu ve gerçek yeniden kontrol. Oyuncu becerisi, hız, baskı ve alanla seç; başarı/başarısızlık gerçek savunma ve top temasından doğsun. Eski animasyon, seyrek yakın kamera ve koşuya dönüş bağlansın. Önceki işte bu hareket uygulanmadı (0 deneme; P1/P3 bağımlılığı).
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P4 — Juggling

```text
ManagerStory — P4 — Juggling
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Önce P1 taşıma/dönüş kabulünün çözüldüğünü doğrula; çözülmediyse bu bağımlı işi başlatma. Yalnız Juggling hareketini tamamla: over-the-top.js: ayrı gerçek havadaki dokunuşlar; uzanan bacakla gerçek çarpışma ve kontrol kaybı. Oyuncu becerisi, hız, baskı ve alanla seç; başarı/başarısızlık gerçek savunma ve top temasından doğsun. Eski animasyon, seyrek yakın kamera ve koşuya dönüş bağlansın. Önceki işte bu hareket uygulanmadı (0 deneme; P1/P3 bağımlılığı).
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P4 — Drag-back

```text
ManagerStory — P4 — Drag-back
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Önce P1 taşıma/dönüş kabulünün çözüldüğünü doğrula; çözülmediyse bu bağımlı işi başlatma. Yalnız Drag-back hareketini tamamla: director temel duel ve ACTIONS.dragBack: topun gerçek geri çekilişi ve normal koşuya çıkış. Oyuncu becerisi, hız, baskı ve alanla seç; başarı/başarısızlık gerçek savunma ve top temasından doğsun. Eski animasyon, seyrek yakın kamera ve koşuya dönüş bağlansın. Önceki işte bu hareket uygulanmadı (0 deneme; P1/P3 bağımlılığı).
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P5 — Backheel

```text
ManagerStory — P5 — Backheel
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
P1 ortak temas/çıkış kabulünden sonra yalnız gerçek topuk pasını ekle. Eski flair-passes backheelKick ve director pass seçicisini oku. Vücut arkasına gerçek topuk çıkışı, ayak temasının öncesi/sonrası ve savunma kesmesi testli olsun. Normal pasın görsel etiketini değiştirmek yeterli değil. Önceki işte engellendi; 0 deneme.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P5 — Rabona

```text
ManagerStory — P5 — Rabona
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
P1 ortak temas kabulünden sonra yalnız rabona ekle. Eski flair-passes rabonaKick yolunu doğrula. Vuran ayağın destek ayağı arkasından gerçekten dolanması ve topa gerçek teması; normal pas alternatifi, başarısız uygulama ve savunma müdahalesi korunsun. Önceki işte engellendi; 0 deneme.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P5 — No-look

```text
ManagerStory — P5 — No-look
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Yalnız no-look pası tamamla; önceki işte bağımsız açık kaldı, 0 deneme. Eski director pass ve ACTIONS.nolook davranışını doğrula. Gerçek pas yönünden farklı ama sahadaki gerçek hedefe bakan baş/göz niyetini motor olayında belirt; vision/technique, baskı ve görünür alanla seç. Rastgele genel pasa etiket ekleme. Gerçek ayak teması ve normal pasın kesilebilmesi korunmalı.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P5 — Bergkamp ve özel kontrol

```text
ManagerStory — P5 — Bergkamp ve özel kontrol
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
P1 ve P3 hava/taşıma temelleri başarılı olmadan başlama. Eski first-touch footTrap/pirouetteReceive içinden yalnız bir davranış seçip açıkça kapsamla. Gerçek top yolundan özel ilk temas, savunmacının bir yanından top/öbür yanından oyuncu gibi özgün sekans varsa fiziksel olarak üret. Genel foot/chest/head kontrolünü Bergkamp sayma. Önceki işte engellendi; 0 deneme.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P6 — Scorpion

```text
ManagerStory — P6 — Scorpion
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
P3 ortak hava teması başarılı olmadan başlama. Yalnız eski scorpion davranışını yeni motorun gerçek uygun topuna bağla. Gerçek gövde/topuk erişimi ve top teması olmadan kurtarış sonucuna göre animasyon seçme. Normal yakalama/elde tutma/iniş/kalkış/dağıtım zinciri ve gole gidebilme ihtimali korunsun. Önceki işte engellendi; 0 deneme.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P9 — Otomatik gerçek yıldız tekrarı

```text
ManagerStory — P9 — Otomatik gerçek yıldız tekrarı
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Mevcut manuel gerçek tekrar ve 180 kare kaydediciyi koru. Yalnız eski seyrek otomatik yıldız tekrarını tamamla. Canlı maçın süre/skor/RNG/sonucuna yazmadan ortak saat sürücüsünü beklet; dönüşte biriken duvar süresi yakalanmasın. Normal gol sevinci/fotoğraf kesilmesin. Tekrar yalnız gerçekten kaydedilmiş özel olaydan gelsin. Önceki işte manuel tekrar tamamlandı; otomatik başlatma uygulanmadı, 0 deneme.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P9 — Arşivdeki İzle gerçeği

```text
ManagerStory — P9 — Arşivdeki İzle gerçeği
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Önce eski highlights tarif/staging yolunu incele. Eski İzle arşivi maçı birebir kaydetmiyor; farklı sahne üretiyor. Yeni motorda bunu gerçek tekrar gibi sunma. Önce mevcut gerçek maç kaydının kalıcı arşive taşınmasının kapsamını ve iPhone bellek/disk sınırını somutlaştır. Kullanıcının yeni kalıcı tekrar sistemi kurmama sınırı geçerli; gerekirse yalnız açık tasarım önerisi ver, çalışmayan prototipi kariyer özelliği sayma. Önceki işte yeni kalıcı arşiv kurulmadı.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```

## P7 — Ofsayt modelinin kalan sınırları

```text
ManagerStory — P7 — Ofsayt modelinin kalan sınırları
Depo: https://github.com/rasimoner/ManagerStory
Bu teslimin ürün commit’i: 0546542776959202a5d1546a7a4447c02c91dd76; önce güncel main ve fix/3d-complete-feature-parity dalını doğrula, daha yeni işleri koru.
AGENTS.md, docs/match-sim.md, docs/3d-feature-parity-report.md ve ilerleme belgesini oku. Benimle Türkçe konuş.
Mevcut kök noktasıyla ofsayt, katılım, kaleci görüşü, endirekt yeniden başlama ve taç/aut/korner istisnalarını koru. Yalnız mevcut noktasal modelin uzuv geometrisi ve eşzamanlı iki takımın kontrolsüz sekmelerindeki karar sınırlarını incele. IFAB birincil kaynağını doğrula. Önce gerçek yanlış kararı gösteren deterministik test yaz; kapsamı bütün hakemlik sistemine büyütme.
Bu ayrı görev için en fazla iki çözüm yaklaşımı uygula. Başarısız ürünü yalnız kendi kapsamından geri al; kırmızı yeniden üretmeyi ayrı tut. İkinci başarısızlıkta dur ve bulguları raporla. Başarılı kamera/kaleci/gol/devre/2D–3D sürekliliği, eski kayıtlar ve seed’li fizik korunmalı. Önce test; lint baseline/golden gerekçesiz değişmesin. Zorunlu kontroller geçince PR aç; merge ve yayın yapma.
```
