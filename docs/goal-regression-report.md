# Gol artışı — markaj ve tanı geçmişi

Güncel teslim 7.19.5 adayıdır: [4–5. yaklaşımların sonucu, ölçümler ve açık işler](goal-regression-continuation-report.md). Aşağıdaki 7.19.4 / 3–3 sonuçları tarihsel kayıttır. Sonraki kullanıcı izniyle iki ek yaklaşım uygulandı; G1 toplamı 5/5 oldu.

Dal `fix/3d-goal-regression`, ürün tabanı `97d99fcfad169c4ccf156b2d53884a4f123c4023`, karşılaştırma main `d86ac72de6bc4677a2357fc516c06e1ffeceed48`. Node 22.23.4. 7.19.4 yayımlanmamış adaydır. Eski çalışma dizinleri ve önceki 7.20.0 hazırlıkları değiştirilmedi.

Kullanıcı somut markaj önerisine “Dene ve devam et” diyerek tek ek denemeyi onayladı. **G1 sayacı 3/3**; önceki iki başarısızlık korunur. Üçüncü yaklaşım kanıtlanan markaj kusurunu düzeltti ve ölçülen gol artışını azalttı; genel denge kabulü geçmedi. Bu bağımsız başarı tutuldu. Dördüncü yaklaşım, PR, merge ve yayın yapılmadı.

## Kesin neden ve ürün farkı

Saklanan doğal seed 901 kornerinde, servis anında `planSimulationBoxDefence` yalnız x farkıyla alıcı seçiyordu. Köşedeki home-LW, kale çizgisine yatayda 0,331 m ama kaleye gerçekte 33,866 m uzaktı. İki markaj hakkından birini tüketiyordu; merkezdeki gerçek alıcı home-ST, 10,904 m kale uzaklığına rağmen listeden düşüyordu. İkinci seçilen home-LCM gerçekte 11,685 m uzaktı. [Tanı ve eski kırmızı kanıt](corner-marking-diagnosis.md).

Yalnız gerçek `flight.cross` uçuşunda uygun alıcı filtresi ve sıralaması iki boyutlu kale uzaklığını kullanır. Mevcut 23 m sınırı ve iki markaj hakkı korundu. Diğer toplarda eski seçim sürer. Fizik, hız, RNG, şut/kaleci katsayısı, temas ve sonuç çözücüsü değişmedi. Yeni durum alanı yok; kayıt biçimi/göç gerekmiyor. Kayıt/devam gerçek orta uçuşundan aynı sonuçla doğrulandı.

Aynı checkpoint'in iki hücum yönü × iki kanat geometrisinde dört kabul önce kırmızı, sonra yeşil oldu. Normal top karşı örneği ve kayıt/devam eşitliğiyle `tests/match-sim-corner-mark-priority.test.cjs` **6/6**. Geometrik aynalar doğal kariyer sıklığının kanıtı değildir.

Aynı doğal korner ileri oynatılınca:

| Gözlem | Önce | Markaj düzeltmesiyle |
|---|---:|---:|
| Servis zamanı | 332,200000 | 332,200000 |
| Gerçek ilk kontrol zamanı | 334,665085 | 334,665085 |
| İlk kontrolde en yakın savunmacı | 4,128585 m | 1,753223 m |
| Şut zamanı | 335,100000 | 335,500000 |
| Sonraki sonuç | 335,598738 gol | 335,918177 kurtarış |

Oyuncu konumu veya sonuç zorlanmadı. Eski gol, temasta savunmacı zaten uzakta olduğu için tek başına eksik çarpışma kanıtı değildi. Yeni kanıt yalnız bu kusurun ve aynı pozisyonun etkisini gösterir; bütün artışın bu nedenle oluştuğu iddia edilmez.

## Aynı tohumlarla ölçülen etki

İlk büyük tarihsel sıçrama korner/servis commit'i `8c99b450da4c1451bc185a7648e815f9d75852b3` içinde, özel hareketler ve otomatik tekrar eklenmeden oluşuyordu. Aynı 901/731/42 girdileri ve 54.000 fizik adımı:

