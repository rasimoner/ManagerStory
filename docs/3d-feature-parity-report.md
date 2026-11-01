# Eski 3D ile özellik eşitliği — teslim raporu

1 Kasım 2026. Başlangıç main `5c201ea439fc0d57c0006683a07b51a07e08559c` / V7.19.2. Dal `fix/3d-complete-feature-parity`. Tam özellik eşitliği **sağlanmadı**. Başarılı bağımsız parçalar korunuyor; iki başarısız yaklaşım sonrası P1 ve P3 ürün farkları geri alındı. Main'e merge ve yayın yapılmadı.

Ürün commit’i: `0546542776959202a5d1546a7a4447c02c91dd76` (yerel test ağacı `004b001`, birebir aynı Git ağacı `8e23588b1471d820b165f3f3d4f9000a24838ecc`). Deneme günlüğü: [ilerleme belgesi](3d-feature-parity-progress.md). [Ayrı devam promptları](3d-feature-parity-follow-ups.md).

## Koddan doğrulanan eski / yeni karşılaştırma

"Eski" sütunu dosya varlığından ibaret değildir: `newview/director.js` içindeki gerçek çağrı yolları ve ilgili `beats` fonksiyonları incelendi. Yeni motorda genel yön değişimine isimli özel çalım etiketi verilmedi.

