# PR #16 sonrası 3D eşitliği — sabit kabul ve deneme günlüğü

Başlangıç: 1 Kasım 2026; main `d86ac72de6bc4677a2357fc516c06e1ffeceed48`, ağaç `b564749a2eeb0b361ba35a422716b6890467e787`, sürüm 7.19.2. Dal: `fix/3d-remaining-feature-parity`. Önceki dizindeki README/package/package-lock ve izlenmeyen 7.20.0 yayın notu korunur; bu ayrı worktree'ye alınmaz. Merge/yayın yapılmayacak.

Başlangıç doğrulaması: PR #16 merged. Pages çalışması 41263740314 build/test/smoke ve publish başarılı. PR CI 41260752142 verify başarılı; iki mobil iş tarayıcı kurulumunda bekliyor. Bunlar birbirinden ayrı sonuçlardır. Node 22.23.4 edinildi; varsayılan Node 24 kullanılmayacak.

Bir çözüm yaklaşımının uygulanması ve kabul doğrulaması bir denemedir. Teşhis/kırmızı test deneme değildir. Her satır bu görevde en çok iki yaklaşım alır; yeniden adlandırma/alt parçalama sayaç yenilemez. İkinci başarısızlıkta yalnız o maddenin başarısız ürün farkı geri alınır; ayrı yeniden üretme saklanır. Önceki P1/P3 ve diğer denemeler `3d-feature-parity-progress.md` içinde değişmeden korunur. Bağımlılık aşağıda başlangıç varsayımıdır; kod/karşı örnek ile doğrulanmadan engellenmiş sayılmaz.

