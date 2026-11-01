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
| R9 | Nutmeg | R1, gerçek savunmacı boşluğu | 1/2 | İki yön/gerçek boşluk, ayakta kesilme ve kayıt geçti |
| R10 | Elastico | R1, çoklu temas | 1/2 | Dış/iç iki dokunuş aynı gerçek ayaktan; rig geçti |
| R11 | Cruyff | R1 | 1/2 | Gerçek geri çekiş/ayak teması, iki yön geçti |
| R12 | Croqueta | R1, çoklu temas | 2/2 | İkinci yaklaşım: destek ayağı ayrılır, gerçek iki ayak teması geçti |
| R13 | Roulette | R1, çoklu temas | 2/2 | İkinci yaklaşım: tam tur hareket sınırında tamamlanır; 5,7 rad kapısı geçti |
| R14 | Flair nutmeg | R1, gerçek savunmacı boşluğu | 2/2 | Başarısız; yalnız flair seçim/veri/ayak farkı geri alındı, normal nutmeg korundu |
| R15 | Drag-back | R1 | 1/2 | Gerçek geriye serbest dokunuş ve eski dragBack pozu geçti |
| R16 | Rainbow | R1 + R2 hava teması | 2/2 | Başarısız; ürün farkı geri alındı, gerçek temas izi saklandı |
| R17 | Sombrero | R1 + R2 hava teması | 1/2 | Gerçek savunmacı üzerinden uçuş, iki yön, rig/kayıt geçti |
| R18 | Juggling | R1 + R2 hava teması | 2/2 | Başarısız; ürün farkı geri alındı, gerçek temas izi saklandı |
| R19 | Backheel | Gerçek kontrollü top/ayak hazırlığı; R1 çözümü korunur | 2/2 | İki yön, gerçek topuk teması, fiziksel hazırlık ve kayıt/devam geçti |
| R20 | Rabona | Gerçek kontrollü top/ayak hazırlığı; R1 çözümü korunur | 2/2 | Gerçek destek arkası krampon yolu, iki yön ve saha dışı alternatif geçti |
| R21 | No-look | Bağımsız pas/görünür hedef ve baş pozu | 1/2 | Gerçek alternatif oyuncuya baş bakışı ve eski nolook pozu; 21 ilgili / 555 hızlı test geçti |
| R22 | Foot trap özel ilk kontrol | Mevcut gerçek ilk kontrol; R2 ilişkisi doğrulanacak | 1/2 | Gerçek iniş/ayağı önce hazırlama, özel yumuşatma ve iki yön/rig/kayıt geçti |
| R23 | Pirouette/Bergkamp özel karşılama sekansı | R1 + gerçek gelen top | 2/2 | Başarısız; gerçek ayak geçti, karşı-yandan tam sekans geçmedi; ürün farkı geri alındı |
| R24 | Flair pass (eski gerçek stepover pas yolu) | R8 ve gerçek pas teması | 1/2 | Gerçek makas dairesi, belirsiz normal pas, iki yön/rig ve kayıt geçti |
| R25 | Scorpion | Gerçek hava/topuk erişimi, R2 ilişkisi doğrulanacak | 2/2 | Başarısız: sabit kökte gerçek topuk 0,576 m uzakta; ürün değişikliği geri alındı |
| R26 | Diğer eski özel kaleci yollarının envanteri, mevcut starsave/pensave/degaj zincirinin eşitliği | Koddan gerçek çağrı doğrulaması | 0/2 | Çağrılar doğrulandı; normal zor kurtarış/penaltı/elden vole mevcut zincirde korunur |
| R27 | Gerçek kayıttan otomatik yıldız tekrarı, saati bekletme/aynı canlı ana dönüş ve belleği koruma | Bağımsız; mevcut manuel kaydedici | 2/2 | Kariyer kare aktarımındaki yıldız/observed bilgisi korundu; WebGL bekleniyor |
| R28 | Kariyer arşivi İzle gerçekliği/mevcut kaydın uygunluğu; yeni kalıcı tekrar sistemi kurmadan sınırı raporlama | Bağımsız | 0/2 | Tarif sahneleniyor; mevcut veride gerçek kayıt yok, yeni kalıcı sistem kurulmadı |
| R29 | Teslim: eşlenmiş denge ölçümü, kayıt göçü gerekiyorsa test, lint/hızlı/tam/build/smoke, WebGL/video ve dar devam promptları | Başarılı ürün maddeleri | 1/2 | Son zorunlu kapılar ve gerçek görüntü kanıtı hazırlanıyor |

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

