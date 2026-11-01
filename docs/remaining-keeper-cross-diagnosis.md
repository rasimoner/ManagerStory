# Kalan gol artışı — kaleci görev çatışmasının tanı geçmişi

Ürün commit'i `191ce72cec788928dcf881ab4d121200151f5198`, yerel aynı ağaç `f4c3b34`; main `d86ac72`. İki uzak dal başı yeniden doğrulandı. Node 22.23.4. Bu çalışma yalnız tanı ve kırmızı kabul ekler. `src/`, 7.19.4 aday metası, markaj düzeltmesi, referans/golden/eşik/CI değişmedi. **G1 sayacı 3/3; dördüncü ürün yaklaşımı uygulanmadı.**

## Doğal kayıtta ne oldu?

Seed 42, normal `createLabScenario` girdisi, ilk gol. Önceki seed 901 kornerinden farklıdır. Müdahale, top/oyuncu konumu veya RNG zorlanmadan ilerletildi; ilk golün öncesinde faul, kart ve oyuncu eksilmesi yoktur. Bu vaka kalan sorunun yalnız kırmızı kart eksilmesine bağlanamayacağını gösterir; tüm tohumlardaki nedensel payını ölçmez.

| Fizik zamanı | Olay / karar |
|---|---|
| 45,5 | home-ST korneri home-CAM'e gerçekten servis eder. |
| 45,6–46,7 | away-RCB, home-CAM'i merkezde doğru marke eder. |
| 46,7→46,8 | `updateOffBallDecisions`, stoperin markajını `cover` yapar; hedef 48,566 / −9,867 olur. Top yaklaşık 7,3 m yüksektedir. |
| 46,8→46,9 | Kaleci önce `keeper` görevindedir. `updateSimulationBallChasers`, onu `intercept` yapıp 25,549 / 34 hedefini verir. |
| 47,3 | Stoper de markajdan ayrı olarak uzak `intercept` hedefi alır. |
| 47,873050 | home-CAM topa 0,832520 m yüksekte gerçek ilk kontrol yapar. |
| 48,4 | Gerçek şut. |
| 49,064706 | Gol. |

Kaleciye karşılama görevi verilmeden önce mevcut hareket/erişim tahminiyle 5 saniyelik yol tarandı. Mevcut 0,25 saniyelik adımda da, 0,01 saniyelik daha sık analitik kontrolde de saha içinde uygun yükseklikte ulaşılabilir nokta bulunmadı. Sık taramada en iyi `arrival − ballTime` farkı **+1,490766 sn**; pozitif fark kalecinin geç kalacağını gösterir. Reaksiyon süresi mevcut motorla aynı biçimde düşüldü; daha iyimser bu ölçütte de yetişemiyor. Bu, gerçek ikinci bir simülasyon veya temas sonucu değildir; mevcut `predictSimulationBall` ve `simulationPlayerArrival` fonksiyonlarının saf tahminidir.

## Kesin çağrı zinciri

`stepSimulation` → `updateOffBallDecisions` önce kaleciyi normal `keeper` görevine yerleştirir. Ardından `prepareBallMovement` → `updateSimulationBallChasers`:

1. `nearestBallChasers`, mevcut topun yalnız yatay uzaklığıyla oyuncu seçer; kaleci de adaylar arasındadır.
2. `simulationInterceptTarget`, ulaşılan bir karşılama noktası bulamayınca son ufuk noktasını saha sınırına kırpıp döndürür. Dönüş değeri gerçek karşılama ile bu fallback'i ayırt etmez.
3. `chaseSimulationBall`, bu hedefi yine de `intercept` görevi olarak atar.
4. Sonra `prepareSimulationKeepers` → `keeperFollowsFreeBall`, `intercept` görevini geçerli karşılama sayıp erken döner; normal konumlanma çalışmaz, kaleci `rush` moduna girer.

Sadece `updateOffBallDecisions` çağrısı kaleciyi bozmuyor. Ayrı aşama çağrılarıyla değişimin `updateSimulationBallChasers` içinde olduğu doğrulandı. Konumlandırıcıdaki önceki iniş tahmini yamasını tekrar uygulamak bu erken dönüş yolunu tek başına düzeltmez.

