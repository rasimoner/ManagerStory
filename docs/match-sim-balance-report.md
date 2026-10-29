# Faz 4 — Denge 1: gol, kaleci, müdahale ve güç farkı

**28–29 Ekim 2026 · Node 22.23.4 · Taban `68f055f` · Dal `feat/match-sim-balance` · Sürüm 7.14.0 korunur.** Eski motor, kariyer, 3D ve altın kayıtlar değiştirilmedi. Laboratuvar: https://rasimoner.github.io/ManagerStory/lab.html.

## Ölçüm düzeneği ve kapsam

Önce yüzdelik/dilim/ikinci şut testleri kırmızı çalıştırıldı; ardından sadece olay tanıları eklenerek ilk 50 maç ölçüldü ve `4d2e901` checkpoint’inde saklandı. Ayarlar bundan sonra değişti. Son rapor çözümlemesiyle başlangıç motoru tekrar çalıştırıldı: **50 maçın bütün skorları ve istatistik sayaçları ilk kayıtla birebir aynı**. Ek tanı alanları fizik veya RNG sırasını değiştirmez.

Tohumlar JSON’daki aynı 50 benzersiz değerdir: 901/731/42/2026/508, ardından artan pozitif tamsayılar; tekrar eden 42 çıkarılır. İki 4-2-3-1, Normal pres/hat/tempo, Dengeli pas/mentalite; 22 oyuncu, 54.000 gerçek 0,1 sn adım = 90 dk. Derleme, snapshot ve rapor çözümlemesi zaman dışında; olay üretimi içeridedir. Ham dosyalar `docs/measurements/match-sim-balance-before.json` ve `match-sim-balance-after.json`. Aynı komut: `npm run sim:report -- --strength --output <dosya>`. Deney bitmeden `status:running-strength` yazılır; yalnız `complete` tam sonuçtur.

Dağılımlar maç ortalaması, medyan, doğrusal enterpolasyonlu P10/P90’dır. Kurtarış ve xG/şut ana tabloda bütün şutlar üzerinden ağırlıklıdır; ham JSON ayrıca maç başına oranların dağılımını taşır. Faullü top teması, yasal müdahale başarısına girmez. Olayın `won/loose` alanı topa fiziksel teması, `bodyContact` devam bacak temasını korur; dilim tablosunda dört ayrık sonuç ayrıca gösterilir.

## Önce / sonra: 50 maç

| Ölçü (iki takım toplamı) | Önce | Sonra | Hedef |
| --- | --- | --- | --- |
| Gol | 7,34 | 2,44 | 2,2–3,4 |
| Şut | 38,30 | 18,14 | 18–30 |
| İsabetli şut | 13,56 | 9,14 | 6–11 |
| Toplam xG | 6,89 | 2,34 | Golle tutarlı |
| xG / şut | 0,180 | 0,129 | 0,09–0,14 |
| Kurtarış % | 45,87 | 73,30 | 62–76 |
| Blok | 14,88 | 4,04 | 3–8 |
| Yasal kazanma + sekme % | 35,08 | 58,15 | >50 |
| Faul | 14,72 | 10,62 | 16–26 |
| Sarı | 2,20 | 2,68 | 2–5 |
| Kırmızı | 0,12 | 0,22 | Sabit hedef yok |
| Pas | 800,92 | 776,02 | 750–1.000 |
| Pas isabet % | 77,01 | 77,32 | 75–88 |
| Pas mesafesi m | 18,32 | 19,90 | 15–20 |

| Toplam gol / maç | Önce % | Sonra % |
| --- | --- | --- |
| 0 | 0,00 | 6,00 |
| 1 | 0,00 | 32,00 |
| 2 | 2,00 | 26,00 |
| 3 | 4,00 | 16,00 |
| 4 | 14,00 | 2,00 |
| 5+ | 80,00 | 18,00 |

Beraberlik: **%10,00 → %24,00**. Golsüz ve 5+ oranları aynı 50 maçın tamamından hesaplanır; tohum çıkarılmadı.

### Yayılım

#### Önce

| Ölçü | Ortalama | Medyan | P10 | P90 |
| --- | --- | --- | --- | --- |
| Gol | 7,34 | 7,00 | 4,00 | 11,00 |
| Şut | 38,30 | 36,50 | 27,00 | 50,00 |
| İsabet | 13,56 | 13,00 | 10,90 | 18,00 |
| xG | 6,89 | 6,74 | 4,31 | 9,82 |
| xG/şut (maç oranı) | 0,182 | 0,180 | 0,136 | 0,223 |
| Kurtarış % (maç oranı) | 46,15 | 46,61 | 28,49 | 66,67 |
| Blok | 14,88 | 12,00 | 5,00 | 27,20 |
| Yasal müdahale % | 35,08 | 34,33 | 28,06 | 43,20 |
| Faul | 14,72 | 14,00 | 10,00 | 21,30 |
| Sarı | 2,20 | 2,00 | 0,90 | 4,00 |
| Pas | 800,92 | 801,00 | 777,00 | 822,10 |
| Pas isabet % | 77,01 | 76,78 | 74,49 | 79,81 |
| Pas mesafesi m | 18,32 | 18,32 | 17,75 | 18,90 |
| 90 dk / ms | 1654,49 | 1279,42 | 1178,56 | 2203,75 |