| Özellik | Eski gerçek yol | Yeni olay / bağlantı | Teslim durumu ve kabul kanıtı |
|---|---|---|---|
| Tekrarlı dönüş | Yönetmenin kendi taşıma çözücüsü | owner-decision → dribbling → gerçek yeniden kontrol | **Çözülemedi, 2/2**. Erken ters yöne dokunuş testi ve seed 9 checkpoint'i ayrı yeniden üretmede. Videoyla aynı seed bulunamadı; kesin tek kök neden iddia edilmez |
| Doğrudan frikik | director freeKickHomes / shot; vuran–baraj–kale kadrajı | restart-decision / runup / gerçek shot / freeKick / wallJump; eski shot kamerası | Doğrudan seçenek, mesafe/açı/beceri ve savunmanın kapattığı açıklık, gerçek fizik ve ayak teması tamamlandı; iki yön ve iki telefon oranında WebGL |
| Frikik kısa pası | director pass | Normal mevcut pass fiziği | Uzak/dar açı/düşük beceri ve savunmayla değişen karar testli |
| Frikikte uygun servis | Eski cross/pass | Teslimde hâlâ kısa pas | **Engellendi: P3**. Orta uçuşu geri alındığı için servis varmış gibi sunulmaz |
| Baraj | freeKickHomes ve şuta tepki | Yasal 9,15 m + gerçek gecikmeli sıçrama zarfı; aynı çarpışma hesabı | Altından/üstünden geçme ve süresi biten sıçramadan normal temasa dönüş testli. Falso eklenmedi; seçilen vuruşlar mevcut yatay doğru/dikey parabolle uçuyor |
| Korner ortası / açık oyun ortası | director cross ve pass | Mevcut kısa korner / normal havadan pas | **Çözülemedi, 2/2**. İkinci yaklaşım eski kayıt sonucunu bozdu; ürün geri alındı |
| Kafa şutu / kafa pası / uzaklaştırma | header / first-touch / director shot | Mevcut kafa **kontrolü**; yeni bitiriş yok | **Engellendi: P3**. Denemede çalışan izole kafa/vole teslim özelliği sayılmaz |
| Vole / röveşata | bicycle-kick, keeper-volley, director shot | Kaleci degajı mevcut; saha bitirişi yok | **Engellendi: P3**. Kaleci degajı vole bitirişi diye sayılmaz |
| Stepover / elastico | feints / skill-beats, director DUEL_MOVES | Genel cut/bodyFeint gözlemleri | **Engellendi: P1**, 0 uygulama denemesi. Eski fonksiyonlar yeni motorun üstünde ikinci çözücü olarak çağrılmadı |
| Nutmeg / flair nutmeg | through-the-legs / skill-beats | Bacak arası için fiziksel boşluk/temas yolu yok | **Engellendi: P1**, 0 deneme |
| Cruyff / croqueta / roulette | turns / feints / skill-beats | Bu isimlerle gerçek çoklu dokunuş yok | **Engellendi: P1**, 0 deneme |
| Rainbow / sombrero / juggling | over-the-top / skill-beats | Genel ilk kontrol özel çalım değil | **Engellendi: P1 + P3**, 0 deneme |
| Drag-back | director temel duel içindeki gerçek `dragBack` eylemi ve geri çekiş | Yeni çekirdekte yalnız genel dönüş | **Engellendi: P1**, 0 deneme. Eski animasyonun dosyada bulunması yeterli sayılmadı |
| Backheel / rabona | flair-passes ve director pass içindeki gerçek seçiciler | Normal pass | **Engellendi: P1**. Ayak/taşıma yönü kabulü sağlanmadan görsel etiket eklenmedi; 0 deneme |
| No-look | director pass / ACTIONS.nolook | Normal pass; göz/bakış niyeti yok | Açık, **0 deneme**. Bağımsız dar motor + baş pozu işi gerekir; tamamlandı sayılmıyor |
| Özel ilk kontroller / Bergkamp | first-touch footTrap / pirouetteReceive | Gerçek yükseklikten mevcut foot/chest/head kontrolü | Havadan süreklilik korundu; özel kaçış sekansı **P1/P3'e bağlı**, 0 deneme |
| Aşırtma | director chip; eski yumuşak pass pozu | Mevcut gerçek `shot.style:chip` → eski scoop/pass pozu | Eksik animasyon bağlantısı tamamlandı. Gerçek uçuş, kontrol/RNG etkisizliği ve WebGL tekrar testli |
| Panenka | director panenka; eski yumuşak vuruş ve pen kamerası | Gerçek keeper erken yan adımı + fren mesafesine göre `shot.style:panenka` | **İkinci yaklaşımda tamamlandı**. Normal koşuda gerçekten tetiklendi; iki yön, sıradan vuruş alternatifi ve kayıt/devam testli; sonucu fizik belirliyor |
| Scorpion / özel kaleci | director scorpion + scorpion beat | Normal erişim/tutma/çelme zinciri | **Engellendi: P3**. Gerçek topuk/hava teması olmadan kurtarış sonucu üzerinden animasyon eklenmedi; 0 deneme |
| Taç/aut/santra/kaleci dağıtımı | Eski duran top ve keeper-hands/volley yolları | Faz 2 fiziksel yeniden başlama + mevcut throw/punt | İki yön, hareket sınırı, gerçek bırakma, kayıt/devam ve önceki smoke kapıları korunuyor |
| Ofsayt | director offside bildirimi/çizgisi; eski motor kuralı | Yeni pas/şut konum kaydı, katılım/çelme/kasti oyun ayrımı, endirekt frikik | Noktasal motor modelinde uygulandı. Pasif oyuncu, gerçek mücadele, kaleci görüşü, doğrudan taç/aut/korner istisnaları, sonraki takım arkadaşı teması ve kayıt/devam testli |
| Kamera ve sunum | Ortak createBroadcastCamera, bayrak/gol/fotoğraf | Mevcut ortak kamera/rig/stadyum | Manuel dört açı ve çalışan eski özellikler korunuyor. Ofsayt eski yüksek açıya ve sarı çizgiye bağlandı; dikey kontrollerin birbirini örtmesi düzeltildi |
| Gerçek yıldız tekrarı | newview/replay gerçek gövde/top ring kaydı; eski maç içi UI | Aynı kaydedici, gerçek çizilmiş pozlar, mevcut yıldız kadrajı, 0,35× | Duraklatılmış maçta **Tekrar** düğmesiyle çalışıyor; canlı checkpoint/RNG aynı. En çok 180 kare; kadro değişiminde temizleniyor |
| Otomatik yıldız tekrarı | Eski yönetmenin özel akışı içinde otomatik | Yeni akışta otomatik başlatma yok | **Açık**, tamamlandı sayılmıyor. Manuel gerçek tekrar teslim edildi; otomatik saat bekletme ayrı kabul ister |
| Kariyer arşivindeki “İzle” | Eski highlights **tarifini** staging ile yeniden sahneliyor | Yeni motorun gerçek kaydı arşive yazılmıyor | Açık. Önceden yazılmış staging sahnesi gerçek maç tekrarı diye bağlanmadı; yeni kalıcı tekrar sistemi kurulmadı |

## Başarısız maddeler ve korunan davranış

### P1: dönüş döngüsü — 2/2 başarısız

1. Seçilen sürme yönüne hizalanana kadar dokunuşu bekletme: 9 yeni test geçti; mevcut ayakla süren kalecinin taşıma niyeti kayboldu.
2. Taşıma niyetini fiziksel dokunuştan önce başlatma: ilk sorun düzeldi; uzak serbest topu kovalama hedefi bozuldu.

`dribbling.js` ürün farkı geri alındı; önceki normal sürme/kaleci davranışı korundu. Yeni isimli çalımlar için ortak taşıma/çıkış kabulü sağlanmadığından bu işler durduruldu. `tests/reproductions/turn-release.cjs`, `turning-seed9-trace.json` ve `turning-seed9-checkpoint.json` korunur. Video erişildi ve kareleri incelendi; özgün kariyer checkpoint/seed'i yoktur. Bunlar videonun kesin tek kök nedenini veya çözüldüğünü ispatlamaz.

