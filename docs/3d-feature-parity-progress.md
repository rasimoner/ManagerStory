# 3D özellik eşitliği — ilerleme ve deneme kaydı

Başlangıç: `5c201ea439fc0d57c0006683a07b51a07e08559c`, V7.19.2.
Dal: `fix/3d-complete-feature-parity`. Main/yayın değiştirilmeyecek.

Bir deneme, bir çözüm yaklaşımının uygulanması + ilgili kabul doğrulamasıdır. Test yazma/teşhis deneme değildir. Aynı kabul maddesi yeniden adlandırılarak sayaç sıfırlanmaz. Başarısız yaklaşım ve bulgu burada tutulur; iki başarısızlıktan sonra yalnız o maddenin ürün değişiklikleri geri alınır. Açık yeniden üretmeler `tests/reproductions/` altında, varsayılan paketten ayrı tutulur.

| Kimlik | Sabit kabul kapsamı | Durum | Deneme | Kanıt / bağımlılık |
|---|---|---|---:|---|
| P1 | Dar alanda tekrarlı dönüş; iki yön/süre/kayıt | ikinci deneme başarısız | 2/2 | Ürün geri alındı; tests/reproductions/turn-release.cjs |
| P2 | Doğrudan frikik kararı, fizik, hazırlık, baraj, kamera | doğrulama bekliyor | 0/2 | Mevcut `restart-release` yalnız kısa pas |
| P3 | Korner/açık oyun ortası ve gerçek kafa/vole/röveşata | ikinci deneme başarısız | 2/2 | Ürün geri alındı; yeniden üretme ve patch saklandı |
| P4 | İsimli özel çalımlar; gerçek temas ve savunma | engellendi | 0/2 | P1 taşıma/çıkış ve havadakilerde P3 başarısız; isim etiketiyle gizlenmedi |
| P5 | Özel pas/ilk kontrol/aşırtma/Panenka | doğrulama bekliyor | 0/2 | Eski sekanslar koddan karşılaştırılacak |
| P6 | Scorpion ve eski özel kaleci hareketleri | engellendi | 0/2 | P3 gerçek hava/topuk teması teslim edilmedi; normal zincir korunuyor |
| P7 | Ofsayt konumu/katılım/istisnalar/düdük/yeniden başlama | doğrulama bekliyor | 0/2 | Yeni motorda kural bulunmuyor |
| P8 | Diğer duran toplar, devre, 90:00, kamera/sunum koruması | doğrulama bekliyor | 0/2 | Önceki çalışmayı yeniden uygulamadan regresyon doğrulaması |
| P9 | Eski gerçek yıldız tekrarı ve sınırlı salt okuma kayıt | doğrulama bekliyor | 0/2 | `newview/replay.js` gerçek kariyer kaydı; prototip ayrı |
| P10 | Denge, performans, WebGL ve zorunlu teslim kapıları | doğrulama bekliyor | 0/2 | Aynı tohumlu önce/sonra ölçümü; fiziksel Safari mevcut değil |

## Altyapı

Depo klonu ve `npm ci` ilk girişimde başarılı. Video yerelde ve kareleri incelendi. Kullanıcının 56:42–60:00 bulgusu, yaklaşık 57:07 ve 59:15 karelerinde aynı dar alandaki Okoro olarak gözleniyor. Bu gözlem motor kök nedeni veya kayıt tohumu değildir.

## P1 — iki deneme sınırı doldu

1. Seçilmiş sürme koridoruna vücut hizalanana kadar dokunuşu bekletme: yeni iki yön/dört süre testinin 9/9'u geçti; mevcut kalecinin ayakla sürme testi taşıma niyetinin kaybolduğunu gösterdi. Başarısız.
2. Taşıma niyetini dokunuştan önce oluşturma, dokunuş zamanını temas gelene kadar boş bırakma: aynı testin ilk kontrolü düzeldi; serbest top uzakta olduğunda kalecinin gerçek topu kovalama regresyonu kaldı. Başarısız.

Yalnız P1 ürün değişikliği (`dribbling.js`) geri alındı. Varsayılan paketi kırmayan açık yeniden üretme: `node --experimental-vm-modules --disable-warning=ExperimentalWarning --test tests/reproductions/turn-release.cjs`. İlk başsız örnek: seed 9, home-LW, ~177–185 fizik saniyesi. Kullanıcı videosunun orijinal checkpoint/seed'i yok; video ile birebir aynı karar dizisi kanıtlanmadı. Erken/ters yöne dokunuş yeniden üretildi; videodaki bütün döngünün tek kök nedeni olduğu iddia edilmez. Normal sürme/kaleci ürünü korunur. Özel çalımların otomatik seçiminde bu kilitlenme giderilmiş sayılmayacak.

