# Kısa maçlarda hücum akışı

30 Ekim 2026 · Başlangıç main `ef392c6` (V7.16.0) · Dal `feat/short-match-flow` · Node 22.23.4.

## Başlangıç ölçümü

Mevcut `equalDurationInput`, `measureDurationMatch`, `summarizeDurationRuns` araçları kullanıldı. Eşit kadrolar, kondisyon/sakatlık açık, 420 fizik saniyesi; tohumlar önce seçildi ve sabit tutuldu: `901,731,42,2026,508,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15`.

| İki takım toplamı / maç | Önce | Sonra |
|---|---:|---:|
| Şut | 1,10 | Bekliyor |
| Gol | 0,20 | Bekliyor |
| Golsüz maç | 16/20 (%80) | Bekliyor |
| xG | 0,1020 | Bekliyor |
| Pas isabeti | %77,57 | Bekliyor |

20/20 maçta günlük/sayaç/kariyer gol, kart, asist ve dakika tutarlılığı doğrulandı. Tohum başına küçük ölçüm tablosu: [match-sim-short-flow.json](measurements/match-sim-short-flow.json).

## Neden ve dar kapsam

Sürme puanında güvenli bölgede fazla kalmanın getirisi ileri alanı değerlendirmeyi bastırabiliyor. Pas ve sürme arasında ilerleme değeri aynı ölçekte değil. İki destek hedefi de topun arkasında; top sahibi ileri hat oyuncusu derin koşuya seçilirse ayrı bir ileri alıcı kalmayabiliyor.

Önce bu kararlar için davranış testleri yazılacak. Değişiklikler doğal süreli yeni motorda kalacak; referans laboratuvar, fizik, şut/kaleci, kariyer kayıt biçimi ve eski motor bu işin ayar alanı değil. Bu dosya başlangıç kaydıdır; sonuç ve doğrulama uygulamadan sonra eklenecek.

## Başlangıç doğrulaması

Değişmemiş main üzerinde Node 22.23.4 ile lint ve hızlı paketin işlev testleri geçti. Ayrı performans dosyasında iki mevcut 2 sn kapısı başarısız: şut/kaleci ve kondisyonlu tam referans maçlar. Kondisyonlu koşular 2.661 / 2.335 / 1.695 ms. Eşikler ve testler korunuyor; bu ortam sorunu uygulamanın başarısı gibi gösterilmeyecek. Başlangıç ölçümünü erken kaydetmek için başarısız hız kapısı bu belge commit'inde açıkça belirtilir.
