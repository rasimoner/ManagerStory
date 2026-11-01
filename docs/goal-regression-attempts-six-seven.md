# Gol artışı — 6–7. yaklaşımlar başarısız, ürün geri alındı

Dal `fix/3d-goal-regression`, ürün `87d57862e2895594d4d2a43f7836a461fdbc425c`, main `d86ac72`. İki uzak baş yeniden doğrulandı; Node 22.23.4 kullanıldı. Kullanıcının devam denemelerine verdiği izin ve “Devam et” talebi doğrultusunda aynı G1'in geçmişi korunarak iki ek yaklaşım uygulandı. **G1 toplamı 7/7; yeni ad/alt maddeyle sayaç sıfırlanmadı.**

Bu tur yeni ürün düzeltmesi teslim edilmedi. İki yeni yaklaşım da genel gol artışını azaltmadığı için yalnız bunların ürün farkları geri alındı. Mevcut markaj, kaleci görevi geçerliliği ve orta anındaki görev sırası korunur. `src/`, aday sürüm 7.19.5, referans/golden/eşik/CI önceki ürünle aynıdır. Main'e merge, PR veya yayın yapılmadı.

## Ön ayrıştırma

Mevcut 50 tohum raporunun yüksek-skor kuyruğundaki 416 gol ayrıştırıldı; 50 maçın toplamı 431 goldür. Son şuttan önceki 10 saniyede en son servis veya şutun restartKind alanına göre 177 frikik, 122 korner, 39 penaltı, 4 açık oyun ortası, 74 diğer yakınlık etiketi çıktı. Bunlar zamansal etiketlerdir; yalnız etiketle nedensel kök neden iddia edilmez. Şut anında kaleci hazırlığı 40 olayda true, 376 olayda false idi.

Kısa seed 202'nin ilk golü penaltıdan: faulün özgün noktası 41,880188 / −18,161848; o devrede motorun ceza alanı içinde. Avantaj geri çağrısının yanlış konumu penaltıya çevirdiği varsayımı doğrulanmadı; bu yönde ürün denenmedi. Uzun seed 731 ilk golünde kaleci şut öncesi merkeze dönüyor; yalnız gol olması çarpışma veya kurtarış hatası kanıtı sayılmadı.

## 6. yaklaşım: ilk oynanabilir orta bölgesine kaleci hazırlığı

Gerçek 731 kornerinde kanattaki mevcut top konumu kaleci hedefini y=±3,30 yapıyordu. Hipotez: ilk oynanabilir alçalan yüksekliğe göre hazırlık, orta inerken geç kalmayı azaltabilir. Önceki başarısız 2. yaklaşım topun **yere düşeceği** noktayı kullanıyordu. Bu denemede ters tarafta yere düşen ama ilk oynanabilir teması öbür tarafta olan ayrı karşı örnek, eski yaklaşımı dışladı. Önceki 5. düzeltmenin erişilemez takip görevini iptal etmesi nedeniyle normal konumlanma yolu bu vakada artık çalışıyor; bu çağrı bağımlılığı kod ve doğal hedef iziyle doğrulandı.

Doğru maç sırasıyla kırmızı kabul 4 başarısız / 3 başarılı kontrol verdi. İlk fixture sürümü off-ball adımını atladığı için geçici restart rolünü sınamıştı; sıra düzeltildi, aynı önerinin kırmızı/yeşili tekrarlandı, ürün yaklaşımı veya eşik değiştirilmedi. Ürün sonrası yeni ve mevcut görev kabulleri 22/22 geçti.

Ancak aynı 901/731/42 ve 54.000 adımda toplam gol **20→24**, şut **90→112** oldu. Kurtarışların artması genel gol azalması anlamına gelmedi. G1 başarısız; yalnız yeni kaleci hedefi farkı kaldırıldı. Patch: `tests/reproductions/goal-keeper-threat-attempt6.patch`. Yeniden üretme: `keeper-cross-threat-window.cjs`, orijinal checkpoint yanında. Varsayılan CI dışında 4 kırmızı / 3 başarılı kontrol olarak korunur.

## 7. yaklaşım: örnekler arasındaki gerçek karşılama penceresi

731'in üçüncü golüne giden serviste tick 24371, home-RB için mevcut 0,25 sn örnekleri ulaşılabilir nokta bulmuyor; hedef −28,057189 / 34 oluyor. Aynı fizik/varış tahmini, 1,80 m yüksekliğe **1,299087 sn** sonra −41,989932 / −0,508405 noktasında inen topa oyuncunun **1,160084 sn** içinde yetişebileceğini gösteriyor. Aynı doğal servisin yedi karar anında bu fark ölçüldü. Gerçek temas sonucu değildir; mevcut planlayıcının kendi varış ölçütündeki kaçırılmış penceredir.

Öneri, yalnız gerçek cross uçuşunda bu analitik iniş sınırını örnekler arasına ekledi. Normal/eski cross bayrağı olmayan pasların grid ve fallback yolu korundu; hedefe ışınlanma, yeni erişim/hız sınırı veya zorunlu temas eklenmedi. İlk yaklaşımın “fallback'i daha yakına koy” yaması tekrar uygulanmadı. Alçak topun temas zarfı şüphesi bu vaka için kanıtlanmadı ve değiştirilmedi.

