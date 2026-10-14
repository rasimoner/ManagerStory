# Madde 7 ürün düzeltmesi — 2026-10-07

Başlangıç: `03afaaa5c258f89df14c6d463890e579f7bb04eb`. Önceki hatalı toplam
sunum sürelerini aynen koruma şartı kullanıcı tarafından kaldırıldı. Motorun
90 dakikası, genel tempo ve seçilen hız korunur. **Ürün düzeltmesi uygulandı;
madde 7 kullanıcı görsel onayı gelmeden kapanmaz.**

## Neden ve uygulama

Eski `contestFrame`, çakışan başlangıçta .70m ayrımı anında koyuyor ve sıfır
vektör fallback'i ile sonraki vektör yönü arasında yaklaşık1.252m sıçrıyordu.
500 örnekli maksimum türev bu yerleşim hatasını koşu sayıp26.601s süre üretiyordu.
Yeni hesapta gözlenen başlangıç aynıdır. Gerekli ayrım kısa, sürekli bir hazırlık
adımıdır (3m/s sidestep limiti); normalleştirilen değişken sıfır vektörü yoktur.

Yaklaşma gerçek başlangıç–temas uçları arasında doğrudan yapılır. Gövdelerin
kesileceği yerde küçük, sabit uç/yönlü bir sapma kullanılır; uzak savunmacıyı
geniş bir çemberde dolaştıran yol kullanılmaz. Toparlanma gerçek sunum sonuna
bağlanır. Doğrusal yol, kısa kutupsal sapma veya yerel ikinci derece eğri için
analitik yol/hız sınırı hesaplanır. Eğri kontrol poligonu ve smoothstep1.5 tepe
türevi koşan kökleri normal ortak sunumda6m/s ile sınırlar. Tek aşırı türev
örneği veya sabit1s klip kullanılmaz. Yol planı değişmeyen başlangıç/son noktaları
için önbelleğe alınır; eğri incelemesi her render karesinde tekrar edilmez.

Hazırlık ve gerçek hareket mesafesi ayrı bütçelerdir. Hareketin son bölümü uzanma;
ardından kısa temas/sahiplik devri(.18s temel), sonra mesafeden hesaplanan
toparlanma vardır. Yaklaşma/uzanma arasında hız profili kesilmez. Motorun zaten
bağlanmış press/tackle sonuçları tekrar klip olmaz; önceki gerçek başarısız motor
denemeleri atlanmaz. Ayrı hold veya başka bekleme eklenmedi.

Tek mevcut step/queue çalışır. `pitchV73.progress` ve adaptör `clockProgress`
gerçek klip zaman oranıdır. Görünümün mevcut0/.19/.65/.76/.91/1 temas fazları
aynı zamanın türetilmiş eşlemesidir (`presentation.progress`,
`contestMotion.progress`); başka saat veya scheduler değildir. Onaylanan
poz/model ve kamera kodu değişmedi. Diğer oyuncuların keyframe interpolasyonu
gerçek klip zaman oranını kullanmaya devam eder. Adapter kopyaları RNG/save
verisine girmez. Safari eski kaynağı tutmasın diye yalnız SW cache anahtarı
yenilendi; ürün sürümü artmadı.

## Aynı gerçek örnekler, önce / sonra (1×, kariyer tempo1)

| Aşama (s) | seed8800/72→73→74 önce | Sonra | seed1/48→49→50 önce | Sonra |
| --- | ---: | ---: | ---: | ---: |
| Hazırlık | 5.054 | .350 | 5.016 | .357 |
| Yaklaşma | 12.236 | 2.013 | 12.144 | 1.908 |
| Uzanma | 2.926 | .481 | 2.904 | .456 |
| Temas/sahiplik | 3.990 | .180 | 3.960 | .183 |
| Toparlanma | 2.394 | .640 | 2.376 | .912 |
| Toplam | **26.601** | **3.664** | **26.401** | **3.816** |

| CPU sunum ölçümü | seed8800/72 önce→sonra | seed1/48 önce→sonra |
| --- | ---: | ---: |
| Saldıran toplam yol (m) | 10.727→10.727 | 9.282→9.282 |
| Savunmacı toplam yol (m) | 10.652→10.989 | 13.046→13.134 |
| Yaklaşmada oyuncu kökü tepe (m/s) | .987→6.000 | .925→5.890 |
| Yaklaşmada top tepe (m/s) | 1.421→8.638 | 1.330→8.467 |
| Başlangıç savunmacı konum farkı (m) | .700→0 | .700→0 |
| p0→p.0001 savunmacı adımı (m) | 1.252→.000000582 | 1.239→.000000582 |

