const { Telegraf, Markup, session } = require('telegraf');
const mysql = require('mysql2/promise');
const RSSParser = require('rss-parser');
const axios = require('axios');

const parser = new RSSParser();

// --- KONFIGURATSIYA ---
const TOKEN = '8088217797:AAHcSdgdfwPyA7YwjJMLCk6pswQgZfLvdck';
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'ambar'
};

const bot = new Telegraf(TOKEN, { handlerTimeout: 90_000 });
bot.use(session());

// --- YORDAMCHI FUNKSIYALAR ---
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

// Bozor ma'lumotlarini olish funksiyasi
async function getMarketUpdate() {
    try {
        const priceRes = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true');
        const xrp = priceRes.data.ripple;
        const priceEmoji = xrp.usd_24h_change > 0 ? "📈" : "📉";

        const feed = await parser.parseURL('https://www.fxstreet.com/rss/news');
        
        let report = `🪙 *XRP (Ripple) Holati:*\n`;
        report += `💰 Narx: *$${xrp.usd.toFixed(4)}*\n`;
        report += `${priceEmoji} 24s o'zgarish: *${xrp.usd_24h_change.toFixed(2)}%*\n\n`;
        report += `📰 *FXStreet So'nggi Yangiliklar:* \n\n`;

        feed.items.slice(0, 3).forEach(item => {
            report += `🔹 *${item.title}*\n🔗 [Batafsil o'qish](${item.link})\n\n`;
        });

        return report;
    } catch (error) {
        return "❌ Ma'lumotlarni yuklashda xatolik.";
    }
}

// --- AVTOMATIK MONITORING ---
let lastPrice = 0;
async function checkPriceAlert(chatId) {
    if (!chatId) return;
    try {
        const priceRes = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
        const currentPrice = priceRes.data.ripple.usd;

        if (lastPrice !== 0 && Math.abs(currentPrice - lastPrice) >= 0.005) {
            const direction = currentPrice > lastPrice ? "🚀 Ko'tarildi" : "🔻 Tushdi";
            const msg = `🔔 *NARX BILDIRISHNOMASI*\n\n🪙 XRP: *$${currentPrice}*\n📊 Holat: ${direction}\n📉 Avvalgi: $${lastPrice}`;
            await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        }
        lastPrice = currentPrice;
    } catch (e) { console.log("Alert hatosi:", e.message); }
}

// --- TUGMALAR ---
const mainKeyboard = Markup.keyboard([
    ['➕ Tovar qo\'shish', '📊 Statistika'],
    ['🌍 Bozor & XRP']
]).resize();

/* =======================
   🚀 BOT KOMANDALARI
======================= */
bot.start((ctx) => {
    ctx.session = {};
    console.log("Foydalanuvchi ID:", ctx.from.id); // Terminalda IDni ko'rish uchun
    ctx.reply("📦 Lentalar ombori va Bozor monitoringiga xush kelibsiz!", mainKeyboard);
});

bot.hears('🌍 Bozor & XRP', async (ctx) => {
    await ctx.reply("⌛️ Bozor tahlil qilinmoqda...");
    const info = await getMarketUpdate();
    ctx.replyWithMarkdown(info);
});

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
    } catch (e) { ctx.reply("❌ Xato!"); }
});

/* =======================
   ✏️ TAHRIRLASH & O'CHIRISH
======================= */
bot.action(/^edit_(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    const rows = await executeQuery("SELECT * FROM main_items WHERE id = ?", [id]);
    if (rows.length === 0) return ctx.answerCbQuery("❌ Topilmadi");
    const item = rows[0];
    ctx.session.editTarget = { id: id };
    const text = `📝 *Tahrirlash:* ${item.code}\n📍 Joyi: ${item.row_char}-${item.row_num}, ${item.col_num}\n🔢 Soni: ${item.count} ta`;
    await ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
        [Markup.button.callback('Kod', `set_code_${id}`), Markup.button.callback('Qator', `set_row_${id}`)],
        [Markup.button.callback('Soni', `set_qty_${id}`)],
        [Markup.button.callback('❌ Bekor qilish', 'cancel_action')]
    ]));
    await ctx.answerCbQuery();
});

