# Kornerde yanlış markaj önceliği — tanı geçmişi

Bu belgenin aşağıdaki öneri ve 2/2 kaydı ek kullanıcı onayından önceki tanıdır. Güncel sonuç en alttadır.

2 Kasım 2026. Ürün tabanı 97d99fc; tanı kaydı 1311857. G1'in önceki iki başarısız yaklaşımı ve 2/2 sayacı korunur.

## Tek pozisyonda kanıt

Seed 901, saklanmış korner checkpoint'i, servis 332,2 fizik saniyesi. Node 22.23.4 ile gerçek simülasyon aynen ilerletildi; konum/sonuç/RNG zorlanmadı. `planSimulationBoxDefence` seçimi:

| Oyuncu | Konum | Gerçek kale uzaklığı | Sonuç |
|---|---|---:|---|
| Kornerci home-LW | 52,169 / -33,865 | 33,866 m | Markaj hakkı kullanılıyor |
| home-LCM | 44,061 / 8,082 | 11,685 m | İkinci markaj hakkı kullanılıyor |
| Asıl alıcı home-ST | 41,597 / 0,031 | 10,904 m | Markaj listesinde yok |

Neden: `box-defending.js` hem uygun alıcı filtresinde hem sıralamada yalnız x farkını kullanıyor. Köşedeki kornerci kale çizgisine yatayda 0,331 m yakın görünüyor; y uzaklığı yok sayılıyor. Sınır mevcut `receiverDistance:23`, markaj sayısı 2. Bu nedenle gerçek merkez alıcısı listeden düşüyor. Savunmacıların seçimi için mevcut planlama geri çağrısı kullanıldı; diğer öncelikli rollerin tükettiği oyuncular liste sırasının bu hatasını değiştirmez.

Bu karar hatası, önceki kovalama hedefi ve kaleci hazırlığı tahminlerinden ayrıdır. Gol artışının ne kadarını giderdiği henüz ölçülmedi; tek kusurun bu olduğu iddia edilmez.

## Kırmızı kabul ve hazır öneri

`tests/reproductions/corner-mark-priority.cjs`: aynı gerçek pozisyonun geometrik aynalarıyla iki yön × iki kanatta dört başarısız kabul; her defasında yanlış `home-LW, home-LCM` listesi. Normal orta dışı davranış karşı örneği başarılı. Aynalar yalnız saf seçim kabulünde kullanılır; doğal kariyer sıklığı kanıtı sayılmaz.

`corner-mark-priority-proposed.patch` yalnız gerçek cross uçuşunda uzaklığı iki boyutlu ölçüp aynı ölçüyle sıralamayı önerir. Mevcut 23 m değeri ve iki markaj hakkı korunur; diğer top türlerinde eski seçim korunur. Patch sıfır bağlamlıdır; incelenebilir ama uygulanmadı ve çözüm diye sunulmaz. Ürün kaynakları değişmedi.

Önerilen doğrulama sırası: mevcut kırmızı kabul → aynı tek korner → 901/731/42 küçük karşılaştırma → ancak düzelme görülürse geniş ölçüm. Servisi kapatma, gol katsayısı veya zorunlu kayıp yoktur.

## Neden uygulanmadı?

İlk kullanıcı talebinde her bağımsız kabul için en fazla iki çözüm yaklaşımı vardı. G1'in iki ürünü başarısız olup geri alındı. Bu öneriyi uygulayıp doğrulamak üçüncü deneme olur; teşhis, ad değiştirme veya alt madde açma yoluyla bütçe yenilenmez. Somut patch ve kırmızı kabul, tek ek deneme için kullanıcıya sunulur. Main'e merge veya yayın yapılmadı.

Veri: [markaj planı](measurements/goal-regression/corner-mark-plan.json). Geçmiş: [G1 günlüğü](goal-regression-progress.md).

Tanı teslim kontrolü: Node 22.23.4 lint başarılı; test:fast 586 başarılı, 1 mevcut atlama, ayrı performans 5/5. Yeni dört kırmızı markaj kabulü ayrı yeniden üretme dosyasındadır; bu sonuçlar kusurun düzeldiği anlamına gelmez.

## Ek onay sonrası sonuç

Kullanıcı “Dene ve devam et” diyerek tek ek denemeyi onayladı; G1 toplamı 3/3. Önerilen dar fark uygulandı. Eski kırmızı test varsayılan `tests/match-sim-corner-mark-priority.test.cjs` dosyasına taşındı; dört yön/kanat kabulü, normal top karşı örneği ve kayıt/devam 6/6 geçti. Aynı doğal kornerde ilk kontrolde savunmacı mesafesi 4,128585→1,753223 m; şut/kurtarışla devam etti. Üç seed 43→28 gol; aynı 50 seed ortalaması 16,92→10,30. Bu kısmi başarıdır; main 2,76, referans karşılaştırması hâlâ başarısız. Markaj düzeltmesi tutuldu; dördüncü yaklaşım/PR/merge/yayın yok. [Güncel rapor](goal-regression-report.md).
