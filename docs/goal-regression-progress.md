# Gol artışı — dar kapsam ve sabit kabul

1 Kasım 2026. Başlangıç: fix/3d-remaining-feature-parity / 97d99fcfad169c4ccf156b2d53884a4f123c4023. Karşılaştırma main d86ac72de6bc4677a2357fc516c06e1ffeceed48; iki uzak baş doğrulandı. Yeni dal fix/3d-goal-regression. Node 22.23.4. Önceki dosyalara dokunmadan ayrı clone; kopuk worktree/Node bağlantısı birer girişimde aşıldı.

Tek ürün kabulü G1: Aynı 50 tohum/54.000 adım sözleşmesindeki gol 2,76→16,92 ve şut 17,64→48,46 artışının nedenini kod/olay iziyle ayır; nedeni gösteren kırmızı testi yaz, yalnız kanıtlanan kusuru düzelt. Diğer yeni fizik özelliklerini, normal şut/kaleci davranışını ve kayıt/devamı koru. Uzun ölçümü doğal kısa maçlarla karıştırma. Gol kotası/sonuç çarpanı, seed/eşik/golden/lint baseline değişikliği yok.

G1 çözüm yaklaşımı sayacı: **2/2**. Salt okuma teşhisi, tarihsel commit karşılaştırması ve kırmızı test çözüm yaklaşımı sayılmaz. Uygulama + ilgili kabul bir denemedir; ikinci başarısızlıkta yalnız bu işin başarısız ürün farkı geri alınır ve ayrı yeniden üretme korunur. Önceki görevin altı başarısız hareketi ve diğer açık maddeleri bu işte yeniden denenmez; sayaçları korunur.

Bağımlılık: Başlangıç varsayımı yok. Önce 901/731/42 tohumlarında küçük karşılaştırma ve tarihsel commit daraltması; kesin neden bulunduktan sonra ürün değişikliği. Odaklı test/ölçümden sonra bir geniş doğrulama. Performans, diğer kariyer fixture'ları ve 3D tekrar ayrı sonraki işlerdir; başarısız kapılar gizlenmez. Main'e merge/yayın yok. PR yalnız zorunlu kapılar geçerse.

Önceki ölçümler docs/measurements/3d-remaining-parity içinde korunur. Yeni kanıtlar aynı adları/raporları ezmeden ayrı klasöre yazılır. AGENTS.md commit kontrolleri uygulanır; kapsam dışı bir kapı başarısız olursa neden ve sapma açıkça kaydedilir.

## Birinci yaklaşım

90ea733 üç sabit tohumda 9 gol, korner/servis commit'i 8c99b45 41 gol, son aday 43 gol. İlk büyük sıçrama 8c99b45'te. 901 olay izinde servis sonrası savunmacı hedefleri x≈20–22/y=-34 iken gerçek karşılama x≈40/y≈-2; üç savunmacı alıcı çevresinden ayrılıyor. Ulaşılamayan orta için son ufuk noktasını seçen simulationInterceptTarget bunu üretiyor. Kırmızı geometri testi hedef (21,23;-34) nedeniyle başarısız; ulaşılabilir orta ve normal serbest top karşı örnekleri geçti. İlk ürün yaklaşımı yalnız ulaşılamayan ortada en yakın oynanabilir geçiş noktasını korur; gerçek erişilebilir kesme ve diğer toplar aynı kalır. Sonuç ölçümü beklenir.

Birinci yaklaşım sonucu: geometri kabulü 3/3 geçti ama aynı üç tohumda 43 yerine 44 gol (15/14/15), dolayısıyla G1 başarısız. Yalnız bu yaklaşımın ball-chasing ürün farkı kaldırıldı. Patch ve kırmızı geometri yeniden üretmesi tests/reproductions altında korunur. Bu savunma hedefi sorunu büyük gol artışını açıklayan yeterli neden değildir.

## İkinci yaklaşım

Gol izinde kaleci orta uçuşu boyunca mevcut topun kanadını izliyor; orta merkeze inerken ters tarafta kalıyor, kurulamıyor. 901 ilk golde atışta kaleci y=+2,069, şut karşı köşeye; gereken uzanma 2,139 m, mevcut ek uzanma 0,749 m. Bu normal şut sonucunu değiştiren bir katsayı değildir. Yeni kırmızı test, merkeze gelen aynı kesintisiz uçuş için iki hücum yönü/iki kanatta kalecinin merkezi alanı önceden örtmediğini gösterir. İkinci yaklaşım yalnız cross uçuşunda gerçek fiziksel iniş noktasını açıortay hedefinde öngörür; diğer pas/şut, hız, tepki, erişim, RNG ve sonuç çözücüsü korunur. Üçüncü ürün yaklaşımı yoktur.

İkinci yaklaşım sonucu: yerel kaleci/iki yön/iki kanat kabulü 5/5 geçti; aynı üç tohumda gol 18/10/9 (toplam 37), son aday 17/14/12 (43), taşıma commit'i 4/4/1 (9). Büyük artış giderilmedi ve 901 daha kötüleşti. G1 başarısız; yalnız ikinci yaklaşımın keeper-positioning ürün farkı da geri alınır. İki patch ve ayrı kırmızı yeniden üretmeler korunur. Yeni ürün çözümü uygulanmayacak; yalnız nedensel ayrıştırma/teslim doğrulaması tamamlanır.

## Son ayırma ve durum

8c99b45 üzerinde yalnız restart-decision.js önceki 90ea733 sürümüne alınınca üç seed 1/2/3 gol, toplam 6 oldu (8c99b45: 14/12/15, toplam 41). Bu tanı kontrolü yeni duran-top servis seçimini kapatır; nihai ürün çözümü değildir ve aday dala alınmadı. Probe worktree de eski haline döndürüldü. Yeni servis yolunun büyük artıştaki nedensel payı doğrulandı; oyuncu yerleşimi/orta seçimi/ilk kontrol/atış zincirindeki tam alt neden henüz izole edilmedi.

G1 çözümü **başarısız, 2/2**. Yeni adayın src/ ağacı 97d99fc ile aynıdır. Üçüncü ürün yaklaşımı yok. Dört yönlü yerel testin geçmesi veya toplamın 43→37 olması yeterli başarı sayılmadı. Başarısız ürünler geri alındığı için daha büyük 50 tohum/güç/video paketi tekrar başlatılmadı. AGENTS.md commit lint/hızlı kontrolü bir kez çalıştırılır; performans veya başka özellik düzeltmesine geçilmez.
