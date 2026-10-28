# Faz 4 — Denge 1

28 Ekim 2026 · Node 22.23.4 · Taban `68f055f` · Dal `feat/match-sim-balance`. Sürüm 7.14.0 korunur. Eski motor, kariyer, 3D ve altın kayıtlar kapsam dışıdır.

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
