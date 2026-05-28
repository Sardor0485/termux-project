# 🚀 Telegram Bot Render.com-da Deploy

## Qo'llanma

### 1️⃣ Render.com-ga ro'yxatdan o'tish
1. [https://render.com](https://render.com) saytiga kiring
2. GitHub akkaunt bilan login qiling
3. "New" tugmasini bosing → "Web Service" tanlang

### 2️⃣ Repository ulanish
1. GitHub repositoryingizni tanlang
2. Branch: `main` tanlang
3. Build command: `npm install`
4. Start command: `npm start`

### 3️⃣ Environment Variables o'rnatish
Render dashboardda quyidagi o'zgaruvchilarni qo'shing:

```
BOT_TOKEN = 8260246769:AAHP0OOyCv_JrOWhVRsD0rsImN7REvhFUz4
DB_HOST = your-mysql-host
DB_USER = your-db-user
DB_PASSWORD = your-db-password
DB_NAME = padval
NODE_ENV = production
```

### 4️⃣ Database ulanish

#### Option A: Render.com MySQL (TAVSIYA QILINADI)
1. Render Dashboard-da "MySQL" database yarating
2. Connection details-ni ko'ching
3. Environment variables-ga qo'shing

#### Option B: Tashqi MySQL Server
1. MySQL hosting platformasini tanlang (RapidSQL, PlanetScale, AWS RDS)
2. `padval_backup.sql` faylini import qiling
3. Connection details-ni o'rnatish

### 5️⃣ Deploy qilish
```bash
git push origin main
```

Render avtomatik ravishda deployment qiladi. `Logs` tab-da barcha harakatlarni ko'rishingiz mumkin.

---

## 🔗 Tavsiya qilinadigan MySQL Hosting-lar

| Platform | Narxi | Afzalliqlari |
|----------|-------|-------------|
| **PlanetScale** | Free | MySQL compatible, Serverless |
| **RapidSQL** | Free | Simple setup, CLI support |
| **AWS RDS** | Free tier | Ishonchli, scalable |
| **Render MySQL** | Free | Render bilan birgalikda |

---

## 🐛 Xatolarni Tuzatish

### Database ulanishda xato
```bash
# Logs-da tekshiring
DB Host va credentials to'g'ri ekanini tasdiqlang
```

### Bot ishga tushmayapti
```bash
# Token to'g'riligiini tekshiring
# Telegram @BotFather-da token regenerate qiling
```

---

## 📊 Monitoring

1. Render Dashboard-da bot statusini tekshiring
2. `Logs` tab-da barcha harakatlar ko'ruvchi
3. Database connection logs-ni tekshiring

---

## 💡 Sozlamalar

### Auto-Restart
Render "Restart Policy"-ni avtomatik qilib qo'yadi.

### Health Check
Bot har 30 soniyada database-ga ping yuboradi.

---

## ✅ Muvaffaqiyatli Deploy Belgisi

```
✅ Build succeeded
✅ Bot successfully started
✅ Database connection established
🚀 ✅ Bot muvaffaqiyatli ishga tushdi!
```

---

## 📱 Bot ishlatish

Telegram-da bot-ni topib `/start` komandasini yuboring.

Bo'lajakda bot 24/7 ishlab turibdi! 🎉
