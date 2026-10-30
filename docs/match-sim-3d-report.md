# Yeni motor — kariyerde gerçek konumlu 3D

Başlangıç: main `75eb294`, V7.17.0; dal `feat/match-sim-3d`. Hedef sürüm V7.18.0. Bu rapor fiziksel iPhone/Safari onayı değildir.

## Bağlantı

Tek motor sürücüsü `liveFrameStep` → `advanceExperimentalSimulation` olarak kalır. 3D'nin kendi motor adımı veya RAF simülasyon döngüsü yoktur. Mevcut `createRuntime` yalnız model kurmak ve pozlamak için kullanılır; `move`, `stepBall`, `contacts`, `place`, `kickWarp`, `planDive`, topu ele alma ve sonuç üretme yolları çağrılmaz. Eski `createDirector` deneysel maça bağlanmaz. Eski motor açıkken mevcut 3D yolu korunur.

`captureSimulationFrame` bağımsız çizim kopyasına hız, heading, takım yönü, yuva, rol, hareket, müdahale, kaleci ve yakın gerçek temas bilgisi ekler. Top yüksekliği, sahibi, elde tutan kaleci, şut ve hız çekirdektendir. Renderer yalnız bu kopyayı okur. Test gerçek rig ile dondurulmuş örnekleri çizer; yerel hareket/top/temas çözücülerine girilirse hata verir ve her çizimden sonra checkpoint/RNG eşitliğini denetler.

| Çekirdek | Sahne |
|---|---|
| Oyuncu metre konumu `(x,y)` | Kök `(x,0,y)` |
| Top konumu `(x,y)` ve zemin üstü yükseklik `h` | Top merkezi `(x,h+0,11,y)` |
| Fizik heading | Rig heading `π/2-heading` |
| `team.direction`, devre | Yeniden aynalama yapılmaz; çekirdekteki konum/yön kullanılır |
| `physicsTime` | Hareket, ayak çevrimi, temas ve kaleci pozu |
| `matchTime` | Ekran saati ve skor etiketi |

`scene-frame.js` yalnız gözlenmiş iki fizik karesi arasında çizim örneği üretir. Fizik ilerlemeyen RAF karesi önceki fizik karesini silmez. Duraklamada güncel kare gösterilir; devam ederken çizim saati geri gitmez. Oyuncu kökleri gerçek konuma, ayak çevrimi gerçek mesafe ve fizik zamanına uyar. Kırmızı kart, sakatlık ve değişiklikte model listesi gerçek aktif kadroyu izler. Radar aynı çizim örneğini kullanır.

Kamera mevcut yan tribün/yayın kamerasıdır. Dikey telefonda aşırı geniş açı yerine yayın kamerasının yüksekliği en-boy oranına uyar. Gerçek hücum yaklaşımında top, hedef kalenin iki direği/üst çizgisi ve kaleci için görüş zarfı kurulur. Yeni bir sinematik, yıldız tekrarı veya olaydan sonradan pozisyon üretimi yoktur. Yakın gerçek gol olayı temel GOOOL bildirimi verir; skor mevcut kariyer kancasındandır. Kariyer özet/arşiv akışı korunur.

## Kontroller ve kayıt

Ayarlar'daki 3/5/7/10 dakika ortaktır; maç öncesi ikinci süre sorusu yoktur. Yeni doğal maçlarda 1× sabit fizik temposudur; 0,5×/1×/2× mevcut motor sürücüsünü değiştirir. Eski cihazın bağımsız oyuncu/top hızları, şut ağır çekimi ve tekrar ayarları okunmaz. Önceki referans saatli yarım maçların mevcut ortak zaman modeli korunur.

2D/3D seçimi aynı aktif maç nesnesinin `fieldView` değerini değiştirir. Seed/RNG, kadro, skor ve saat yeniden kurulmaz. Duraklatma ve taktik mevcut görülen motor adımına, değişiklik ilk gerçek futbol duruşuna bağlıdır. Tam ekran, telefonun yatay/dikey yerleşimi ve mevcut müdahale kontrolleri kullanılır.

