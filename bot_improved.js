const { Telegraf, Markup, session } = require('telegraf');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// ⚠️ DIQQAT: Tokenni xavfsiz joyda saqlang!
const TOKEN = '8260246769:AAHP0OOyCv_JrOWhVRsD0rsImN7REvhFUz4';

// Logging funksiyasi
const logFile = 'bot.log';
const log = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage);
    fs.appendFileSync(logFile, logMessage);
};

// MySQL Pool sozlamasi
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'padval',
    waitForConnections: true,
    connectionLimit: 10
});

// Database ulanishini tekshirish
async function checkDatabase() {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT COUNT(*) as total FROM tavarlar');
        connection.release();
        log(`✅ Database ulanishda muvaffaq. Jami tavarlar: ${rows[0].total}`);
        return true;
    } catch (err) {
        log(`❌ Database ulanishda xatolik: ${err.message}`);
        return false;
    }
}

const bot = new Telegraf(TOKEN);
bot.use(session());

/* =======================
   🎛 KLAVIATURALAR
======================= */
const mainKeyboard = Markup.keyboard([
    ['➕ Tavar qo\'shish', '📊 Statistika'],
    ['🔍 Tavarlarni ko\'rish', '⚙️ Sozlamalar']
]).resize();

const settingsKeyboard = Markup.keyboard([
    ['📥 Backup olish', '🔄 Bazani yangilash'],
    ['⬅️ Orqaga']
]).resize();

/* =======================
   🚀 START KOMANDASĪ
======================= */
bot.start((ctx) => {
    ctx.session = {};
    log(`👤 Yangi foydalanuvchi: ${ctx.from.id} - ${ctx.from.first_name}`);
    ctx.reply(
        "🚀 <b>Ombor boshqaruv tizimiga xush kelibsiz!</b>\n\n" +
        "Quyidagi amallarni bajarishingiz mumkin:\n" +
        "➕ Tavarlarni qo'shish\n" +
        "🔍 Tavarlarni qidirish\n" +
        "✏️ Tahrirlash\n" +
        "🗑 O'chirish\n" +
        "📊 Statistika ko'rish",
        { parse_mode: 'HTML', ...mainKeyboard }
    );
});

/* =======================
   📊 STATISTIKA
======================= */
bot.hears('📊 Statistika', async (ctx) => {
    try {
        const [totalRows] = await pool.execute('SELECT COUNT(*) as total FROM tavarlar');
        const [qatorRows] = await pool.execute('SELECT DISTINCT qator FROM tavarlar');
        const [bolimRows] = await pool.execute('SELECT DISTINCT bolim FROM tavarlar');
        
        const stats = `📊 <b>STATISTIKA</b>
        
📦 Jami tavarlar: <b>${totalRows[0].total}</b>
📍 Turli qatorlar: <b>${qatorRows.length}</b>
🔢 Turli bo'limlar: <b>${bolimRows.length}</b>`;
        
        ctx.reply(stats, { parse_mode: 'HTML', ...mainKeyboard });
        log(`📊 Statistika so'raldi: ${ctx.from.id}`);
    } catch (err) {
        log(`❌ Statistika xatosi: ${err.message}`);
        ctx.reply("❌ Statistika o'qishda xatolik yuz berdi!", mainKeyboard);
    }
});

/* =======================
   🔍 TAVARLARNI KO'RISH
======================= */
bot.hears('🔍 Tavarlarni ko\'rish', async (ctx) => {
    try {
        const [results] = await pool.execute('SELECT id, nomi, qator, bolim FROM tavarlar LIMIT 10');
        
        if (results.length === 0) {
            return ctx.reply("📭 Bazada hech qanday tavar topilmadi.", mainKeyboard);
        }
        
        ctx.reply("📦 <b>Oxirgi 10 ta tavar:</b>\n", { parse_mode: 'HTML' });
        
        for (const item of results) {
            await ctx.reply(`📦 <b>${item.nomi}</b>\n📍 Joyi: <b>${item.qator}-${item.bolim}</b>`, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✏️ Tahrirlash', `edit_${item.id}`),
                        Markup.button.callback('🗑 O\'chirish', `del_${item.id}`)
                    ]
                ])
            });
        }
        log(`🔍 Tavarlarni ko'rdi: ${ctx.from.id}`);
    } catch (err) {
        log(`❌ Ko'rish xatosi: ${err.message}`);
        ctx.reply("❌ Xatolik yuz berdi!", mainKeyboard);
    }
});

/* =======================
   ➕ QO'SHISH
======================= */
bot.hears('➕ Tavar qo\'shish', (ctx) => {
    ctx.session.adding = { step: 1 };
    ctx.reply("📦 Tavar nomini kiriting (Masalan: 222):", Markup.removeKeyboard());
    log(`➕ Tavar qo'shishni boshladi: ${ctx.from.id}`);
});