## R21 — bakmadan pas

Eski director pass/nolook ve ACTIONS.nolook yolu doğrulandı. Gerçek farklı/görünür bir takım arkadaşı baş hedefidir; beceri, mesafe, düşük gerçek hız ve orta baskı şartları vardır. İlk iki yeni kabul kırmızıydı. Gerçek rig'de başın dünya bakış vektörü hedef oyuncuyla >0,98 doğrultuda; top normal fiziksel pasa gider. Aynı durumda normal pasla hız/düşey hız/RNG birebir eşit; başarı önceden verilmez. 21 ilgili test, lint ve 555 başarılı hızlı / 1 mevcut atlama, 5/5 performans geçti. Kodun karmaşıklığı aynı koşullar ayrı saf yüklemlere ayrılarak düşürüldü; eşikler/baseline büyümedi.

## R19/R20 — özel paslar

Eski flair-passes backheelKick/backheelFeet ve rabonaKick/rabonaFeet çağrıları doğrulandı. R19 ilk yaklaşımında stance varış yarıçapı içindeki durağan oyuncu yüzünü çevirmediği için topuk pası çıkmadı. İkinci yaklaşım duruşta tek fiziksel dönüşü tamamlar; hız/dönüş sınırı korunur. R20 ilk yaklaşımı gerçek pas/ayak yolu ve JSON devamı geçti ama saha kenarında hazırlık hedefi dışarı taşabiliyordu. İkinci yaklaşım yasal duruş sığmıyorsa normal pasa döner; hedefi erişilemez yere zorlamaz.

24 ortak kabul: iki yön; zayıf teknikte normal alternatif; gerçek RightFoot topuk teması; rabona kramponunun destek ayağı arkasından ve öbür yana geçtiği gerçek rig yolu; hazırlığın ortasında kayıt/devam ve normal pas/RNG korumaları. Eski saf ayak eğrileri kullanılır; jeneratör ve director fiziği çağrılmaz. Şema 10, isteğe bağlı passing.technique duruş/readyAt bilgisini saklar; ham/sıkıştırılmış göç kırmızıdan yeşile döndü. Lint yeni ihlal yok; son hızlı 566 başarılı / 1 mevcut atlama, ayrı 5/5 performans.

## R16–R18 — ortak fizik ve iki durdurulan hareket

Sombrero ilk yaklaşımda gerçek tek ayak kaldırışıyla savunmacının üzerinden geçer; motor normal ivme ile gerçek iniş noktasını takip eder. Eski salt okunur scoop ayağı gerçek topa <0,30 m erişir; iki yön, kaydet/devam ve kökün değişmemesi dahil 34/34 ortak test geçti. Yeni kalıcı alan gerekmedi: mevcut carry.skill ve gerçek hava topu kullanılır.

Rainbow 1: ikinci temas genel ilk kontrolde öne taşındı, vücudun arkasından flick kabulü geçmedi. Rainbow 2: geçici kontrol offset'ini korumak denendi; yere oturduğunda followSimulationControl bunu temizliyor, 0,5 sn'deki ikinci temas gerçek gövdenin önünden çıkıyor. Juggling 1: ikinci dokunuş yerdeydi. Juggling 2: 0,8 sn'de 0,703 m'den ikinci gerçek temas oluştu, fakat 0,9 sn'de 0,962 m'de savunmacı aldı; sabit vücut üstü çıkış kabulü geçmedi. Eski juggle'ın lunge bacağı üzerinden tasarlanmış olması bu görevde test eşiğini değiştirmek için kullanılmadı.

