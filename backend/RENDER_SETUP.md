# Render Deployment Setup

## Environment Variables

Render'da aşağıdaki environment variable'ları ayarlayın:

### Required (Zorunlu)

```
NODE_ENV=production
PORT=5000
```

### OpenCV & Native Dependencies (ÖNEMLİ)

Render Linux ortamında çalışır ve native binary gerektiren paketler (opencv4nodejs, pdf-poppler) çalışmaz veya server'ı crash eder.

**ÇÖZÜM:** Bu paketleri devre dışı bırakın:

```
ENABLE_OPENCV=false
ENABLE_PDF_POPPLER=false
SAVE_EXAM_CROPS=false
```

`SAVE_EXAM_CROPS=true` yaparsanız kırpılmış puan kutuları `temp/exam_crops/` altına kaydedilir (koordinat kalibrasyonu için).

### MongoDB & Other Services

```
MONGODB_URI=your_mongodb_connection_string
```

## Önemli Notlar

1. **OpenCV Devre Dışı:** `ENABLE_OPENCV=false` olduğunda:
   - Marker detection fallback kullanır
   - Perspective transform yapılmaz
   - Template koordinatları ile crop yapılır
   - API çalışır, sadece OpenCV özellikleri kullanılmaz

2. **PDF-Poppler Devre Dışı:** `ENABLE_PDF_POPPLER=false` olduğunda:
   - `pdftoppm` (poppler-utils) kullanılır
   - Render'da poppler-utils kurulu olmalı (genelde kurulu)

3. **Local Development:**
   - Local `.env` dosyasında:
     ```
     ENABLE_OPENCV=true
     ENABLE_PDF_POPPLER=true
     ```

## Render'da Environment Variable Ekleme

1. Render Dashboard → Your Service → Environment
2. Add Environment Variable:
   - Key: `ENABLE_OPENCV`
   - Value: `false`
3. Add Environment Variable:
   - Key: `ENABLE_PDF_POPPLER`
   - Value: `false`
4. Deploy/Redeploy

## Test

Backend çalıştıktan sonra:

```bash
curl https://gaun-mudek.onrender.com/api/health
```

`{status:"OK"}` dönmeli.