Stoper için aynı “erişilemez” hükmü **verilmez**: 0,25 sn örneklemede fırsat görünmezken daha sık tarama ulaşılabilir bir pencere bulur. Dolayısıyla kaleciye yönelik bir erişim kuralını bütün saha oyuncularına körlemesine yaymak yanlış olur. Stoperin cover/markaj devri ayrı gözlemdir; bu tanıda düzeltilmedi veya bağımsız yeni sayaç açılmadı.

## Kırmızı kabul ve iki koruyucu örnek

`tests/reproductions/remaining-keeper-cross-checkpoint.json` gerçek tick 468 checkpoint'idir; tüm maçı yeniden koşturmadan karar sınırını üretir. `remaining-keeper-cross-role.cjs`:

- Doğal ve değişiklik yapılmamış kayıtta kaleci ulaşamayacağı ortayı karşılamak için normal görevini bırakmamalı: **1 kırmızı**. Gerçek hata: `intercept`, hedef 25,548657 / 34.
- Ulaşılabilir orta için kaleci çıkışına izin verilmeli: **başarılı**.
- Ulaşılabilir yerdeki serbest topu ayakla kovalama sürmeli: **başarılı**.

Son iki karşı örnek top konumunu açıkça değiştirir; doğal kariyer kanıtı değildir. Test varsayılan CI dışında tutuldu. Çalıştırma:

```bash
node --experimental-vm-modules --disable-warning=ExperimentalWarning --test tests/reproductions/remaining-keeper-cross-role.cjs
```

Bu komut bilinçli olarak 1 başarısız / 2 başarılı üretir. Varsayılan CI'nın test listesi değiştirilmedi. [Olay, aşama ve tahmin kaydı](measurements/goal-regression/remaining-keeper-cross-role.json).

## İncelemeye hazır dar öneri

Yalnız gerçek orta uçuşunda **kaleciye karşılama görevi verme kararını**, sahanın içinde fiziksel olarak erişilebilir bir noktaya bağla. Karşılama hedefi ile fallback kovalamayı ayırt eden sonuç üret; geçersiz hedef kalecinin normal konumlanmasını devreden çıkarmasın. Önceden verilmiş `intercept` görevinin geçerliliği bittiğinde de eski rush görevini sürdürme. Normal serbest top, gerçek ulaşılabilir orta ve ayakla taşıma yolları korunmalı. Değişiklik atış/kurtarış sonucunu veya kalecinin erişimini değiştirmemeli.

Bu, başarısız 1. yaklaşımın “her oyuncuya daha yakın fallback hedefi” veya 2. yaklaşımın “kaleciye iniş alanı hedefi” değildir. Yine de aynı **G1** kabulünün yeni ürün yaklaşımı olacağı için 3/3 sayacı altında uygulanmadı. Yeni ad/alt özellik yoluyla bütçe yenilenmez. Ürün etkisi kanıtlanmış çözüm veya bütün gol artışının nedeni diye sunulmaz.

Bir ek ürün denemesi ayrıca yetkilendirilirse sıra: kırmızı kabul → iki hücum yönü ve iki kanat → erişilebilir orta/normal serbest top/ayakla taşıma/kayıt-devam → aynı 901/731/42 → yalnız düzelme varsa aynı 50 tohum ve 20 kısa maç. Daha sık örnekleme bulgusunu ayrı ürün değişikliğine dönüştürme; önce kaleci görev geçerliliğini dar tut. Bu tanıda geniş ölçüm, yeni WebGL video, sürüm artışı, PR, merge veya yayın yapılmadı.

Teslim kontrolü: Node 22.23.4 lint temiz; varsayılan test:fast 592 başarılı, 1 mevcut atlama; ayrı performans 5/5. Bilinçli kırmızı test bu sayılara dahil değildir. Ürün kaynak ağacı `bc72c24cb318c1abfbe35138bc4ea2c3b977b5a5` aynı kaldı.

## Devam izni sonrasında

Kullanıcı devam denemelerini yetkilendirdi. 4. yaklaşımda bu kusurun yerel kabulleri geçti, üç tohum toplam golü azalmadı (28→28); bağımsız genel başarı sayılmadı. 5. yaklaşımda orta anındaki stoper görev önceliğiyle birlikte ele alındı; 50 tohum 10,30→8,62 gol, kısa seri 0,80→1,10 oldu. Genel kabul açık, G1 5/5. Test şimdi varsayılan `tests/match-sim-keeper-cross-role.test.cjs` dosyasında 8/8; eski kırmızı komut tarihsel kayıttır. [Güncel rapor](goal-regression-continuation-report.md).