#### Sonra

| Ölçü | Ortalama | Medyan | P10 | P90 |
| --- | --- | --- | --- | --- |
| Gol | 2,44 | 2,00 | 1,00 | 5,00 |
| Şut | 18,14 | 16,50 | 11,00 | 25,30 |
| İsabet | 9,14 | 9,00 | 4,90 | 14,00 |
| xG | 2,34 | 2,05 | 1,06 | 3,75 |
| xG/şut (maç oranı) | 0,128 | 0,120 | 0,083 | 0,186 |
| Kurtarış % (maç oranı) | 72,31 | 78,17 | 49,55 | 90,23 |
| Blok | 4,04 | 2,00 | 0,90 | 5,10 |
| Yasal müdahale % | 58,15 | 58,14 | 52,38 | 63,40 |
| Faul | 10,62 | 10,00 | 7,00 | 14,00 |
| Sarı | 2,68 | 2,00 | 1,00 | 4,10 |
| Pas | 776,02 | 774,00 | 745,80 | 806,40 |
| Pas isabet % | 77,32 | 77,27 | 75,22 | 79,99 |
| Pas mesafesi m | 19,90 | 19,85 | 19,10 | 20,64 |
| 90 dk / ms | 1285,65 | 1171,42 | 1127,19 | 1841,84 |

## Teşhis ve değişiklikler

**Gol fazlalığı tek başına ikinci şutlardan gelmiyordu.** Başlangıçta 1.915 şutun 417’si 0–6 m’den, 367 golün 103’ü bu bölgedendi. Genel blok ve tek markaj, yakın koşuları ve dönen top bölgesini yeterince tutmuyordu. Canlı top kaleye 35 m yaklaşınca blok 18 m boyunca kademeli 32×40’tan 24×30 m’ye, ortak hedef zarfı 38×44’ten 30×38 m’ye daralır/derinleşir. İki savunmacı alıcıları kale tarafından izler; positioning daha yakın doğru hedef verir. Bir oyuncu penaltı noktası civarını tutar. Oyuncu hedefe aynı hız, ivme ve dönüşle gider; eski topsuz tekrar değişmez.

**Karar ve blok zarfı farklıydı.** Şut kararı 0,72 m, fizik ise 1,2 m kontrol diski kullanıyordu. İkisini 1,2 m yapan aday düşük değerli şutu azaltırken şutları aşırı bastırdı. Son kaynakta hızlı şut için **tek `shooting.blockRadius=0,72 m` hem izdüşümde hem fiziksel çarpışmada** kullanılır. Pas/serbest top kontrolü 1,2 m kalır. Bu ayrım, topu uzanarak kontrol etme ile hızlı şuta dikilen ayak/gövde duruşunu ayırır; iki hesap birbirine ters konuşmaz.

**Kalecide asıl kayıp yalnız erişim değildi.** Başlangıçta 94 golde kaleci dokunmuştu. Eski parmak ucu saptırması yatay hızın %85’ini hâlâ ağ yönüne bırakıyordu. Şimdi ileri bileşen `0,32·zorluk`, yana itki hızın 0,60’ıdır. Normal/set gövde ve açılmış kol zarfı 1,15/1,25 m; tepki `0,16 + 0,20·(1−reflexes/100)` sn, set değilse +0,04 sn. Plonjon hızı ve 2,65 m azami ek uzanma korunur. Temas olup golü önlemeyen top kurtarıştan düşer; kurtardı/gol zarı yoktur.

**Müdahale ıskasında sabitlenen yön yanlış çıkış noktasından kuruluyordu.** Hazırlık süresi gerçek temas adımına yuvarlanır. Serbest top aynı fizik, kontrollü taşıyıcı mevcut sür/pas/şut niyeti ile aynı ivme/fren/dönüş integratörü kullanılarak öngörülür. Ayak, hazırlık sonundaki gerçek savunmacı konumundan bu sabit öngörü noktasına uzanır; topa kilitlenmez. Etkin süpürme yarıçapı 0,36 m, bacak zarfı 0,30 m, bekleme 8→5 sn; uzanma 1,85/3,10 m kalır. Kayarak ıska ayaktan daha yüksektir. Top ilk temas olsa da aynı yol daha sonra gerçekten bacağa giriyorsa kaymada 9, ayakta 10 m/sn üzerindeki devam teması fauldür. Bunlar temas/hız koşullarıdır, başarı veya faul yüzdesi değildir.

