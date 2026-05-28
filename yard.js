const { Telegraf, Markup, session } = require('telegraf');

// Tokeningiz kodingizda qoldi (8408803989:AAEH...)
const bot = new Telegraf('8408803989:AAEH9u_1sQvRu1Mq10mPSxvoypRXERM0ydQ');

const YARD_TO_CM = 91.44;
const RULON_CONFIG = {
    '3#': { yard: 400, cm: 400 * YARD_TO_CM },
    '5#': { yard: 200, cm: 200 * YARD_TO_CM }
};

// Sessiyani to'g'ri ulash
bot.use(session());

// Har bir yangi foydalanuvchi uchun sessiya ob'ektini yaratish
bot.use((ctx, next) => {
    ctx.session ??= {};
    return next();
});

bot.start((ctx) => {
    ctx.session = {}; 
    return ctx.reply('Assalomu alaykum! Masrur Textil zamok hisoblash botiga xush kelibsiz.\nQaysi turdagi zamokni hisoblaymiz?', 
        Markup.keyboard([['3# lik', '5# lik']]).oneTime().resize()
    );
});

bot.hears(['3# lik', '5# lik'], (ctx) => {
    const type = ctx.message.text.split(' ')[0]; 
    ctx.session.type = type;
    ctx.session.step = 'waiting_length'; // Qaysi qadamdaligini belgilaymiz
    return ctx.reply(`${type} zamok uzunligini kiriting (sm da):`, Markup.removeKeyboard());
});

bot.on('text', async (ctx) => {
    const input = parseFloat(ctx.message.text.replace(',', '.'));

    if (isNaN(input)) {
        return ctx.reply('Iltimos, faqat raqam kiriting (masalan: 70 yoki 15.5)');
    }

    if (!ctx.session.type) {
        return ctx.reply('Avval zamok turini tanlang: /start');
    }

    // 1-Qadam: Uzunlikni saqlash
    if (ctx.session.step === 'waiting_length') {
        ctx.session.length = input;
        ctx.session.step = 'waiting_quantity';
        return ctx.reply(`${ctx.session.type} uchun ${input} sm dan nechta dona kerak?`);
    }

    // 2-Qadam: Sonini saqlash va hisoblash
    if (ctx.session.step === 'waiting_quantity') {
        const quantity = input;
        const { type, length } = ctx.session;
        
        const config = RULON_CONFIG[type];
        const totalCm = length * quantity;
        const exactRulons = totalCm / config.cm;
        const roundedRulons = Math.ceil(exactRulons);

        const report = `
📊 **Hisobot:**
--------------------------
🔹 **Zamok turi:** ${type}
🔹 **Bitta dona:** ${length} sm
🔹 **Soni:** ${quantity} dona
🔹 **Jami uzunlik:** ${(totalCm / 100).toFixed(2)} metr

📏 **Natija:**
Aniq miqdor: **${exactRulons.toFixed(2)} rulon**
Sotib olish kerak: **${roundedRulons} rulon**
--------------------------
_1 rulon ${type}: ${config.yard} yard (${(config.cm / 100).toFixed(1)} metr)_
        `;

        await ctx.replyWithMarkdown(report);
        
        ctx.session = {}; // Sessiyani tozalash
        return ctx.reply('Yangi hisob-kitob uchun /start bosing.');
    }
});

bot.launch().then(() => console.log('Bot muvaffaqiyatli ishga tushdi!'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