| Kimlik | Sabit kabul maddesi | Başlangıç bağımlılığı | Yeni görev denemesi | Durum |
|---|---|---|---:|---|
| R1 | Tekrarlı dönüş: karar/koruma/taşıma/yeniden kontrol, iki yön, bütün süreler, kayıt, normal sürme ve kaleci | Yok; eski P1 iki başarısız yaklaşımı tekrar edilmez | 1/2 | Odaklı 68/68, lint/hızlı/perf geçti; son WebGL bekleniyor |
| R2 | Kısa korner/ceza alanı ortası, frikik servisi, açık oyun ortası; fiziksel yerleşim, boş alan/kaçan/kesilen/seken servis; restartKind ve eski referans uyumu | Yok; eski P3 patch hazır çözüm değildir | 2/2 | İkinci yaklaşım: yakındaki gerçek koşucular; 32 ortak kabul geçti, son hızlı/görsel sürüyor |
| R3 | Gerçek yükseklik/temasla kafa şutu | R2 ortak servis | 1/2 | Kafa şutu fizik/rig geçti; son WebGL bekleniyor |
| R4 | Gerçek kafa pası | R2 ortak servis | 1/2 | Gerçek güvenli kafa pası ve kayıt/devam geçti |
| R5 | Gerçek uzaklaştırma | R2 ortak servis | 1/2 | Gerçek uzaklaştırma ve iki yön geçti |
| R6 | Gerçek vole | R2 ortak servis | 1/2 | Gerçek yükseklikten vole geçti |
| R7 | Uygun durumda röveşata | R2 ortak servis | 2/2 | Başarısız, yalnız röveşata geri alındı; remaining-bicycle.cjs |
| R8 | Stepover | R1 temas/çıkış, koddan doğrulanacak | 1/2 | Gerçek makas dairesi/teması, iki yön, rig ve kesilebilme geçti |
| R9 | Nutmeg | R1, gerçek savunmacı boşluğu | 0/2 | Bekliyor |
| R10 | Elastico | R1, çoklu temas | 1/2 | Dış/iç iki dokunuş aynı gerçek ayaktan; rig geçti |
| R11 | Cruyff | R1 | 1/2 | Gerçek geri çekiş/ayak teması, iki yön geçti |
| R12 | Croqueta | R1, çoklu temas | 2/2 | İkinci yaklaşım: destek ayağı ayrılır, gerçek iki ayak teması geçti |
| R13 | Roulette | R1, çoklu temas | 2/2 | İkinci yaklaşım: tam tur hareket sınırında tamamlanır; 5,7 rad kapısı geçti |
| R14 | Flair nutmeg | R1, gerçek savunmacı boşluğu | 0/2 | Bekliyor |
| R15 | Drag-back | R1 | 1/2 | Gerçek geriye serbest dokunuş ve eski dragBack pozu geçti |
| R16 | Rainbow | R1 + R2 hava teması | 0/2 | Bekliyor |
| R17 | Sombrero | R1 + R2 hava teması | 0/2 | Bekliyor |
| R18 | Juggling | R1 + R2 hava teması | 0/2 | Bekliyor |
| R19 | Backheel | Pas temasının yön/ayak gereksinimi; R1 ilişkisi doğrulanacak | 0/2 | Bekliyor |
| R20 | Rabona | Pas temasının yön/ayak gereksinimi; R1 ilişkisi doğrulanacak | 0/2 | Bekliyor |
| R21 | No-look | Bağımsız pas/görünür hedef ve baş pozu | 0/2 | Bekliyor |
| R22 | Foot trap özel ilk kontrol | Mevcut gerçek ilk kontrol; R2 ilişkisi doğrulanacak | 0/2 | Bekliyor |
| R23 | Pirouette/Bergkamp özel karşılama sekansı | R1 + gerçek gelen top | 0/2 | Bekliyor |
| R24 | Flair pass (eski gerçek stepover pas yolu) | R8 ve gerçek pas teması | 0/2 | Bekliyor |
| R25 | Scorpion | Gerçek hava/topuk erişimi, R2 ilişkisi doğrulanacak | 0/2 | Bekliyor |
| R26 | Diğer eski özel kaleci yollarının envanteri, mevcut starsave/pensave/degaj zincirinin eşitliği | Koddan gerçek çağrı doğrulaması | 0/2 | İncelenecek; yeni hareket çıkarsa bu satır sabit kalır |
| R27 | Gerçek kayıttan otomatik yıldız tekrarı, saati bekletme/aynı canlı ana dönüş ve belleği koruma | Bağımsız; mevcut manuel kaydedici | 0/2 | Bekliyor |
| R28 | Kariyer arşivi İzle gerçekliği/mevcut kaydın uygunluğu; yeni kalıcı tekrar sistemi kurmadan sınırı raporlama | Bağımsız | 0/2 | İncelenecek |
| R29 | Teslim: eşlenmiş denge ölçümü, kayıt göçü gerekiyorsa test, lint/hızlı/tam/build/smoke, WebGL/video ve dar devam promptları | Başarılı ürün maddeleri | 0/2 | Bekliyor |

## Altyapı sayacı

Git erişimi 1/2 başarılı; eski dizin değişmeden ayrı worktree. Node 22 edinme 1/2 başarılı. Video materyalizasyonu 1/2 başarılı. Tarayıcı için önce önceki görevde çalışan mevcut Chromium kullanılacak; bozuk ZIP döngüsü tekrarlanmayacak. Her yeni aynı engel burada en çok iki girişimle izlenecek.

## Tarihsel karşı örnekler

R1: dokunuşu bekletip taşıma niyetini kaybetmek ve niyeti erken başlatıp uzak top kovalamayı bozmak önceki başarısızlıklardır. `turn-release.cjs` ve seed 9 trace/checkpoint korunur. Özgün kullanıcı videosunun kariyer checkpoint/seed'i yoktur; seed 9 videonun kesin kök nedeni sayılmaz.

R2: çizgi dışı yaklaşma ve ikinci denemede restartKind/eski referans olay-kondisyon uyumu önceki başarısızlıklardır. `cross-delivery-attempt2.patch` uygulanacak hazır çözüm değildir.

## R1 — birinci yaklaşım

Kırmızı: sekiz yön/süre temas testi ve koruma maliyetini kısa sonuçsuz sürmeyle sıfırlama testi. Kaydet/devam zaten geçti. Kesin iki kod bulgusu: dokunuş yönü seçilen taşıma hedefi yerine henüz dönmemiş heading'den çıkıyor; `shieldSinceTick` her kısa dribble kararından sonra yenileniyor. Sunumdaki `shoulder` döngüsü bu motor kararını tekrar gösteriyor; ikinci bir animasyon kararı yok. Seed 9 trace'inde pas seçenekleri güvenlik ve erişimden eleniyor/puan kaybediyor; rastgele pas eklenmedi.

