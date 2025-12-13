# 🔧 Vercel Ayarlarını Düzelt - Adım Adım

## ✅ Yapılacaklar:

### 1️⃣ Framework Preset'i Değiştir

**Framework Settings** sayfasında:

1. **Framework Preset** dropdown'ını açın
2. **"Next.js"** seçin (şu an "Other" seçili)
3. Bu değişiklik otomatik olarak Build Command, Output Directory vb. ayarları doğru şekilde yapılandıracak

### 2️⃣ Root Directory Ayarla

**Root Directory** sayfasında:

1. Boş olan input alanına **`frontend`** yazın
2. **Save** butonuna tıklayın

### 3️⃣ Deploy

Ayarları kaydettikten sonra:

1. **Deployments** sekmesine gidin
2. En üstteki deployment'ın yanındaki **"⋯"** (üç nokta) menüsüne tıklayın
3. **"Redeploy"** seçin
4. Veya yeni bir commit push yapın

## ✅ Beklenen Sonuç

Build log'da şunları görmelisiniz:

```
Running "npm install"
...
Running "npm run build"
> next build
...
Creating an optimized production build
...
Route (app)                              Size     First Load JS
...
```

Build süresi **30-60 saniye** arası olmalı (137ms değil!).

## ❌ Şu Anki Sorun

- Framework Preset: "Other" → Next.js algılanmıyor
- Root Directory: Boş → Frontend klasörü bulunamıyor
- Sonuç: Build çalışmıyor, tüm sayfalar 404

## ✅ Düzeltme Sonrası

- Framework Preset: "Next.js" → Next.js otomatik algılanacak
- Root Directory: "frontend" → Frontend klasörü bulunacak
- Sonuç: Build çalışacak, sayfalar açılacak