bot.action(/^set_(code|row|st|et|qty)_(\d+)$/, async (ctx) => {
    const field = ctx.match[1];
    ctx.session.editTarget = { id: ctx.match[2], field: field };
    const labels = { code: "Yangi kod:", row: "Qator (A, B...):", qty: "Yangi soni:" };
    await ctx.reply(labels[field] || "Qiymatni kiriting:");
    await ctx.answerCbQuery();
});

bot.action(/^del_(\d+)$/, async (ctx) => {
    await executeQuery(`DELETE FROM main_items WHERE id = ?`, [ctx.match[1]]);
    await ctx.answerCbQuery("🗑 O'chirildi");
    await ctx.deleteMessage().catch(() => {});
});

bot.action('cancel_action', async (ctx) => {
    ctx.session.editTarget = null;
    await ctx.editMessageText("Bekor qilindi.");
});

/* =======================
   🔥 ASOSIY HANDLER
======================= */
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!ctx.session) ctx.session = {};

    if (ctx.session.editTarget && ctx.session.editTarget.field) {
        const { id, field } = ctx.session.editTarget;
        const dbFields = { code: 'code', row: 'row_char', qty: 'count' };
        try {
            await executeQuery(`UPDATE main_items SET ${dbFields[field]} = ? WHERE id = ?`, [text, id]);
            ctx.session.editTarget = null;
            return ctx.reply("✅ Yangilandi!", mainKeyboard);
        } catch (e) { return ctx.reply("❌ Xato!"); }
    }

    if (text === '➕ Tovar qo\'shish') {
        ctx.session.step = 'get_code';
        ctx.session.data = {};
        return ctx.reply("📦 Kodni yuboring:", Markup.removeKeyboard());
    }

    if (ctx.session.step) {
        const steps = {
            'get_code': { next: 'get_row', field: 'code', msg: "📍 Qator (A, B...):" },
            'get_row': { next: 'get_qty', field: 'row_char', msg: "🔢 Soni:", format: t => t.toUpperCase() }
        };
        const current = steps[ctx.session.step];
        if (current) {
            ctx.session.data[current.field] = current.format ? current.format(text) : text;
            ctx.session.step = current.next;
            return ctx.reply(current.msg);
        }
        if (ctx.session.step === 'get_qty') {
            const d = ctx.session.data;
            await executeQuery("INSERT INTO main_items (code, row_char, count) VALUES (?, ?, ?)", [d.code, d.row_char, text]);
            ctx.session.step = null;
            return ctx.reply("✅ Qo'shildi!", mainKeyboard);
        }
    }

    if (!['📊 Statistika', '🌍 Bozor & XRP'].includes(text)) {
        const results = await executeQuery(`SELECT * FROM main_items WHERE code LIKE ? OR row_char = ?`, [`%${text}%`, text.toUpperCase()]);
        if (results.length === 0) return ctx.reply("🔍 Topilmadi.");
        for (const item of results) {
            await ctx.replyWithMarkdown(`📦 *${item.code}*\n📍 ${item.row_char}-qator\n🔢 *${item.count}* ta`, Markup.inlineKeyboard([
                [Markup.button.callback('📝 Edit', `edit_${item.id}`), Markup.button.callback('🗑 O\'chirish', `del_${item.id}`)]
            ]));
        }
    }
});

// --- ISHGA TUSHIRISH ---
const MY_CHAT_ID = "8009669458"; // Shu yerga IDingizni yozing!

const startBot = async () => {
    try {
        await bot.launch();
        console.log("🚀 Bot ishga tushdi!");
        
        // Har 5 daqiqada narxni tekshirish
        setInterval(() => checkPriceAlert(MY_CHAT_ID), 300000);
        
    } catch (err) {
        setTimeout(startBot, 5000);
    }
};
startBot();

