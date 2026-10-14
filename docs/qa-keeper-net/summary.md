# Kaleci ve yerel gol filesi — 2026-10-07

Başlangıç `35f23971a0045222db8c7d242e18bbac60740145`.
Madde7 kullanıcı görsel onayıyla kapalıdır. Bekleyen hız değişikliği uygulanmadı.

| Başlık | Ürün değişikliği | CPU kanıt / sınır |
| --- | --- | --- |
| Kaleci kıyafeti | Açık keeper kit/renkleri önce; veri yokken iki saha formasına karşı deterministik kontrast. Ayrı açık eldiven/palma ve bilek. | Gerçek kimlik/mevcut numara etiketi ve onaylanan mesh/iskelet oranı korunur. Motorda özel keeper renk ve forma numarası telemetrisi yoktur. |
| Kurtarış | Hazır çömelme, mesafe güdümlü uzanma, destek adımı, gövde eğimi, kontrol/bırakma ve ortak saniyeden ayağa toparlanma. | Yakalama49→51/99→101, çelme31→33/106→108. Eller CATCH alçaltma yolunu izler; PARRY'de bırakır. Gerçek kök/ball/clock değişmedi. Destek adımı yalnız türetilmiş 3D gövde yerleşimidir. |
| Eller/dirsek | Yerel +Z ileri/world hedef dönüşümü, yana/aşağı/ileri dirsek pole'u; sabit iki .285m kemik. | İki kale yönünde temas elleri omuzun önünde, gap6.5cm. CATCH son faz6.5–7.6cm; PARRY geç faz yaklaşık1.2m ayrılır. Kaleci pas53 gerçek ayak teması ayrıca test edilir. |
| File | Gerçek golde top yarıçapı arka fileye ulaştığında, yalnız yakın ağ parçalarında sönümlenen esneme. | Gerçek seed8800 gol115. Ön temas yok, 1.2s sonunda hareket sıfır; karşı ağ/direkler sabit. Geometri tabanlı, offline, mevcut ortak saat. |

Gerçek örnekler seed8800'den, CPU onaylanan rig/world koordinatlarıdır.
Kurtarış49→51 ve31→33 sol kale;99→101 sağ kale. Video seed eşlemesi iddia edilmez.
Mevcut motor physical contact height/dive/landing telemetrisi sağlamaz. Ortak
sunum save temas yüksekliğini1.05m türetir; düşük/yüksek gerçek kurtarış türleri
doğrulanmış sayılmaz. Bu örneklemde DEFLECT_CORNER yoktur. Model kol uzunluğu
hedef uzak diye artırılmaz; IK'nin ulaşamadığı hedeflerde el–top gap'i açık ölçülür.

Ortak saat/MatchEngine/pitch/adapter/hız/UI/kamera hesapları byte-byte korunur.
Saha oyuncusu bend davranışı aynı kalır; yeni pole yalnız keeperMotion içindir.
SW cache ve offline list yeni yerel modüller için güncellenmiştir; sürüm artmaz.

Tam test sonucu `tests.log`, gerçek54 faz ölçümü `measurements.json`, tarayıcı
engeli `webgl.log`. İki tam maç normal süreleri395.44/412.64s, aynı motor/RNG/
istatistik/kariyer, boş son zincir ve tek sonuç uygulaması testlerdedir.

Chromium executable hâlâ yok; kurulum/indirme yapılmadı. Gerçek WebGL
390×844/320×568, yakın yan açı siluet/iniş, iPhone akıcılığı veya MP4 üretilemedi.
CPU temas/anatomi file ölçümleri görsel onay değildir. Mevcut ayrı iPhone
önizlemesi bu ürün dosyalarıyla güncellenir; yeni kaleci/file görsel onayı bekler.
Main, canlıV7.4.2 ve tek oyunculu Site değiştirilmez.
