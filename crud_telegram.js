const { Telegraf, Markup } = require('telegraf');
const mysql = require('mysql2/promise');

const bot = new Telegraf('8147123427:AAEpQF2JnENY3dCagcsTtOGYlJILos6LEdE');

const pool = mysql.createPool({
    host: 'localhost', user: 'root', database: 'dynamic_wms', password: '', enableKeepAlive: true
});

// --- Yordamchi Dizayn ---
const line = "────────────────";

// --- START ---
bot.start(async (ctx) => {
    const [items] = await pool.execute("SELECT SUM(count) as total FROM items");
    const totalCount = items[0].total || 0;

    return ctx.replyWithMarkdown(`💎 *AMBAR PRO: PREMIUM EDITION*\n${line}\n📊 Ombor holati: *${totalCount} dona tovar*\n${line}\nBoshqarish uchun menyuni tanlang:`, 
        Markup.keyboard([
            ['📦 Omborni ko\'rish'],
            ['🔍 Qidiruv', '📊 Statistika'],
            ['➕ Yangi Tovar qo\'shish']
        ]).resize()
    );
});

// --- STATISTIKA ---
bot.hears('📊 Statistika', async (ctx) => {
    const [rows] = await pool.execute("SELECT count(*) as types, SUM(count) as total FROM items");
    const [sections] = await pool.execute("SELECT count(*) as count FROM warehouse_config");
    
    let stats = `📊 *OMBOR STATISTIKASI*\n${line}\n`;
    stats += `📁 Bo'limlar: *${sections[0].count} ta*\n`;
    stats += `🏷 Tovar turlari: *${rows[0].types} ta*\n`;
    stats += `🔢 Jami mahsulot: *${rows[0].total || 0} ta*\n`;
    stats += `${line}`;
    
    ctx.replyWithMarkdown(stats);
});

// --- QIDIRUV (PREMIUM) ---
bot.hears('🔍 Qidiruv', (ctx) => ctx.reply("🔍 Tovar kodini yozib yuboring (Masalan: N55):"));

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    if (['📦 Omborni ko\'rish', '🔍 Qidiruv', '📊 Statistika', '➕ Yangi Tovar qo\'shish'].includes(text)) return next();

    // Agar foydalanuvchi "KOD SONI QATOR STELLAJ ETAJ SLOT" formatida yozsa (Yangi qo'shish)
    if (text.split(' ').length >= 2 && !isNaN(text.split(' ')[1])) {
        return addNewItem(ctx, text);
    }

    // Qidiruv mantiqi
    const [items] = await pool.execute("SELECT * FROM items WHERE code LIKE ?", [`%${text}%`]);
    if (!items.length) return ctx.reply("❌ Tovar topilmadi.");

    items.forEach(it => {
        let msg = `🏷 *KOD:* ${it.code}\n${line}\n`;
        msg += `🆔 ID: ${it.id}\n🔢 Miqdor: *${it.count}*\n📍 Joy: Qator ${it.row_id}, Stellaj ${it.rack_no}\n`;
        
        ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
            [Markup.button.callback("📝 Tahrirlash", `edit_${it.id}`), Markup.button.callback("🗑 O'chirish", `del_${it.id}`)]
        ]));
    });
});

// --- QO'SHISH LOGIKASI ---
bot.hears('➕ Yangi Tovar qo\'shish', (ctx) => {
    ctx.replyWithMarkdown("🆕 *Yangi tovar qo'shish uchun quyidagicha yozing:*\n\n`KOD SONI QATOR_ID STELLAJ_NO ETAJ_NO SLOT_NO` \n\n*Misol:* `N55 100 1 2 3 1` \n(N55 kodli, 100ta, 1-qator, 2-stellaj, 3-etaj, 1-slot)");
});

async function addNewItem(ctx, text) {
    const parts = text.split(' ');
    if (parts.length < 6) return ctx.reply("❌ Ma'lumot yetarli emas. Namunadagidek yozing.");
    
    try {
        await pool.execute("INSERT INTO items (code, count, row_id, rack_no, shelf_no, slot_no) VALUES (?,?,?,?,?,?)", 
            [parts[0].toUpperCase(), parts[1], parts[2], parts[3], parts[4], parts[5]]);
        ctx.reply("✅ Tovar muvaffaqiyatli qo'shildi!");
    } catch (e) { ctx.reply("❌ Xato: Ma'lumotlar formati noto'g'ri."); }
}

