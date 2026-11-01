# Gol artışı — iki ek yaklaşımın teslimi

Sonraki devamda 6–7. yaklaşımlar da genel kabulü geçmedi ve ürün farkları geri alındı: [güncel tanı ve devam promptu](goal-regression-attempts-six-seven.md). Bu belgedeki 7.19.5 ürün ve 50/20 ölçümleri değişmedi; geçmiş toplamı 7/7 oldu.

Dal `fix/3d-goal-regression`. Taban ürün `191ce72cec788928dcf881ab4d121200151f5198`, tanı `fbc51b8ed80efc1919782db4a172dcc59af4ae07`; main `d86ac72de6bc4677a2357fc516c06e1ffeceed48` yeniden doğrulandı. Node 22.23.4. **7.19.5 yayımlanmamış adaydır.** Kullanıcı “Tamam denemelere devam edebilirsin” diyerek devamı yetkilendirdi; bu turdaki iki ek yaklaşım eski sayacı sıfırlamadan G1 **4–5 / toplam 5/5** olarak kaydedildi.

İki görev kusuru düzeldi, genel denge kabulü açık kaldı. Önceki markaj düzeltmesi korundu. İlk iki başarısız yama yeniden uygulanmadı; önceki oturumların sürüm/yayın hazırlıkları değiştirilmedi.

## Kesin bulgu ve değişen davranış

- Kaleci, ulaşamadığı ortada son ufuk noktasını gerçek karşılama sanıp `intercept` görevi alıyordu. `keeperFollowsFreeBall` bu görevi kabul ederek normal konumlanmayı atlıyordu. Ortak mevcut tahmin şimdi hedefle birlikte erişilebilirlik bilgisini verir; yalnız cross uçuşunda geçersiz kaleci görevi normal konumlanmaya döner. Hedef, hız, erişim ve kurtarış sonucuna katsayı eklenmedi.
- Yüksek orta sırasında pres/cover ataması, merkez alıcısının yakın stoperini markajdan koparıyordu. Ceza alanına gerçek cross uçuşunda markaj önce planlanır; gerçek topa ulaşma ortak ball-chasing yolundadır. Normal paslar ve eski cross bayrağı olmayan kayıtlar eski görev sırasını kullanır.

Diğer saha oyuncularının fallback hedefi, temas çözücüsü ve kaleci tutma/iniş/kalkış/dağıtım zinciri değişmedi. Yeni kalıcı alan yok; kayıt biçimi/göç gerekmedi. Saf tahmin RNG tüketmez; pozisyon ve sonuçlar sonraki gerçek kararlarla değişir.

Aynı doğal seed 42 / tick 467 checkpoint'i ileri oynatıldı. Eski akışta home-CAM ilk kontrol→şut→gol yapıyordu. Yeni akışta away-RCB, **47,783895 sn / 1,80 m** yüksekte gerçek kafa pası teması yapıyor; uçuşlar aynı temas noktasında birleşiyor ve oyun sürüyor. Temas/başarı/gol zorlanmadı. Bu laboratuvar senaryosudur; özgün kullanıcı videosunun veya kariyer kaydının seed'i değildir. [Olay kaydı](measurements/goal-regression/cross-roles-final-corner.json).

## Deneme sonuçları

| G1 yaklaşımı | Yerel kabul | 901/731/42 golleri | Karar |
|---|---|---|---|
| Önceki markaj adayı | 6/6 | 11/5/12 = 28 | Önceki başarılı fark korundu |
| 4: yalnız kaleci görevi geçerliliği | 8/8 | 13/9/6 = 28 | Genel gol artışı azalmadı; tek başına başarı sayılmaz |
| 5: orta sırasında görev önceliğini birlikte ele alma | Kaleci 8/8, stoper 6/6; gerçek temasla 15/15 | 5/9/6 = 20 | Kanıtlanan görev kusurlarını gideren kısmi başarı tutuldu |

