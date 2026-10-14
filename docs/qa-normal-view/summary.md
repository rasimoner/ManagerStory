# Normal maç sunumu — 2026-10-06

- Başlangıç: 005a866ee1c21003b3f2329284d1264de13300ae; tree e291d28c0bb2209014b121695b07fede86818e78.
- Son tam regresyon: 175/175, 0 başarısız; `node --test tests/*.test.cjs`. Gerçek tarihsel commit/tree/blob'lar GitHub bağlantısından SHA doğrulanarak yerel Git nesnelerine geri getirildi; geçmiş karşılaştırma testleri değiştirilmedi.
- Seed1 ve seed8800: ham motor olayları/sırası, skor, shots, takım/oyuncu istatistikleri, RNG ve sonuç uygulanmış kariyer S aynı. Tek end/tek sonuç uygulaması. Ortak tempo1 QA adımlarında süreler aynı: 451.76s / 469.20s. Bunlar cihaz FPS/duvar saati değildir.
- Onaylanan `dist/match3d-player.js` başlangıçla byte-byte aynı; SHA256 efc294ce2522e4e5d5ca9d2ef7e4fdf172c488bdb75e44247a37f55eb002bcf3. Motor karar dosyaları ve ürün sürümü değişmedi.
- Yeni iki kontrol: gerçek golün santra konumuna kararma arkasında dönüşü, pause'da ortak phase'in sabitliği; gerçek pas#11 gönderen/alıcı gövdesinin 390/500 ve320/240 saha aspect'lerinde geometrik kadraja sığması ve değişmez snapshot/root'lar. Mevcut şut/mücadele mobil frustum ve anatomik/gerçek mesh temas kontrolleri geçti.
- WebGL denemesi: `node tools/match3d-career-webgl.mjs` browserType.launch'ta Chromium headless-shell1234 executable eksikliğiyle durdu. Önceki başarısız indirmeler tekrarlanmadı. İki gerçek mobil raster yerleşimi, yan açı diz/zemin/temas görüntüsü, iPhone FPS ve yeni MP4'ler doğrulanamadı/üretilmedi. Test aracı44px kontroller, aynı satır, sahanın ve anlatımın görünürlüğü kontrolleriyle güncellendi; tarayıcı kısmı çalıştırılmış sayılmaz.
- Yeni sunum geometri testleri görsel kalite onayı değildir. Özellikle yüksek mevcut root hızlarında adım doğallığı ve temas okunurluğu cihazda incelenmelidir. Süre/tempo bu tur değiştirilmedi.
