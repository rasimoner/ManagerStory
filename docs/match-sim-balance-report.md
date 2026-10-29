# Faz 4 — Denge 1

28–29 Ekim 2026 · Node 22.23.4 · Taban `68f055f` · Dal `feat/match-sim-balance`. Sürüm 7.14.0 korunur. Eski motor, kariyer, 3D ve altın kayıtlar kapsam dışıdır.

## Ayardan önce teşhis

Önce rapor düzeneğinin yüzdelik, dilim sınırı ve aynı atakta üç saniyelik ikinci şut testleri kırmızı çalıştırıldı. Ardından yalnız olaylara tanı alanları eklendi; fizik ve RNG sırası değişmedi. `npm run sim:report -- --output docs/measurements/match-sim-balance-before.json` ile **50 ayrı tohum** ölçüldü. İlk beş eski tohum 901/731/42/2026/508, sonra artan pozitif tamsayılar; tekrar eden 42 çıkarılır. Her maç 54.000 gerçek adım, iki 4-2-3-1, Normal pres/hat/tempo ve Dengeli pas/mentalitedir. Başlangıç JSON'u ayarlardan önce kaydedildi.

- Ortalama **7,34 gol, 38,30 şut, 13,56 isabet, 6,89 xG**; ağırlıklı xG/şut **0,180**, kurtarış **%45,87**. Gol medyanı 7, P10–P90 4–11. Maçların %80'i 5+ gollü; golsüz maç yok.
- **417/1.915 şut (%21,8) 0–6 m**; buradan 103 gol. Savunmanın genel blok çapaları ile tek markajı kale önü koşularını ve boş dönen top bölgesini yeterince korumuyor. Bu dilimde ortalama xG 0,446. İkinci şutlar 342/1.915 ama yalnız 21/367 gol: gol fazlalığının tamamını ikinci şuta bağlamak yanlış.
- Set kaleci 157 isabetin 91'ini (%58,0), set olmayan 521 isabetin 220'sini (%42,2) kurtarıyor. **94/367 golde kaleci teması var.** Mevcut parmak ucu kuralı yatay hızın %85'ini hâlâ ağ yönüne taşır; temasın önemli bölümü golü önleyemiyor. Uzak ve yetişilebilir şutlarda gerçek çelme yönü ile hazırlık incelenmeli; erişimi sınırsız büyütmek gerekmez.
- 11–18 m: 906 şut, 145 gol; ortalama xG 0,098 ama gerçekleşme %16,0. 18–25 m: 436 şut, 73 gol; xG 0,063 ama gerçekleşme %16,7. Yakın şutta aşırı tahmin ile uzakta eksik tahmin toplam xG'de birbirini gizliyor. Karar silueti 0,72 m ile gerçek 1,2 m blok zarfı da farklı.
- **6.739 müdahalede 4.386 ıska (%65,1)**; ayakta başarı %35,4, kayarak %34,5. 4–6 m/sn taşıyıcıya 435 girişimin 352'si ıska. Hazırlık başında sabitlenen yön, savunmacının hazırlık sırasındaki kendi hareketini hesaba katmıyor; 0,16 m ayak diski ve 0,4–0,5 sn kayma bunu büyütüyor. Çözüm temas sonucunu kura ile seçmek değildir.
- Pas 800,92 / %77,01 / 18,32 m ile temel aralıkta; faul 14,72 ve sarı 2,20. Müdahale iyileştirmesinde pas ve faul dengesi birlikte izlenecek.

Ham önce dosyası her ölçü için ortalama, medyan, P10/P90, skor dağılımı, şut/kaleci/xG/müdahale dilimleri ve maç bazında bütün sayaçları içerir. Kaynak etiketleri son 10 saniyede birden çok olayı işaretleyebilir; toplamları %100 olmak zorunda değildir. Ara pas burada alıcının başlangıç konumundan en az 3 m ileri koşu alanına bırakılan başarılı pas için kaba etikettir; gerçek ofsayt/ara pas modeli iddiası değildir.