**Şut seçimi ve xG birlikte sınırlandırıldı.** Tam örtülmüş veya beklerken değeri kaybolmuş şutta yeniden seçenek aranır. Vision/composure güvenli pası, finishing/composure şut tercihi ve uygulama hatasını etkiler. Örtülen açıya iki kez ağır ceza azaltıldı; mesafe/açı eğrisi ve puan ölçeği JSON’dan değiştirilir. Her sonucu kota veya ayrı zarla seçmek reddedildi. Kaleci durumunu xG’ye daha güçlü bağlayan adaylar 50 maçta şut/gol akışını yeniden bozduğu için kabul edilmedi; yalnız toplam xG’yi güzel göstermek için kötüleşen maç korunmadı.

Bu değişiklikler birlikte 50 tohumda değerlendirildi. Aşağıdaki dağılım farkları her katsayının tek başına nedensel etkisi diye sunulmaz; mekanizmalar önce kırmızı/sonra yeşil sentetik testlerle ayrıca korunur. Bütün ayar sayıları `src/data/match-sim.json` içindedir.

## Şut dilimleri

### Kaleye mesafe / m

| Dilim | Dönem | Şut | İsabet | Gol | Ort. xG |
| --- | --- | --- | --- | --- | --- |
| 0–6 | Önce | 417 | 182 | 103 | 0,446 |
| 0–6 | Sonra | 251 | 111 | 28 | 0,308 |
| 6–11 | Önce | 156 | 66 | 46 | 0,270 |
| 6–11 | Sonra | 129 | 60 | 38 | 0,097 |
| 11–18 | Önce | 906 | 244 | 145 | 0,098 |
| 11–18 | Sonra | 386 | 201 | 50 | 0,055 |
| 18–25 | Önce | 436 | 186 | 73 | 0,063 |
| 18–25 | Sonra | 141 | 85 | 6 | 0,040 |
| 25+ | Önce | 0 | 0 | 0 | — |
| 25+ | Sonra | 0 | 0 | 0 | — |

### Görünen kale açısı / derece

| Dilim | Dönem | Şut | İsabet | Gol | Ort. xG |
| --- | --- | --- | --- | --- | --- |
| 0–15 | Önce | 740 | 185 | 111 | 0,079 |
| 0–15 | Sonra | 117 | 46 | 28 | 0,044 |
| 15–30 | Önce | 660 | 266 | 123 | 0,108 |
| 15–30 | Sonra | 472 | 259 | 42 | 0,052 |
| 45+ | Önce | 436 | 194 | 110 | 0,444 |
| 45+ | Sonra | 260 | 119 | 33 | 0,303 |
| 30–45 | Önce | 79 | 33 | 23 | 0,266 |
| 30–45 | Sonra | 58 | 33 | 19 | 0,144 |

### Vuruş stili — bütün şutlar ayakla

| Dilim | Dönem | Şut | İsabet | Gol | Ort. xG |
| --- | --- | --- | --- | --- | --- |
| drive | Önce | 838 | 317 | 190 | 0,183 |
| drive | Sonra | 377 | 212 | 51 | 0,135 |
| placed | Önce | 1030 | 340 | 159 | 0,178 |
| placed | Sonra | 508 | 238 | 64 | 0,124 |
| chip | Önce | 47 | 21 | 18 | 0,179 |
| chip | Sonra | 22 | 7 | 7 | 0,134 |

### Ayakla hazırlanan / aynı ataktaki dönen top

| Dilim | Dönem | Şut | İsabet | Gol | Ort. xG |
| --- | --- | --- | --- | --- | --- |
| foot | Önce | 1546 | 632 | 338 | 0,181 |
| foot | Sonra | 778 | 433 | 114 | 0,126 |
| rebound | Önce | 369 | 46 | 29 | 0,174 |
| rebound | Sonra | 129 | 24 | 8 | 0,145 |

### İlk / 3 sn içindeki ikinci şut

| Dilim | Dönem | Şut | İsabet | Gol | Ort. xG |
| --- | --- | --- | --- | --- | --- |
| first | Önce | 1573 | 640 | 346 | 0,180 |
| first | Sonra | 782 | 436 | 115 | 0,126 |
| second | Önce | 342 | 38 | 21 | 0,179 |
| second | Sonra | 125 | 21 | 7 | 0,148 |

### Baskı (eşik 0,25)

| Dilim | Dönem | Şut | İsabet | Gol | Ort. xG |
| --- | --- | --- | --- | --- | --- |
| open | Önce | 789 | 291 | 154 | 0,097 |
| open | Sonra | 341 | 191 | 39 | 0,061 |
| pressured | Önce | 1126 | 387 | 213 | 0,238 |
| pressured | Sonra | 566 | 266 | 83 | 0,169 |

### Kaleci set durumu

