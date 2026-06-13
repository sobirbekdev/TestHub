# TestHub — Loyiha Handoff Hujjati

**Sana:** 2026-yil 11-iyun  
**Tayyorlagan:** Claude (Anthropic)  
**Loyiha egasi:** Sobirbek Toshtemirov (kimyo o'qituvchisi)

---

## Fayl manzillari

| Fayl | Tavsif |
|------|--------|
| `testhub-user-v10.html` | Foydalanuvchi qismi — eng so'nggi versiya |
| `testhub-admin-v6.html` | Admin panel — eng so'nggi versiya |

---

## Texnik stack

| Qatlam | Texnologiya |
|--------|-------------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | NestJS + TypeScript |
| Ma'lumotlar bazasi | PostgreSQL + Prisma ORM |
| Fayl saqlash | Cloudflare R2 |
| Autentifikatsiya | Telefon raqam + SMS (Eskiz.uz) + JWT |
| AI tekshiruv | Gemini Flash (bepul tier — oyiga 1500 so'rov) |
| Video | Telegram Bot file_id → Telegram CDN streaming |
| To'lov | Click + Payme (merchant akkaunti kerak) |
| Server | VPS + Docker + Nginx |

---

## Foydalanuvchi qismi (`testhub-user-v10.html`)

### Sahifalar ro'yxati

| ID | Sahifa | Tavsif |
|----|--------|--------|
| `auth` | Kirish | SMS tasdiqlash orqali ro'yxatdan o'tish |
| `home` | Bosh sahifa | Shaxsiy statistika, testlarga o'tish |
| `tests` | Barcha testlar | Milliy sert., DTM, Atestatsiya, Mavzular — bitta sahifada |
| `test-dtm` | DTM testi | 30 savol, 60 daqiqa taymer |
| `test-atest` | Atestatsiya testi | 35 savol, 120 daqiqa taymer |
| `test-sert` | Sertifikat testi | 43 savol, 240 daqiqa taymer, 41–43 AI |
| `result-dtm` | DTM natijasi | 30 ta savol tugmasi + video yechim |
| `result-atest` | Atestatsiya natijasi | 35 ta savol tugmasi + video yechim |
| `result-sert` | Sertifikat natijasi | 43 ta savol tugmasi + AI tekshiruv holati |
| `rating` | Reyting | Umumiy / Guruh / Kunlik filtr |
| `stats` | Statistika | Haftalik grafik + test turlari bo'yicha |

---

### Testlar tizimi

#### Milliy Sertifikat — BEPUL
- 4 muallif: Sohibjon Boboyev, Maruf Tongotarov, Samarqand 30+30, Abdullayev X.
- **43 savol:**
  - 1–32: A B C D (4 javob)
  - 33–35: A B C D E F (6 javob)
  - 36–40: Matn/formula yozish (ochiq javob)
  - 41, 43: Ko'p javob → foydalanuvchi rasmga olib yuboradi → **Gemini Flash AI tekshiradi**
  - 42: Barcha reaksiyalar **bitta qog'ozga** yoziladi → **bitta rasm** yuboriladi → **Gemini Vision AI tekshiradi**
- Taymer: **240 daqiqa (4 soat)**
- Natijada: 43 ta tugma, AI tekshiruv holati (40–43 "Tekshirilmoqda..." spinner)

#### DTM Testlari — PULLIK (5 000 so'm/variant)
- Yillar: 2020–2025, har yil 30 ta variant
- **30 savol, 60 daqiqa taymer**
- PDF avtomatik generatsiya
- Guruhda ishlash tugmasi

#### DTM Sinov (O'zingizni sinang) — PULLIK (5 000 so'm)
- Bazadan **random** 30 ta savol:
  - Daraja: 4 qiyin + 13 o'rta + 13 oson
  - Tur: 2 rasmli + 2 grafikli + 2 nazariy + 24 yozma
- **60 daqiqa taymer**

#### Atestatsiya — PULLIK (5 000 so'm/variant)
- 35+ variant
- **35 savol, 120 daqiqa taymer**
- Savol tarkibi: 7 qiyin + 18 o'rta + 10 oson
- Tur: 3 rasmli + 3 grafikli + 3 nazariy + 26 yozma
- Guruhda ishlash tugmasi

#### Mavzulashtirilgan testlar — PULLIK (narx o'zgaruvchan)
- Admin ochganda ko'rinadi
- Guruhda ishlash tugmasi

---

### Video yechim tizimi
- Video Telegram kanaliga yuklanadi
- Bot `file_id` ni oladi
- Foydalanuvchi natija sahifasida savol raqamini bosadi
- Video **Telegram CDN** orqali o'ynaydi (server zarur emas)
- Video bo'lmagan savolda: `📭 "Video yechim hali yuklanmagan"` xabari

### Natija sahifasi — savol tugmalari
- **Yashil** = to'g'ri javob
- **Qizil** = noto'g'ri javob
- **Binafsha** = AI tekshiryapti (40–43-savollar)
- `▶` belgisi = video mavjud, bosib ko'rish mumkin
- Video panel inline ochiladi (alohida sahifaga o'tilmaydi)

### Tugma ranglar
| Tugma | Rang |
|-------|------|
| Boshlash | Yashil gradient |
| Yakunlash | Qizil gradient |
| Asosiy amal | Violet-Rose gradient |
| Guruhda ishlash | Ko'k outline |
| Orqaga | Outline |

### Qiyinlik darajalari
- Foydalanuvchiga **ko'rsatilmaydi** (CSS `display:none`)
- Faqat backend va admin panelda ishlatiladi

---

### Reyting tizimi
- **Umumiy reyting:** barcha foydalanuvchilar ichida
- **Guruh reytingi:** faqat guruh a'zolari ichida
- **Kunlik reyting:** filtr orqali
- Ball hisoblash: foiz × o'rtacha natija (AI qisman ball ham kiritiladi)

---

### 4 ta tema (localStorage da saqlanadi)

| Tugma | Nom | Asosiy rang |
|-------|-----|-------------|
| 🌙 | Tungi Indigo | `#0d0e1a` fon, `#7c6af5` accent |
| ☀️ | Kunduzgi Indigo | `#f5f6ff` fon, `#6b5cf0` accent |
| 🌊 | Tungi Teal | `#03151c` fon, `#00c9a7` accent |
| 🌿 | Kunduzgi Teal | `#f0fdfb` fon, `#0d9488` accent |

### Responsive dizayn
- Mobil (`≤640px`): padding kichrayadi, taymer gorizontal, tugmalar wrap
- Desktop (`≥641px`): `padding:20px`, max-width `700px`

---

## Admin panel (`testhub-admin-v6.html`)

### Sidebar bo'limlari

| Bo'lim | Tavsif |
|--------|--------|
| Dashboard | Umumiy statistika va tezkor amallar |
| Barcha testlar | DTM, Milliy sert., Atestatsiya, Mavzular (tablar) |
| Savol bazasi | 3 daraja × 4 tur = 12 bo'lim, jami 439+ savol |
| Test yaratish | 4 bosqichli: Tur → Ma'lumot → Savollar → Tasdiqlash |
| Deadline | Deadline qo'shish va boshqarish |
| Guruhlar | Guruh yaratish, test biriktirish |
| AI tekshiruv | Gemini natijalarini ko'rish va tasdiqlash |
| Telegram Video | Bot sozlash, file_id boshqaruvi |
| Foydalanuvchilar | Ro'yxat va statistika |
| Kuratorlar & Rollar | Rol berish va ruxsatlar |
| To'lovlar | Click/Payme tarixi |

---

### Testlar boshqaruvi

Har bir test turida (DTM, Atestatsiya, Mavzular) quyidagi tugmalar mavjud:
- **⏰ Deadline** — guruh va vaqt belgilash
- **👥 Guruhda ochish** — guruh va deadline bilan birga
- **+ Yangi qo'shish** — yangi variant/test

---

### Savol bazasi tuzilmasi

```
Savol bazasi
├── 🟢 Oson (147 ta)
│   ├── 📷 Rasmli (24)
│   ├── 📈 Grafikli (18)
│   ├── 📚 Nazariy (48)
│   └── ✍️ Yozma (57)
├── 🟡 O'rta (203 ta)
│   ├── 📷 Rasmli (38)
│   ├── 📈 Grafikli (31)
│   ├── 📚 Nazariy (72)
│   └── ✍️ Yozma (62)
└── 🔴 Qiyin (89 ta)
    ├── 📷 Rasmli (15)
    ├── 📈 Grafikli (19)
    ├── 📚 Nazariy (28)
    └── ✍️ Yozma (27)

Jami: 439 savol
```

**Random tanlash formulasi:**

| Test | Qiyin | O'rta | Oson | Rasmli | Grafikli | Nazariy | Yozma | Jami |
|------|-------|-------|------|--------|----------|---------|-------|------|
| DTM Sinov | 4 | 13 | 13 | 2 | 2 | 2 | 24 | **30** |
| Atestatsiya | 7 | 18 | 10 | 3 | 3 | 3 | 26 | **35** |

---

### AI tekshiruv paneli

Gemini Flash bepul tier: **oyiga 1500 so'rov**  
~500 ta to'liq test tekshiriladi (41+42+43 = 3 so'rov/test)

**Tekshiruv holatlari:**
- `Kutmoqda` — admin tasdiqlash kerak
- `Tasdiqlandi` — baholangan
- `Qayta tekshirish` — qayta yuborilgan

**Admin amallari:**
- ✅ Tasdiqlash (AI ballni qabul qilish)
- ✏️ Ball o'zgartirish (qo'lda tuzatish)
- 🔄 Qayta yuborish (Gemini ga qayta jo'natish)
- 🖼 Rasmni ko'rish
- ✍️ Qo'lda baholash

**Rash modeli (ball berish):**
- 85–100% → To'liq to'g'ri ✅
- 40–84% → Qisman to'g'ri ⚠️
- 0–39% → Noto'g'ri ❌

---

### Telegram Video sozlash

```
Jarayon:
1. Admin Telegram kanaliga video yuklaydi
2. Bot videoning file_id ni oladi
3. Admin file_id ni savolga biriktiradi
4. Foydalanuvchi bosganida Telegram CDN orqali o'ynaydi
5. Server xarajati = 0
```

---

### Kuratorlar & Rollar

| Rol | Test ochish | Deadline | Guruh | Test yaratish | Foydalanuvchilar | Rollar |
|-----|-------------|----------|-------|---------------|------------------|--------|
| **Super Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **O'qituvchi** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Kurator** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Muhim texnik eslatmalar

### To'lov integratsiyasi
- **Click:** `business.click.uz` → merchant akkaunti (3–7 kun)
- **Payme:** `merchant.payme.uz` → merchant akkaunti (3–7 kun)
- UI tayyor, integratsiya keyinroq qilinadi

### SMS xizmat
- **Eskiz.uz** yoki **PlayMobile.uz** API
- Telefon raqam + SMS kod → JWT token

### Gemini AI limitlari
| Holat | Miqdor |
|-------|--------|
| Bepul tier | 1500 so'rov/oy |
| Har test (3 savol) | ~3 so'rov |
| Oy davomida max testlar | ~500 ta |
| Limit oshsa | Pullik tier (~$0.075/1M token) |

### Savol darajalari — backend SQL namuna
```sql
-- DTM Sinov random 30 ta savol
SELECT * FROM questions 
WHERE difficulty = 'hard' AND type = 'image' 
ORDER BY RANDOM() LIMIT 2;

SELECT * FROM questions 
WHERE difficulty = 'hard' AND type != 'image' 
ORDER BY RANDOM() LIMIT 2;
-- ... va hokazo har daraja/tur uchun
```

---

## Kodlash bosqichlari (navbat bo'yicha)

1. **Database schema** — Prisma + PostgreSQL
2. **Auth** — SMS (Eskiz.uz) + JWT
3. **Subjects, Topics, Tests** CRUD
4. **Questions, Options** CRUD (daraja + tur bilan)
5. **Attempts, Answers, Results**
6. **Random savol tanlash algoritmi**
7. **Stats, Leaderboard**
8. **Upload** — Cloudflare R2 (rasmlar)
9. **Gemini AI** — 41/42/43 savol tekshiruvi
10. **Telegram Bot** — video file_id boshqaruvi
11. **Frontend** — Next.js setup + i18n
12. **Testlar sahifasi** — barcha bo'limlar
13. **Test ishlash** — taymer + savol navigatsiya
14. **Natijalar** — savol tugmalari + video panel
15. **Admin panel** — NestJS + React
16. **To'lov** — Click + Payme
17. **Guruh tizimi** — deadline + reyting
18. **Docker + Nginx + VPS** deploy

---

## Dizayn qarorlar

- **Shrift:** Inter (asosiy) + JetBrains Mono (raqamlar, formulalar)
- **Border radius:** kartalar 18px, tugmalar 10px, variant qatorlar 12px
- **Animatsiyalar:** hover `translateX(3px)` yoki `translateY(-1px)`, `box-shadow` porlash
- **Savol darajalari foydalanuvchiga ko'rsatilmaydi** (`display:none`)
- **Responsive breakpoint:** 640px

---

*Hujjat oxiri*