İki başarısız hareketin seçim, veri ve özel kontrol farkları geri alındı. Sombrero ve genel fiziksel iniş tahmini korunur. air-skills.cjs, attempt2.patch ve gerçek tick/pozisyon/yükseklik/RNG trace JSON'u ayrı yeniden üretmedir; patch hazır çözüm değildir. Üçüncü ürün yaklaşımı uygulanmadı. Lint karmaşıklığı yalnız geometri/nişan sorumluluğu ayrılarak temizlendi; futbol eşikleri değişmedi.

## R27 — mevcut gerçek kayıtla otomatik yıldız tekrarı

Eski kariyer star hook/cadence yolu kullanılıyordu. Aynı 180 kare tampon yeni motorun gerçek skill, özel pas, chip/Panenka ve zor gerçek kurtarışlarını okur; observed genel dönüş etiketleri kabul edilmez. Temas sonrası 0,9 sn kayıt beklenir; otomatik tekrar aralığı 30 fizik saniyesidir. Duraklama, skip, devre, değişiklik, restart ve gol fotoğrafı korunur. Canlı RAF tekrar sırasında checkpoint'e dokunmaz; dönüşte zaman kökeni sıfırlanır, duvar zamanı telafi edilmez. Manuel düğme ve bellek sınırı korunur; yeni kalıcı alan yoktur.

12/12 kayıt/bellek/kadans/tam checkpoint/RNG ve aynı ana dönüş testi geçti. Test kurulumundaki performance mock'u ve snapshot.state.tick düzeltildi; ürün yaklaşımı değiştirilmedi. Kesinti öncesi 573 hızlı + 5 performans geçti. Lint olay sınıflaması ayrılarak giderildi.

## R28 — arşiv sınırı

Gerçek çağrı: manager/highlight-recorder.recordStarMoment → core/highlights.recipeOf (move/seed/kimlik) → manager/highlight-screens.watchHighlight → presentation/scenes/highlight-scene → director.stage. Son adım sahne tarifi üretir, gerçek maç karesi okumaz. Yeni 180 kare tampon RAM'dedir, arşive yazılmaz. Gerçek maç bağlantısı mevcut tariften çıkarılamaz. Kalıcı klip sürümü, rig/kadro kimliği, sıkıştırma, saklama/atım ve iPhone kotası gerekir; kullanıcı kapsamı gereği kurulmadı. Eski gösteri gerçek maç tekrarı olarak bağlanmadı.

## Ortam kesintisinden dönüş

Çalışma ortamı 2 başarısız erişim sonrası durmuştu; yeniden sağlandığında b3c3be5 ve ürün dosyaları korundu, son otomatik tekrar commit nesnesi yoktu. Aynı başarılı kod yeniden uygulanmadı, korunan fark doğrulanıp tekrar commit'e alınır. Deneme sayaçları ve iki başarısızlıkta durdurulan hareketler sıfırlanmaz. Node 22.23.4 tekrar edinildi; Node 24 ile ürün kabulü çalıştırılmadı.

## R24 — gerçek makasla pas

Eski director.flairPassTry → stepoverBeat → stepoverPass yolu doğrulandı. İlk kırmızı iki yön testi normal pasın özel daireyi yapmadığını gösterdi. Yeni hazırlık, görüş/teknik/dribbling yeteneği, yakın gerçek baskı, ileri hedef ve mesafeye bağlıdır. Eski saf stepoverFeet eğrisi gerçek kramponu top çevresinde kaldırır; sonrasında normal pas yeniden değerlendirilir ve aynı pas hata fiziği kullanılır. Savunmacı hazırlıkta topu alabilir, zorunlu sendeleme/başarı yoktur. Mevcut passing.technique isteğe bağlı durumuyla JSON devamı eşittir.