/* =======================
   ✏️ TAHRIRLASH
======================= */
bot.action(/^edit_(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    try {
        const [rows] = await pool.execute('SELECT * FROM tavarlar WHERE id = ?', [id]);
        if (rows.length === 0) return ctx.answerCbQuery("❌ Topilmadi");

        const item = rows[0];
        ctx.session.editTarget = { id: id };

        const text = `🛠 <b>Tahrirlash:</b> ${item.nomi}\n📍 Hozirgi joyi: ${item.qator}-${item.bolim}\n\nNimani o'zgartirmoqchisiz?`;
        
        await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📦 Nomini', `set_nomi_${id}`)],
                [Markup.button.callback('📍 Qatorni', `set_qator_${id}`)],
                [Markup.button.callback('🔢 Bo'limni', `set_bolim_${id}`)],
                [Markup.button.callback('❌ Bekor qilish', `cancel_edit`)]
            ])
        });
        log(`✏️ Tahrirlash boshladi - ID: ${id}, User: ${ctx.from.id}`);
    } catch (e) {
        log(`❌ Tahrirlash xatosi: ${e.message}`);
        ctx.reply("❌ Xatolik yuz berdi.");
    }
});

// Tahrirlash uchun ustunga o'tish
bot.action(/^set_(nomi|qator|bolim)_(\d+)$/, (ctx) => {
    const field = ctx.match[1];
    const id = ctx.match[2];
    ctx.session.editTarget = { id, field };

    const labels = { 
        nomi: "Yangi nomni", 
        qator: "Yangi qatorni (Masalan: A)", 
        bolim: "Yangi bo'limni (Masalan: 5)" 
    };
    ctx.reply(`${labels[field]} yuboring:`);
});

// Bekor qilish
bot.action('cancel_edit', (ctx) => {
    ctx.session.editTarget = null;
    ctx.deleteMessage().catch(() => {});
    ctx.reply("Tahrirlash bekor qilindi.", mainKeyboard);
});

/* =======================
   🗑 O'CHIRISH
======================= */
bot.action(/^del_(\d+)$/, async (ctx) => {
    try {
        await pool.execute('DELETE FROM tavarlar WHERE id=?', [ctx.match[1]]);
        await ctx.deleteMessage().catch(() => {});
        ctx.answerCbQuery("🗑 Tavar o'chirildi");
        log(`🗑 Tavar o'chirildi - ID: ${ctx.match[1]}, User: ${ctx.from.id}`);
    } catch (err) {
        log(`❌ O'chirish xatosi: ${err.message}`);
        ctx.answerCbQuery("❌ O'chirishda xatolik!");
    }
});

/* =======================
   ⚙️ SOZLAMALAR
======================= */
bot.hears('⚙️ Sozlamalar', (ctx) => {
    ctx.reply("⚙️ Sozlamalar menyu:", settingsKeyboard);
});

bot.hears('📥 Backup olish', async (ctx) => {
    try {
        ctx.reply("⏳ Backup tayyorlanmoqda...");
        
        const [rows] = await pool.execute('SELECT * FROM tavarlar');
        const backupData = JSON.stringify(rows, null, 2);
        
        const backupFile = `backup_${Date.now()}.json`;
        fs.writeFileSync(backupFile, backupData);
        
        ctx.replyWithDocument(
            { source: fs.createReadStream(backupFile) },
            { caption: '✅ Backup muvaffaqiyatli!' }
        );
        
        fs.unlinkSync(backupFile);
        log(`📥 Backup olindi: ${ctx.from.id}`);
    } catch (err) {
        log(`❌ Backup xatosi: ${err.message}`);
        ctx.reply("❌ Backup olinishda xatolik!");
    }
});

bot.hears('🔄 Bazani yangilash', async (ctx) => {
    try {
        ctx.reply("🔄 Baza tekshirilmoqda...");
        
        const [rows] = await pool.execute('SELECT COUNT(*) as count FROM tavarlar');
        ctx.reply(`✅ Baza sog'lom! Jami ${rows[0].count} ta tavar`, mainKeyboard);
        log(`🔄 Baza tekshirildi: ${ctx.from.id}`);
    } catch (err) {
        log(`❌ Tekshirish xatosi: ${err.message}`);
        ctx.reply("❌ Xatolik yuz berdi!", mainKeyboard);
    }
});

bot.hears('⬅️ Orqaga', (ctx) => {
    ctx.reply("⬅️ Asosiy menyuga qaytdingiz.", mainKeyboard);
});

