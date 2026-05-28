const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const token = '8147123427:AAEpQF2JnENY3dCagcsTtOGYlJILos6LEdE';
const bot = new TelegramBot(token, { polling: true });

const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'ambar'
});

app.use(express.json());
app.use(express.static('public'));

// Web App asosi
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: Mahsulotlarni olish
app.get('/api/products', async (req, res) => {
    const [rows] = await pool.execute("SELECT * FROM main_items ORDER BY id DESC");
    res.json(rows);
});

// Bot komandasi
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "📦 Ombor tizimiga xush kelibsiz!\nPastdagi tugmani bosing:", {
        reply_markup: {
            inline_keyboard: [[
                { text: "Ilovani ochish", web_app: { url: 'Sizning_Server_URL' } } 
            ]]
        }
    });
});

app.listen(3000, () => console.log("Server 3000-portda ishlamoqda"));