Kayıt biçimi 5 ve fizik checkpoint alanları değişmez. Eski kayıttaki çizim önbellekleri yüklenirken checkpoint'ten yeniden türetilir; cursor, kesirli birikim ve RNG korunur. WebGL/yükleme kaybında açıklamayla aynı maça 2D'de devam edilir. 3D dosyası kariyer açılmadan önce indirilemezse hata da hatırlanır; sonraki 3D seçimi açıklamalı geri dönüş yapar.

## Doğrulama

Önce dört sözleşme testi kırmızı çalıştı; uygulama sonrası geçti. Kariyer seçimi/geri dönüşü ve erken dosya indirme hatasının kırmızı sonuçları da gözlendi. Yerel Node 22.23.4: lint, 406 başarılı hızlı test/1 mevcut atlama, ayrı beş performans kapısı, 15 odaklı 3D test ve build geçti. Altın dosyalar değiştirilmedi; lint tabanı büyümedi.

Aynı tohum ve aynı fizik adımı komutlarıyla biten 2D/3D maçların bütün checkpoint'i, olayları, skoru, kadrosu ve RNG'si eşit. Geçiş ek fizik adımı üretmiyor. Gerçek rig ile aktif kadro, kaleci bekleme/gerçek tehdit, kök konumları ve iki yön/üç en-boy oranında şut kadrajı ayrıca denetleniyor. Önceki kayıt önbelleği, kaydet/devam ve duraklatma sonrası saat de testli.

Yerel bulut tarayıcı WebGL bağlamı oluşturamadı (`GL_RENDERER = Disabled`). Aynı kariyer maçının açıklamayla, saat/skor korunarak 2D'ye döndüğü doğrudan gözlendi. Gerçek WebGL kanıtı Actions Chromium'unda alınır; 390×844 santra, pas, şut, kurtarış ve gol görüntüleri; ayrıca yatay tam ekran, devre/bitiş ve WebGL bağlam kaybı senaryoları vardır. Gol görüntüsünün geometrisi yalnız test fixture'ındadır, ürün maçlarında sonuç zorlanmaz. İlk diğer görüntüler sabit bir olağan kariyer tohumunun gerçek olaylarındandır.

İlk [Actions koşusunda](https://github.com/rasimoner/ManagerStory/actions/runs/41027575112) 494 tam test/1 mevcut atlama ve beş performans kapısı, build, mevcut 12 duman, bütün laboratuvarlar ve kariyer kontrolleri geçti. Yeni 3D dumanının ilk gol kontrolü, önceki sayfanın kapanış kaydının fixture üstüne yazması nedeniyle başarısızdı; her sahne ayrı tarayıcı oturumuna taşındı ve yüklü tick eşitliği eklendi. Görüntüdeki alt boşluk için yeni host/canvas yüksekliği düzeltildi. 3D dumanı bağımsız Actions işinde ve yayın kapısında zorunludur. Son CI/duman/görsel sonuçları ve yayın bağlantıları tamamlandığında aşağıya eklenir. Bu kapsamda yeni denge taraması, 200 maç ölçümü veya ikinci tam yedi dakikalık izleme yoktur; bütün mevcut test, performans ve duman kapıları korunur.

## Açık sınırlar

- Mevcut pas/şut klipleri genel takip pozudur. Henüz her vuruş için tam anatomik ayak–top temasını garanti etmez; temas için kök veya top kaydırılmaz.
- Motor kalecinin gerçek konumunu, tepki/erişim durumunu ve kurtarış temasını verir; tam gövde plonjon/kalkış yörüngesi vermez. Mevcut uzanma pozu gösterilir; hayali kök uçuşu eklenmez. El–top hizası her kurtarışta birebir değildir.
- Kayma ve elden dağıtım mevcut kliplerle gerçek eyleme bağlanır; blok/yönlü müdahalede genel uzanma pozu vardır. Yeni özel çalım/kurtarış hareketi eklenmez.
- Çizim fizik karesinden en çok bir gözlenmiş kare aralığı geride örneklenebilir. İleri kestirim yapılmaz. Bütçe yetmezse fizik atlanmaz; gerçek izleme uzayabilir.
- Chromium emülasyonu gerçek iPhone/Safari, termal yük veya tüm cihazlarda kare hızı garantisi değildir. Kamera görüntüleri bu sürümün belirli senaryolarının kanıtıdır; her olası pozisyona dair görsel onay değildir.
