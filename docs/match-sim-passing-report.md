# Faz 4 — hız, top fiziği ve pas raporu

Tarih: **28 Ekim 2026**. Başlangıç: `main c80e847`. Dal: `feat/match-sim-passing`. Node **22.23.4**, Linux/x86_64, tohum **901**, 22 oyuncu, 90 dakika = **54.000 adet 0,1 sn adım**. Sürüm **7.14.0**. Kariyer, eski motor, 3D ve altın kayıtlar değiştirilmedi.

## Hız: aynı ölçüm türünü karşılaştırmak

Önceki 16,51 sn, test erişim noktasının `vm.SourceTextModule` bağlamında ölçülmüştü. Bu ortamda global matematik/nesne erişiminin ek maliyeti büyüktür. Onu doğrudan telefonun çalıştırdığı yerel paketle karşılaştırıp 25 kat hızlandığını söylemek doğru olmaz.

| Ölçüm | Önce | Sonra | Açıklama |
|---|---:|---:|---|
| Önceki teslimin test VM ölçümü | 16,51 sn | — | Eski rapordaki paralel test yükü |
| Aynı ortamda yeniden koşulan test VM | 11,63 sn | 1,15 sn | 54.000 adımın tüm koordinatlarını özetleme dahil; önceki profil koşusu 10,40 sn |
| Yerel paket, topsuz | 1,03 sn | **0,67 sn** | Üç koşu medyanı; hedef <1 sn |
| Yerel paket, top/pas | İlk taslak 5,43 sn | **1,29 sn** | Üç koşu medyanı; hedef <1,5 sn |

Son üç bağımsız yerel koşu: topsuz **0,602 / 0,713 / 0,673 sn**; paslı **1,484 / 1,291 / 1,249 sn**. Süreler makine yükü ve JIT ısınmasına bağlıdır; başka hızlı test sonrası tek paslı koşu 1,26 sn, yüklü bir koşu 1,61 sn verdi. Telefon donanımı burada ölçülmedi. Laboratuvardaki `90 dakikayı tamamla` düğmesi telefonda gerçek süreyi gösterecek.

Tekrar üretim: Node 22 ile `node --experimental-vm-modules tools/match-sim-report.cjs`. Vite derlemesi, ilk kadro kurulumu, çizim ve durum kopyası zamanlayıcının dışındadır; ölçülen maçın her fizik adımı içeridedir. Paket testte API'nin adından bulunup Vite ile yerel ES modülüne çevrilir; motorun farklı veya hızlandırılmış bir test uygulaması yoktur.

### İlk CPU profilinde süre nereye gidiyordu?

| Bölüm | Kapsadığı örneklenmiş süre | Pay |
|---|---:|---:|
| Oyuncu hareketinin entegrasyonu | 7,72 sn | %73,3 |
| Topsuz karar/rol planlaması | 1,63 sn | %15,5 |
| Çöp toplama | 0,27 sn | %2,5 |
| Konum doğrulamasının kendi süresi | 0,06 sn | %0,6 |
| `readSimulation` / `structuredClone` | 0 | Başsız döngü bunları çağırmıyordu |

Hareket içindeki en büyük kendi süreleri: sınır freni 1,87 sn, kırpma 1,76 sn, istenen hız 1,49 sn, mesafe 1,22 sn, dönüş 1,03 sn. İç içe süreler üstteki toplamla tekrar toplanmaz.

Ölçüme göre yapılanlar: sık kullanılan matematik/nesne işlevlerini modülde bir kez bağlamak; en yakın oyuncuyu liste kopyalama/sıralama yerine tek taramayla bulmak; kadro dizinini ve rol planı Map'ini yeniden kullanmak; aynı kararda takım şeklini tekrar hesaplamamak; duranın gereksiz entegrasyonunu atlamak; çizgiden azami hızda bile yeterince uzak olan oyuncuya matematiksel olarak eşdeğer serbest ivme hesabı uygulamak. Sınırdaki eski vektör freni aynıdır. Sonraki pas profilinde asıl maliyet varış hesabıydı: ulaşamayacak rakipleri ucuz azami hız zarfıyla elemek, ilk tehlikede riskli seçeneğin taramasını bitirmek, yer/hava seçeneğinin ortak alıcı/boşluk hesabını paylaşmak ve yalnız seçilen pası tazelemek bu maliyeti düşürdü.

Koordinat koruması: `tests/match-sim-performance.test.cjs`, eski main'in **54.000 × 22 × 2** adet double koordinatını aynı sırayla SHA-256 özetler. Beklenen değer `9b1126b840f9ad5ec641b19abbdc01fd4f66afd11acba238e6207aee31d16754`; değişmedi. Adım sayısı, fizik veya karar sıklığı hız için azaltılmadı.

CI ölçümü diğer ağır testler bittikten sonra seri çalışır: topsuz **3 sn**, paslı **4,5 sn** bütçe. Bunlar ürün hedeflerinin üç katıdır; gerçek süre tanı çıktısına yazılır. VM konum özeti ise zaman aşımına bağlanmaz.

## 90 dakikalık otomatik oyunun sonucu