### P3: orta ve hava bitirişleri — 2/2 başarısız

1. Kornerde ceza alanına gerçek servis ve hava teması: yaklaşma hedefi çizgi dışına çıktı ve fiziksel yerleşim kilitlendi.
2. Köşe yayı içinde top, saha içinde yaklaşma: 22 odaklı test geçti; hızlı paket servis pasında eksik `restartKind` ve V7.15.0 referans kaydında değişen olay/fitness sonucu buldu.

Yalnız P3 ürün farkları geri alındı. Çalışan kısa korner, eski havadan pas ve ilk kontrol korundu. `tests/reproductions/cross-delivery.cjs` ve `cross-delivery-attempt2.patch` saklanır. Bu patch gözden geçirilmeden uygulanacak hazır ürün değildir. Harici dosya gerekmez; yeni görev için gereken motor/uyumluluk karşı örnekleri depoda saklıdır. Kafa kontrolü kafa şutu sayılmadı. Bağlı kafa/vole/röveşata, hava çalımları ve scorpion engellendi.

Bloklanan maddelerde **iki yaklaşım denenmiş gibi yazılmadı**: deneme sayısı sıfırdır. P1/P3'ü aşmak için başarısız ortak yolu başka adla yeniden denemek veya eski yönetmenin ikinci fiziğini çağırmak tercih edilmedi. No-look, otomatik tekrar ve kalıcı arşiv ayrıca açık iş olarak listelendi.

## Motor, kayıt ve denge

Saf çekirdek DOM/three.js veya kariyer modunu import etmez. Sunum çekirdeği ilerletmez; tekrar yalnız ayrılmış renderer nesnelerine yazıyor. RNG mevcut seed'li üreteçten; yeni kararlar sonuç zarı eklemiyor. Kalecinin penaltı erken adımı mevcut hareket/ivme sınırlarıyla çizgide gerçekleşiyor. Panenka seçimi, gerçek yanal hızın fiziksel fren mesafesine bakıyor; gol/kurtarış yazmıyor.

Kayıt biçimi **7**: eski ham ve sıkıştırılmış aktif kayıtta isteğe bağlı `offside:null`; çalışma anında restart delivery/runup ve baraj tepki zamanı düz checkpoint'te saklanır. Gerçek tekrar tamponu kariyere kaydedilmez. Eski V7.15.0 referans saati uyumluluğu korunur. Schema meta verisi karşılaştırması dışındaki golden içerikler değiştirilmedi.

Eşlenmiş 20 tohum: aynı Node 22.23.4, aynı kadrolar/özellikler, 7 dakika, iki devre, yorgunluk kapalı. Başlangıç main ayrı worktree'den; son ürün aynı komutla ölçülür. Bu, fiziksel iPhone performansı veya geniş kalibrasyon değildir. Top kaybı sütunu, yeniden başlama kararları dahil sahiplik takımı değişimleridir.

| Maç başına | Main | Aday | Fark |
|---|---:|---:|---:|
| Şut | 7.20 | 6.80 | -0.40 |
| Gol | 0.65 | 0.55 | -0.10 |
| Pas | 71.15 | 72.45 | 1.30 |
| Başarılı pas | 52.55 | 52.70 | 0.15 |
| Faul | 2.05 | 1.95 | -0.10 |
| Kurtarış | 2.60 | 2.35 | -0.25 |
| Kontrollü kazanma | 18.50 | 18.25 | -0.25 |
| Sahiplik değişimi | 27.75 | 29.50 | 1.75 |

Bu dağılım değişti; “denge aynı” denmiyor. Şut/gol kotası veya sonuç çarpanı eklenmedi. Frikik hazırlığı/şut tercihi, ofsaytta kesilen atak ve yeni fiziksel penaltı kararı değişimin sebepleridir. 20 maçlık örneklem küçük; yeni gol dengesi kalibre edilmiş sayılmaz.

Eski Denge 1 tarihi ölçümü değiştirilmeden korunur. Mevcut CI'nın 50 tohum + sekiz güç deneyi yeniden üretme kapısı, bilinçli yeni futbol kuralları için ayrı **yeni ölçüm referansı** kullanır; test/karşılaştırma kaldırılmaz. Yeni referansın her koşusu ve gücü ham JSON'dadır. Bu mevcut araç 54.000 fizik adımlık yeniden üretme sözleşmesini kullanır; devre hazırlığı yüzünden bu kapı tek başına tam 90:00 bitiş kanıtı değildir. Tam bitiş, 20 kısa maçın sona kadar işletilmesinde ve ayrı devre/bitiş testlerinde doğrulanır.

## Görsel kanıt ve telefon kontrolü