4. yaklaşım öncesinde 5 kırmızı / 3 başarılı kontrol; 5. yaklaşım öncesinde 4 kırmızı / 2 başarılı kontrol vardı. Başarısız 4'ün yaması `tests/reproductions/goal-keeper-role-attempt4.patch` içinde korunur; aynı G1 alt maddeye taşınarak sayaç yenilenmedi. Son aday, kaleci geçerliliğiyle stoper rol sırasını birlikte içerir. Altıncı yaklaşım uygulanmadı.

Varsayılan yeni testler `match-sim-keeper-cross-role.test.cjs` ve `match-sim-cross-mark-role.test.cjs`: iki hücum yönü/iki kanat, eski görev iptali, ulaşılabilir orta, normal serbest top, kayıt/devam ve gerçek hava teması. Ayna senaryolar doğal kariyer sıklığı kanıtı değildir. İlgili şut/top/orta/kaleci sınırı/taşıma ve dört maç süresi testleri ayrıca **79/79** geçti; bunlar yeni 15 testten ayrıdır. Teslim kontrolleri Node 22.23.4: lint temiz; test:fast 607 başarılı, 1 mevcut atlama; ayrı performans 5/5; build başarılı. [Kontrol kaydı](measurements/goal-regression/cross-roles-final-checks.json).

## Ölçülen denge etkisi

**Aynı 50 tohum / 54.000 fizik adımı**, maç başına ortalama. Bu sözleşme doğal kısa maçın gol ortalamasıyla birleştirilmez.

| Sayaç | Main | Önceki markaj adayı | Son aday |
|---|---:|---:|---:|
| Gol | 2,76 | 10,30 | 8,62 |
| Şut | 17,64 | 38,48 | 35,62 |
| Pas | 798,64 | 734,76 | 742,80 |
| Top kazanma | 143,52 | 126,82 | 125,82 |
| Faul | 25,88 | 31,10 | 30,60 |
| Kurtarış | 6,72 | 9,54 | 9,86 |
| Kırmızı kart | 0,44 | 2,50 | 2,30 |
| Maçların ortalama kurtarış yüzdesi | 69,82 | 48,06 | 53,38 |

Gol önceki adaya göre %16,3 azaldı; ilk 16,92 gollü adaya göre toplam azalma %49,1. Son medyan 8, p10/p90 5/13. Tohum eşleriyle karşılaştırmada gol 31 maçta azaldı, 4 maçta aynı kaldı, 15 maçta arttı. Main'e göre gol hâlâ 3,12 kat; kart/fırsat/gol artışı giderilmiş sayılmaz.

**Aynı 20 doğal kısa laboratuvar maçı / 420 saniye**, slot bazında eşit özellikler, iki devre, workload kapalı:

| Sayaç | Main | Önceki markaj adayı | Son aday |
|---|---:|---:|---:|
| Gol | 0,55 | 0,80 | 1,10 |
| Şut | 6,80 | 7,80 | 8,50 |
| Pas | 72,45 | 72,80 | 70,20 |
| Top kaybı | 29,50 | 30,20 | 28,50 |
| Faul | 1,95 | 2,05 | 2,40 |
| Kurtarış | 2,35 | 2,45 | 2,75 |

Kısa maçta gol 1 tohumda azaldı, 14 tohumda aynı kaldı, 5 tohumda arttı. Gol ve faul artışı olumsuz etkidir; gizlenmez. “Denge değişmedi” denmez. Kısa serinin top kaybı, yeniden başlatmalardaki sahiplik değişimini de içerir; uzun serideki top kazanmayla aynı ölçü değildir. [Karşılaştırma ve küçük denemeler](measurements/goal-regression/cross-roles-final-comparison.json), [50 tohum/dağılım](measurements/goal-regression/cross-roles-final-50-summary.json), [20 kısa maç](measurements/goal-regression/cross-roles-final-short.json).