| Dilim | Dönem | Şut | İsabet | Gol | Ort. xG |
| --- | --- | --- | --- | --- | --- |
| set | Önce | 789 | 157 | 66 | 0,094 |
| set | Sonra | 228 | 72 | 13 | 0,093 |
| unset | Önce | 1126 | 521 | 301 | 0,240 |
| unset | Sonra | 679 | 385 | 109 | 0,141 |

İkinci şut: aynı takımın atağında kurtarış/blok/direkten sonraki 3 sn içinde yeni şut. Rakip kontrolü ve yeniden başlama izi keser; başarısız rakip dokunuşu kontrol sayılmaz. “Dönen top” kökeni aynı atakta daha önce sekme bulunmasını belirtir; 3 sn’lik ikinci şutla birebir aynı etiket değildir. Kafa/vole ve ayak tercihi henüz modellenmediği için varmış gibi dilim uydurulmaz.

## xG kalibrasyonu ve kalan uyumsuzluk

| Tahmin aralığı | Dönem | Şut | Ort. tahmin | Gerçek gol % |
| --- | --- | --- | --- | --- |
| 0–0.05 | Önce | 175 | 0,044 | 12,00 |
| 0–0.05 | Sonra | 384 | 0,040 | 8,33 |
| 0.05–0.1 | Önce | 838 | 0,069 | 15,51 |
| 0.05–0.1 | Sonra | 238 | 0,067 | 15,97 |
| 0.1–0.2 | Önce | 487 | 0,134 | 15,20 |
| 0.1–0.2 | Sonra | 115 | 0,139 | 16,52 |
| 0.2–0.4 | Önce | 136 | 0,280 | 27,94 |
| 0.2–0.4 | Sonra | 60 | 0,309 | 31,67 |
| 0.4+ | Önce | 279 | 0,629 | 37,28 |
| 0.4+ | Sonra | 110 | 0,463 | 12,73 |

Gol−xG maç başına **0,10**; maçlar bağımsız kabul edilirse ortalama farkın yaklaşık %95 aralığı **-0,51…0,72**. Bu aralık modelin her dilimde kalibre olduğu anlamına gelmez. Özellikle orta/düşük xG dilimleri eksik, en yüksek dilim fazla tahmin edebiliyor. Kalecinin yakın yerleşimi, set/ters konumu ve dar açıdaki gerçek uygulama hatasının ayrımı mevcut yaklaşık modelde yeterli değil. **Dilim kalibrasyonu kapanmış sayılmadı**; toplam farkı gizlemek için sonuçlara dokunulmadı.

