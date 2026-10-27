# Sezon geçişi

Dal: `feat/season-transition`

## Sorun
34. hafta oynandıktan sonra kariyer duruyordu. Fikstür 33'te kalıyor, "Maç Önü" ekranı "Bu fikstürün maçı zaten tamamlandı" uyarısı veriyordu.

## Akış
34. turun bütün maçları oynanınca, maç sonu röportajından sonraki gün sezon sonu başlar. Ana sayfa sekmesi sezon sonu ekranlarına geçer; diğer sekmeler (Lig, Kadro, Transfer, Akademi) açık kalır.

Adımlar sırayla çalışır. Ekran olan adımlar onay bekler, diğerleri kendiliğinden geçer:

1. **Özet (ekran):**
   - final puan durumu, şampiyon, sıramız, puan ve averaj;
   - yönetim hedefleri (tuttu / tutmadı) ve lig ödülü;
   - en çok gol, asist ve en yüksek ortalama puan; her listede ilk 3.
2. **Yaşlanma:**
   - herkes +1 yaş;
   - sezon arası gelişim: gençler potansiyele yaklaşır, 30+ düşer, kaleciler yaklaşık 3 yıl geç düşer;
   - yeni açılan hareket geçmişe yazılır.
3. **Emeklilik:** yaşa ve seviyeye göre (aşağıdaki tablo). Bizim oyuncularımız için gelen kutusuna not düşer.
4. **Kiralıktan dönenler:** kiralık oyuncular takıma döner, gelen kutusuna not düşer.
5. **Sezon arası raporu (ekran):** kimin ne kadar geliştiği ya da düştüğü, emekli olanlar.
6. **Sözleşmeler (ekran):**
   - Herkesin kalan yılı 1 azalır; 0'a inenler karar ekranına gelir. Kimsenin sözleşmesi bitmiyorsa ekran atlanır.
   - Seçenekler: 1/2/3 yıl yenile ya da bırak. 31 yaş üstü en fazla 2 yıl, 33 yaş üstü 1 yıl alabilir.
   - Yenilenen oyuncu maaş talebiyle kalır. Ekran şimdiki maaş giderini, kararlarla oluşacak gideri ve maaş alanını gösterir; kararlarla gider maaş alanını aşıyorsa uyarır (yenileme engellenmez, ama maaş alanı açılana kadar yeni transfer yapılamaz). Bırakılan oyuncu serbest oyuncu olarak transfer havuzuna düşer (kulüp "Serbest", bonservis yerine düşük imza parası).
   - Her oyuncu için karar vermeden devam edilemez. "Hepsini 1 yıl yenile" ve "Hepsini bırak" kısayolları var.
7. **Altyapı:**
   - Altyapıdan çıkan oyuncuların satış kilidi kalkar.
   - Yeni sezonun aday raporu gelir; sabitlenmiş harika çocuk yerinde kalır ve yaşlanır.
   - Sezonun harika çocuğu yeni sezon adıyla kendiliğinden planlanır: her sezon bir tane, yaklaşık üç sezonda bir bizde.
8. **Rakipler:**
   - yaşlanma, sezon arası gelişim, emeklilik;
   - emekli olanın yerine aynı mevkiye 17–20 yaşında bir genç gelir;
   - kulüp kendi seviyesinden (taban + 5) 1,5 puandan fazla saparsa en fazla 3 hamleyle geri çekilir: güçlüyse en iyi oyuncusu yurt dışına satılır, zayıfsa tecrübeli bir oyuncu alır;
   - harika çocuğa dokunulmaz.
9. **Transfer havuzu:** yaşlanır ve gelişir, yaşlılar emekli olur, geçen yazdan kalan serbest oyuncular ayrılır, havuz yeniden 110 oyuncuya tamamlanır.
10. **Toparlama:**
    - Satılan, emekli olan ve bırakılan oyuncular kadro listesinden çıkar; kısa kayıtları `S.v796.former` içinde kalır.
    - Kadro 16'nın altındaysa altyapıdan takviye yapılır; kalecisi kalmayan kadroya acil bir genç kaleci alınır.
    - İlk 11'deki boşluklar uygun yedekle doldurulur.
    - Eski sezonların maç olay zincirleri silinir; skor ve oyuncu istatistikleri kalır.
11. **Yeni sezon:**
    - sezon numarası ve adı artar (2025/26 → 2026/27);
    - fikstür yeniden kurulur (aynı devre sistemi, kulüpler farklı yerlere çekilir);
    - puan tablosu ve form sıfırlanır; 1. hafta, 1. günden başlanır;
    - lig ödülü bütçeye eklenir;
    - yönetimin "Sezon Başlıyor" kararı gelir.

### Sonraki işler için
Adım listesi bir kayıt defteridir: `seasonEndStep({id, run | screen, prepare, skip, canContinue, finish}, {after|before})`.
- Küme düşme ve çıkma: `after: 'summary'`.
- Kupa finali: `before: 'summary'`.
- Teknik direktör sözleşmesi ve kovulma: `before: 'newSeason'`.

