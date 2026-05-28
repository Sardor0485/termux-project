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
    connectionLimit: 10
};

const pool = mysql.createPool(dbConfig);
const bot = new Telegraf(TOKEN);

// Sessiyani ulash
bot.use(session());

// Ma'lumotlar bazasi bilan ishlash funksiyasi
async function executeQuery(sql, params) {
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (err) {
        console.error("🚫 DB Xatosi:", err.message);
        return [];
    }
}

// Asosiy menyu
const mainKeyboard = Markup.keyboard([
    ['➕ Tovar qo\'shish', '📊 Statistika'],
    ['🔍 Omborga qarash']
]).resize();

/* =======================
   🚀 START
======================= */
bot.start((ctx) => {
    ctx.session = {}; // Yangi sessiya ochish
    ctx.reply("📦 Ombor boshqaruv tizimi faol.\nAmalni tanlang yoki tovar kodini yozing:", mainKeyboard);
});

/* =======================
   📊 STATISTIKA
======================= */
bot.hears('📊 Statistika', async (ctx) => {
    const stats = await executeQuery("SELECT row_char, COUNT(*) as count FROM main_items GROUP BY row_char ORDER BY row_char", []);
    const total = await executeQuery("SELECT SUM(count) as total_qty FROM main_items", []);

    if (stats.length === 0) return ctx.reply("📭 Ombor bo'sh.");

    let report = "📋 *OMBOR HISOBOTI*\n\n";
    stats.forEach(s => { report += `📍 Qator ${s.row_char}: ${s.count} tur\n`; });
    report += `\n📦 Jami miqdor: ${total[0].total_qty || 0} dona`;

    ctx.replyWithMarkdown(report);
});

/* =======================
   🔍 QIDIRUV (BUTTONS)
======================= */
bot.hears('🔍 Omborga qarash', async (ctx) => {
    const rows = await executeQuery("SELECT DISTINCT row_char FROM main_items ORDER BY row_char", []);
    if (rows.length === 0) return ctx.reply("📭 Ombor hozircha bo'sh.");

    const buttons = rows.map(r => Markup.button.callback(`Qator ${r.row_char}`, `list_row_${r.row_char}`));
    ctx.reply("Qidirish uchun qatorni tanlang:", Markup.inlineKeyboard(buttons, { columns: 3 }));
});

bot.action(/^list_row_(.+)$/, async (ctx) => {
    const row = ctx.match[1];
    const items = await executeQuery("SELECT * FROM main_items WHERE row_char = ?", [row]);
    await ctx.answerCbQuery();
    
    if (items.length === 0) return ctx.reply("Bu qatorda tovar yo'q.");

    for (const item of items) {
        sendItemCard(ctx, item);
    }
});

// Tovar kartochkasini chiqarish
async function sendItemCard(ctx, item) {
    const text = `📦 *KOD:* ${item.code}\n📍 *JOY:* ${item.row_char}-${item.row_num}-${item.col_num}\n🔢 *SONI:* ${item.count} ta`;
    await ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
        [Markup.button.callback('➕ Miqdorni o\'zgartirish', `manage_qty_${item.id}`)],
        [Markup.button.callback('✏️ Tahrirlash', `edit_${item.id}`), Markup.button.callback('🗑 O\'chirish', `del_confirm_${item.id}`)]
    ]));
}

/* =======================
   🔢 MIQDORNI +/- BILAN O'ZGARTIRISH
======================= */
bot.action(/^manage_qty_(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    const rows = await executeQuery("SELECT code, count FROM main_items WHERE id = ?", [id]);
    if (rows.length === 0) return ctx.answerCbQuery("Topilmadi.");
    const item = rows[0];

    await ctx.editMessageText(`📦 Kod: ${item.code}\nHozirgi soni: ${item.count} ta\n\nO'zgartirish:`, {
        ...Markup.inlineKeyboard([
            [Markup.button.callback('-10', `change_${id}_-10`), Markup.button.callback('-1', `change_${id}_-1`), Markup.button.callback('+1', `change_${id}_1`), Markup.button.callback('+10', `change_${id}_10`)],
            [Markup.button.callback('⬅️ Orqaga', `back_to_item_${id}`)]
        ])
    });
});

bot.action(/^change_(\d+)_(-?\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    const diff = parseInt(ctx.match[2]);
    await executeQuery("UPDATE main_items SET count = count + ? WHERE id = ?", [diff, id]);
    const item = (await executeQuery("SELECT code, count FROM main_items WHERE id = ?", [id]))[0];

    try {
        await ctx.editMessageText(`📦 Kod: ${item.code}\nYangilangan soni: ${item.count} ta`, {
            ...Markup.inlineKeyboard([
                [Markup.button.callback('-10', `change_${id}_-10`), Markup.button.callback('-1', `change_${id}_-1`), Markup.button.callback('+1', `change_${id}_1`), Markup.button.callback('+10', `change_${id}_10`)],
                [Markup.button.callback('⬅️ Orqaga', `manage_qty_${id}`)]
            ])
        });
    } catch (e) {}
    await ctx.answerCbQuery(`Yangi: ${item.count}`);
});

