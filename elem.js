const { Telegraf, Markup, session } = require('telegraf');
const mysql = require('mysql2/promise');

// --- KONFIGURATSIYA ---
const TOKEN = '8088217797:AAHcSdgdfwPyA7YwjJMLCk6pswQgZfLvdck';
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'ambar',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Connection Pool - Bazaga barqaror ulanish uchun
const pool = mysql.createPool(dbConfig);

const bot = new Telegraf(TOKEN);
bot.use(session());

// Ma'lumotlar bazasi funksiyasi
async function executeQuery(sql, params) {
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (err) {
        console.error("🚫 DB Xatosi:", err.message);
        throw err;
    }
}

/* =======================
   ⌨️ TUGMALAR
======================= */
const keyboards = {
    main: () => Markup.keyboard([
        ['➕ Tovar qo\'shish', '📊 Statistika']
    ]).resize(),
    cancel: () => Markup.keyboard([['❌ Bekor qilish']]).resize()
};

/* =======================
   🚀 START
======================= */
bot.start((ctx) => {
    ctx.session = {}; 
    ctx.reply("📦 Lentalar ombori tizimiga xush kelibsiz!\nKerakli bo'limni tanlang:", keyboards.main());
});

/* =======================
   📊 STATISTIKA
======================= */
bot.hears('📊 Statistika', async (ctx) => {
    try {
        const stats = await executeQuery("SELECT row_char, COUNT(*) as count FROM main_items GROUP BY row_char ORDER BY row_char", []);
        const totalItems = await executeQuery("SELECT SUM(count) as total_qty FROM main_items", []);

        let report = "📊 *Baza statistikasi:*\n\n";
        stats.forEach(s => {
            const star = ['F', 'G', 'H'].includes(s.row_char.toUpperCase()) ? "⭐ " : "🔹 ";
            report += `${star}${s.row_char} qatori: ${s.count} turdagi tovar\n`;
        });
        report += `\n🔢 *Umumiy miqdor: ${totalItems[0].total_qty || 0} ta*`;

        ctx.replyWithMarkdown(report, keyboards.main());
    } catch (e) {
        ctx.reply("❌ Statistika yuklashda xato!");
    }
});

/* =======================
   ✏️ TAHRIRLASH (ACTION)
======================= */
bot.action(/^edit_(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    const rows = await executeQuery("SELECT * FROM main_items WHERE id = ?", [id]);

    if (rows.length === 0) return ctx.answerCbQuery("❌ Topilmadi");

    const item = rows[0];
    ctx.session.editTarget = { id: id };

    const text = `📝 *Tahrirlash:* ${item.code}\n` +
                 `📍 Joyi: ${item.row_char}-${item.row_num}-st, ${item.col_num}-et\n` +
                 `🔢 Soni: ${item.count || 0} ta\n\n` +
                 `Nimani o'zgartirmoqchisiz?`;

    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('Kod', `set_code_${id}`), Markup.button.callback('Qator', `set_row_${id}`)],
            [Markup.button.callback('Stellaj', `set_st_${id}`), Markup.button.callback('Etaj', `set_et_${id}`)],
            [Markup.button.callback('🔢 Soni', `set_qty_${id}`)],
            [Markup.button.callback('⬅️ Orqaga', 'cancel_edit')]
        ])
    });
});

bot.action(/^set_(code|row|st|et|qty)_(\d+)$/, async (ctx) => {
    const field = ctx.match[1];
    ctx.session.editTarget = { id: ctx.match[2], field: field };

    const labels = {
        code: "Yangi kodni kiriting:",
        row: "Yangi qatorni kiriting (Masalan: A):",
        st: "Yangi stellaj raqamini kiriting:",
        et: "Yangi etaj raqamini kiriting:",
        qty: "Yangi sonini kiriting:"
    };

    await ctx.reply(labels[field], keyboards.cancel());
    await ctx.answerCbQuery();
});

/* =======================
   🗑 O'CHIRISH
======================= */
bot.action(/^del_confirm_(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
        [Markup.button.callback('✅ Tasdiqlash (O\'chirish)', `del_yes_${id}`)],
        [Markup.button.callback('❌ Bekor qilish', `edit_${id}`)]
    ]).reply_markup);
});

