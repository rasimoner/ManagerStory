# Gerçek kayıtlar

Telefondan dışa aktarılmış kariyer yedeklerini (Ayarlar → Dışa aktar, `ManagerStory-…-Hafta-N.json`) bu klasöre koy.
`tests/saves.test.cjs` buradaki her `.json` dosyasını iki yolla yükler (tarayıcı kaydı ve içe aktarma), yarım maçı
bitirir, yarım sezon sonunu tamamlar, bir lig maçı oynar, ana ekranları çizer ve yeniden dışa aktarılabildiğini
kontrol eder. Sonuç altın kayda bağlanmaz; yalnızca çalışmaya devam etmesi beklenir.

İyi örnekler: sezon ortası, sezon sonu ekranında, maç ortasında, mümkünse eski bir sürümden.