Yarıda kapanan bir sezon sonu, kaydedildiği adımdan devam eder (`S.seasonEnd`).

## Kurallar
| | Kural |
|---|---|
| Sezon arası gelişim | 21 yaş ve altı: +1–3 (potansiyele kadar). 22–24: 0–2. 25–29: %35 ihtimalle +1. 30: %40 ihtimalle −1. 31+: −1…−5, yaşla artar. Kalecilerde eşikler 3 yıl geç. |
| Potansiyel | 28+ yaşta 1 düşer, 31+ yaşta güce eşitlenir (kalecide 31 / 34). |
| Emeklilik ihtimali | 33 yaşta %8, 34'te %20, 35'te %40, 36'da %60, 37'de %80, 38+ kesin. Gücü 78+ olana ×0,6, 65 altı olana ×1,4. Kaleciler 2 yıl geç. |
| Haftalık gelişim | Aynı. Tek değişiklik: kalecinin düşüşü 3 yıl geç başlıyor (bizde 32/33, rakipte 34 yaş). |
| Sözleşme dağıtımı (eski kayıtlar ve yeni kariyer, bir kez) | 21 yaş ve altı: 2–4 yıl. 22–26: 1–3. 27–30: 1–2. 31+: 1. Altyapıdan gelen 3, yeni transfer 4. |
| Maaş talebi | max(şimdiki maaş, OVR² × 900) × 1,1 (mutsuzsa 1,2; 32 yaş üstü 0,85). |
| Maaş alanı (V7.13.2) | Kulüp seviyesi² × 900 × 22, milyona yuvarlanır (seviye 70 → 97M). Kayıtta durmaz, her an hesaplanır. |
| Forma numarası (V7.13.2) | Sezon geçişinde herkes numarasını korur; ayrılanın numarası boşa çıkar; altyapıdan takviye en küçük boş numarayı alır. |
| Lig ödülü | 1. sıra 12M … 18. sıra 2M. |

## Diğer değişiklikler
- **Asist:** maç olaylarından sayılıyor. Golcüye aynı atakta atılan son başarılı pas ya da orta asisttir; dönen top, duran top ve penaltıda asist yok. Motora dokunulmadı.
- **Sezon etiketi:** her maç sonucuna sezon etiketi (`season`) ekleniyor.
- **Tohumlar:** diğer kulüplerin kendi aralarındaki maçların ve rakip gelişiminin sabit tohumlarına sezon numarası eklendi. 1. sezonda ek sıfırdır; mevcut kariyerler ve testler aynı sonuçları verir.
- **Oyuncu kimlikleri:** artık hep büyüyor (`nextPlayerId`). Ayrılan bir oyuncunun kimliği yeni bir oyuncuya verilmiyor, böylece kimliğe bağlı kayıtlar (ileride highlight arşivi) karışmıyor.
- **Hafta sayaçları:** haftaya bağlı sayaçlar (olay bekleme süreleri, süre sözleri, görüşmeler, başkandan bütçe isteme, taktik haftası) yeni sezona bir sezon geri kaydırılarak taşınıyor.
- **Sabit isimli olaylar:**
  - Mensah teklifi sadece 1. sezonda ve Mensah takımdaysa çıkıyor.
  - Kaptan Burak; o ayrılınca soyunma odasının lideri kaptan oluyor ve öyle kalıyor.
  - Pazar haberindeki "Deniz" 2. sezondan itibaren kadronun en genç oyuncusu oluyor.
- **İçe aktarma:** harika çocuk teklifi (`v6wk…`), serbest oyuncu (`v6fa…`) ve yeni havuz oyuncusu (`v6n…`) kimlikleri kabul ediliyor. Önceden harika çocuk teklifi olan bir kayıt içe aktarılamıyordu.

## Ölçüm (tohum başına 8 sezon, hızlı simülasyon)
- 5 farklı tohumda her yeni sezon başında her kulübün ilk 11 ortalaması hedefin ±1,5 puan içinde. Lig ortalaması hedefin +0,1 ile +0,9 üstünde.
- Rakip kadrolar 16–17 oyuncu. 17 olan, harika çocuğun ilk 11'e girerken yedeğe indirdiği oyuncudur (V7.9.5 davranışı).
- Lig yaş ortalaması 25,5–26.
- Şampiyon puanı 58–79, son sıradakinin puanı 20–37.
- Bizim kadro her sezon 16–17 oyuncu, ilk 11 tam.
- Kayıt boyutu sezon başına yaklaşık 30–35 KB büyüyor (eski sezonların olay zincirleri silindikten sonra).

## Açık konular
- Rakip oyuncuların golleri kayıtlı değil; sezonun öne çıkanları sadece bizim oyunculardan seçiliyor.
- Diğer kulüplerin kendi aralarındaki maçlar sabit kulüp güçlerini kullanıyor. Rakip kadroları dengede tutmak bizim maçlarımızın zorluğunu korumak içindir.