Yeni yaklaşım önceki başarısız ikisinden şu nedenle farklı: taşıma niyetiyle gerçek dokunuş zamanı ayrılıyor (`carry.touchTick:null`); kaleci bu niyetle korunuyor, taşıma sırasında kontrol yarıçapı dışındaki gerçek top hedefi sahiplik etiketinden bağımsız okunuyor. Eski ikinci denemenin tam karşı örneği olan uzak topu takip testi geçti. Gerçek en az 3 m taşıma olmadan koruma destek zamanı yenilenmiyor; ilerleyen normal taşıma yeniden koruma hakkını koruyor. Yeni katsayı veya sonuç/RNG zarı yok. Tarihsel `pauseHalfPreparation:false` checkpoint'inde eski karar/dokunuş yolu korunur.

68/68 odaklı test (iki yön, 180/300/420/600 saniye, kayıt, sürme, mücadele, kaleci ayakla taşıma/uzak top takibi ve havadan kontrol). Lint tabanı büyümedi; hızlı paket ve 5/5 ayrı performans geçti. Kullanıcı videosu 34,43 sn; 57:07/58:10/59:15 karelerinde aynı bölge doğrulandı, özgün checkpoint yok. Bu nedenle video için kesin aynı kök neden veya tam çözüm iddia edilmez. Mevcut tarihsel yeniden üretmeler değiştirilmedi.

## R2 — birinci fizik yaklaşımı

Kırmızı: yüksek beceride iki yönde gerçek servis, geniş endirekt frikik ve açık oyun ortası (5/9 kırmızı). Düşük beceride kısa seçenek, tarihsel uçuş ve kaçan pas önceden de geçti. Eski patch uygulanmadı; planlama/yerleşim ve ortak pas fiziği ayrı modüllerde kuruldu. Korner noktası yay içinde 0,5 m içeride; yaklaşma hedefi saha içinde. Pas olayının restartKind/temporaryRestart bilgisi asıl eventIndex'te tutuluyor, sonraki cross olayına yanlış yazılmıyor. Tarihsel pauseHalfPreparation:false uçuşlarında orta sınıflandırması/yeni düşey hız uygulanmıyor.

İlk fizik doğrulaması 38/38 geçti. Lintte restart planı ve hazırlığının karmaşıklığı görüldü; davranış değiştirmeyen sorumluluk ayrımı yapıldı. Göçün kırmızı testi sonrasında şema 8 eklendi; 40/40 odaklı ve hızlı/perf geçti. İkinci lintte eski golden metadata yardımcısına eklenen koşulun karmaşıklığı görüldü; iki eşdeğer şema koşulu tek üyelik koşulunda birleştirildi. Bunlar aynı fizik yaklaşımının mekanik lint temizliğidir; ikinci futbol yaklaşımı uygulanmadı, başarısız fizik testi gizlenmedi. Eşik/baseline/golden içeriği değişmedi.

Şema 8 yalnız isteğe bağlı servis uçuşunu korur; ham/sıkıştırılmış eski aktif pas aynı top/olay/RNG ile devam eder. Alıcı değişiklikte ayrılmışsa servis planı yeni kadrodan yeniden kurulur.

## R2 — ikinci fizik yaklaşımı ve R3–R6

Ortak hava temasları sonrası 900 fizik saniyelik otomatik pas kabulü 30 sn kapısında kaldı. Eşik değiştirilmedi. Seed 901'in gerçek duruşu incelendi: kafa/vole kilidi değil, korner/servis yerleşiminin alıcı dışındaki koşucuları kadro sırasından seçmesiydi; yakın hücumcular varken uzak iki stoper 40 m koşuyordu. Gerçek frikik 250,6'da başladı, gereksiz yol nedeniyle 261,0'da çıktı; testteki son pasa göre 32 sn oldu. İkinci yaklaşım koşucuları gerçek hedefe yakınlıktan seçer; hız/ivme veya saat kotası eklenmez. Önce uzak stoperleri seçen kırmızı karşı örnek, sonra 32/32 ilgili kabul (900 sn otomatik akış dahil) geçti.