| Kaynak / yaklaşım | 901 gol | 731 gol | 42 gol | Toplam gol | Toplam şut |
|---|---:|---:|---:|---:|---:|
| Main d86ac72 | 1 | 4 | 1 | 6 | 54 |
| Taşıma 90ea733 | 4 | 4 | 1 | 9 | 43 |
| Korner/servis 8c99b45 | 14 | 12 | 15 | 41 | 128 |
| Önceki aday 97d99fc | 17 | 14 | 12 | 43 | 114 |
| 1. yaklaşım, geri alındı | 15 | 14 | 15 | 44 | 127 |
| 2. yaklaşım, geri alındı | 18 | 10 | 9 | 37 | 130 |
| 8c99b45 + eski restart seçimi, yalnız tanı | 1 | 2 | 3 | 6 | 56 |
| 3. yaklaşım, markaj | 11 | 5 | 12 | 28 | 104 |

Eski restart seçimi yeni servisi kapattığı için ürün çözümü değildir; probe worktree eski haline döndürüldü. Markajdaki küçük ölçüm olumlu olduğu için tek 50-tohum ve 20 kısa maç ölçümü yapıldı.

**50 aynı tohum, 54.000 fizik adımı:** satırlar maç başına ortalama. Bu sözleşme doğal 420 saniyelik maçlarla birleştirilmez.

| Sayaç | Main | Önceki aday | Markaj düzeltmesi |
|---|---:|---:|---:|
| Gol | 2,76 | 16,92 | 10,30 |
| Şut | 17,64 | 48,46 | 38,48 |
| Pas | 798,64 | 728,98 | 734,76 |
| Top kazanma | 143,52 | 124,16 | 126,82 |
| Faul | 25,88 | 30,26 | 31,10 |
| Kurtarış | 6,72 | 10,24 | 9,54 |
| Kırmızı kart | 0,44 | 2,44 | 2,50 |
| Maçların ortalama kurtarış yüzdesi | 69,82 | 37,68 | 48,06 |

Gol %39,1, şut %20,6 azaldı. Yeni gol medyanı 11, p10/p90 6/14. Genel denge hâlâ bozuk; main'e göre gol 3,73 kat. Faul/kart artışı giderilmedi. “Denge değişmedi” veya “gol sorunu çözüldü” denmez.

**20 doğal kısa maç, 420 saniye, iki devre, slot bazında eşit özellikler, workload kapalı:**

| Sayaç | Main | Önceki aday | Markaj düzeltmesi |
|---|---:|---:|---:|
| Gol | 0,55 | 1,05 | 0,80 |
| Şut | 6,80 | 8,80 | 7,80 |
| Pas | 72,45 | 71,25 | 72,80 |
| Top kaybı | 29,50 | 31,20 | 30,20 |
| Faul | 1,95 | 1,85 | 2,05 |
| Kurtarış | 2,35 | 3,35 | 2,45 |

Top kaybı burada yeniden başlatmalarda sahiplik değişimini de sayar; 50 maçtaki top kazanmayla aynı sayaç değildir. [Karşılaştırma](measurements/goal-regression/mark-attempt3-comparison.json), [50 tohum ve dağılımlar](measurements/goal-regression/mark-attempt3-50-summary.json), [20 kısa maç](measurements/goal-regression/mark-attempt3-short.json), [tek korner olayları](measurements/goal-regression/mark-attempt3-corner.json).

## Deneme geçmişi ve doğrulama

1. Ulaşılamayan ortada en yakın oynanabilir yaklaşımı koruma: yerel geometri 3/3, üç tohum 43→44 gol. Başarısız ürün farkı geri alındı. `goal-chase-attempt1.patch` / `goal-cross-chase.cjs` korunur.
2. Kalecinin gerçek iniş alanını önceden örtmesi: yerel yön/kanat kabulleri 5/5, üç tohum 43→37 gol; 901 17→18 kötüleşti. Büyük artış kaldı. Başarısız ürün farkı geri alındı. `goal-keeper-attempt2.patch` / `goal-keeper-cross-anticipation.cjs` korunur.
3. Kullanıcı onayıyla gerçek kale uzaklığına göre markaj: kesin seçim kusuru düzeldi, 50 tohumda kısmi etki doğrulandı. Önceki yamalar yeniden uygulanmadı. Genel G1 açık; bütçe doldu.

