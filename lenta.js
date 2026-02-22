const { Telegraf, Markup, session } = require('telegraf');
const mysql = require('mysql2/promise');

const TOKEN = '8088217797:AAHcSdgdfwPyA7YwjJMLCk6pswQgZfLvdck';
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'ambar'
};

const bot = new Telegraf(TOKEN);
bot.use(session());

// Ma'lumotlar bazasi bilan ishlash uchun funksiya
async function executeQuery(sql, params) {
    const connection = await mysql.createConnection(dbConfig);
    try {
        const [rows] = await connection.execute(sql, params);
        return rows;
    } finally {
        await connection.end();
    }
}

// Asosiy menyu
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
        const stats = await executeQuery(
            "SELECT row_char, COUNT(*) as count FROM main_items GROUP BY row_char ORDER BY row_char", []
        );
        const totalRows = await executeQuery("SELECT COUNT(*) as total FROM main_items", []);
        const totalItems = await executeQuery("SELECT SUM(count) as total_qty FROM main_items", []);

        let report = "📊 *Baza statistikasi:*\n\n";
        stats.forEach(s => {
            let star = ['F', 'G', 'H'].includes(s.row_char.toUpperCase()) ? "⭐ " : "🔹 ";
            report += `${star}${s.row_char} qatori: ${s.count} turdagi lenta\n`;
        });
        report += `\n📦 *Jami turlar: ${totalRows[0].total} ta*`;
        report += `\n🔢 *Umumiy miqdor: ${totalItems[0].total_qty || 0} ta*`;

        ctx.replyWithMarkdown(report);
    } catch (e) {
        ctx.reply("❌ Statistika yuklashda xato!");
    }
});

/* =======================
   ✏️ TAHRIRLASH (EDIT) BOSHQARUVI
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
    if(!ctx.session.editTarget) ctx.session.editTarget = { id: ctx.match[2] };
    ctx.session.editTarget.field = field;

    const labels = {
        code: "Yangi kodni kiriting:",
        row: "Yangi qatorni kiriting (A, B...):",
        st: "Yangi stellaj raqamini kiriting:",
        et: "Yangi etaj raqamini kiriting:",
        qty: "Yangi sonini (miqdorini) kiriting:"
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
    ctx.session.step = null;
    await ctx.editMessageText("Amal bekor qilindi.");
    await ctx.answerCbQuery();
});

/* =======================
   🔥 ASOSIY TEXT HANDLER
======================= */
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!ctx.session) ctx.session = {};

    // 1. TAHRIRLASH JARAYONI (Saqlash qismi)
    if (ctx.session.editTarget && ctx.session.editTarget.field) {
        const { id, field } = ctx.session.editTarget;
        const dbFields = { code: 'code', row: 'row_char', st: 'row_num', et: 'col_num', qty: 'count' };
        const val = (field === 'row') ? text.toUpperCase() : text;

        try {
            await executeQuery(`UPDATE main_items SET ${dbFields[field]} = ? WHERE id = ?`, [val, id]);
            ctx.session.editTarget = null;
            return ctx.reply("✅ Muvaffaqiyatli yangilandi!", mainKeyboard);
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return ctx.reply("❌ Xato: Bu manzil boshqa mahsulotga band! Iltimos, boshqa qiymat kiriting.");
            }
            console.error(error);
            return ctx.reply("❌ Yangilashda xato yuz berdi.");
        }
    }

    // 2. QO'SHISH TUGMASI
    if (text === '➕ Tovar qo\'shish') {
        ctx.session.step = 'get_code';
        ctx.session.data = {};
        return ctx.reply("📦 Yangi tovar kodini yuboring:", Markup.removeKeyboard());
    }

    // 3. QO'SHISH BOSQICHLARI
    if (ctx.session.step) {
        if (ctx.session.step === 'get_code') {
            ctx.session.data.code = text;
            ctx.session.step = 'get_row';
            return ctx.reply("📍 Qatorni kiriting (Masalan: A):");
        }
        if (ctx.session.step === 'get_row') {
            ctx.session.data.row_char = text.toUpperCase();
            ctx.session.step = 'get_st';
            return ctx.reply("🔢 Stellaj raqamini kiriting:");
        }
        if (ctx.session.step === 'get_st') {
            ctx.session.data.row_num = text;
            ctx.session.step = 'get_et';
            return ctx.reply("🏢 Etaj raqamini kiriting:");
        }
        if (ctx.session.step === 'get_et') {
            ctx.session.data.col_num = text;
            ctx.session.step = 'get_qty';
            return ctx.reply("🔢 Tovardan nechta bor? (Soni):");
        }
        if (ctx.session.step === 'get_qty') {
            const d = ctx.session.data;
            try {
                await executeQuery(
                    "INSERT INTO main_items (code, row_char, row_num, col_num, count, color) VALUES (?, ?, ?, ?, ?, 'def')",
                    [d.code, d.row_char, d.row_num, d.col_num, text]
                );
                ctx.session.step = null;
                return ctx.reply("✅ Yangi lenta muvaffaqiyatli qo'shildi!", mainKeyboard);
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    ctx.session.step = null; 
                    return ctx.reply(`❌ Xato: ${d.row_char}-${d.row_num}-${d.col_num} manzili band! Avval uni o'chiring yoki boshqa manzil bering.`, mainKeyboard);
                }
                console.error(error);
                return ctx.reply("❌ Xatolik yuz berdi.");
            }
        }
    }

    // 4. QIDIRUV
    if (text !== '📊 Statistika') {
        const results = await executeQuery(`SELECT * FROM main_items WHERE code LIKE ?`, [`%${text}%`]);
        if (results.length === 0) return ctx.reply("🔍 Hech narsa topilmadi.");

        for (const item of results) {
            const star = ['F', 'G', 'H'].includes(item.row_char.toUpperCase()) ? "⭐" : "";
            const msg = `📦 Kod: *${item.code}*\n📍 Joyi: ${star}${item.row_char} qator, st-${item.row_num}, et-${item.col_num}\n🔢 Soni: *${item.count || 0}* ta`;

            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
                [
                    Markup.button.callback('📝 Edit', `edit_${item.id}`),
                    Markup.button.callback('🗑 O\'chirish', `del_${item.id}`)
                ]
            ]));
        }
    }
});

bot.launch().then(() => console.log("🚀 Lenta Bot Pro ishga tushdi!"));

// Xatoliklarni ushlash
process.on('uncaughtException', (err) => console.log('Kutilmagan xato:', err));
process.on('unhandledRejection', (reason, promise) => console.log('Rad etilgan so\'rov:', reason));

