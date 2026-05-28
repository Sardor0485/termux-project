const { Telegraf, Markup, session } = require('telegraf');
const mysql = require('mysql2/promise');

// --- KONFIGURATSIYA ---
const TOKEN = '8088217797:AAHcSdgdfwPyA7YwjJMLCk6pswQgZfLvdck';
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Termuxda parolsiz bo'lsa bo'sh qoldiring
    database: 'ambar'
};

const bot = new Telegraf(TOKEN, {
    handlerTimeout: 90_000 // Ulanish vaqti biroz uzaytirildi
});

bot.use(session());

// Ma'lumotlar bazasi bilan ishlash
async function executeQuery(sql, params) {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(sql, params);
        return rows;
    } catch (err) {
        console.error("DB Xatosi:", err.message);
        throw err;
    } finally {
        if (connection) await connection.end();
    }
}

// Tugmalar
const mainKeyboard = Markup.keyboard([
    ['➕ Tovar qo\'shish', '📊 Statistika']
]).resize();

/* =======================
   🚀 START & HELP
======================= */
bot.start((ctx) => {
    ctx.session = {}; // Sessionni tozalash
    ctx.reply("📦 Lentalar ombori tizimiga xush kelibsiz!", mainKeyboard);
});

/* =======================
   📊 STATISTIKA
======================= */
bot.hears('📊 Statistika', async (ctx) => {
    try {
        const stats = await executeQuery("SELECT row_char, COUNT(*) as count FROM main_items GROUP BY row_char ORDER BY row_char", []);
        const totalRows = await executeQuery("SELECT COUNT(*) as total FROM main_items", []);
        const totalItems = await executeQuery("SELECT SUM(count) as total_qty FROM main_items", []);

        let report = "📊 *Baza statistikasi:*\n\n";
        stats.forEach(s => {
            let star = ['F', 'G', 'H'].includes(s.row_char.toUpperCase()) ? "⭐ " : "🔹 ";
            report += `${star}${s.row_char} qatori: ${s.count} ta\n`;
        });
        report += `\n📦 *Jami turlar: ${totalRows[0].total} ta*`;
        report += `\n🔢 *Umumiy miqdor: ${totalItems[0].total_qty || 0} ta*`;

        ctx.replyWithMarkdown(report);
    } catch (e) {
        ctx.reply("❌ Statistika yuklashda xato!");
    }
});

/* =======================
   ✏️ TAHRIRLASH BOSHQARUVI
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

    await ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
        [Markup.button.callback('Kod', `set_code_${id}`), Markup.button.callback('Qator', `set_row_${id}`)],
        [Markup.button.callback('Stellaj', `set_st_${id}`), Markup.button.callback('Etaj', `set_et_${id}`)],
        [Markup.button.callback('🔢 Soni', `set_qty_${id}`)],
        [Markup.button.callback('❌ Bekor qilish', 'cancel_action')]
    ]));
    await ctx.answerCbQuery();
});

bot.action(/^set_(code|row|st|et|qty)_(\d+)$/, async (ctx) => {
    const field = ctx.match[1];
    ctx.session.editTarget = { id: ctx.match[2], field: field };

    const labels = {
        code: "Yangi kodni kiriting:",
        row: "Yangi qatorni kiriting (A, B...):",
        st: "Yangi stellaj raqamini kiriting:",
        et: "Yangi etaj raqamini kiriting:",
        qty: "Yangi sonini kiriting:"
    };

    await ctx.reply(labels[field]);
    await ctx.answerCbQuery();
});

/* =======================
   🗑 O'CHIRISH
======================= */
bot.action(/^del_(\d+)$/, async (ctx) => {
    await executeQuery(`DELETE FROM main_items WHERE id = ?`, [ctx.match[1]]);
    await ctx.answerCbQuery("🗑 O'chirildi");
    await ctx.deleteMessage().catch(() => {});
});

