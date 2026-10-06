# Açık madde 7 — mücadele süre teşhisi (2026-10-07)

Başlangıç ve korunmuş ürün kaynağı: `bd78b5e52ff24bb3d0247dcccae7ad67585c7038`.
**Düzeltme teslimi değildir.** Ürün JS/CSS/model/kamera/kaleci/motor/sürüm değişmedi.
Kullanıcının aynı maç süresi ve genel tempo sınırıyla çelişen deneme yalnız QA VM'sindedir;
uygulama tarafından yüklenmez. 7. madde açık ve kullanıcı görsel onayı bekliyor.

## Kaydı eşleştirme

83.067s uzunluğundaki ekin 51–81s kareleri incelendi. Görünen anlatım:
15' Sinan Erdem mücadelede topu kaybetti → Taylan topa baskıya çıktı → Taylan topu kazandı;
16' Taylan pas verdi → 17' Mensah pas verdi. 1× ve 3D seçili.
Kaydın seed/olay kimliği veya cihaz RAF telemetrisi yoktur. **Videonun seed'i doğrulanmadı.**
Kontrollü gerçek motor seed 8800 aynı dakika/oyuncu/anlatım ve sonraki pasları üretir:
başarısız press70/tackle71 → dribble72 + press73 + tackle74 → pass76 → pass80.
Bu tekrar üretilebilir örnektir; kaydın kesin kimliği değildir.

## Ölçülen neden

`contestFrame` başlangıcında saldıran ve savunmacı aynı gerçek noktadadır.
Sıfır mesafede .70m siluet ayrımı `normal` yönünü kullanır; sıfırdan hemen sonraki
karede normalleştirilmiş hareket vektörünü kullanır. Bu yön değişimi 1.251811m
sayısal süreksizliktir. `contestDuration` 500 faz örneğinin maksimum türevini /24×1.02
ile süreye dönüştürür; yaklaşık 9.977m mücadeleye 26.600990s atanır.
Örnek sayısı 100/500/1000 olduğunda hesaplanan süre 5.320/26.601/53.202s olur:
ölçüm çözünürlüğüyle büyüyen bir geometri tekilliği; gerçek fiziksel hız değildir.

73/74 aynı mücadeleye bağlıdır ve ayrı klip olarak yeniden oynatılmaz. 70/71 ise
motorun önceki gerçek başarısız denemesidir; toplam .88s. İncelenen kazanç zincirinde
ayrı hold yoktur. Uzun bölüm, üst üste 24s bekleme veya biriken saat borcu değil,
tek yanlış uzun kliptir. Sonraki pass76'nın normal .790208s bütçesi (53.451m yol,
.450419s uçuş) değiştirilmez: CPU sunum koordinatlarında ortalama 118.670m/s;
pass80 47.688m/.438721s =108.698m/s. Bunlar **videodan çıkarılan hızlar veya gerçek
motor fizik verisi değildir**. Çıkışta gizli telafi katsayısı yoktur; yanlış uzun
mücadeleden mevcut kısa pas bütçesine geçiş tempo farkını üretir.

## Önce / yalıtılmış deneme (1×, tempo1)

Deneme yalnız çakışan başlangıçta sürekli bir lateral kök yolu kullanır; ürün
düzeltmesi değildir. Başlangıç sınırındaki .70m ayrımı ayrıca yumuşatılmalıdır.

| Bölüm | Korunan ürün (s) | QA denemesi (s) |
| --- | ---: | ---: |
| Önceki gerçek başarısız press/tackle | .880 | .880 |
| Hazırlık 0–.19 | 5.054 | .212 |
| Yaklaşma .19–.65 | 12.236 | .513 |
| Uzanma .65–.76 | 2.926 | .123 |
| Temas/sahiplik devri .76–.91 | 3.990 | .167 |
| Toparlanma .91–1 | 2.394 | .100 |
| Ayrı hold | 0 | 0 |
| Mücadele klibi toplamı | 26.601 | 1.116 |
| Sonraki yerleşim + dakika hareketi | .150 + .667 | .150 + .667 |
| Sonraki Taylan pası76 | .790 | .790 |
| Sonraki Mensah pası80 | .770 | .770 |

Mücadele yaklaşmasında saldıran kökün CPU tepe hızı .987→23.530m/s, top
1.421→33.873m/s olur. Deneme mevcut /24 limitini devralır; doğal hareket çözümü
olarak kabul edilemez. Aynı sürekli yolun 6m/s kök limiti yaklaşık 4.46s gerektirir;
26.60s korunursa yaklaşık 10m kısa yol yine ağır kalır. Klipteki 25.485s fazlalığı
bekleme eklemeden yerleştirecek başka gerçek 15. dakika aksiyonu yoktur. Sonraki
paslar 16/17. dakikadadır; mevcut atomik kuyruk boşalmadan gelecekteki motor
dakikaları üretilmez. Geleceğe spekülatif motor üretimi, gizli zaman borcu veya
başka kliplerde duruşla telafi kullanılmadı.

Tüm çakışan başlangıçlara bu QA denemesini uygulamak normal tam sunumu değiştirir:
seed1 **451.76→343.20s**, seed8800 **469.20→382.16s** (.08s örnekli tam maç).
Ham motor olayları/skor/istatistik/RNG/kariyer aynıdır; değişen sunum bütçesidir.
Bu, kullanıcının normal süre koruma şartını karşılamaz ve ürüne uygulanmadı.

## Saat, kontroller ve doğrulama sınırı

Gerçek aynı seed8800/72 örneğinde iki görünüm × .5/1/2 hız: normal 1/60, .08 ve
.12s karelerde ortak ilerleme tam `dt×seçili hız`. .12 sınırı normal karelerde
zaman kaybetmez. 2s gecikmiş kare .12×hız ilerler; sonraki normal kare 1/60×hızdır,
borç geri ödenmez. Duraklama sıfır ilerler; 2D→3D→2D geçişi saati/klibi yenilemez.
Sınır .12s üstü karelerde wall-time atar ve düşük FPS'de ağırlaştırabilir; video
RAF telemetrisi olmadan cihaz katkısı ölçülmüş değildir. Normal CPU akışında da
26.601s hata tekrar üretildiği için cihaz performansı bu süre hatasını açıklamaz.

İki korunmuş ürün tam maçı 451.76/469.20s; olay/sonuç/istatistik/RNG/kariyer eşit,
son kuyruk boş, tek end, kariyer sonucu bir kez. QA denemesinde de motor/kariyer
eşitliği sağlanır; süre eşitliği **sağlanmaz**. `measurements.json` küçük sayısal
kanıttır; GPU hareket veya iPhone akıcılığı onayı değildir.

Gerçek WebGL aracı mevcut Chromium executable bulunmadığından launch'ta durdu.
İndirme/kurulum yapılmadı. Yeni gerçek önce/sonra hareket kaydı, iki mobil boyutta
GPU kontrolü ve cihaz FPS'si yoktur. Ek kullanıcı videosu büyük medya olarak Git'e
aktarılmadı. Ayrı iPhone uygulama önizlemesindeki ürün davranışı bu tur değişmez.

Çalıştırma: `node tools/match3d-duel-duration-audit.mjs`.