## P2 — frikik

İlk yaklaşım: deterministik mesafe/açı/teknik tercihi, gerçek koşu, mevcut şut/parabol, baraj ve kaleci. Yakın iki yön, uzak/dar açı/düşük teknik, koşuda kayıt/devam ve dikey/yatay kadraj testleri geçti. İlk kadraj testinde testin camera matrixWorld güncellemesi eksikti; bu test altyapısı düzeltildi, ürün kamera formülleri değiştirilmedi.

Tamamlama: barajın gecikmeli fiziksel sıçrama zarfı ve altından geçme, vuruş karesinde gerçek ayağa IK bağlantısı. Gerçek rig teması ve baraj çarpışma testleri geçti. Falso eklenmedi: mevcut doğrusal yatay/parabolik dikey uçuşta doğrudan vuruşlar hesaplanır; bu aşamada falso gerektiren uçuş seçilmez. Uygun servis seçeneği P3 ile ortaklaştırılacak. Genel frikik maddesi henüz bütün görsel kanıtlarıyla tamamlandı sayılmıyor.

Altyapı: varsayılan Node 24 eski golden sonuçlarını değiştiriyor; Node 22.23.4 edinildi. Node 22 hızlı pakette yalnız yeni JSON belgesinin eksik başlığı yakalandı ve belge eklendi; golden yenilenmedi. Yerel Playwright indirmesi eksik ZIP döndürüyor; otomatik iç tekrar yapan yükleyici durduruldu. Aynı indirme tekrar başlatılmayacak.

## P3 — ortak orta / hava teması

İlk yaklaşım: korner ve uygun servis frikiğinde alıcı/markaj hedefleri, açık oyunda aynı havadan pas uçuşu, temas yüksekliğinden gerçek kafa şutu/uzaklaştırma/vole. Kafa/vole ve kayıt testleri geçti; köşe çizgisinin arkasına çıkan yaklaşma hedefi hareket sınırında erişilemedi. İlk deneme başarısız.

İkinci yaklaşım: köşe yayı içinde 0,5 m içeride top noktası ve saha içinde kırpılan yaklaşma hedefi. Aynı 22 odaklı test geçti; fiziksel yerleşim ve önceki duran top testleri korunuyor. İsimli röveşata henüz eklenmedi; kafa pası/boşa çıkan servis ve normal kariyer kanıtı için doğrulama sürüyor. Sayaç 2/2; aynı köşe/hedef kabulü yeniden açılmayacak.

P3 ikinci yaklaşımın zorunlu hızlı paketi iki regresyon buldu: servis pasında `restartKind` metadata'sı eksik; V7.15.0 referans kaydında açık oyun orta sınıflandırmasının uyumluluk kapısı olmadığı için özgün olay/fitness sonucu değişiyor. 22 odaklı test yeterli kabul edilmedi. İki yaklaşım da tüm kabulü sağlayamadığı için P3 ürün farkının tamamı geri alındı; P2 frikik commit'i korundu. Üçüncü düzeltme yapılmadı. `tests/reproductions/cross-delivery.cjs` kırmızı örnekleri, `cross-delivery-attempt2.patch` denenmiş yaklaşımı saklar. Kafa/vole, ikinci yaklaşımda izole testte çalışsa da teslim edilen ürün özelliği sayılmaz. P3'e bağlı hava bitirişleri, havadan özel kontroller ve bunların kamera/tekrarları engellendi.

## P7 — ofsayt

İlk yaklaşım: gerçek pas/şut çıkışında top ve sondan ikinci rakibe göre konumu saklama; katılımda düdük, endirekt frikik; taç/aut/korner istisnaları; kontrolle sıfırlama; kayıt/devam. 24 odaklı test geçti.

İkinci yaklaşım: pasif oyuncu/gerçek top mücadelesi/kaleci görüşünü kapatma ayrımı ve yavaş, hazırlanılmış rakip oyunuyla hızlı sekmenin ayrımı. 7 motor testi ve eski sarı çizgi/rengin salt okuma görünüm testi geçti. Bu model oyuncuları mevcut motorun metre kök noktalarıyla değerlendirir; ayrı uzuv ofsayt geometrisi yoktur. Rakibin kasti oyun ölçütü bu motorun süre/hız/yükseklik yaklaşımıdır; hakemlikteki bütün öznel durumların eksiksiz karşılığı iddia edilmez. Kaynak: https://www.theifab.com/laws/latest/offside/ .