bot.action('cancel_action', async (ctx) => {
    ctx.session.editTarget = null;
    await ctx.editMessageText("Amal bekor qilindi.");
});

/* =======================
   🔥 ASOSIY HANDLER
======================= */
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!ctx.session) ctx.session = {};

    // 1. Tahrirlashni saqlash
    if (ctx.session.editTarget && ctx.session.editTarget.field) {
        const { id, field } = ctx.session.editTarget;
        const dbFields = { code: 'code', row: 'row_char', st: 'row_num', et: 'col_num', qty: 'count' };
        const val = (field === 'row') ? text.toUpperCase() : text;

        try {
            await executeQuery(`UPDATE main_items SET ${dbFields[field]} = ? WHERE id = ?`, [val, id]);
            ctx.session.editTarget = null;
            return ctx.reply("✅ Yangilandi!", mainKeyboard);
        } catch (error) {
            return ctx.reply("❌ Xato! Ehtimol bu joy banddir.");
        }
    }

    // 2. Qo'shishni boshlash
    if (text === '➕ Tovar qo\'shish') {
        ctx.session.step = 'get_code';
        ctx.session.data = {};
        return ctx.reply("📦 Yangi tovar kodini yuboring:", Markup.removeKeyboard());
    }

    // 3. Qo'shish bosqichlari
    if (ctx.session.step) {
        const steps = {
            'get_code': { next: 'get_row', field: 'code', msg: "📍 Qator (Masalan: A):" },
            'get_row': { next: 'get_st', field: 'row_char', msg: "🔢 Stellaj raqami:", format: t => t.toUpperCase() },
            'get_st': { next: 'get_et', field: 'row_num', msg: "🏢 Etaj raqami:" },
            'get_et': { next: 'get_qty', field: 'col_num', msg: "🔢 Soni:" }
        };

        const current = steps[ctx.session.step];
        if (current) {
            ctx.session.data[current.field] = current.format ? current.format(text) : text;
            ctx.session.step = current.next;
            return ctx.reply(current.msg);
        }

        if (ctx.session.step === 'get_qty') {
            const d = ctx.session.data;
            try {
                await executeQuery(
                    "INSERT INTO main_items (code, row_char, row_num, col_num, count, color) VALUES (?, ?, ?, ?, ?, 'def')",
                    [d.code, d.row_char, d.row_num, d.col_num, text]
                );
                ctx.session.step = null;
                return ctx.reply("✅ Qo'shildi!", mainKeyboard);
            } catch (e) {
                ctx.session.step = null;
                return ctx.reply("❌ Xato! Manzil band yoki baza ulanmagan.", mainKeyboard);
            }
        }
    }

    // 4. Qidiruv
    if (text !== '📊 Statistika') {
        const results = await executeQuery(`SELECT * FROM main_items WHERE code LIKE ? OR row_char = ?`, [`%${text}%`, text.toUpperCase()]);
        if (results.length === 0) return ctx.reply("🔍 Hech narsa topilmadi.");

        for (const item of results) {
            const star = ['F', 'G', 'H'].includes(item.row_char.toUpperCase()) ? "⭐" : "";
            const msg = `📦 Kod: *${item.code}*\n📍 Joyi: ${star}${item.row_char} qator, st-${item.row_num}, et-${item.col_num}\n🔢 Soni: *${item.count || 0}* ta`;

            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
                [Markup.button.callback('📝 Edit', `edit_${item.id}`), Markup.button.callback('🗑 O\'chirish', `del_${item.id}`)]
            ]));
        }
    }
});

// Botni ishga tushirish (Xatolikka qarshi qayta urinish bilan)
const startBot = async () => {
    try {
        await bot.launch();
        console.log("🚀 Lenta Bot Pro ishga tushdi!");
    } catch (err) {
        console.error("Ulanishda xato, 5 soniyadan keyin qayta urinish...", err.message);
        setTimeout(startBot, 5000);
    }
};

startBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

