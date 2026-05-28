const { Telegraf, Markup, session } = require('telegraf');
const mysql = require('mysql2/promise');

// --- KONFIGURATSIYA ---
const TOKEN = '8088217797:AAHcSdgdfwPyA7YwjJMLCk6pswQgZfLvdck';
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'ambar'
};

const bot = new Telegraf(TOKEN, {
    handlerTimeout: 90_000
});

bot.use(session());

// Ma'lumotlar bazasi bilan ishlash funksiyasi
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
   🚀 START
======================= */
bot.start((ctx) => {
    ctx.session = {}; 
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
   ✏️ TAHRIRLASH
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
                 `Nimani o'zgartiramiz?`;

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
    const labels = { code: "kodni", row: "qatorni (A,B...)", st: "stellaj raqamini", et: "etaj raqamini", qty: "sonini" };
    await ctx.reply(`Yangi ${labels[field]} kiriting:`);
    await ctx.answerCbQuery();
});

/* =======================
   🗑 O'CHIRISH
======================= */
bot.action(/^del_(\d+)$/, async (ctx) => {
    try {
        await executeQuery(`DELETE FROM main_items WHERE id = ?`, [ctx.match[1]]);
        await ctx.answerCbQuery("🗑 O'chirildi");
        await ctx.deleteMessage().catch(() => {});
    } catch (e) {
        await ctx.answerCbQuery("❌ O'chirishda xato");
    }
});

bot.action('cancel_action', async (ctx) => {
    ctx.session.editTarget = null;
    ctx.session.step = null;
    await ctx.reply("Amal bekor qilindi.", mainKeyboard);
});

/* =======================
   🔥 ASOSIY HANDLER (TEXT)
======================= */
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!ctx.session) ctx.session = {};

    // 1. Tahrirlashni saqlash
    if (ctx.session.editTarget && ctx.session.editTarget.field) {
        const { id, field } = ctx.session.editTarget;
        const dbFields = { code: 'code', row: 'row_char', st: 'row_num', et: 'col_num', qty: 'count' };
        
        let value = text;
        if (['st', 'et', 'qty'].includes(field)) {
            value = parseInt(text);
            if (isNaN(value)) return ctx.reply("⚠️ Faqat son kiriting!");
        } else if (field === 'row') {
            value = text.toUpperCase().substring(0, 1);
        }

        try {
            await executeQuery(`UPDATE main_items SET ${dbFields[field]} = ? WHERE id = ?`, [value, id]);
            ctx.session.editTarget = null;
            return ctx.reply("✅ Yangilandi!", mainKeyboard);
        } catch (e) {
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
        switch (ctx.session.step) {
            case 'get_code':
                ctx.session.data.code = text;
                ctx.session.step = 'get_row';
                return ctx.reply("📍 Qator harfi (Masalan: F):");
            
            case 'get_row':
                ctx.session.data.row_char = text.toUpperCase().substring(0, 1);
                ctx.session.step = 'get_st';
                return ctx.reply("🔢 Stellaj raqami (row_num):");

            case 'get_st':
                const st = parseInt(text);
                if (isNaN(st)) return ctx.reply("⚠️ Faqat son kiriting!");
                ctx.session.data.row_num = st;
                ctx.session.step = 'get_et';
                return ctx.reply("🏢 Etaj raqami (col_num):");

            case 'get_et':
                const et = parseInt(text);
                if (isNaN(et)) return ctx.reply("⚠️ Faqat son kiriting!");
                ctx.session.data.col_num = et;
                ctx.session.step = 'get_qty';
                return ctx.reply("🔢 Soni (count):");

            case 'get_qty':
                const qty = parseInt(text);
                if (isNaN(qty)) return ctx.reply("⚠️ Faqat son kiriting!");
                
                try {
                    const d = ctx.session.data;
                    await executeQuery(
                        `INSERT INTO main_items 
                        (code, row_char, row_num, col_num, count, color, row_num_in_st, section_name) 
                        VALUES (?, ?, ?, ?, ?, '#333', 0, 'A')`,
                        [d.code, d.row_char, d.row_num, d.col_num, qty]
                    );
                    ctx.session.step = null;
                    return ctx.reply("✅ Qo'shildi!", mainKeyboard);
                } catch (e) {
                    ctx.session.step = null;
                    if (e.code === 'ER_DUP_ENTRY') return ctx.reply("❌ Bu manzil band!", mainKeyboard);
                    return ctx.reply("❌ Baza xatosi!", mainKeyboard);
                }
        }
    }

    // 4. Qidiruv (Kod yoki Qator bo'yicha)
    if (text !== '📊 Statistika') {
        try {
            const results = await executeQuery(
                `SELECT * FROM main_items WHERE code LIKE ? OR row_char = ? ORDER BY id DESC LIMIT 10`, 
                [`%${text}%`, text.toUpperCase()]
            );
            
            if (results.length === 0) return ctx.reply("🔍 Topilmadi.");

            for (const item of results) {
                const star = ['F', 'G', 'H'].includes(item.row_char.toUpperCase()) ? "⭐" : "🔹";
                const msg = `📦 Kod: *${item.code}*\n` +
                            `📍 Joyi: ${star}${item.row_char}-${item.row_num}-st, ${item.col_num}-et\n` +
                            `🔢 Soni: *${item.count || 0}* ta`;

                await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
                    [Markup.button.callback('📝 Edit', `edit_${item.id}`), Markup.button.callback('🗑 O\'chirish', `del_${item.id}`)]
                ]));
            }
        } catch (e) {
            ctx.reply("❌ Qidiruvda xato.");
        }
    }
});

// Botni ishga tushirish
const startBot = async () => {
    try {
        await bot.launch();
        console.log("🚀 Lenta Bot Pro ishlamoqda...");
    } catch (err) {
        console.error("Qayta ulanish...", err.message);
        setTimeout(startBot, 5000);
    }
};

startBot();

// Xavfsiz yopilish
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