// --- OMBORNI KO'RISH (PREMIUM UI) ---
bot.hears('📦 Omborni ko\'rish', async (ctx) => {
    const [rows] = await pool.execute("SELECT * FROM warehouse_config");
    const buttons = rows.map(r => [Markup.button.callback(`📁 Qator: ${r.row_name}`, `row_${r.id}`)]);
    ctx.replyWithMarkdown("📂 *Bo'limni tanlang:*", Markup.inlineKeyboard(buttons));
});

// Stellajlar, Edit, Upd, Del funksiyalari avvalgi xatosiz versiyadan qoladi...
// (Joy tejash uchun asosiy mantiqni yuqoridagi kod bilan bir xil qoldiramiz)

bot.action(/^row_(\d+)$/, async (ctx) => {
    const rowId = ctx.match[1];
    const [[config]] = await pool.execute("SELECT * FROM warehouse_config WHERE id = ?", [rowId]);
    let buttons = config ? [] : [];
    for (let i = 1; i <= config.racks_count; i++) buttons.push(Markup.button.callback(`📦 ${i}-Stellaj`, `rack_${rowId}_${i}`));
    const grid = []; while(buttons.length) grid.push(buttons.splice(0, 2));
    grid.push([Markup.button.callback("⬅️ Orqaga", "back_to_rows")]);
    await ctx.editMessageText(`📍 *${config.row_name}* qatori:`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(grid) });
});

bot.action(/^rack_(\d+)_(\d+)$/, async (ctx) => {
    const [_, rowId, rackNo] = ctx.match;
    const [items] = await pool.execute("SELECT * FROM items WHERE row_id = ? AND rack_no = ?", [rowId, rackNo]);
    let text = `💎 *Stellaj:* ${rackNo}\n${line}\n`;
    const buttons = [];
    items.forEach(it => {
        text += `🔹 *${it.code}* | ${it.count} ta | ID: ${it.id}\n`;
        buttons.push([Markup.button.callback(`⚙️ ${it.code} (ID: ${it.id})`, `edit_${it.id}`)]);
    });
    buttons.push([Markup.button.callback("⬅️ Orqaga", `row_${rowId}`)]);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
});

bot.action(/^edit_(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    const [[it]] = await pool.execute("SELECT * FROM items WHERE id = ?", [id]);
    const btns = [
        [Markup.button.callback("-10", `upd_${id}_-10`), Markup.button.callback("-1", `upd_${id}_-1`), Markup.button.callback("+1", `upd_${id}_1`), Markup.button.callback("+10", `upd_${id}_10`)],
        [Markup.button.callback("🗑 O'chirish", `del_${id}`)],
        [Markup.button.callback("⬅️ Qaytish", `rack_${it.row_id}_${it.rack_no}`)]
    ];
    await ctx.editMessageText(`📝 *Tahrirlash:* ${it.code}\n🔢 Miqdor: *${it.count}*`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^upd_(\d+)_(-?\d+)$/, async (ctx) => {
    const [_, id, delta] = ctx.match;
    await pool.execute("UPDATE items SET count = count + ? WHERE id = ?", [delta, id]);
    const [[it]] = await pool.execute("SELECT * FROM items WHERE id = ?", [id]);
    if (!it || it.count <= 0) { await pool.execute("DELETE FROM items WHERE id = ?", [id]); return ctx.editMessageText("❗ Tovar tugadi."); }
    const btns = [
        [Markup.button.callback("-10", `upd_${id}_-10`), Markup.button.callback("-1", `upd_${id}_-1`), Markup.button.callback("+1", `upd_${id}_1`), Markup.button.callback("+10", `upd_${id}_10`)],
        [Markup.button.callback("⬅️ Qaytish", `rack_${it.row_id}_${it.rack_no}`)]
    ];
    await ctx.editMessageText(`📝 *Tahrirlash:* ${it.code}\n🔢 Yangi miqdor: *${it.count}*`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^del_(\d+)$/, async (ctx) => {
    await pool.execute("DELETE FROM items WHERE id = ?", [ctx.match[1]]);
    ctx.answerCbQuery("O'chirildi");
    ctx.deleteMessage();
});

bot.action('back_to_rows', async (ctx) => {
    const [rows] = await pool.execute("SELECT * FROM warehouse_config");
    const buttons = rows.map(r => [Markup.button.callback(`📁 Qator: ${r.row_name}`, `row_${r.id}`)]);
    ctx.editMessageText("📂 *Bo'limni tanlang:*", { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
});

bot.launch().then(() => console.log("💎 Premium Bot Tayyor!"));

