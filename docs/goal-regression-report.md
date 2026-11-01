# Gol artışı: ilk ayrıştırma — düzeltme tamamlanmadı

Dal: fix/3d-goal-regression. Taban: 97d99fcfad169c4ccf156b2d53884a4f123c4023. Main d86ac72de6bc4677a2357fc516c06e1ffeceed48. Node 22.23.4; önceki ortamın kopuk Git/Node bağlantıları ayrı clone ve aynı Node sürümüyle birer girişimde giderildi. Eski çalışma dizinleri değiştirilmedi.

## Kesinleşen bulgu

İlk büyük sıçrama **8c99b450da4c1451bc185a7648e815f9d75852b3** korner/servis commit'inde başlıyor. Henüz özel çalımlar, kafa/vole ve otomatik tekrar eklenmeden de artış var. Aynı 901/731/42 seed'leri, aynı createLabScenario girdileri, aynı 54.000 fizik adımı kullanıldı. Bunlar erken teşhis için üç maçtır; önceki 50 maç ortalamalarıyla karıştırılmaz ve CI karşılaştırmasının yerine geçmez.

| Kaynak / kontrol | 901 gol | 731 gol | 42 gol | Toplam gol | Toplam şut |
|---|---:|---:|---:|---:|---:|
| Main d86ac72 | 1 | 4 | 1 | 6 | 54 |
| Taşıma düzeltmesi 90ea733 | 4 | 4 | 1 | 9 | 43 |
| Korner/servis 8c99b45 | 14 | 12 | 15 | 41 | 128 |
| Son aday 97d99fc | 17 | 14 | 12 | 43 | 114 |
| 1. yaklaşım | 15 | 14 | 15 | 44 | 127 |
| 2. yaklaşım | 18 | 10 | 9 | 37 | 130 |
| 8c99b45 + yalnız önceki restart-decision | 1 | 2 | 3 | 6 | 56 |

Son satır, yalnız ayrı teşhis worktree'sinde eski duran-top kararını kullanır. Yeni korner/frikik servis seçimini kapattığı için ürün düzeltmesi sayılmadı; aday dala katılmadı. Bu kontrol, artışın yeni duran-top servis yolundan geldiğini nedensel olarak daraltır. Yerleşim, servis seçimi, ilk kontrol ve takip eden yakın şut arasındaki tam alt neden henüz yeterince ayrıştırılmadı. Tek bir satır kusuru veya bütün sorunun kaleciden kaynaklandığı iddia edilmez.

901'in ilk yüksek-skor örneği: korner 1052,5 sn; servis 1060,3; ST gerçek kontrolü 1062,6919; şut 1063,1; gol 1063,5473. Şut mesafesi 13,429 m. Kaleci y=+2,069 iken top karşı köşeye gider; gereken ek uzanma 2,139 m, oluşan 0,749 m. Ayrı izde bazı savunmacılar alıcı çevresini bırakıp x≈20–22/y=-34 hedeflerine koşar. Bu iki yerel sorun ölçüldü, fakat aşağıdaki denemeler genel artışı gidermediği için yeterli kök neden/düzeltme sayılmadı.

## İki deneme ve geri alma

1. Ulaşılamayan ortada son ufuk noktasını kovalamak yerine en yakın oynanabilir yaklaşımı koruma. Önce kırmızı test hedefi (21,23;-34) gösterdi. Yerel geometri ve koruma testleri 3/3 geçti; maç toplamı 43→44 oldu. **Başarısız.** ball-chasing ürün farkı kaldırıldı.
2. Kalecinin ortanın mevcut kanat konumu yerine gerçek fiziksel iniş alanını önceden örtmesi. Önce iki yön/iki kanatta dört kırmızı test; normal top karşı örneği geçti. Uygulama sonrası 5/5 yerel kabul geçti, toplam gol 43→37 oldu; 901 17→18 kötüleşti. Büyük artış kaldı. **Başarısız.** keeper-positioning ürün farkı kaldırıldı.

