DepremNabız v2 - Tek dosya HTML sürümü ile canlı AFAD benzeri veri çekme.
İçerik:
- index.html
- style.css
- script.js

Kullanım:
1. Zip'i açın.
2. Dosyaları aynı klasörde tutun ve index.html'i tarayıcıda açın.
3. "Konumumu Kullan" ile konumunuza göre en yakın depremi görebilirsiniz.
4. Bildirim açarsanız yeni deprem olduğunda tarayıcı bildirimi gösterilir (tarayıcı izin ister).

Not:
- API: https://api.orhanaydogdu.com.tr/deprem/live.php
- Bazı tarayıcılarda file:// üzerinden fetch sorun çıkarabilir. Eğer veri gelmezse küçük bir local server ile açın:
  python3 -m http.server 8000
  sonra tarayıcıda http://localhost:8000 açın.