bot.action(/^del_yes_(\d+)$/, async (ctx) => {
    await executeQuery("DELETE FROM main_items WHERE id = ?", [ctx.match[1]]);
    await ctx.answerCbQuery("🗑 O'chirildi");
    await ctx.deleteMessage().catch(() => {});
});

bot.action('cancel_edit', async (ctx) => {
    ctx.session.editTarget = null;
    await ctx.deleteMessage();
    await ctx.reply("Amal bekor qilindi.", keyboards.main());
});

/* =======================
   🔥 ASOSIY HANDLER
======================= */
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!ctx.session) ctx.session = {};

    // 0. Bekor qilish
    if (text === '❌ Bekor qilish') {
        ctx.session = {};
        return ctx.reply("Barcha amallar bekor qilindi.", keyboards.main());
    }

    // 1. Tahrirlashni saqlash
    if (ctx.session.editTarget && ctx.session.editTarget.field) {
        const { id, field } = ctx.session.editTarget;
        const dbFields = { code: 'code', row: 'row_char', st: 'row_num', et: 'col_num', qty: 'count' };
        const val = (field === 'row') ? text.toUpperCase() : text;

        try {
            await executeQuery(`UPDATE main_items SET ${dbFields[field]} = ? WHERE id = ?`, [val, id]);
            ctx.session.editTarget = null;
            return ctx.reply("✅ Muvaffaqiyatli yangilandi!", keyboards.main());
        } catch (error) {
            return ctx.reply("❌ Xato! Ma'lumot formatini tekshiring.");
        }
    }

    // 2. Qo'shishni boshlash
    if (text === '➕ Tovar qo\'shish') {
        ctx.session.step = 'GET_CODE';
        ctx.session.data = {};
        return ctx.reply("📦 Yangi tovar kodini yuboring:", keyboards.cancel());
    }

    // 3. Qo'shish bosqichlari (FSM)
    if (ctx.session.step) {
        switch (ctx.session.step) {
            case 'GET_CODE':
                ctx.session.data.code = text;
                ctx.session.step = 'GET_ROW';
                return ctx.reply("📍 Qator (Masalan: A):");
            case 'GET_ROW':
                ctx.session.data.row_char = text.toUpperCase();
                ctx.session.step = 'GET_ST';
                return ctx.reply("🔢 Stellaj raqami:");
            case 'GET_ST':
                ctx.session.data.row_num = text;
                ctx.session.step = 'GET_ET';
                return ctx.reply("🏢 Etaj raqami:");
            case 'GET_ET':
                ctx.session.data.col_num = text;
                ctx.session.step = 'GET_QTY';
                return ctx.reply("🔢 Soni (Nechta):");
            case 'GET_QTY':
                try {
                    const d = ctx.session.data;
                    await executeQuery(
                        "INSERT INTO main_items (code, row_char, row_num, col_num, count) VALUES (?, ?, ?, ?, ?)",
                        [d.code, d.row_char, d.row_num, d.col_num, text]
                    );
                    ctx.session.step = null;
                    return ctx.reply("✅ Tovar muvaffaqiyatli qo'shildi!", keyboards.main());
                } catch (e) {
                    ctx.session.step = null;
                    return ctx.reply("❌ Xato! Manzil band yoki baza xatosi.", keyboards.main());
                }
        }
    }

    // 4. Qidiruv
    if (text !== '📊 Statistika') {
        const results = await executeQuery(
            `SELECT * FROM main_items WHERE code LIKE ? OR row_char = ? LIMIT 10`, 
            [`%${text}%`, text.toUpperCase()]
        );
        
        if (results.length === 0) return ctx.reply("🔍 Hech narsa topilmadi.");

        for (const item of results) {
            const star = ['F', 'G', 'H'].includes(item.row_char.toUpperCase()) ? "⭐" : "";
            const msg = `📦 Kod: *${item.code}*\n📍 Joyi: ${star}${item.row_char} qator, st-${item.row_num}, et-${item.col_num}\n🔢 Soni: *${item.count || 0}* ta`;

            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
                [Markup.button.callback('📝 Edit', `edit_${item.id}`), Markup.button.callback('🗑 O\'chirish', `del_confirm_${item.id}`)]
            ]));
        }
    }
});

// Botni ishga tushirish
bot.launch().then(() => console.log("🚀 Ombor Bot ishga tushdi!"));

// Xavfsiz to'xtatish
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