/* =======================
   🔥 ASOSIY MATN QABUL QILUVCHI
======================= */
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!ctx.session) ctx.session = {};

    // 1. TAHRIRLASH
    if (ctx.session.editTarget && ctx.session.editTarget.field) {
        const { id, field } = ctx.session.editTarget;
        const finalValue = field === 'qator' ? text.toUpperCase() : text;

        try {
            await pool.execute(`UPDATE tavarlar SET ${field} = ? WHERE id = ?`, [finalValue, id]);
            ctx.session.editTarget = null;
            ctx.reply(`✅ Ma'lumot yangilandi!`, mainKeyboard);
            log(`✏️ Tavar yangilandi - ID: ${id}, Field: ${field}, User: ${ctx.from.id}`);
        } catch (err) {
            log(`❌ Yangilash xatosi: ${err.message}`);
            ctx.reply("❌ Yangilashda xatolik!");
        }
        return;
    }

    // 2. QO'SHISH JARAYONI
    if (ctx.session.adding) {
        const add = ctx.session.adding;
        if (add.step === 1) {
            add.nomi = text;
            add.step = 2;
            return ctx.reply("📍 Qatorni kiriting (Masalan: B):");
        }
        if (add.step === 2) {
            add.qator = text.toUpperCase();
            add.step = 3;
            return ctx.reply("🔢 Bo'limni kiriting:");
        }
        if (add.step === 3) {
            try {
                await pool.execute('INSERT INTO tavarlar (nomi, qator, bolim) VALUES (?, ?, ?)', 
                    [add.nomi, add.qator, text]);
                ctx.session.adding = null;
                ctx.reply(`✅ Saqlandi: ${add.nomi} (Joyi: ${add.qator}-${text})`, mainKeyboard);
                log(`➕ Yangi tavar qo'shildi: ${add.nomi}, User: ${ctx.from.id}`);
            } catch (err) {
                log(`❌ Qo'shish xatosi: ${err.message}`);
                ctx.reply("❌ Qo'shishda xatolik!");
            }
        }
        return;
    }

    // 3. QIDIRUV
    const loading = await ctx.reply("🔎 Qidirilmoqda...");
    try {
        const [results] = await pool.execute(
            "SELECT id, nomi, qator, bolim FROM tavarlar WHERE nomi LIKE ? OR qator LIKE ? OR bolim LIKE ?",
            [`%${text}%`, `%${text}%`, `%${text}%`]
        );

        await ctx.deleteMessage(loading.message_id).catch(() => {});

        if (results.length === 0) {
            ctx.reply("❌ Hech narsa topilmadi.", mainKeyboard);
            log(`🔍 Qidiruv natijasi yo'q: "${text}", User: ${ctx.from.id}`);
            return;
        }

        ctx.reply(`✅ ${results.length} ta natija topildi:\n`);
        
        for (const item of results) {
            await ctx.reply(`📦 <b>${item.nomi}</b>\n📍 Joyi: <b>${item.qator}-${item.bolim}</b>`, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✏️ Tahrirlash', `edit_${item.id}`),
                        Markup.button.callback('🗑 O\'chirish', `del_${item.id}`)
                    ]
                ])
            });
        }
        log(`🔍 Qidiruv: "${text}", Natijalar: ${results.length}, User: ${ctx.from.id}`);
    } catch (e) {
        await ctx.deleteMessage(loading.message_id).catch(() => {});
        log(`❌ Qidiruv xatosi: ${e.message}`);
        ctx.reply("❌ Qidiruvda xatolik.", mainKeyboard);
    }
});

// Xavfsiz o'chirishlar uchun error handling
bot.catch((err, ctx) => {
    log(`⚠️ Bot xatosi: ${err.message}`);
    ctx.reply("❌ Noma'lum xatolik yuz berdi!");
});

/* =======================
   🚀 ISHGA TUSHIRISH
======================= */
async function startBot() {
    const dbConnected = await checkDatabase();
    
    if (!dbConnected) {
        log("❌ Bot ishga tushurilmadi: Database ulanmadi!");
        process.exit(1);
    }

    bot.launch().then(() => {
        log("🚀 ✅ Bot muvaffaqiyatli ishga tushdi!");
        log(`📝 Barcha harakatlar '${logFile}' faylda saqlanmoqda`);
    }).catch((err) => {
        log(`❌ Bot ishga tushurishda xatolik: ${err.message}`);
    });
}

startBot();

// Graceful stop
process.once('SIGINT', () => {
    log("🛑 Bot to'xtatildi (SIGINT)");
    bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
    log("🛑 Bot to'xtatildi (SIGTERM)");
    bot.stop('SIGTERM');
});
