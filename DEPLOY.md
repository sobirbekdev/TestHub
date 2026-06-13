# TestHub — Bepul Deploy Qo'llanmasi

Stack: **Frontend → Vercel**, **Backend → Render**, **Baza → Neon**, **Rasmlar → Cloudflare R2**. Hammasi bepul.

---

## 0. GitHub'ga yuklash
Deploy GitHub repo orqali ishlaydi.
```bash
cd /Users/sobirbek/files
git init
git add .
git commit -m "TestHub — deploy uchun tayyor"
# GitHub'da yangi repo oching, keyin:
git remote add origin https://github.com/<user>/testhub.git
git push -u origin main
```
> `.gitignore` `.env` fayllarni avtomatik chetlab o'tadi — kalitlaringiz xavfsiz.

---

## 1. Neon — PostgreSQL baza (bepul)
1. https://neon.tech → ro'yxatdan o'ting → **Create Project**.
2. **Connection string**'ni nusxa oling (`postgresql://...?sslmode=require`).
3. Saqlab qo'ying — Render'ga `DATABASE_URL` sifatida kerak bo'ladi.

---

## 2. Cloudflare R2 — rasm saqlash (bepul, 10GB)
1. https://dash.cloudflare.com → **R2** → **Create bucket** → nomi: `testhub-uploads`.
2. Bucket > **Settings** > **Public access** → yoqing (yoki custom domain ulang).
   ⚠️ AI rasmlarni public URL orqali o'qiydi — public bo'lishi SHART.
3. **Manage R2 API Tokens** → token yarating → quyidagilarni oling:
   - `R2_ACCOUNT_ID` (dashboard URL'da yoki token sahifasida)
   - `R2_ACCESS_KEY` (Access Key ID)
   - `R2_SECRET_KEY` (Secret Access Key)
   - `R2_PUBLIC_URL` (masalan `https://pub-xxxx.r2.dev`)

---

## 3. Render — backend (NestJS, bepul)
1. https://render.com → **New** → **Blueprint** → GitHub repo'ni ulang.
   (Repo'dagi `render.yaml` avtomatik o'qiladi.)
2. So'ralganda env'larni kiriting:
   - `DATABASE_URL` → Neon string
   - `FRONTEND_URL` → Vercel manzili (4-qadamdan keyin qaytib qo'shing)
   - `OPENROUTER_API_KEY` → mavjud kalit
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_PUBLIC_URL`
   - `JWT_SECRET` avtomatik generatsiya bo'ladi
3. Deploy tugagach manzilni oling: `https://testhub-backend.onrender.com`
4. Tekshirish: `https://testhub-backend.onrender.com/api` ochilsa — backend ishlayapti.

> Migratsiyalar `npx prisma migrate deploy` orqali har deploy'da avtomatik qo'llanadi.
> ⚠️ Bepul Render 15 daqiqa harakatsizda uxlaydi — birinchi so'rov ~50s sekin.

---

## 4. Vercel — frontend (Next.js, bepul)
1. https://vercel.com → **Add New Project** → GitHub repo.
2. **Root Directory** = `frontend`.
3. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL` = `https://testhub-backend.onrender.com/api`
4. **Deploy**. Manzil: `https://testhub.vercel.app`

---

## 5. Bog'lash (oxirgi qadam)
1. Vercel manzilini Render'dagi `FRONTEND_URL`'ga qo'shing → backend qayta deploy bo'ladi (CORS uchun).
2. Tayyor! Saytni Vercel manzilidan oching.

---

## Tez tekshiruv ro'yxati
- [ ] `/api` ochiladi (backend tirik)
- [ ] Login/ro'yxatdan o'tish ishlaydi (baza ulangan)
- [ ] Admin rasm yuklaydi va u ko'rinadi (R2 public)
- [ ] 41-43 AI tekshiruvi ball qo'yadi (OpenRouter + R2 URL o'qildi)
