# Gaun MEDEK – Yapılacak Değişiklikler Planı

Bu belge, öğrenci listesi (XLS), rol tabanlı erişim, OBS formatında puan yükleme ve geçme notu (manuel/otomatik) ile ilgili planı özetler.

---

## 1. Öğrenci Listesi – XLS Desteği

**Mevcut:** TXT, CSV, DOCX (StudentImporter – `öğrenciNo ad soyad` satır formatı).

**Yapılacak:**
- Öğrenci listesi **.xls / .xlsx** ile yüklenebilecek.
- Format: İlk sütun öğrenci numarası, ikinci sütun ad soyad (isteğe bağlı: ek sütunlar puan için kullanılabilir – OBS ile birleşince).
- Frontend: `StudentImporter` içinde `xlsx` (veya `sheetjs`) ile Excel okuma; aynı `Student[]` formatına çevirme.

**Dosyalar:**  
`frontend/components/courses/StudentImporter.tsx`, `frontend/package.json` (xlsx bağımlılığı).

---

## 2. Rol Tabanlı Erişim (Bölüm Başkanı / Süper Admin / Öğretmen)

**Hedef:**
- **Süper admin:** Tüm bölümler, programlar, dersler, sınavlar, raporlar – hepsini görür ve yönetir.
- **Bölüm başkanı:** Sadece kendi bölümünün programları ve dersleri; o bölüme ait raporlar ve yönetim.
- **Öğretmen (kullanıcı):** Sadece atandığı ders(ler); kendi dersinin sınavları, puanları, raporu.

**Yapılacaklar:**

1. **Backend**
   - **User modeli:** `email`, `passwordHash`, `role` (`super_admin` | `department_head` | `teacher`), `departmentId` (bölüm başkanı için), `assignedCourseIds[]` veya `assignedProgramId` (öğretmen için). İsteğe bağlı: `name`, `fullName`.
   - **Course modeli:** `instructorId` veya `assignedTeacherId` (ObjectId ref User) – öğretmenin hangi dersleri gördüğü.
   - **Department:** İsteğe bağlı `headId` (bölüm başkanı) – yoksa bölüm başkanı `User.departmentId` ile eşleşecek.
   - Auth: Login endpoint (JWT veya session); middleware `requireAuth`, `requireRole`, `requireCourseAccess` (sadece o derse erişim).
   - Course/Exam/Report listeleme API’leri: Süper admin → tümü; bölüm başkanı → `departmentId` filtresi; öğretmen → `assignedCourseIds` veya `instructorId` filtresi.

2. **Frontend**
   - Login: Gerçek API’ye bağlan; token ve kullanıcı bilgisi (role, departmentId, assignedCourseIds) saklanacak.
   - Sidebar / menü: Role göre görünen sayfalar (örn. sadece “Kendi Derslerim” veya “Bölüm Dersleri”).
   - Ders listesi: Backend’in döndüğü (zaten filtrelenmiş) liste kullanılacak; ekstra filtre gerekmez.

**Dosyalar:**  
Yeni: `backend/models/User.js`, `backend/controllers/authController.js`, `backend/routes/authRoutes.js`, `backend/middleware/authMiddleware.js`.  
Güncellenecek: `Course.js`, `courseController.js`, `courseRoutes.js`, `examController.js`, `reportController.js`, `frontend/app/login/page.tsx`, `frontend/lib/api/apiClient.ts`, sidebar/navigation.

---

## 3. OBS Formatında Excel ile Puan Yükleme

**Hedef:** Hazır öğrenci listesinde öğrenci numarası + puan sütunları olsun; bu Excel (OBS formatı) yüklenince ilgili sınava göre toplu puan girilsin ve rapor mantığı uygulansın.

**Format (OBS):**
- Excel: En az 2 sütun – **Öğrenci No** (veya “Numara”) ve **Puan** (veya “Score”, “Not”).
- İsteğe bağlı: Ad soyad (eşleşme kontrolü için). Üst satır başlık olabilir.

**Yapılacaklar:**
- **Backend:**  
  - Endpoint: `POST /api/exams/:examId/upload-scores` (multipart/form-data veya base64).  
  - Girdi: Excel dosyası, (isteğe bağlı) `maxScore` (varsayılan 100).  
  - İşlem: Excel’den satırları oku (öğrenci no, puan); her satır için `StudentExamResult` oluştur/güncelle: `totalScore`, `maxScore`, `percentage`, `outcomePerformance`, `programOutcomePerformance` ve **geçme notu mantığı** (aşağıda) uygulansın.
- **Frontend:**  
  - Sınav detay veya “Puanlar” sayfasında “OBS Excel ile toplu yükle” butonu; dosya seç → upload → başarı/hata mesajı.