`tests/smoke/feature-parity.mjs`: gerçek WebGL, gerçek kariyer UI'sinde **izole çekirdek senaryoları**. İki hücum yönünde frikik ve dikey/yatay ofsayt, aşırtma tekrarı, Panenka. 390×844 / 844×390 Chromium, yazılımsal SwiftShader. Normal kariyer kanıtı ayrı `smoke:sim-3d` ve kaleci kayıtlarındadır; izole sahneler doğal maç sıklığını kanıtlamaz.

Tekrar butonu uygun gerçek kayıt oluşup maç duraklatılınca açılır. Ad/kadraj/ağır çekim ve çubuk gerçek çizilmiş pozlardan gelir. Tekrar bitince aynı canlı poz ve kamera geri konur. Otomatik tekrar ve arşiv “İzle” ayrı açık kalır.

Telefonda kontrol listesi (branch adayı çalıştırıldığında):

1. Yakın frikik: vuran–baraj–kale, gerçek koşu/ayak teması, baraj ve kaleci; uzak/dar açıda pas.
2. Penaltı: normal vuruş, gerçek yan adıma karşı uygun oyuncuda Panenka; kaleci normal zincirine dönüş.
3. Ofsayt: düdük, sarı çizgi/bildirim, doğru endirekt yeniden başlama; taç/aut/korner istisnaları.
4. Aşırtma/uygun kurtarış sonrası duraklat → Tekrar; skor/saat aynı; çıkış, 2D/3D ve kayıt/devam.
5. Dikey kontroller birbirine değmesin; yatay kamera, ayak desteği, gol/fotoğraf/bayrak ve kaleci zinciri korunsun.
6. Gerçek iPhone Safari akıcılığı/ısınması: **henüz fiziksel cihaz onayı yok**. Chromium emülasyonu Safari diye sunulmaz.

## Teslim doğrulaması

| Kontrol | Yerel sonuç |
|---|---|
| Lint | Yeni ihlal yok; baseline büyümedi |
| Tam `npm test` | 585 test: 584 başarılı, 1 mevcut atlama; ayrı performans 5/5 |
| `npm run test:fast` | 495 test: 494 başarılı, 1 mevcut atlama; ayrı performans 5/5 |
| Vite build | Başarılı |
| Eski 34 golden / eski kayıt uyumluluğu | Tam pakette geçti; golden içerikleri yenilenmedi |
| Eşlenmiş 20 kısa maç | Önce/sonra tamamlandı; her maç 90:00'a kadar işletildi |
| 50 tohum + 8 güç deneyi | Yeni kaynakta ölçüldü; bağımsız CI yeniden üretmesi PR'da görülecek |
| Mevcut smoke + gerçek 1× kariyer | Başarılı; 12 eski smoke, tüm laboratuvarlar ve gerçek tam 1× izleme |
| Gerçek 3D/kaleci/Faz 2/yeni olay kayıtları | Son kaynak kanıt listesi aşağıya eklenecek |
| Fiziksel iPhone Safari | Kullanıcı görsel/cihaz onayı bekliyor |

390×844 Chromium 153, 4× CPU yavaşlatması: **441,332 sn (7 dk 21 sn)** aktif izleme; 90:00 bitiş, 4.369 fizik adımı, 169 durdurulmuş devre adımı, atlanan fizik adımı yok. Medyan kare 16,7 ms; p95 16,8 ms; en uzun kare 483,4 ms (maç sonu). Kayıt 644.874 UTF-16 byte; bu renderer'ın toplam tepe belleği değildir. [Ham izleme ölçümü](measurements/3d-feature-parity/career-mobile.json).

Son kaynaklı WebGL dizisinin ve PR/CI durumunun bağlantıları teslim mesajındadır. CI bağımsız doğrulaması tamamlanmadıysa yerel başarı CI başarısı gibi sunulmaz.

Yerel commit / GitHub commit eşlemesi (ağaçları birebir aynı):

| İçerik | Yerel test commit'i | GitHub commit'i |
|---|---|---|
| Doğrudan frikik, kayıt 7, P1 bulguları | f5ba670 | 1a3278d684c740f0f21bc42fdf09c297e4e1562a |
| Ofsayt ve P3 geri alım/yeniden üretme | 095c344 | 32d59451f87f280c105a7fa425d353bea63c9b95 |
| Panenka, gerçek manuel tekrar ve son temas/kamera kabulü | 004b001 | 0546542776959202a5d1546a7a4447c02c91dd76 |

CLI push kimlik doğrulaması bulunmadığından aynı Git ağaçları bağlı GitHub uygulamasıyla commit'lendi; farklı SHA içerik farkı değildir. Bu belgeden sonraki rapor/CI referans commit'leri yeni futbol davranışı eklemez.