14/14 ortak test ve gerçek rig: iki yön, kaldırış/yan geçiş, kök/checkpoint değişmezliği, kesilebilme, kayıt/devam. Lint iki mekanik sorumluluk ayrımıyla temizlendi, eşikler/baseline değişmedi. Yeniden açılan Node 22 ortamında 576 hızlı + 5 performans geçti. İlk yeniden açılış hızlı süreci özet üretmeden sonlandı; başarı sayılmadı. İkinci girişim tam test/pass/fail ve süreç bitişiyle doğrulandı; aynı altyapı üçüncü kez denenmedi.

## R22 — özel ayakla öldürme

İlk üç kırmızı kabul özel temas/ayak hazırlığı olmadığını, alıcının topu daha yukarıda genel kontrol ettiğini gösterdi. İlk yaklaşım: teknik ve ilk kontrol, gerçek düşük hız, iniş noktası/erişim, aşağı hareket ve incik yüksekliğine göre ayakla karşılama niyeti. Ortaların kafa/vole seçimi ve şut/kaleci yolları korunur. Genel foot kontrolü yeniden adlandırılmaz: özel trap gerçek yakın temas ve daha düşük düşey hızla yumuşatma gerektirir, ilk kontrol hatası hâlâ mümkündür. Eski saf trapBoot eğrisi temas öncesinde ayağı hazırlar; yeni ikinci fizik çalışmaz.

25/25 ortak hava/ilk kontrol/sombrero testi ve ilave canlı alıcı testi (5/5 trap) geçti. İki yön ve gerçek krampon <0,30 m; kök/checkpoint/RNG çizimden etkilenmez; kaydet/devam eşittir. Yeni kalıcı alan yoktur; trapIntent karede çekirdekten türetilir, ilkTouch.style olayının isteğe bağlı detayında kalır. Lint yeni ihlal yoktur.

R27 ikinci yaklaşım: gerçek captureSimulationFrame yolu için ek kırmızı test, sunum olay kopyasının observed/reachDifficulty/lastMoment alanlarını düşürdüğünü gösterdi. İzole kaydedici filtresi doğruydu; kariyere aktarım eksikti. Kopya bu gerçek kanıtı korur: genel observed etiket yıldız olmaz, zor gerçek kurtarış otomatik seçilebilir. Yeni tekrar tamponu veya motor durum değişikliği yoktur. Bu satır 2/2'dir; ileri kabul başarısızsa yalnız otomatik bağlantı geri alınacak, manuel gerçek tekrar korunacaktır.

R9/R14 ilk yaklaşım: mevcut 1,2 m kontrol çemberinin yerine yalnız gerçek jokey boşluğu anında iki fiziksel ayak diski ve aynı ayak hedeflerini kullanan rig. Savunmacı hızlanır veya müdahaleye başlarsa normal top kazanma yolu geri gelir; hareket adından ötürü bağışıklık yoktur. R9 iki yönde geçti. R14 birinci trace'inde uzun hazırlıktan sonra savunmacı 1,3 sn'de hızlanıp topu aldı; sonraki topun sahipli yürüyüşü bacak arası sayılmadı. İkinci yaklaşım 0,7 sn'de, mevcut açısal dönüş sınırında ve fiziksel 6,5 m/sn topuk hızında temas eder; savunmacı hedefi/hızı/ivmesi değiştirilmez. İlk trace ayrı korunur.

R14 ikinci yaklaşımda gerçek ayak boşluğu geçildi fakat geri dönük gerçek topuk teması kabulü geçmedi. Eşik gevşetilmedi, üçüncü zamanlama/IK düzeltmesi yapılmadı. İkinci temas ölçümü JSON'u ve patch'i saklandı; patch hazır çözüm değildir. Yalnız flairnutmeg veri/seçim/ayak dalı geri alındı. Ortak ayak geometrisi ve geçen normal nutmeg bağımsızdır; diğer özel ilk kontrolü ve kaleciyi engellemez.

