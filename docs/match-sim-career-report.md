# Faz 4 — Kariyer bağlantısı

29 Ekim 2026 · Taban `854f020` · Dal `feat/match-sim-career` · Node 22.23.4.

## A — Skor kuyruğunun teşhisi

Önce tanı aracının testi kırmızı çalıştırıldı, sonra olay çözümlemesi eklendi. `npm run sim:report -- --output docs/measurements/match-sim-career-tail.json` aynı 50 tohumu yeniden oynatır. Yeni ham dosya, dokuz yüksek skorlu maçtaki **52 golün her biri için önceki 30 saniyenin bütün olaylarını**, son santradan geçen zamanı ve önceki gole uzaklığı içerir. Motorun sayıları ve RNG sırası değiştirilmedi; 50 skor ve bütün istatistik sayaçları Denge 1'in kaydedilmiş sonucuyla birebir karşılaştırıldı ve aynı çıktı.

| Toplam gol | Denge 1 | Teşhis sonrası |
|---|---:|---:|
| 0 | %6 | %6 |
| 1 | %32 | %32 |
| 2 | %26 | %26 |
| 3 | %16 | %16 |
| 4 | %2 | %2 |
| 5+ | %18 | %18 |
| Ortalama | 2,44 | 2,44 |

Yüksek skorlu tohumlar: 2026 (3–3), 4 (3–4), 6 (3–2), 10 (3–2), 16 (5–3), 29 (1–4), 31 (3–2), 37 (2–3), 46 (3–3). Goller arası en kısa süre **46,27 sn**, medyan **693,36 sn**; 60 sn altındaki tek çift tohum 29'dadır. **Son santradan sonraki 30 sn içinde gol yoktur.** Santrada kayıp → gol → aynı santra kaybı biçiminde kendini besleyen bir döngü gözlenmedi. Başlama kuralı oyuncuların kendi yarısına gerçek hareketle dönmesini bekler; gol sonrası rolleri/kararları yeni sahiplik fazı yeniden üretir. Bu maçların yalnız biri kırmızı kartlıdır (46); başlangıç motorunda kondisyon tüketimi henüz bulunmadığından yorgunluk birikmesi bu dağılımı açıklayamaz.

**Somut zayıflık kaleci çıkışıdır:** bu 52 golün yedisinin önceki 30 sn'sinde gol yiyen kalecinin dağıtımı vardır. Beşi başarısız dağıtımın **0,69–1,20 sn** sonrasında, kaleciden yalnız **0,26–5,87 m** uzakta rakip kontrolüyle gelir. Tohum 16'da üç örnek vardır. Diğer iki çıkış takım arkadaşına ulaşmış, hücum daha sonra topu kazanmıştır. Mevcut kaleci alıcıyı güvenlik yerine tercih edilen mesafeye göre seçer; taşıma yüksekliğinden çıkan topun ilk alçak kısmı yakındaki rakibe açıktır. Bu aynı santra/yeniden başlama durumunun bozulup kalması değil, çıkış seçimi ve alçak çıkış geometrisinin tekrar eden zayıflığıdır. Topu rakibe ulaştıran fizik, günlüğe uygun çalışmaktadır. Bu işte oyuncuya dokunulmazlık, sonuç kotası veya daha yüksek çıkış eklenmedi; güvenli kaleci çıkışı ve dar açı kalibrasyonu son denge işine açık madde olarak bırakıldı. Bu bulgu kuyruğun tek nedeni olduğu iddiası değildir.

Geçici çizgi duruşları 52 golün 18'inin penceresinde bulunur; tek taraflı tekrarlı faul/çizgi döngüsü görülmedi (yalnız bir faul). Goller çoğunlukla birkaç dakikalık açık oyunlarla ayrılır. Poisson varsayımı, farklı konum/şut kalitelerindeki ve birbirine bağlı ataklardaki varyansı açıklamak için yeterli değildir; örneklemdeki kopukluk gizlenmedi ve **denge sorunu kapanmış sayılmadı**.

Önce/sonra gol 2,44; şut 18,14; isabet 9,14; xG 2,336; xG/şut 0,1288; kurtarış %73,30; faul 10,62; sarı 2,68; pas 776,02. Önceden hedef dışında olan faul ve 5+ oranları hâlâ açıktır. Bu A adımı davranış değiştirmediği için yeni bir hedef sapması yoktur.

## İlerleme

- A: tamamlandı; davranış değiştirilmedi, ham tanı saklandı.
- B: bekliyor.
- C: bekliyor.
- D: bekliyor.
- Tam doğrulama, sezon deneyi ve main birleşmesi: bekliyor.
