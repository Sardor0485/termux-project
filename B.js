const { Telegraf, Markup, session } = require('telegraf');
const mysql = require('mysql2/promise');

const TOKEN = '8260246769:AAHP0OOyCv_JrOWhVRsD0rsImN7REvhFUz4';

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'padval',
    waitForConnections: true,
    connectionLimit: 10
});

const bot = new Telegraf(TOKEN);
bot.use(session());

/* =======================
   🎛 ASOSIY KLAVIATURA
======================= */
const mainKeyboard = Markup.keyboard([
    ['➕ Tavar qo\'shish', '📊 Statistika']
]).resize();

/* =======================
   🚀 START
======================= */
bot.start((ctx) => {
    ctx.session = {};
    ctx.reply("🚀 Ombor tizimi tayyor.\n\nMisol: A-1 deb yozsangiz, A qator 1-bo'limdagi tavarlar chiqadi.", mainKeyboard);
});

/* =======================
   📊 STATISTIKA (YANGI)
======================= */
bot.hears('📊 Statistika', async (ctx) => {
    try {
        const [rows] = await pool.execute('SELECT COUNT(*) as total FROM tavarlar');
        ctx.reply(`📊 Omboringizda jami: <b>${rows[0].total}</b> ta tavar bor.`, { parse_mode: 'HTML' });
    } catch (err) {
        ctx.reply("❌ Ma'lumotlar bazasida xatolik!");
    }
});

/* =======================
   ➕ QO‘SHISH
======================= */
bot.hears('➕ Tavar qo\'shish', (ctx) => {
    ctx.session.adding = { step: 1 };
    ctx.reply("📦 Tavar nomini kiriting:", Markup.removeKeyboard());
});

/* =======================
   ✏️ TAHRIRLASH (YANGI MANTIQ)
======================= */
bot.action(/^edit_(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    try {
        const [rows] = await pool.execute('SELECT * FROM tavarlar WHERE id = ?', [id]);
        if (rows.length === 0) return ctx.answerCbQuery("❌ Topilmadi");

        const item = rows[0];
        ctx.session.editTarget = { id: id };

        const text = `🛠 <b>Tahrirlash:</b> ${item.nomi}\n📍 Joyi: ${item.qator}-${item.bolim}\n\nNimani o'zgartiramiz?`;

        await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📦 Nomi', `set_nomi_${id}`), Markup.button.callback('📍 Qator', `set_qator_${id}`)],
                [Markup.button.callback('🔢 Bo‘lim', `set_bolim_${id}`)],
                [Markup.button.callback('❌ Bekor qilish', `cancel_edit`)]
            ])
        });
    } catch (e) {
        ctx.reply("❌ Xatolik yuz berdi.");
    }
});

bot.action(/^set_(nomi|qator|bolim)_(\d+)$/, (ctx) => {
    const field = ctx.match[1];
    const id = ctx.match[2];
    ctx.session.editTarget = { id, field };
    const labels = { nomi: "yangi nomni", qator: "yangi qatorni (A, B...)", bolim: "yangi bo'limni (1, 2...)" };
    ctx.reply(`Marhamat, ${labels[field]} yuboring:`);
});

bot.action('cancel_edit', (ctx) => {
    ctx.session.editTarget = null;
    ctx.deleteMessage().catch(() => {});
    ctx.reply("Tahrirlash bekor qilindi.", mainKeyboard);
});

/* =======================
   🗑 O'CHIRISH
======================= */
bot.action(/^del_(\d+)$/, async (ctx) => {
    await pool.execute('DELETE FROM tavarlar WHERE id=?', [ctx.match[1]]);
    await ctx.deleteMessage().catch(() => {});
    ctx.answerCbQuery("🗑 O'chirildi");
});

/* =======================
   🔥 ASOSIY MANTIQ (TEXT HANDLING)
======================= */
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!ctx.session) ctx.session = {};

    // 1. TAHRIRLASH QIYMATINI QABUL QILISH
    if (ctx.session.editTarget && ctx.session.editTarget.field) {
        const { id, field } = ctx.session.editTarget;
        const val = field === 'qator' ? text.toUpperCase() : text;
        try {
            await pool.execute(`UPDATE tavarlar SET ${field} = ? WHERE id = ?`, [val, id]);
            ctx.session.editTarget = null;
            return ctx.reply("✅ Yangilandi!", mainKeyboard);
        } catch (e) {
            return ctx.reply("❌ Xatolik: Bazaga yozishda muammo.");
        }
    }

    // 2. QO'SHISH BOSQICHLARI
    if (ctx.session.adding) {
        const add = ctx.session.adding;
        if (add.step === 1) { 
            add.nomi = text; add.step = 2; 
            return ctx.reply("📍 Qatorni kiriting (A, B...):"); 
        }
        if (add.step === 2) { 
            add.qator = text.toUpperCase(); add.step = 3; 
            return ctx.reply("🔢 Bo'limni kiriting:"); 
        }
        if (add.step === 3) {
            await pool.execute('INSERT INTO tavarlar (nomi, qator, bolim) VALUES (?, ?, ?)', [add.nomi, add.qator, text]);
            ctx.session.adding = null;
            return ctx.reply(`✅ Saqlandi: ${add.nomi}`, mainKeyboard);
        }
    }

    // 3. QIDIRUV (ESKI + YANGI KOMBINATSIYA)
    const loading = await ctx.reply("🔎 Qidirilmoqda...");
    try {
        let results;
        if (text.includes('-')) {
            const [v1, v2] = text.split('-').map(s => s.trim());
            [results] = await pool.execute(
                "SELECT * FROM tavarlar WHERE (qator = ? AND bolim = ?) OR (nomi = ? AND bolim = ?)", 
                [v1.toUpperCase(), v2, v1.toUpperCase(), v2]
            );
        } else {
            [results] = await pool.execute(
                "SELECT * FROM tavarlar WHERE nomi LIKE ? OR qator LIKE ? OR bolim LIKE ?", 
                [`%${text}%`, `%${text}%`, `%${text}%`]
            );
        }

        await ctx.deleteMessage(loading.message_id).catch(() => {});

        if (results.length === 0) return ctx.reply("❌ Hech narsa topilmadi.");

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
    } catch (e) {
        ctx.reply("❌ Qidiruvda xatolik.");
    }
});

bot.launch().then(() => console.log("✅ Bot ishga tushdi!"));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