R14 ölçülen ikinci başarısızlık: tam geri dönüş (cos = -1) tamamlandı ama gerçek RightFoot-top boşluğu **0,533681087 m**, kabul <0,30 m. Fiziksel boşluk geçişi tek başına topuk hareketi kabul edilmedi. R9 korunan normal hareket için 36 ortak ve 4 ilave kabul geçti: merkez boşluk gerçek geçiş; ayak çizgisine gelen top savunmacıya çarpar; kayıt/devam tüm sonucu/RNG'yi korur. Yeni kayıt alanı açılmadı: geçiş, mevcut phase ve o gerçek serbest-top adımının önce/sonra segmentinden okunur. Kalıcı previousGap/crossed prototip alanları kaldırıldı; aynı temas yaklaşımı korunur.

R23 birinci yaklaşım: gerçek özel ilk temas oldu ama savunmacı gövdenin önünde jokey kalınca karşı-yandan geçiş oluşmadı. Trace saklandı. İlk çizim testi sabit sol ayağı ölçüyordu; seçilen gerçek ayna tarafı ölçülür (aynı <0,30 m sınırı). İkinci yaklaşım: ekseni henüz değişebilen gövde heading'i yerine gerçek gelen pas doğrultusundan alır; 0,35 m yakın teması bekler; savunmacı gerçek topun kendi tepki süresindeki tahminine normal hareket eder. Hız/ivme ve müdahale kazanımı korunur; sendeleme/başarı zorlanmaz.

R23 ikinci sonuç: gerçek seçilen krampon teması, kesirli top sürekliliği ve JSON devamı geçti; iki yönde karşı-yandan tam sekans yine oluşmadı. Genel dönüşe pirouette adı verilmedi. İkinci trace/patch ve bağımsız fixture saklandı; tüm R23 seçim, yönlendirme ve sunum ürün farkları geri alındı. R1, R9 gerçek ayak boşluğu ve R22 özel trap korunur; diğer işler engellenmez. Üçüncü yön/tempo/AI yaklaşımı yapılmadı.

R25 birinci rig yaklaşımında eski ileri gövde/katlanan diz eğrisi topa erişti ama legacy model kökü **0,943077341 m** kaydı. Bu, motor köküyle uyum kabulünü geçmez. İkinci yaklaşım kalecinin gerçek düzleminde kökü sabit tutup topu yerinden oynatmadan topuk hedefi/ters diz kutbuyla mevcut IK erişimini ölçer. R7'den bağımsızdır: burada gövde ileri yatar ve dizler arkaya katlanır; erişim aynı varsayılmadı. Yeni kurtarış sonucu veya eski fizik sürücüsü eklenmedi.

R25 ikinci rig ölçümü iki kale yönünde **0,576207097 / 0,576207025 m**, kabul <0,30 m. Kök 48 m'de sabitken topuk gerçek 1,53 m topa erişmedi. Eşik/top/kök oynatılmadı; üçüncü kemik-yerel kalça çözümü denenmedi. Kaleci outcome koduna scorpion etiketi veya zorunlu kurtarış eklenmeden duruldu. Yalnız deneme için açılan saf yardımcı export'u ve test bundler farkı geri alındı; iki rig yeniden üretmesi/patch/ölçüm saklandı. Bunlar kariyer özelliği sayılmaz.

## R26 — gerçek eski kaleci envanteri

moves.json keeperSaves: scorpion, pensave, starsave. director.shot gerçek scorpion/pensave/starReach dallarına sahiptir; gkvolley keeperDistribution/degaj yoludur, ayrı yeni gizli kurtarış yoktur. Yeni motorun penaltıda gerçek tepki/çizgi davranışı; normal kurtarış/tutma/parry/tip/iniş/kalkış ve throw/punt dağıtımı mevcut test ve karelerden doğrulanır. Scorpion R25'te ayrı durur; R7 veya R23 başarısızlığı normal kaleci zincirini engellemez. Yeni sonuç zarı/ikinci fizik eklenmedi.