Eski savunmacı yolunun hazırlık bölümüne yapay yön sıçraması dahildir; bu fiziksel
koşu değildir. Top hızlı dokunuş/yuvarlanma ve sahiplik devriyle kökten farklı
hızdadır. Tüm hızlar CPU dünya-sunum koordinatlarından, **videodan değil**.
Diğer gerçek örnekler seed1/18 (başarılı top saklama),1/21 (kayıp),1/3 (bağımsız
kazanım) ayrıca ölçüldü. Bu dalın eski uygun olmayan /24 hızlı mücadele limiti
QA'daki1.116s denemesiyle ürüne taşınmadı.

Seed8800/72 son sınırında örnekli top/iki oyuncu kare farkı yaklaşık.000004m;
ayrı yerleşim ve dakika hareketi önceki.150/.667s, sonraki Taylan pass76
**.790208s ile aynı**. Uçuş mesafesi/süre/hız profili korunur; uçuşun önceki hızlı
sunum bütçesi yeniden tasarlanmadı. Kuyruk borcu veya gizli telafi katsayısı yoktur.

## Ortak saat ve tam maç eşitliği

2D/3D×.5/1/2, duraklatma/devam ve görünüm değiştirme: aynı olay/konum/saat
korunur. Normal1/60,.08,.12s karelerde tamdt×hız; mücadele tepe kökü3/6/12m/s.
2s gecikmiş kare mevcut.12s sınırıyla.12×hız ilerler; sonraki normal kare yine
1/60×hızdır, borç geri ödenmez. Sınır değiştirilmedi. **1.88s wall-time bu gecikmiş
karede atılır**; bu, sunum burst'ünü önleyen mevcut davranıştır.8.33FPS altındaki
sürekli gecikmeler ağırlaştırabilir; video RAF/GPU telemetrisi vermediği için
iPhone performansı doğrulanmış değildir. Normal akışta yapay26s klip giderilmiştir.

İki tam maç(.08s adımlı,1×) ham motor olayları/sırası/skor/istatistik/oyuncu
sonuçları/RNG/kariyer ve kayıt davranışı eşittir. Son zincir boşalır, tek end,
tek kariyer sonucu vardır. Klip sayısı/sırası aynıdır; **değişen bütün süreler
mücadele klibidir. Mücadele dışı hiçbir klibin süresi değişmedi.**

| Tam sunum | Önce (s) | Sonra (s) | Mücadele klip bütçe farkı (s) | Atomik kare sınırı yuvarlama farkı (s) |
| --- | ---: | ---: | ---: | ---: |
| seed1 | 451.76 | 395.44 | −56.109958 | −.210042 |
| seed8800 | 469.20 | 412.64 | −56.392658 | −.167342 |

Çıkarılan süre başka beklemeye taşınmadı. Yuvarlama farkı mevcut atomik dakika
kuyruğunun kare sonunda boşalma/generasyon davranışıdır; yeni telafi mekanizması
yoktur. Eski sabit toplam regresyonu kullanıcı talimatına göre yeni doğrulanmış
toplamlara ve yalnız mücadele bütçesi değişimi kontrolüne çevrildi.

## Görsel doğrulama açık

Gerçek WebGL aracı Chromium executable eksikliğinde launch'ta durdu; kurulum
ve indirme yapılmadı. İki mobil boyutta GPU hareket, iPhone FPS/akıcılık ve
mücadele öncesi→sonraki pas hareket kaydı üretilemedi. Mevcut CPU anatomi ve
gerçek model temas regresyonları görsel onay değildir. Ayrı uygulama önizlemesi
ürün düzeltmesiyle güncellenir; main/canlıV7.4.2/sürüm/tek oyunculu site korunur.

Araç: `node tools/match3d-duel-fix-audit.mjs`; küçük ölçüm dosyası:
`measurements.json`. Tam regresyon sonucu `tests.log`, WebGL engeli `webgl.log`.

Tam kapı **183/183 geçti,0 başarısız**. JS parse ve `git diff --check` temiz.
