# 🔴 ÖNEMLİ: Vercel Dashboard Ayarları

## Sorun
Build log'da Next.js build çalışmıyor (137ms çok kısa, normal build 30-60 saniye sürer). Bu, Vercel'in Next.js projesini algılamadığını gösteriyor.

## ✅ Çözüm: Vercel Dashboard'da Ayarları Düzelt

### 1. Vercel Dashboard'a Git
https://vercel.com/dashboard

### 2. Projenizi Seçin
"gaun-mudek" veya proje adınızı seçin

### 3. Settings → General

**Şu ayarları kontrol edin:**

1. **Root Directory**: `frontend` olarak ayarlanmış olmalı
   - Eğer `.` veya boşsa → `frontend` yazın
   - ✅ Save butonuna tıklayın

2. **Framework Preset**: `Next.js` seçili olmalı
   - Eğer "Other" ise → `Next.js` seçin

3. **Build Command**: Boş bırakın (Vercel otomatik algılar)
   - Veya: `npm run build` (root directory `frontend` olduğu için otomatik `frontend` klasöründe çalışır)

4. **Output Directory**: Boş bırakın (Vercel otomatik algılar)
   - Veya: `.next`

5. **Install Command**: Boş bırakın (Vercel otomatik algılar)
   - Veya: `npm install`

### 4. Deploy Ayarlarını Kaydet
"Save" butonuna tıklayın

### 5. Yeni Deploy Başlat
- "Deployments" sekmesine gidin
- En üstteki deployment'ın yanındaki "⋯" menüsünden "Redeploy" seçin
- Veya yeni bir commit push yapın

## ✅ Beklenen Build Log

Doğru ayarlarla build log şöyle görünmeli:

```
Running "npm install"
Running "npm run build"
> next build
...
Creating an optimized production build
...
Route (app)                              Size     First Load JS
...
○  /                                     ... kB         ... kB
○  /reports/[courseId]                   ... kB         ... kB
...
```

Build süresi **30-60 saniye** arası olmalı (137ms değil!).

## ❌ Yanlış Yapılandırma Belirtileri

- Build süresi < 1 saniye → Next.js build çalışmıyor
- "Build Completed in /vercel/output [137ms]" → Build çalışmıyor
- Tüm sayfalar 404 veriyor → Build çalışmıyor

## ✅ Doğru Yapılandırma

1. Root Directory: `frontend` ✅
2. Framework Preset: `Next.js` ✅
3. Build Command: Boş (otomatik) ✅
4. vercel.json: Boş veya yok ✅

## 📝 Not

`vercel.json` dosyasını sildim/boş bıraktım çünkü:
- Vercel Dashboard ayarları önceliklidir
- Next.js projeleri için otomatik algılama yeterlidir
- `vercel.json` sadece özel durumlar için gerekir