İki deneme sayacı korunur. P1/P3 başarısız ürünleri geri alındıktan sonra P7 hızlı paketleri başarılı; mevcut bir atlama var; ayrı performans 5/5. Sarı çizgi görünümünün eklenmesinden sonraki kapılar teslimde ayrıca çalıştırılacak.

## P2 — teslim öncesi ikinci yaklaşım

Açıklığı tamamen kapatmanın ilk kararda maliyetsiz kaldığı ek kabul testi kırmızıydı. İkinci yaklaşım, kapalı kale açıklığına göre gerekli teknik beceriyi artırır; beceri/mesafe/açı ve kalecinin köşe konumu birlikte korunur. Sabit barajın gerçek çarpışması ve sıçrama aralığı dışında sıradan top temasına dönüş de kabul testindedir. Bu kapsamdan sonra yeni bir futbol yaklaşımı eklenmez. Servis ortası P3 yüzünden engellidir.

## P5 — bağımsız aşırtma/Panenka

Aşırtma zaten fiziksel `shot.style:chip` üretmekteydi; eksik eski scoop/pass pozu bağlandı. Top/sonuç/RNG değişmez.

Panenka 1. yaklaşımda izole gerçek kaleci konumunda çalıştı, **normal hazırlık/koşuda tetiklenmedi**: kaleci vuruştan önce yalnız 0,445 m yanal yer değiştiriyordu. 2. yaklaşım, gerçek yanal hızdan mevcut ivmeyle frenlenebilen konumu kullanır; beceri/hız/mesafe eşikleri düşürülmedi. Normal penaltı yaklaşmasında gerçekten Panenka oluştu. İki yön, düşük beceri/bağlanmamış kalecide normal şut, kayıt/devam ve önceki 39 ilgili kontrol geçti. Daha sonra 20 ortak çekirdek kabulü geçti. Backheel/rabona/özel kontrol P1/P3'e bağlı; no-look ayrıca 0 denemeyle açık kalır.

## P9 — gerçek manuel tekrar

Eski createReplay kullanıldı: gerçek çizilmiş beden ve top, mevcut yıldız kamera ölçüleri, 0,35× ve ilerleme çubuğu. İlk yaklaşımda çekirdek eşitliği ve 180 kare/bellek sınırı geçti. WebGL'de dikey kamera düğmeleri iki satırlı oynatma düğmeleriyle çakıştı. İkinci yaklaşımda dikey yerleşimler ayrıldı, gerçek UI tıklamasıyla kabul geçti. Kadro değişince tampon temizlenir; sonraki maça taşınmaz. Kayıtlı gövde/top oynatılırken canlı checkpoint/RNG eşitliği ve gerçek kayda dönüş testli. Otomatik başlatma ve kalıcı arşiv tamamlanmış sayılmaz.

## P10 — görsel ve altyapı

Node 22 ve yerel Chromium 153 gerçek WebGL çalışıyor. CDN'deki bozuk ZIP yerine scratch'te mevcut bağımlılıkları değiştirmeyen bir tarayıcı paketi kullanıldı; sistem FFmpeg'i video için kullanıldı. Fiziksel iPhone/Safari yok. İzole gerçek kariyer UI'sinde 10 kayıt alındı: dört frikik (iki yön/iki oran), iki ofsayt, iki gerçek aşırtma tekrarı, iki Panenka. Ofsayt çizgisinin ilk TV kadrajında dışarıda kaldığı görsel bulgu sonrası eski yüksek kamera olay bağlantısı eklendi; sarı çizgi görüntüde doğrulandı.

Son futbol kaynağı sabitlendi. Sonraki işlemler zorunlu tam/hızlı/lint/build/smoke, salt okuma video kaydı ve ölçüm referansıdır. Ölçüm sürerken kaynak değiştiğinde eski kaynaklı çalışma durduruldu; aynı koşulda sonuç değişsin diye tekrar denenmedi.

## Son kaynak doğrulaması

P2'de savunmanın karar maliyeti ve sıçrama zaman aralığının bitişi, P5'te doğal koşuda Panenka, P7'de takım arkadaşının yeni temas anı, P9'da gerçek kayda dönüş birlikte son odaklı pakette doğrulandı. Yeni futbol değişikliği eklenmiyor. CI'nin eski tarihli Denge 1 dosyası yerinde korunur; aynı 50 tohum + sekiz güç deneyinin yeniden üretme kapısı yeni tarihli ölçüm referansına bağlanır. Hiçbir ünite/smoke/performans/50-tohum karşılaştırması kaldırılmadı. Yeni WebGL kabulü PR'a ve ilerideki Pages yayın kapısına eklendi; bu dal yayın tetiklemez.