İlk hızlı test çalıştırmasında raporla eşzamanlı hız testinin ilk maçı 2.047 ms çıktı (diğerleri 1.551/1.601 ms). Eşik değiştirilmedi; doğrulama boş işlemcide ve Node 22 CI'da tekrar yapılır. Başlangıç raporundaki duvar süreleri eşzamanlı test yükünü içerir; futbol istatistikleri bu yükten etkilenmez.


## Fizik ve karar değişiklikleri

1. Canlı top savunulan kaleye 35 m yaklaşınca blok 18 m boyunca kademeli daralır: boy 32→24 m, en 40→30 m, ortak hedef zarfı 38×44→30×38 m. İki savunmacı ceza sahasındaki alıcıları kale tarafından izler; positioning daha yakın doğru markaj hedefi verir. Bir oyuncu penaltı noktası çevresinde dönen top alanını tutar. Hız, ivme ve dönüş sınırları korunur; eski topsuz tekrar grafiği ayrı kalır.
2. Karar ve fizik artık aynı `shooting.blockRadius=0,72 m` değerini kullanır. 1,2 m pas/serbest top kontrol zarfını hızlı şuta da uygulamak, yakın savunmacıyı 2,4 m genişliğinde duvar yapıyordu. Karar siluetini 1,2 m'ye büyüten ilk aday şutları fazla bastırdığı için korunmadı. Aynı yarıçapın hem karar hem gerçek temas için kullanılması sentetik testle korunur.
3. Mesafe/açı xG eğrisi ve örtülme cezası birlikte değişti. Örtülen açıya ağır cezanın iki kez uygulanması kaldırıldı. Şut diğer seçeneklerle karşılaştırılır; bırakırken değeri tamamen düşmüşse yeni seçenek aranır. Vision/composure güvenli pası görmeyi, finishing/composure şut tercihi ve uygulamayı etkiler. Gol sayısı veya maç skoru karar hesabında okunmaz.
4. Kalecinin normal/set gövde ve açılmış kol yarıçapı 0,95/1,15 m; tepki `0,16 + 0,20·(1−reflexes/100)` sn, set değilse +0,08 sn. Plonjon hızı/azami ek uzanma korunur. Parmak ucunda ileri hız `0,32·zorluk`, yana itki hızın 0,60'ıdır; eski %85 ileri hız topu çoğunlukla ağ yönünde bırakıyordu. Yakın ve ters konumdaki şutlarda erişememe sürer. Hiçbir temas için kurtardı/gol zarı yoktur.
5. Müdahale, yuvarlanmış temas adımına göre topu ve taşıyıcıyı öngörür. Kontrollü taşıyıcının mevcut sür/pas/şut niyeti, fren ve dönüşü aynı hareket integratörüyle ilerletilir. Ayak doğrultusu hazırlık sonundaki gerçek savunmacı konumundan sabit öngörü noktasına kurulur. Etkin süpürme yarıçapı 0,36 m, bacak zarfı 0,30 m; uzanma mesafeleri 1,85/3,10 m korunur. Bekleme 8→5 sn. Bunlar fiziksel erişim ve zamanlama değerleridir; başarı yüzdesi değildir.
6. Topa ilk değmek, devamındaki tehlikeli bacak temasını otomatik yasal yapmaz. Aynı ayak parçasında daha sonra gerçek bacak kesişimi varsa kaymada 9, ayakta 10 m/sn üzerindeki devam teması fauldür. Sonuç kaydındaki `bodyContact` bu ikinci kesişimi gösterir. Ölçümde faullü top teması ile yasal kazanma/sekme ayrı raporlanır.

Son tablo tamamlanana kadar ara adaylar nihai denge olarak değerlendirilmez. Fiziksel kontroller golün önce şutunu, faulün önce temasını, deterministik tekrarı ve eski topsuz koordinat özetini korur. `npm run sim:report -- --strength --output <dosya>` güç deneylerini her 50 maçta dosyaya checkpoint eder; `status:complete` olmayan çıktı tam deney sayılmaz.