Normal kaleci koruması: 40/40 gerçek rig, kurtarış, ayakla takip, sınır ve kalkış/şut testi geçti. Son ürün değişikliği normal nutmeg'dir; sonrasında yalnız başarısız adaylar geri alındı. Teslim sürümü için main'in gerçek 7.19.2'sinden **7.19.3 PR adayı** hazırlanır; önceki dizinin commit edilmemiş 7.20.0 yayın hazırlıkları bu işe alınmaz ve değiştirilmez. Bu sürüm yayımlandı anlamına gelmez.

## R29 — teslim kurtarma ve kalıcı doğrulama

Ortam tekrar erişilebilir olduğunda yerel dizin yine b3c3be5 anlık görüntüsündeydi. GitHub'da korunan c6341386 kaynaklarından ayrı, detached bir teslim worktree'si açıldı; eski yerel farklar ve ana dizindeki 7.20.0 hazırlıkları değiştirilmedi. Başarılı özellikler yeniden uygulanmadı. Önceki ortamda Node 22 tam paket 676 başarılı / 1 mevcut atlama + 5 performans, hızlı 586 başarılı / aynı atlama + 5 performans geçti; build ve otomatik tekrar/normal kariyerin iki kadraj WebGL kontrolleri geçti. Ham yerel dosyalar anlık görüntü dönüşünde kaybolduğundan bu sonuçlar tarihsel gözlemdir; yeni GitHub doğrulaması kendi kalıcı log/artifact çıktısıyla teslimi doğrular.

Uzak verify için push tetikleme düşünülmüştü; aynı performans engelinde üçüncü girişim olacağı için eklenmedi. PR, zorunlu kontroller geçmeden açılmaz; Pages workflow'u çalıştırılmaz. Kod kontrolleri atlanmaz, var olan branch istisnalarına bu dal eklenmez. Sürüm main'in gerçek 7.19.2'sinden 7.19.3 PR adayı olarak hazırlanır; yayımlanmış 7.20.0 varsayımı yoktur.

Son Node 22 oturumunda aynı performans kapısı iki kez geçmedi. İlk shooting/keeper üçlüsü 2039,1 / 1642,4 / 1537,5 ms; ikinci 2462,5 / 1765,7 / 1646,1 ms. İkinci workload üçlüsü 2237,4 / 2169,2 / 1710,3 ms. Her koşu <2000 ms olmalıdır; medyanın geçmesi başarı sayılmadı. Her iki hızlı işte 586 fonksiyonel test geçti / 1 mevcut atlama. İlk ayrı performans 4/5, ikinci 3/5. Eşik, warm-up, lint baseline veya test filtresi değiştirilmedi; üçüncü performans koşusu yapılmaz. Yeni performans ürün optimizasyonu denenmedi; bu nedenle host etkisi mi ürün yükü mü kesinleştirilmiş değildir. Denge/görsel kanıtlar bağımsız sürer. Zorunlu kapı kırmızı olduğundan PR yoktur.

20 eşlenmiş doğal-saat tohum ölçümü tamamlandı: şut 6,80→8,80; gol 0,55→1,05; pas 72,45→71,25; tamamlanan pas 52,70→49,70; faul 1,95→1,85; kurtarış 2,35→3,35; top kaybı (restart dahil sahip takım değişimi) 29,50→31,20. Denge aynı denmedi; dağılım ve seed bazlı farklar comparison.json'dadır. No-look görsel fixture'ının ilk yüksek dribbling oyuncusunda makasla pas öncelik kazanıyordu; ürün kodu değişmeden dribbling 50 / vision-technique 95 uygun oyuncu seçildi. İkinci fixture gerçek nolook pasını üretti; etiket uydurulmadı. Diğer 23 fixture gerçek beklenen olayları doğruladı.