Üçüncü yaklaşım yapılmadı. İki patch ve kırmızı yeniden üretmeler tests/reproductions altında, varsayılan test dosyalarının dışındadır. Patch'ler hazır çözüm değildir; boş bağlam satırlarının dosya içi whitespace hatası üretmemesi için sıfır bağlamlıdır (teşhis için git apply --unidiff-zero). src/, sürüm metası, mevcut golden, CI, lint-baseline ve 50-tohum referansı **97d99fc ile aynıdır**. Önceki başarılı özellikler ve altı hareketin eski başarısızlık geçmişi korunur. Sürüm artırılmadı; yeni ürün değişikliği yoktur. PR/merge/yayın yapılmadı.

## Doğrulama ve yeniden üretme

AGENTS.md commit kontrolleri bir kez çalıştırıldı: lint yeni ihlal yok; test:fast 586 başarılı, 1 mevcut atlama, ayrı performans 5/5. Bu yeni ortamın performans başarısı önceki ortamdaki iki başarısız girişimin kök nedeninin çözüldüğü anlamına gelmez; optimizasyon uygulanmadı. Başarısız ürünler geri alındığından tam test/build/smoke, 50 tohum/güç ve yeni video paketi tekrar başlatılmadı. G1 kabulü açık kalır.

Node 22 ile mevcut bir checkout'u küçük ölçmek için:

```bash
node --experimental-vm-modules --disable-warning=ExperimentalWarning tests/reproductions/goal-regression-probe.cjs /absolute/checkout /absolute/output.json
```

Karşılaştırma checkout'ları aynı bağımlılıklarla çalışmalıdır. 90ea733 → 8c99b45 farkı için bu iki commit ayrı checkout'ta ölçülür. goal-restart-isolation.patch yalnız 8c99b45 üzerinde teşhis amaçlıdır; yeni özelliği kapatır. goal-cross-chase.cjs ve goal-keeper-cross-anticipation.cjs geri alınmış adayların yerel kırmızı kabulleridir; normal CI'ya eklenmedi. Tohumlar/girdi/istatistikler [probes.json](measurements/goal-regression/probes.json), ilk gol izi [first-goal.json](measurements/goal-regression/first-goal.json), sayaç [ilerleme belgesi](goal-regression-progress.md) içindedir.

## Ayrı devam görevi için dar prompt

```text
ManagerStory fix/3d-goal-regression dalının son raporunu ve ölçümlerini oku. Ürün tabanı 97d99fc, main d86ac72; yeni ürün düzeltmesi teslim edilmedi. İlk büyük artış 8c99b45 korner/servis commit'inde: aynı 901/731/42 seed ve 54.000 adımda toplam 9→41 gol; son aday 43. 8c99b45'te yalnız eski restart-decision kullanılması 6 gole dönüyor, fakat servisi kapattığından bu ürün çözümü değildir. Yeni ayrı görev yalnız duran-top servisinden ilk kontrole ve yakın şuta kadar savunma/alıcı yerleşimi ve gerçek fırsat zincirini ayrıştırsın. Önce tek bir doğal checkpoint üzerinde kesin kusuru kırmızı testle göster; sonra yalnız o nedeni düzelt. Savunmacının en yakın yaklaşımını seçmek 44, kaleci iniş öngörüsü 37 gol verdi; ikisi geri alındı, aynı çözümleri gerekçesiz tekrarlama. Bu görevin iki başarısızlığını koru; kullanıcı başlatacağı yeni görev için en çok iki yaklaşımı başta sabitle. Gol kotası, şut/kaleci katsayısı, zorunlu kayıp, eski servisi kapatma, seed/eşik/golden değişikliği yok. Önce üç sabit seed; ancak kabul geçerse 20 doğal kısa maç ve aynı 50 tohumla geniş doğrulama. Diğer özel hareket/perf/tekrar işlerine girme. Zorunlu kontroller geçmeden PR, merge veya yayın yapma.
```