| Ölçü | Değer |
|---|---:|
| Pas / kontrollü tamamlama | **1.358 / 758** |
| Pas isabeti | **%55,82** |
| Gerçek ortalama pas mesafesi | **25,84 m** |
| Dakika başına iki takım toplam pas | **15,09** |
| Kontrollü pas kesme ile top kazanma | **186** (Sarı 90, Mavi 96) |
| Oyuncunun ortalama top tutması | **1,16 sn** |
| Takımın kesintisiz ortalama sahiplik süresi | **8,74 sn** |
| Sahiplik | Sarı **%49,08**, Mavi **%50,92** |

600 başarısız pasın 272'si temas olmadan dışarı çıktı, 224'üne rakip dokundu, 104'ünde takım arkadaşı ilk dokunuşu kontrol edemedi. 224 rakip temasının 186'sı kontrollü kazançtır; diğerleri sekmedir. Bu ayrım, isabetin gizli başarı zarından gelmediğini ve nerede denge çalışması gerektiğini gösterir.

Futbol dengesi açısından bu sonuç **henüz yeterli değil**: toplam pas, verilen 800–1.000 referansının üzerinde; isabet %75–88'in altında, paslar da uzun. Sürme/şut olmayınca ilerlemenin ve baskıdan çıkmanın tek yolu pas; alıcı kaçırırsa top fizik gereği ilerleyip dışarı çıkabiliyor. Yeni motorun konum/temas kuralları tutarlı, iki takımın sahipliği dengeli; bundan gerçek maç temposunun dengelendiği sonucu çıkarılmamalı. Sonraki işlerde pas uzunluğu/ilk kontrol/alan desteği sürme ve şutla birlikte ayarlanmalı; başarı zarıyla oran düzeltilmemeli.

## Telefonda bakılacak dört şey

1. **0,25× ve pas seçenekleri:** yeşil/kırmızı çizgiler, kalın seçili pas ve hedefte alıcı/rakip saniyeleri. Aynı renkte başka oyuncuya dokun; çizgideki rakibin gerçekten koşarak kesmesini izle.
2. **Elle havadan pas:** aynı engelli çizgiyi lobla dene. Yüksek orta bölümden alınamaması, çıkış/inişte kesilebilmesi ve ilk dokunuş sekmeleri görünmeli.
3. **Otomatik ve 90 dakika:** iki takımın kazanıp kaybettiğini izle; sonra hızlı tamamlayıp telefonundaki süreyi, pas/isabet/mesafe/kesme ve sahipliği kontrol et.
4. **Hakem müdahalesi ve dışarı:** boş sahaya dokunarak topu koy; takım düğmesini değiştir. Dışarıda rakibin çizgiye koşması gerekir; oyuncu sıçramamalı.

## Açık kalan sorular

- 1,8 m erişim zarfı sıçrama, kafa mücadelesi ve oyuncu boyuna nasıl ayrılacak? Spin/çim/hava direnci gerekli mi?
- Sürme/müdahale gelince 2,4 m baskı hedefi gerçek temas, gövde çarpışması ve faul zamanlamasına nasıl dönüşecek?
- **Geçici** çizgiden rakip başlatma 6. işte gerçek taç/kale vuruşu/korner ve yerleşim kurallarıyla değişecek.
- Şut/kaleci, ofsayt, eski günlük biçimine çeviri ve 3D bağlantısı ayrı işler; pas dengesi bunlarla birlikte tekrar ölçülecek. Telefonun gerçek hız ölçümü ayrıca kullanıcı denemesinden gelecek.

Kuralların tüm formülleri ve gerekçeleri [şartnamede](match-sim.md); dosya sorumlulukları [kod haritasında](code-layout.md). Yeni testler sentetik kesme/yükseklik/temas sırası, ilk dokunuş, deterministik konum/olay, hız/ivme/dönüş, sahiplik erişimi, oyun akışının tıkanmaması ve telefon kontrollerini kapsar. Mevcut test dosyaları, altınlar ve eski 12 duman kontrolü değiştirilmedi; yeni telefon pas kontrolü bunların arkasına eklendi.

## Doğrulama

Node 22.23.4 ile `npm run lint`, `npm run test:fast`, `npm test`, `npm run build`, `npm run smoke`. Tam Node paketinde **353 test geçti**, mevcut **1 gerçek telefon kayıt fikstürü** bulunmadığı için eskiden olduğu gibi atlandı; başarısız test yok. Hız testleri bu toplamda ayrıca seri çalışan üç kontroldür. Lint tabanı büyümedi; yeni dosyalarda sıfır ihlal. Eski motor, 3D, altınlar, sürüm/README ve kilit dosyası için diff boştur. Tarayıcı doğrulaması eski 12 oyun kontrolüne ek olarak mevcut laboratuvar, eski worker ve yeni telefon pas kontrolünü kapsar; 390 px görünüm ayrıca görsel olarak incelendi.

Birleştirme sonrasında silinebilecek dallar `feat/match-sim-lab` ve `feat/match-sim-passing`; dallar silinmez. Yayındaki laboratuvar: https://rasimoner.github.io/ManagerStory/lab.html.