R3–R6: gerçek yüksekliğe göre kafa/vole, dar yatay temas zarfı, şutun başlangıç yüksekliği, uygun güvenli kafa pası ve tehlikeden uzaklaştırma. İlk izole fizik kabulü geçti; eski header bir recorded motion olduğu için testin act-only varsayımı düzeltildi, gerçek eski motion da doğrulanır. Son 59/59 ortak kontrol; kesirli temas noktasından geçen top örneklemesi ve JSON kayıt/devam dahil. Hava hareketi kaleci sonucunu yazmaz.

## R7 — iki başarısız yaklaşım

1. Geriye dönük, yüksek teknikli ve boş alandaki gerçek gelen top için fiziksel overhead seçimi/şut: izole uçuş geçti ancak yalnız action pose tam eski havalanma/iniş zincirini vermiyordu.
2. Eski overBackwards salt okuma gövde eğrisi + gerçek temas noktasına ayak IK: kök/çekirdek/RNG korunuyordu ama krampon temas boşluğu **0,933840868 m** (kabul <0,30 m) çıktı. Eşik gevşetilmedi, kök/top kaydırılmadı. Yalnız röveşata seçimi, gövde/ayak sunumu ve ayarları geri alındı; kafa/pas/uzaklaştırma/vole korundu. `tests/reproductions/remaining-bicycle.cjs`, ölçüm JSON'u ve ikinci yaklaşım patch'i saklandı. Yeni yaklaşım gereği: motorun erişim zarfıyla rig'in kalça/ayak geometrisini birlikte çözmek. Diğer bağımsız özel pas ve kaleci envanteri engellenmez.

## R8/R10/R11/R12/R13/R15 — isimli yer hareketleri

Eski director DUEL_MOVES/dragBack ve feints/turns gerçek çağrıları doğrulandı. Altı hareket farklı gerçek temas dizileridir: makasta topa değmeyen ayak dairesi ve çıkış; elasticoda aynı ayağın dış/iç iki teması; Cruyff ve drag-back'te gerçek geriye çekiş; croquetada iki ayrı ayak; roulettede çoklu taban teması ve fiziksel tam tur. Eski saf ayak eğrileri kullanılır, beat jeneratörleri/drive/move/stepBall çalışmaz. Kök/top çizimde kaydırılmaz.

İlk 49 fizik kabulü geçti. Çizim incelemesindeki tek-dışa-aktarım yükleyici çakışması ortak movesFor tanımının tek modülde kalmasıyla temizlendi; eski motor aynı saf kuralı import eder. İleri kabulde croqueta her iki vuruşu aynı ayağa yakın gösterdi; roulette toplam dönüşü 5,584874765 rad oldu (istenen >5,7). R12 ikinci yaklaşımı gerçek geçişte destek ayağını topun dışına basar ve eski ayak eğrisinin temas fazını günceller. R13 ikinci yaklaşımı tam dönüş zamanını toparlanmadan ayırır; 2,0 saniyede tur, 2,2 saniyede normal oyuna dönüş. Eşikler gevşetilmedi. 44/44 fizik/rig/mücadele kabulü; son hızlı paket 551 başarılı, 1 mevcut atlama, ayrı 5/5 performans. Lint yeni ihlal yok.

Savunmacı gerçek ayak/gövde sinyalini konumlanma/tepki becerisine göre hatalı okuyabilir; yalnız hedefi değişir, mevcut hız/ivme ve temas düelloyu çözer. Hareket sırasında rakip kazanabilir; skill başarı zarı/sonuç yazmaz. Beceri, hız, gerçek yakın savunmacı, hücum alanı ve boşluk kısıtlarıyla otomatik seçim; seyrekliğe 12 fizik saniyelik sunulan hareket aralığı. Kayıtta carry.skill isteğe bağlıdır, şema 9 ve ham/sıkıştırılmış göç testi vardır.