/* =======================
   ✏️ TAHRIRLASH & O'CHIRISH
======================= */
bot.action(/^edit_(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    await ctx.editMessageText("Nimani o'zgartiramiz?", Markup.inlineKeyboard([
        [Markup.button.callback('Kod', `set_code_${id}`), Markup.button.callback('Qator', `set_row_${id}`)],
        [Markup.button.callback('Stellaj', `set_st_${id}`), Markup.button.callback('Etaj', `set_et_${id}`)],
        [Markup.button.callback('⬅️ Orqaga', `back_to_item_${id}`)]
    ]));
});

bot.action(/^set_(code|row|st|et)_(\d+)$/, async (ctx) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.editTarget = { id: ctx.match[2], field: ctx.match[1] };
    await ctx.reply("Yangi qiymatni yozib yuboring:");
    await ctx.answerCbQuery();
});

bot.action(/^del_confirm_(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    await ctx.editMessageText("⚠️ Rostdan ham o'chirmoqchimisiz?", Markup.inlineKeyboard([
        [Markup.button.callback('✅ Ha, o\'chirish', `del_yes_${id}`)],
        [Markup.button.callback('❌ Yo\'q, bekor qilish', `back_to_item_${id}`)]
    ]));
});

bot.action(/^del_yes_(\d+)$/, async (ctx) => {
    await executeQuery("DELETE FROM main_items WHERE id = ?", [ctx.match[1]]);
    await ctx.answerCbQuery("🗑 O'chirildi");
    await ctx.deleteMessage();
});

bot.action(/^back_to_item_(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    const item = (await executeQuery("SELECT * FROM main_items WHERE id = ?", [id]))[0];
    if (!item) return ctx.deleteMessage();
    await ctx.deleteMessage();
    sendItemCard(ctx, item);
});

/* =======================
   📥 MATN QABUL QILISH (ASOSIY QISM)
======================= */
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();

    // MUHIM: Sessiya yo'qligi xatosini oldini olish
    if (!ctx.session) ctx.session = {};

    // 1. Tovar qo'shish jarayoni
    if (text === '➕ Tovar qo\'shish') {
        ctx.session.step = 'ADD_CODE';
        return ctx.reply("📦 Tovar kodi:");
    }

    if (ctx.session.step) {
        if (ctx.session.step === 'ADD_CODE') {
            ctx.session.newData = { code: text };
            ctx.session.step = 'ADD_ROW';
            return ctx.reply("📍 Qator (A, B...):");
        }
        if (ctx.session.step === 'ADD_ROW') {
            ctx.session.newData.row = text.toUpperCase();
            ctx.session.step = 'ADD_ST';
            return ctx.reply("🔢 Stellaj raqami:");
        }
        if (ctx.session.step === 'ADD_ST') {
            ctx.session.newData.st = text;
            ctx.session.step = 'ADD_ET';
            return ctx.reply("🏢 Etaj raqami:");
        }
        if (ctx.session.step === 'ADD_ET') {
            ctx.session.newData.et = text;
            ctx.session.step = 'ADD_QTY';
            return ctx.reply("🔢 Soni:");
        }
        if (ctx.session.step === 'ADD_QTY') {
            const d = ctx.session.newData;
            const qty = parseInt(text) || 0;
            await executeQuery("INSERT INTO main_items (code, row_char, row_num, col_num, count) VALUES (?, ?, ?, ?, ?)", [d.code, d.row, d.st, d.et, qty]);
            ctx.session.step = null;
            return ctx.reply("✅ Qo'shildi!", mainKeyboard);
        }
    }

    // 2. Tahrirlash qiymatini qabul qilish
    if (ctx.session.editTarget?.field) {
        const { id, field } = ctx.session.editTarget;
        const dbFields = { code: 'code', row: 'row_char', st: 'row_num', et: 'col_num' };
        await executeQuery(`UPDATE main_items SET ${dbFields[field]} = ? WHERE id = ?`, [text, id]);
        ctx.session.editTarget = null;
        return ctx.reply("✅ Yangilandi!", mainKeyboard);
    }

    // 3. Avtomatik Qidiruv (Smart Search)
    const results = await executeQuery("SELECT * FROM main_items WHERE code LIKE ?", [`%${text}%`]);
    if (results.length > 0) {
        for (const item of results) { sendItemCard(ctx, item); }
    } else {
        ctx.reply("❓ Ma'lumot topilmadi. Qidirish uchun kodni yozing yoki menyudan foydalaning.");
    }
});

// Xatoliklarni ushlash (Bot o'chib qolmasligi uchun)
bot.catch((err, ctx) => {
    console.error(`❌ Botda xatolik: ${ctx.update_id}`, err);
});

bot.launch().then(() => console.log("🚀 Lenta Bot Professional (Stablized) ishga tushdi!"));