Mevcut referansla karşılaştırma seed 901'de **1–0 yerine 3–2** nedeniyle hâlâ başarısız. Referans/golden/eşik/lint tabanı/CI büyütülmedi veya yenilenmedi. İlk karşılaştırma zaten kapıyı durdurduğu için 400 ek güç maçı, beş süre taraması ve tam paket/smoke yeniden başlatılmadı. Başarılı odaklı/hızlı kontroller zorunlu bütün kapıların yeşil olduğu anlamına gelmez. **PR oluşturulmadı; merge ve yayın yapılmadı.**

## Görsel kontrolün durumu

Bu ortamda kurulu Chromium bulunmadı. Tek `npx playwright install chromium` komutu boş/bozuk ZIP hatasıyla başarısız oldu: `End of central directory record signature not found`. Komutun kendi beş otomatik indirme denemesi kullanıcının iki altyapı girişimi sınırını aştı; bu sapma gizlenmez. Komut tekrar başlatılmadı. Yeni WebGL görüntüsü/video üretilemedi; eski 3D kayıtları yeni fizik adayı için yeniden doğrulanmış sayılmaz. Fiziksel iPhone/Safari testi yapılmadı.

Telefon kontrol listesi, yayın/görsel inceleme için çalışan aday hazır olduğunda: dikey/yatay kadraj; kornerde merkez markajı; kalecinin ulaşılabilir ortayı karşılaması ve ulaşamayacağı topu yanlış hedefe kovalamaması; normal serbest top/ayakla taşıma; kurtarıştan tutma/iniş/kalkış/dağıtıma geçiş; kayıt/devam ve 2D↔3D saat/skor sürekliliği. Bu liste henüz tamamlanmış kabul değildir.

## Açık G1 için dar devam promptu

```text
ManagerStory fix/3d-goal-regression dalının güncel HEAD'ini, docs/goal-regression-continuation-report.md ve docs/goal-regression-progress.md'yi oku. 7.19.5 yayımlanmamış adaydır. G1 geçmişi 1–5 korunur: 1 ve 2 geri alındı; 3 markajı düzeltti; 4 tek başına toplam golü azaltmadı; 5 kaleci görev geçerliliği ve orta anındaki stoper markajını birlikte düzeltti. Yeni 15 varsayılan test ve önceki markaj farkını koru. Aynı 50 tohum gol 16,92→10,30→8,62, main 2,76; 20 kısa maçta son değişim 0,80→1,10 gol ve 2,05→2,40 faul. Genel kabul açık. Yalnız farklı doğal bir pozisyonda kalan yakın şut/gol zincirini, ilk kontrolü ve kart eksilmesinin payını salt okuma iziyle daralt. Eski sayacı/adı sıfırlama; yeni ürün yaklaşımından önce somut kırmızı kabul ve dar öneri hazırla. Önceki fallback/kaleci iniş tahmini yamalarını gerekçesiz tekrarlama. Gol kotası, zorunlu kayıp, servisi kapatma veya golden/ref/eşik/CI değişikliğiyle başarı üretme. Diğer özel hareket/perf/tekrar işleri yok; zorunlu kapılar geçmeden PR, görsel onay olmadan merge/yayın yapma.
```

## Açık görsel altyapı için dar devam promptu

```text
ManagerStory 7.19.5 adayında yalnız WebGL kanıt altyapısını ele al. Node 22 ve mevcut Playwright sürümünü koru. Önce kurulu/çalışan Chromium var mı doğrula. Önceki tek playwright install chromium komutu bozuk/boş ZIP alıp kendi içinde beş kez indirmeyi denedi; aynısını körlemesine tekrarlama. Yeni denemelerin otomatik tekrarlarını da sayarak aynı altyapı engeli için en fazla iki girişim uygula. Kaynak fiziğini, maç seed'lerini, test eşiklerini veya CI'yı değiştirme. Gerçek izole korner kaydını ve ayrı normal kariyer akışını dikey/yatay Chromium WebGL ile kaydet; bunları fiziksel Safari testi diye sunma. Çalışmazsa tam hata, kullanılan yol ve gereken altyapıyı raporla; merge/yayın yapma.
```