Kırmızı kabul 4 başarısız / 4 başarılı kontrol; uygulama sonrası yeni pencere, kaleci, markaj ve hava teması testleri **34/34** geçti. Kayıt/devam ve RNG eşitliği doğrulandı. İlgili normal şut/kaleci/top/pas/süre/taşıma kontrolleri ayrıca 71/71 geçti.

Fakat gol yine **20→24**, şut **90→108** oldu. Yeni hedef savunmacıların yanında hücumcuların da yüksek top temasını erkene aldı; üç maçtaki kafa şutu sayısı 20'ye çıktı. Doğru geometrik pencereyi bulmak genel dengeyi tek başına düzeltmedi. G1 başarısız; yeni fizik-zaman yardımcısı ve temas/kovalama farkları birlikte geri alındı. Patch: `goal-intercept-window-attempt7.patch`. `cross-intercept-window.cjs` ve gerçek checkpoint, varsayılan CI dışında 4 kırmızı / 4 başarılı kontrol olarak korunur.

| Kaynak | 901 gol | 731 gol | 42 gol | Toplam gol | Toplam şut |
|---|---:|---:|---:|---:|---:|
| Korunan 87d5786 ürünü | 5 | 9 | 6 | 20 | 90 |
| 6. yaklaşım, geri alındı | 6 | 10 | 8 | 24 | 112 |
| 7. yaklaşım, geri alındı | 11 | 6 | 7 | 24 | 108 |

[Tohumlar, doğal olaylar, pencere kanıtı ve ölçümler](measurements/goal-regression/attempts-six-seven.json). Bu küçük tarama mevcut 50 tohum kapısının yerine geçmez. İki başarısız küçük sonuç nedeniyle 50/20 serileri, güç ve beş süre paketi tekrar başlatılmadı. Yeni WebGL veya fiziksel iPhone/Safari kanıtı üretilmedi; önceki Chromium engeli yeniden denenmedi.

## Korunan durum, açık kabul ve gereken bilgi

Geri alınan kodlar ürünün parçası değildir. Güncel ürünün son ölçülmüş ortalamaları önceki rapordaki **50 tohum 8,62 gol**, **20 kısa maç 1,10 gol** olarak kalır; yeni ölçüm diye sunulmaz. Main'in 2,76 uzun/0,55 kısa ortalamasından fark ve zorunlu referans karşılaştırması açıktır. Bu tanı diğer bağımsız kamera/kaleci animasyonu/kural/özel hareket işlerini kanıtsız biçimde engellenmiş saymaz; bu tur yalnız kritik G1'e ayrılmıştır.

Gereken sonraki kanıt: erken yüksek temasın hücumcu ve savunmacı kararını, gerçek gövde yönü/temas erişimini ve kalecinin hazırlanmasını ayrı izleyen tek doğal pozisyon. Özgün kullanıcı videosunun kariyer checkpoint/seed'i hâlâ yok; bu laboratuvar seed'lerinin videoyla aynı kök neden olduğu iddia edilmez. Genel şut/kaleci katsayısı veya gol kotasıyla 2,76'ya indirmek kabul değildir.

Teslim kontrolü Node 22.23.4: lint temiz; test:fast 607 başarılı, 1 mevcut atlama; ardından ayrı performans 5/5. Yeni kırmızı reproductions bu yeşil sayılara dahil değildir. [Kontrol kaydı](measurements/goal-regression/attempts-six-seven-checks.json). Sürüm artırılmaz; ürün farkı yok. [Önceki başarılı ürün ve açık görsel altyapı promptu](goal-regression-continuation-report.md).

## Dar devam promptu

```text
ManagerStory fix/3d-goal-regression güncel HEAD, docs/goal-regression-attempts-six-seven.md ve docs/goal-regression-progress.md'yi oku. Ürün kaynakları 87d5786 ile aynı; 7.19.5 yayımlanmadı. Mevcut markaj/kaleci görevi/orta rol sırası ve 15 kabul testini koru. G1 toplam geçmişi 1–7 korunur; 6 ve 7 geri alındı. 6 ilk oynanabilir bölgeye kaleci hazırlığı: 22 yerel kabul geçmesine rağmen üç seed 20→24 gol. 7 kaba grid'e gerçek oynanabilir sınırı eklemek: 34 kabul geçmesine rağmen 20→24 gol ve 20 kafa şutu. İki patch/repro hazır çözüm değildir. Ürün değişikliğini varsayılan olarak tekrar uygulama veya sayacı yeni alt maddeyle sıfırlama. Yeni inceleme yalnız erken yüksek top temasında hücumcu/savunmacı kararını, gerçek gövde yönünü, temas erişimini ve kaleci hazır oluşunu tek doğal pozisyonda ayrı izlesin. Önce kesin kusuru kırmızı kabul ve dar öneriyle göster. Son geçerli ölçümler 50 tohum 8,62 gol / 20 kısa maç 1,10; main 2,76 / 0,55, genel kabul açık. Sonuç kotası, zorunlu kayıp, servis kapatma veya golden/ref/eşik/CI değişikliğiyle başarı üretme. Diğer özel hareket/perf/tekrar işlerine girme. Zorunlu kapılar geçmeden PR, görsel onay olmadan merge/yayın yapma.
```