Mesafe referansları bu işte verilen genel futbol hedefleridir; tek bir konumun evrensel xG’si yoktur. [StatsBomb’un model açıklaması](https://blogarchive.statsbomb.com/articles/soccer/upgrading-expected-goals/) kaleci/savunmacı konumu ve şut uygulamasının ayrı etkisini açıklar. [Opta’nın penaltı örneği](https://theanalyst.com/articles/premier-league-penalties-like-free-goal) yaklaşık 0,78 değeridir; bu motorda henüz gerçek penaltı yoktur. Duran top uygulanmış gibi xG eklenmez.

## Kaleci dilimleri

### Set / set değil

| Dilim | Dönem | İsabet | Kurtarış % | Tuttu/çeldi/saptırdı¹ | Dokundu ama gol | Hiç değemedi² |
| --- | --- | --- | --- | --- | --- | --- |
| set | Önce | 157 | 57,96 | 30/75/66 | 30 | 36 |
| set | Sonra | 72 | 81,94 | 19/36/27 | 0 | 13 |
| unset | Önce | 521 | 42,23 | 56/144/164 | 64 | 237 |
| unset | Sonra | 385 | 71,69 | 83/167/143 | 2 | 107 |

### Gerçek şut çıkış hızı / m·sn⁻¹

| Dilim | Dönem | İsabet | Kurtarış % | Tuttu/çeldi/saptırdı¹ | Dokundu ama gol | Hiç değemedi² |
| --- | --- | --- | --- | --- | --- | --- |
| 25–30 | Önce | 212 | 40,57 | 19/64/75 | 36 | 90 |
| 25–30 | Sonra | 146 | 78,08 | 22/73/58 | 1 | 31 |
| 30+ | Önce | 89 | 32,58 | 4/31/25 | 17 | 43 |
| 30+ | Sonra | 42 | 66,67 | 5/15/12 | 0 | 14 |
| 20–25 | Önce | 275 | 54,18 | 45/92/101 | 29 | 97 |
| 20–25 | Sonra | 214 | 74,77 | 60/92/85 | 1 | 53 |
| 0–20 | Önce | 102 | 46,08 | 18/32/29 | 12 | 43 |
| 0–20 | Sonra | 55 | 60,00 | 15/23/15 | 0 | 22 |

### Şutun kale mesafesi / m

| Dilim | Dönem | İsabet | Kurtarış % | Tuttu/çeldi/saptırdı¹ | Dokundu ama gol | Hiç değemedi² |
| --- | --- | --- | --- | --- | --- | --- |
| 11–18 | Önce | 244 | 40,57 | 29/68/78 | 30 | 115 |
| 11–18 | Sonra | 201 | 75,12 | 34/94/90 | 0 | 50 |
| 6–11 | Önce | 66 | 30,30 | 3/15/16 | 4 | 42 |
| 6–11 | Sonra | 60 | 36,67 | 14/8/11 | 0 | 38 |
| 18–25 | Önce | 186 | 60,75 | 35/78/70 | 34 | 39 |
| 18–25 | Sonra | 85 | 92,94 | 29/49/31 | 0 | 6 |
| 0–6 | Önce | 182 | 43,41 | 19/58/66 | 26 | 77 |
| 0–6 | Sonra | 111 | 74,77 | 25/52/38 | 2 | 26 |

### Şut anında top–kaleci mesafesi / m

| Dilim | Dönem | İsabet | Kurtarış % | Tuttu/çeldi/saptırdı¹ | Dokundu ama gol | Hiç değemedi² |
| --- | --- | --- | --- | --- | --- | --- |
| 11–18 | Önce | 340 | 54,12 | 58/127/126 | 56 | 100 |
| 11–18 | Sonra | 201 | 90,05 | 48/120/91 | 0 | 20 |
| 0–6 | Önce | 235 | 40,85 | 24/68/76 | 28 | 111 |
| 0–6 | Sonra | 163 | 59,51 | 31/59/45 | 2 | 64 |
| 6–11 | Önce | 91 | 28,57 | 2/21/22 | 6 | 59 |
| 6–11 | Sonra | 89 | 60,67 | 22/23/32 | 0 | 35 |
| 18–25 | Önce | 11 | 45,45 | 2/3/6 | 4 | 2 |
| 18–25 | Sonra | 3 | 100,00 | 1/1/2 | 0 | 0 |
| 25+ | Önce | 1 | 0,00 | 0/0/0 | 0 | 1 |
| 25+ | Sonra | 1 | 0,00 | 0/0/0 | 0 | 1 |

### Kale varışında kaleci merkezine enine uzaklık / m

| Dilim | Dönem | İsabet | Kurtarış % | Tuttu/çeldi/saptırdı¹ | Dokundu ama gol | Hiç değemedi² |
| --- | --- | --- | --- | --- | --- | --- |
| 3+ | Önce | 503 | 47,32 | 63/167/186 | 56 | 209 |
| 3+ | Sonra | 326 | 68,10 | 69/155/135 | 0 | 104 |
| 2–3 | Önce | 131 | 45,04 | 16/42/37 | 35 | 37 |
| 2–3 | Sonra | 121 | 85,95 | 28/46/31 | 1 | 16 |
| 1–2 | Önce | 39 | 33,33 | 6/9/6 | 3 | 23 |
| 1–2 | Sonra | 10 | 90,00 | 5/2/4 | 1 | 0 |
| 0–1 | Önce | 5 | 20,00 | 1/1/1 | 0 | 4 |
| 0–1 | Sonra | 0 | — | 0/0/0 | 0 | 0 |

¹ Tür sayıları dışarı giden topa temasları da kapsar; kurtarış yüzdesinin paydası yalnız isabetli şuttur. ² Yalnız isabetli şutta gerçek el/gövde teması oluşmaması. `evaluatedAtKeeperPlane` sadece geometrik değerlendirmedir; “yetişti” diye sayılmaz. Tepki ve gerçek ek uzanma aşağıda; `requiredExtension` ise gereken mesafedir, gerçekleşmiş 10 m plonjon iddiası değildir.

| Dönem | Set | Tepki sn ort. [P10–P90] | Gerçek ek uzanma m | Gereken ek uzanma m |
| --- | --- | --- | --- | --- |
| Önce | set | 0,19 [0,15–0,23] | 1,50 [0,00–2,65] | 2,91 [0,00–8,73] |
| Önce | unset | 0,38 [0,34–0,41] | 0,73 [0,00–2,49] | 1,92 [0,00–5,91] |
| Sonra | set | 0,23 [0,19–0,25] | 1,08 [0,00–2,65] | 0,91 [0,00–2,46] |
| Sonra | unset | 0,26 [0,23–0,28] | 1,19 [0,00–2,65] | 1,01 [0,00–2,69] |

## Fırsatın kaynağı: önceki 10 saniye

| Kaynak | Önce şut | Önce gol | Sonra şut | Sonra gol |
| --- | --- | --- | --- | --- |
| ballWin | 486 | 103 | 335 | 54 |
| throughPass | 57 | 13 | 21 | 1 |
| dribbleBeat | 97 | 21 | 20 | 2 |
| rebound | 356 | 132 | 131 | 22 |
| other | 1020 | 147 | 426 | 53 |

Etiketler birden çok kaynağı içerebilir; toplamları %100 olmak zorunda değildir. Golün 10 saniyesi gol anından, şutunki şut anından geriye okunur. `ballWin`: kontrollü rakip kesme veya müdahaleyle kazanma; `throughPass`: alıcının çıkış konumundan en az 3 m koşu alanına bırakılan başarılı pasın kaba etiketi; `dribbleBeat`: gerçek adam geçme; `rebound`: kurtarış/blok/direk; `other`: bu kısa pencerede bu etiketlerden hiçbiri. Gerçek ofsayt/ara pas sistemi iddiası yoktur.

## Müdahale dilimleri

### Tür

| Dilim | Dönem | Girişim | Yasal kazandı | Yasal sekti | Iska (faulsüz) | Faul |
| --- | --- | --- | --- | --- | --- | --- |
| sliding | Önce | 3733 | 0 | 1288 | 2124 | 321 |
| sliding | Sonra | 3772 | 0 | 2053 | 1228 | 491 |
| standing | Önce | 3006 | 975 | 90 | 1526 | 415 |
| standing | Sonra | 1272 | 815 | 74 | 343 | 40 |

### Başlangıçta taşıyıcı hızı / m·sn⁻¹

| Dilim | Dönem | Girişim | Yasal kazandı | Yasal sekti | Iska (faulsüz) | Faul |
| --- | --- | --- | --- | --- | --- | --- |
| 0–2 | Önce | 3707 | 717 | 804 | 1785 | 401 |
| 0–2 | Sonra | 2610 | 591 | 1140 | 710 | 169 |
| 2–4 | Önce | 2581 | 231 | 517 | 1555 | 278 |
| 2–4 | Sonra | 2219 | 210 | 902 | 781 | 326 |
| 4–6 | Önce | 435 | 26 | 57 | 296 | 56 |
| 4–6 | Sonra | 211 | 13 | 84 | 78 | 36 |
| 6+ | Önce | 16 | 1 | 0 | 14 | 1 |
| 6+ | Sonra | 4 | 1 | 1 | 2 | 0 |

### Hazırlık / sn

| Dilim | Dönem | Girişim | Yasal kazandı | Yasal sekti | Iska (faulsüz) | Faul |
| --- | --- | --- | --- | --- | --- | --- |
| 0.4–0.6 | Önce | 3730 | 1 | 1285 | 2123 | 321 |
| 0.4–0.6 | Sonra | 3770 | 2 | 2052 | 1227 | 489 |
| 0.25–0.4 | Önce | 3002 | 974 | 90 | 1524 | 414 |
| 0.25–0.4 | Sonra | 1270 | 813 | 74 | 343 | 40 |
| 0.6+ | Önce | 7 | 0 | 3 | 3 | 1 |
| 0.6+ | Sonra | 4 | 0 | 1 | 1 | 2 |

### Başlangıçta top mesafesi / m

| Dilim | Dönem | Girişim | Yasal kazandı | Yasal sekti | Iska (faulsüz) | Faul |
| --- | --- | --- | --- | --- | --- | --- |
| 2–3 | Önce | 3048 | 0 | 1098 | 1690 | 260 |
| 2–3 | Sonra | 3005 | 0 | 1622 | 1002 | 381 |
| 1–2 | Önce | 2756 | 891 | 156 | 1388 | 321 |
| 1–2 | Sonra | 1623 | 814 | 290 | 449 | 70 |
| 0–1 | Önce | 553 | 84 | 1 | 354 | 114 |
| 0–1 | Sonra | 3 | 1 | 0 | 1 | 1 |
| 3+ | Önce | 382 | 0 | 123 | 218 | 41 |
| 3+ | Sonra | 413 | 0 | 215 | 119 | 79 |

Son dört sütun ayrık sonuçlardır. Ham olay ve eski canlı sayaçlar topa ilk teması ayrıca korur; faulle biten top teması yasal başarı oranını yükseltmez. Faulün sayısal eşikleri simülasyonun kendi yaklaşımıdır; [IFAB Law 12](https://theifab.com/laws/latest/fouls-and-misconduct/) tehlikeli/ölçüsüz müdahaleyi yalnız topa değdi diye yasal kabul etmez.

## Güç farkı ve tek özellik deneyleri

Her deney aynı 50 tohumda; iki takımın başlangıç özellikleri eşlenerek kadro üretim farkı çıkarılır. Güçlü tarafa +5/+10/+20 eklenir, 100’de kırpılır (başlangıç fitness=100 daha artmaz). Tek özelliklerde yalnız ST finishing, yalnız GK reflexes veya dört savunmacının tackling/positioning alanlarına +10 verilir. “equal” kontrolü aynı eşlenmiş kadroyu yükseltmeden oynatır. “swapped10” aynı tohumda güç artışını diğer tarafa verir; ilk santrayı alma sırası da böylece yer değiştirir.

| Deney | G/B/M (50) | Attı | Yedi | Gol farkı | Şut farkı | xG farkı |
| --- | --- | --- | --- | --- | --- | --- |
| equal | 18/9/23 | 0,90 | 1,20 | -0,30 | -0,58 | -0,05 |
| all5 | 29/9/12 | 1,94 | 1,04 | 0,90 | 5,50 | 0,72 |
| all10 | 31/14/5 | 1,94 | 0,68 | 1,26 | 12,60 | 1,40 |
| all20 | 46/1/3 | 2,88 | 0,32 | 2,56 | 47,06 | 5,69 |
| finishing | 19/13/18 | 0,96 | 1,04 | -0,08 | -0,56 | -0,09 |
| reflexes | 18/8/24 | 0,92 | 1,24 | -0,32 | -1,10 | 0,01 |
| defence | 22/12/16 | 1,24 | 1,04 | 0,20 | 0,44 | 0,17 |
| swapped10 | 42/7/1 | 2,20 | 0,46 | 1,74 | 9,74 | 1,05 |

+20 deneyinde şut/xG farkı +47,06/+5,69 iken gol farkı +2,56’dır; yüksek güç düzeyinde xG ayrışması da sürer. Güç etkisi doğru yönde olsa da model bütün özellik düzeylerinde kalibre edilmiş sayılmaz. Her deneyin medyan/P10/P90 ve tohum başına farkları ham JSON’dadır. İki tarafı değiştirmek aynı seed ile aynı skoru garanti etmez: seed’li uygulama hatalarının hangi takıma/aksiyona denk geldiği değişir. Değerlendirme, eşlenmiş 50 maçta üstünlüğün yönü ve büyüklüğüdür; bu simetrinin yerine sonuç kopyalamak değildir.

### Kontrollü tek özellik: aynı 250 şut

Tam maçta erken bir temas sonraki RNG akışını ve bütün fırsatları değiştirir. Bu yüzden tek bir küçük özellik artışının 50 maç ortalaması tek başına nedensel kanıt değildir. Aynı tohum ve aynı 5/8/11/18/22 m konumlarında 250 eşlenmiş gerçek şut da çalıştırılır; diğer oyuncular uzaktadır, kaleci set, yalnız ilgili özellik +10. Sonuç yine fiziksel uçuş/temastır.

| Deney | Normal gol | +10 gol | Normal kurtarış | +10 kurtarış |
| --- | --- | --- | --- | --- |
| controlledFinishing | 106 | 115 | 132 | 122 |
| controlledGoalkeeping | 106 | 97 | 132 | 141 |

Finishing artınca stilin yanlışlıkla sertten plaseye geçip nominal gücü %20 düşürebildiği bu işte saptandı. Önce kırmızı test eklendi, stil karşılaştırması strength/technique yapıldı. Finishing doğruluk/köşeyi etkiler; tek başına artınca aynı şutun amaçlanan gücü ve stili değişmez. Kontrollü sette stil değişimi sıfırdır. Tam maçta yalnız reflexes artışı 1,20→1,24 gol yeme gibi küçük ters bir ortalama verdi; eşlenmiş fark +0,04, yaklaşık %95 aralığı −0,27…+0,35. Bu gürültülü maç ortalaması saklanmadı; aynı uçuşlarda kurtarış 132→141 ve yenen gol 106→97 ile fiziksel etki beklenen yöndedir.

### Ek 100 tohum: yayılım ve yön kontrolü

| Ölçü | İlk 50 | 100 tohum |
| --- | --- | --- |
| Gol | 2,44 | 2,34 |
| Şut | 18,14 | 17,87 |
| İsabet | 9,14 | 9,09 |
| xG | 2,34 | 2,28 |
| Kurtarış % | 73,30 | 74,26 |
| Faul | 10,62 | 10,94 |
| 5+ gol % | 18,00 | 17,00 |
| Golsüz % | 6,00 | 11,00 |

Ayarlar bu ek ölçüm için değiştirilmedi. İlk 50 skor ve bütün istatistik sayaçları bağımsız 100 maç koşusunun ilk 50’sinde birebir tekrar eder. 100 tohum dosyası `match-sim-balance-hundred.json` içindedir. 100 maçta şut ortalaması 18 altına indiği için yalnız ilk 50’nin 18,14 değerine bakılıp tamamen çözülmüş sayılmaz.

| +10 güçlü taraf | G/B/M (100) | Gol farkı | Şut farkı | xG farkı |
| --- | --- | --- | --- | --- |
| all10 | 70/21/9 | 1,43 | 10,91 | 1,18 |
| swapped10 | 75/21/4 | 1,48 | 9,71 | 1,04 |

100 tohumda iki yönün gol farkı +1,43/+1,48 ve kazanma %70/%75’tir. İlk 50’deki %62/%84 farkının ardından daha büyük aynı sabit tohum dizisiyle kontrol yapıldı; sonuçlar eşitlenmedi. Güç üstünlüğü iki tarafta da tutarlıdır. Her seed’de birebir aynı skor veya örneklem oranlarının kesin eşitliği iddia edilmez. `match-sim-balance-strength-sides.json` tam çiftleri taşır; ilk 50 çift önceki deneyle birebir karşılaştırılır.

## Hedef dışında kalanlar ve doğrulamanın sınırı

- **Şut 18,14**, 18–30 aralığının alt sınırında. Otomatik kararın düşük xG eşiği ve hızlı şut blok zarfı, ceza sahası dışındaki uygun şutu hâlâ az seçiyor. 25 m+ dilimindeki sayı tabloda açık. Kafa/orta/duran top şutları da yok. Bunların yokluğu tek başına hedefe ulaşılamayacağının kanıtı değildir; uzak şut seçimi için kalan ince ayardır.
- **Faul 10,62**, 16–26 hedefinin altında. Faul yalnız süpürülmüş ayak–bacak ve tehlikeli devam temasından doğuyor. Omuz modeli sadece yavaşlatır; genel itme/çekme/sert gövde faulleri yok. Gerçek penaltının yokluğu faul sayısını silmez: ceza alanı temasları zaten `penaltyPending` ile sayılır. Sayıyı yükseltmek için temas olmadan faul eklenmedi.
- **xG dilim kalibrasyonu eksik.** Ortalama gol gerçek maç ölçeğine indi; bu, her alt grubun tahmininin doğru olduğu anlamına gelmiyor. Son Faz 4 denge işinde kaleci durumu, dar açı/uygulama ve şut seçimi birlikte ele alınmalı. Hedef dışı ölçüler ve başarısız adaylar saklanarak kota eklenmedi.

- **5+ gol oranı %18,00**, <%15 hedefinin üzerinde. Ayar değişmeden 100 maçta oran %17,00; yayılım sorunu yalnız ilk örnekleme veya kırmızı kartlara bağlanmadı. İlk dokuz yüksek skorlu maçın yalnız biri kırmızı kartlıdır. Bu kuyruk, son denge işinde kaleci/şut akışının konuma göre dağılımıyla ele alınmalıdır.

## Doğrulama ve telefonda kontrol

Kurallar: aynı tohumda bütün 54.000 adım/konum/top/olay/skor tekrarı; her golün önce aynı şutu, her faulün önce aynı oyuncuların teması; gol/kurtarış/müdahale sonucuna doğrudan kura olmaması; mevcut topsuz koordinat SHA-256 özeti ve altın dosyalar korunur. Yeni fizik/rapor/harita testleri önce kırmızı çalıştırıldı. CI ölçümünün kaydedilmiş maç ve güç sonuçlarıyla eşitliği ayrıca karşılaştırılır; yalnız duvar süresi bu karşılaştırmadan çıkarılır. Lint tabanı büyütülmedi. Node 22 tam doğrulama ve değişmemiş 12 oyun duman kontrolü + laboratuvar senaryolarının kanonik kaydı [PR #6 kontrolleridir](https://github.com/rasimoner/ManagerStory/pull/6/checks). Son kaynağın yeşil olması main’e birleşme önkoşuludur.

Yerel hız testinin ilk/JIT koşusu zaman zaman 2 sn’yi geçti; eşik gevşetilmedi. CI, aynı testi boş işlemcide üç ayrı tam maçın **her birinde** 2 sn sınırıyla çalıştırır. Raporun zaman dağılımı ayrıca yukarıdadır; telefondaki duvar süresi masaüstü CI süresi değildir. Bu ortamda Chromium çalıştırma erişimi reddedildiğinden 390×844 dokunmatik Chromium kontrolleri dal üzerinde GitHub Actions’ta çalıştırılır; `balance-mobile.png` iş akışı çıktısına eklenir.

1. Tohum **731 → Yeniden kur → 90 dakikayı tamamla**: skor, xG ve kurtarış oranını kontrol et. Aynı tohum ve aynı komutlar aynı maçı üretmeli.
2. **Şut haritası**: yeşil gol, mavi kurtarış, turuncu blok, gri dışarı/direk; büyük nokta daha yüksek xG. Katmanı kapat/aç: geçmiş şutlar kaybolmamalı. Yeniden kurunca temizlenmeli.
3. **0,25×**, roller ve mücadele katmanı açık: kale tarafı markajı, penaltı noktası civarındaki **DT** oyuncusunu, ayak/kayma temasını ve dönen top yarışını izle.
4. Top sahibine **çift dokunarak şut**: kaleci erişimini ve çelmenin gerçek top yolunu izle; skordan sonra santra ve devrede yön değişimi sürmeli.

Main’in son commit’i ve silinebilecek birleşmiş dallar kapanış mesajında verilir; dallar otomatik silinmez. Sürüm, eski motor, kariyer ve 3D bu işin kapsamına alınmadı.