**Dosyalar:**  
`backend/controllers/examController.js` (upload handler), `backend/routes/examRoutes.js`, `backend` için xlsx kütüphanesi.  
Frontend: Sınav/puan sayfasına upload bileşeni.

---

## 4. Geçme Notu Mantığı (Vize 60 → O Kadar ÖÇ/PÇ Geçsin)

**İki kural:**

- **Kural A – Oransal:**  
  Vizede 60 alan öğrenci, o puan (yüzde) kadar ÖÇ/PÇ’den geçmiş sayılsın. Örneğin 10 ÖÇ varsa ve öğrenci %60 aldıysa, 6 ÖÇ “geçti”, 4’ü “kalmış” gibi raporlanabilir.

- **Kural B – Tümü veya hiç:**  
  “Geçen öğrenci bütün ÖÇ/PÇ/DEM geçecek, kalan hepsinden kalmış olacak.”  
  Yani: **Sınav geçme notuna göre** öğrenci geçtiyse → tüm ÖÇ/PÇ (ve DEM) “geçti”; kaldıysa → tümü “kalmış”.

**Uygulama:**
- **Exam modeli:** `passingScore` veya `passingPercentage` (sayı, örn. 40 veya 60). Zorunlu değil; yoksa varsayılan (örn. 60) kullanılır.
- **StudentExamResult:**  
  - `passed: Boolean` – `(percentage >= exam.passingScore)` (veya `passingPercentage`).  
  - Raporlarda: Öğrenci geçtiyse tüm ÖÇ/PÇ “başarılı”, kaldıysa tümü “başarısız” (Kural B). İsteğe bağlı ek: ÖÇ bazında “oransal geçen sayısı” (Kural A) raporlarda gösterilebilir.
- **OBS yüklemede:** Yüklenen her puan için `percentage` ve `passed` hesaplanır; `outcomePerformance` / `programOutcomePerformance` bu mantığa göre doldurulur (geçen = tümü 100, kalan = tümü 0 gibi veya mevcut yüzde değerleri korunup rapor katmanında “geçti/kaldı” ayrımı yapılır).

**DEM:** Kodda şu an sadece ÖÇ ve PÇ var. “DEM” aynı geçme mantığına bağlanabilir (geçen öğrenci DEM’den de geçmiş sayılır). Gerekirse ileride ayrı alan eklenir.

---

## 5. Manuel Geçme Notu (Sınav Eklerken / Düzenlerken)

**Hedef:** Sınav eklerken veya düzenlerken “Geçme notu 40 olsun” gibi manuel ayar yapılabilsin; sınav puanını (geçmek için) düşürebilsin.

**Yapılacaklar:**
- **Exam modeli:** `passingScore` (Number, optional). Örn. 40 yazılırsa, öğrenci 40 ve üzeri alınca “geçti”.
- **Backend:** Exam create/update’te `passingScore` alanı kabul edilsin ve kaydedilsin.
- **Frontend:** Sınav ekleme/düzenleme formunda “Geçme notu (0–100)” alanı; varsayılan 60, kullanıcı 40 vb. girebilsin.
- Hem manuel puan girişi hem OBS Excel yüklemesi bu `passingScore` değerini kullanacak.

---

## 6. Özet – Hem Manuel Hem Otomatik

- **Otomatik:** OBS Excel yükle → öğrenci–puan listesi → `StudentExamResult` + geçme notu ile `passed` ve rapor.
- **Manuel:** Tek tek puan girişi (mevcut manual-score) + sınav formunda geçme notu alanı.
- **Rapor:** Geçen öğrenci → tüm ÖÇ/PÇ/DEM geçti; kalan → tümü kalmış. İsteğe bağlı oransal (yüzdeye göre kaç ÖÇ geçti) bilgisi eklenebilir.

---

## Uygulama Sırası Önerisi

| Sıra | Konu | Bağımlılık |
|------|------|------------|
| 1 | Exam’e `passingScore` ekleme + sınav formunda manuel geçme notu | - |
| 2 | StudentExamResult’a `passed` + geçme mantığı (tümü/hiç) | 1 |
| 3 | Öğrenci listesi XLS desteği (StudentImporter) | - |
| 4 | OBS Excel puan yükleme (endpoint + UI) | 1, 2 |
| 5 | User modeli + auth + rol bazlı filtreleme (süper admin, bölüm başkanı, öğretmen) | - |

Önce 1–2 ile geçme notu ve rapor mantığı, ardından 3–4 ile Excel (liste + OBS puan), son olarak 5 ile roller ve erişim kısıtları uygulanabilir.