Yeni altı kabul 6/6; ilgili korner/hava teması/kaleci sınırı/kayıt/taşıma testleri 39/39 geçti. Teslim kontrolü Node 22.23.4: lint temiz; test:fast 592 başarılı, 1 mevcut atlama; ardından ayrı performans 5/5; build başarılı. Denge kapısı açık olduğundan bu dar teslimde tam test/smoke ve yeni video paketi tekrar başlatılmadı; tam paket yeşil diye sunulmaz. [Kontrol kaydı](measurements/goal-regression/mark-attempt3-checks.json).

Mevcut `match-sim-parity-reference.json` ile gerçek karşılaştırma ilk seed 901'de **1–0 yerine 6–5** nedeniyle başarısız. Referans, eşikler, golden, lint tabanı ve CI değiştirilmedi. İlk skor farkı zorunlu kapıyı zaten durdurduğu için 400 ek güç maçı, beş süre taraması ve geniş video paketi yeniden çalıştırılmadı. Önceki doğal kariyer fixture ve görsel kabul açıkları bu küçük düzeltmeyle kapanmış sayılmaz. Yeni WebGL görüntüsü/video veya fiziksel iPhone/Safari kanıtı üretilmedi. PR koşulu sağlanmadı; başarılı düzeltme dala teslim edilir.

Yeniden ölçüm (Node 22): `npm run sim:report -- --output /absolute/report.json`; kısa seri: `node --experimental-vm-modules --disable-warning=ExperimentalWarning tools/match-sim-parity-report.cjs . /absolute/short.json`. Tek korner: `node --experimental-vm-modules --disable-warning=ExperimentalWarning tests/reproductions/corner-mark-replay.cjs /absolute/checkout /absolute/corner.json`.

## Ek devamda bulunan yeni karar kusuru

Ürün değişmeden, seed 42 ilk golünde ulaşılabilir bir karşılama noktası bulunmayan kalecinin `intercept` görevi alıp normal konumlanmayı atladığı gösterildi. Kart/oyuncu eksilmesi yok. Yeni yeniden üretme 1 kırmızı / 2 başarılı karşı örnek; varsayılan CI dışında. G1 3/3 olarak korunur; dördüncü yaklaşım uygulanmadı. [Somut çağrı zinciri ve dar öneri](remaining-keeper-cross-diagnosis.md). Önceki 50/20 ölçümü geçerliliğini korur; yeni denge etkisi ölçülmedi.

## Açık G1 için kopyalanabilir dar devam promptu

```text
ManagerStory fix/3d-goal-regression dalının güncel HEAD'ini ve docs/goal-regression-continuation-report.md'yi oku. 7.19.5 yayımlanmamış adaydır; G1 aynı kimlikle 5/5 geçmişi korur. Mevcut markaj, kaleci görev geçerliliği ve orta rol sırası düzeltmelerini koru. 50 tohum gol 16,92→10,30→8,62; main 2,76. Son 20 kısa maçta gol 0,80→1,10 arttı; genel denge kabulü açık. Yalnız farklı doğal bir pozisyonda kalan gol zincirini ve kart eksilmesinin etkisini salt okuma iziyle ayrıştır. Son rapordaki geçmişi/başarısız yaklaşımları yeniden adlandırma veya bütçeyi sıfırlama. Yeni ürün yaklaşımından önce somut kırmızı kabul ve dar öneri hazırla. Golden/ref/eşik/CI değiştirerek başarı üretme. Diğer özel hareket/perf/tekrar işlerine girme; zorunlu kapılar geçmeden PR, görsel onay olmadan merge/yayın yapma.
```
