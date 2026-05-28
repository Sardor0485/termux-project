require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const mysql = require('mysql2/promise');
const winston = require('winston');
const fs = require('fs');

// ─── LOGS PAPKA ────────────────────────────────────────────────────────────
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

// ─── LOGGER ────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) =>
            `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});

// ─── CONFIG ────────────────────────────────────────────────────────────────
const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    DB: {
        host:               process.env.DB_HOST     || 'localhost',
        user:               process.env.DB_USER     || 'root',
        password:           process.env.DB_PASSWORD || '',
        database:           process.env.DB_NAME     || 'dynamic_wms',
        waitForConnections: true,
        connectionLimit:    10,
        connectTimeout:     8000,
        queueLimit:         0,
    },
    ADMIN_IDS: (process.env.ADMIN_IDS || '').split(',').map(Number).filter(Boolean),
};

if (!CONFIG.BOT_TOKEN) {
    logger.error('BOT_TOKEN .env faylda yoq!');
    process.exit(1);
}

// ─── DATABASE ──────────────────────────────────────────────────────────────
let pool;

async function initDB() {
    pool = mysql.createPool(CONFIG.DB);
    await pool.query('SELECT 1');
    logger.info('MySQL ulanish muvaffaqiyatli');
}

async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

// ─── BOT ───────────────────────────────────────────────────────────────────
const bot = new Telegraf(CONFIG.BOT_TOKEN);
bot.use(session());

const DIV = '━━━━━━━━━━━━━━━━━━━━';

// ─── HELPERS ───────────────────────────────────────────────────────────────
function isAdmin(ctx) {
    return CONFIG.ADMIN_IDS.includes(ctx.from.id);
}

function adminOnly(handler) {
    return async (ctx) => {
        if (!isAdmin(ctx)) return ctx.reply('Ruxsat yoq.');
        return handler(ctx);
    };
}

async function safeEdit(ctx, text, extra = {}) {
    try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', ...extra });
    } catch {
        await ctx.replyWithMarkdown(text, extra);
    }
}

// ─── KEYBOARDS ─────────────────────────────────────────────────────────────
const mainMenu = Markup.keyboard([
    ['🏢 Omborni Boshqarish'],
    ['🔍 Qidiruv',  '📊 Statistika'],
    ['➕ Tovar Kirim', '📋 Hisobot'],
]).resize();

// ─── /start ────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
    const name = ctx.from.first_name || 'Foydalanuvchi';
    await ctx.replyWithMarkdown(
        `💎 *AMBAR PRO CRM V3.5*\nXush kelibsiz, *${name}*!`,
        mainMenu
    );
    try {
        const rows = await query('SELECT SUM(`count`) AS total FROM items');
        const total = rows[0]?.total ?? 0;
        await ctx.replyWithMarkdown(
            `📦 *Joriy holat:*\n└ Zaxirada: *${total} dona*\n└ Holat: 🟢 Onlayn\n${DIV}`
        );
    } catch (e) {
        logger.warn(`/start baza xatosi: ${e.message}`);
    }
});

// ─── OMBOR ─────────────────────────────────────────────────────────────────
bot.hears('🏢 Omborni Boshqarish', async (ctx) => {
    try {
        const rows = await query('SELECT id, row_name FROM warehouse_config ORDER BY id');
        if (!rows.length) return ctx.reply('Hozircha hududlar yoq.');

        const buttons = rows.map(r => [
            Markup.button.callback(`📁 ${r.row_name} ➔`, `row_${r.id}`)
        ]);
        await ctx.replyWithMarkdown(
            `🗺 *OMBOR XARITASI*\n${DIV}\nHududni tanlang:`,
            Markup.inlineKeyboard(buttons)
        );
    } catch (e) {
        logger.error(`Ombor: ${e.message}`);
        ctx.reply('Bolimlar yuklanishida muammo!');
    }
});

// ─── ROW ───────────────────────────────────────────────────────────────────
bot.action(/^row_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const rowId = ctx.match[1];
    try {
        const [config] = await query(
            'SELECT id, row_name, racks_count FROM warehouse_config WHERE id = ?', [rowId]
        );
        if (!config) return ctx.reply('Hudud topilmadi.');

        const btns = Array.from({ length: config.racks_count }, (_, i) =>
            Markup.button.callback(`📍 ${i + 1}-St`, `rack_${rowId}_${i + 1}`)
        );
        const grid = [];
        for (let i = 0; i < btns.length; i += 3) grid.push(btns.slice(i, i + 3));
        grid.push([Markup.button.callback('⬅️ Orqaga', 'back_to_rows')]);

        await safeEdit(ctx,
            `📁 *Hudud:* ${config.row_name}\n${DIV}\nStellajni tanlang:`,
            Markup.inlineKeyboard(grid)
        );
    } catch (e) {
        logger.error(`row action: ${e.message}`);
        ctx.reply('Xato yuz berdi.');
    }
});

// ─── RACK ──────────────────────────────────────────────────────────────────
bot.action(/^rack_(\d+)_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const [, rowId, rackNum] = ctx.match;
    try {
        const items = await query(
            'SELECT name, `count`, unit FROM items WHERE warehouse_id = ? AND rack = ? ORDER BY name',
            [rowId, rackNum]
        );
        let text = `📍 *${rackNum}-Stellaj*\n${DIV}\n`;
        if (!items.length) {
            text += '_Bosh_';
        } else {
            items.forEach((it, i) => {
                text += `${i + 1}. *${it.name}* — ${it.count} ${it.unit || 'dona'}\n`;
            });
        }
        const buttons = [
            [Markup.button.callback('➕ Qoshish', `add_${rowId}_${rackNum}`)],
            [Markup.button.callback('⬅️ Orqaga', `row_${rowId}`)],
        ];
        await safeEdit(ctx, text, Markup.inlineKeyboard(buttons));
    } catch (e) {
        logger.error(`rack action: ${e.message}`);
        ctx.reply('Stellaj malumotlarini yuklab bolmadi.');
    }
});

// ─── ORQAGA ────────────────────────────────────────────────────────────────
bot.action('back_to_rows', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
        const rows = await query('SELECT id, row_name FROM warehouse_config ORDER BY id');
        const buttons = rows.map(r => [
            Markup.button.callback(`📁 ${r.row_name} ➔`, `row_${r.id}`)
        ]);
        await safeEdit(ctx,
            `🗺 *OMBOR XARITASI*\n${DIV}\nHududni tanlang:`,
            Markup.inlineKeyboard(buttons)
        );
    } catch (e) {
        logger.error(`back_to_rows: ${e.message}`);
    }
});

// ─── STATISTIKA ────────────────────────────────────────────────────────────
bot.hears('📊 Statistika', async (ctx) => {
    try {
        const [res] = await query(
            'SELECT COUNT(*) AS types, SUM(`count`) AS total, MAX(updated_at) AS last_update FROM items'
        );
        const lastUpdate = res.last_update
            ? new Date(res.last_update).toLocaleString('uz-UZ')
            : 'Noma lum';
        await ctx.replyWithMarkdown(
            `📊 *KPI HISOBOTI*\n${DIV}\n` +
            `📦 Mahsulot turlari: *${res.types} ta*\n` +
            `🔢 Jami dona: *${res.total ?? 0} ta*\n` +
            `🕐 Sunggi yangilanish: *${lastUpdate}*\n` +
            `${DIV}\nStatus: 🟢 Barqaror`
        );
    } catch (e) {
        logger.error(`Statistika: ${e.message}`);
        ctx.reply('Analitika yuklanmadi.');
    }
});

// ─── QIDIRUV ───────────────────────────────────────────────────────────────
bot.hears('🔍 Qidiruv', (ctx) => {
    ctx.session ??= {};
    ctx.session.waitingSearch = true;
    ctx.reply('🔍 Qidirmoqchi bolgan mahsulot nomini yozing:');
});

// ─── TOVAR KIRIM ───────────────────────────────────────────────────────────
bot.hears('➕ Tovar Kirim', adminOnly((ctx) => {
    ctx.session ??= {};
    ctx.session.step = 'kirim_name';
    ctx.reply('Mahsulot nomini kiriting:');
}));

// ─── HISOBOT ───────────────────────────────────────────────────────────────
bot.hears('📋 Hisobot', adminOnly(async (ctx) => {
    try {
        const rows = await query(
            `SELECT w.row_name, COUNT(i.id) AS types, SUM(i.count) AS total
             FROM warehouse_config w
             LEFT JOIN items i ON i.warehouse_id = w.id
             GROUP BY w.id ORDER BY w.id`
        );
        let text = `📋 *OMBOR HISOBOTI*\n${DIV}\n`;
        rows.forEach(r => {
            text += `📁 *${r.row_name}*: ${r.types ?? 0} tur, ${r.total ?? 0} dona\n`;
        });
        text += DIV;
        await ctx.replyWithMarkdown(text);
    } catch (e) {
        logger.error(`Hisobot: ${e.message}`);
        ctx.reply('Hisobot yuklanmadi.');
    }
}));

// ─── TEXT HANDLER ──────────────────────────────────────────────────────────
bot.on('text', async (ctx) => {
    ctx.session ??= {};
    const text = ctx.message.text.trim();

    if (ctx.session.waitingSearch) {
        ctx.session.waitingSearch = false;
        try {
            const results = await query(
                'SELECT name, `count`, unit FROM items WHERE name LIKE ? LIMIT 20',
                [`%${text}%`]
            );
            if (!results.length) return ctx.reply('Hech narsa topilmadi.');
            let msg = `🔍 *Natijalar: "${text}"*\n${DIV}\n`;
            results.forEach((r, i) => {
                msg += `${i + 1}. *${r.name}* — ${r.count} ${r.unit || 'dona'}\n`;
            });
            await ctx.replyWithMarkdown(msg, mainMenu);
        } catch (e) {
            logger.error(`Qidiruv: ${e.message}`);
            ctx.reply('Qidiruv xatosi.');
        }
        return;
    }

    if (ctx.session.step === 'kirim_name') {
        ctx.session.kirim = { name: text };
        ctx.session.step = 'kirim_count';
        return ctx.reply('Miqdorini kiriting (raqam):');
    }
    if (ctx.session.step === 'kirim_count') {
        const count = parseInt(text);
        if (isNaN(count) || count <= 0) return ctx.reply('Faqat musbat raqam kiriting:');
        ctx.session.kirim.count = count;
        ctx.session.step = 'kirim_unit';
        return ctx.reply('Olchov birligini kiriting (dona, kg, litr):');
    }
    if (ctx.session.step === 'kirim_unit') {
        const { name, count } = ctx.session.kirim;
        ctx.session.step = null;
        ctx.session.kirim = null;
        try {
            await query(
                'INSERT INTO items (name, `count`, unit, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
                [name, count, text]
            );
            logger.info(`Kirim: ${name} x${count} ${text} — user ${ctx.from.id}`);
            await ctx.replyWithMarkdown(
                `✅ *Qoshildi!*\n└ Nom: *${name}*\n└ Miqdor: *${count} ${text}*`,
                mainMenu
            );
        } catch (e) {
            logger.error(`Kirim DB: ${e.message}`);
            ctx.reply('Saqlashda xato yuz berdi.');
        }
        return;
    }
});

// ─── GLOBAL ERROR ──────────────────────────────────────────────────────────
bot.catch((err, ctx) => {
    logger.error(`Global xato [${ctx?.updateType}]: ${err.message}`);
    ctx?.reply("Tizimda xato. Iltimos, bir ozdan sung urinib koring.").catch(() => {});
});

// ─── LAUNCH ────────────────────────────────────────────────────────────────
(async () => {
    try {
        await initDB();
        await bot.launch({ dropPendingUpdates: true });
        logger.info('AMBAR PRO ishga tushdi!');
    } catch (err) {
        logger.error(`Ishga tushishda xato: ${err.message}`);
        process.exit(1);
    }
})();

process.once('SIGINT',  () => { bot.stop('SIGINT');  });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); });

