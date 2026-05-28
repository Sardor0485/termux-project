const express = require('express');
const mariadb = require('mariadb');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Baza sozlamalari
const pool = mariadb.createPool({
    host: 'localhost',
    user: 'root',
    password: '', // Agar parolingiz bo'lsa yozing
    database: 'logistika',
    connectionLimit: 10
});

// Avtomatik sozlash
async function setupDB() {
    let conn;
    try {
        const rootPool = mariadb.createPool({ host: '127.0.0.1', user: 'root', password: '' });
        conn = await rootPool.getConnection();
        await conn.query("CREATE DATABASE IF NOT EXISTS logistika");
        await conn.release();
        await rootPool.end();

        conn = await pool.getConnection();
        await conn.query(`
            CREATE TABLE IF NOT EXISTS kelganlar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kim_keldi VARCHAR(255),
                nima_opkeldi VARCHAR(255),
                olchami VARCHAR(100),
                berildi_holati BOOLEAN DEFAULT FALSE,
                sana TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ Baza va jadval tayyor.");
    } catch (err) {
        console.error("❌ XATOLIK: MariaDB-ga ulanib bo'lmadi!", err.message);
        console.log("DIQQAT: MariaDB (MySQL) yoqilganini va 'root' foydalanuvchisi parolsiz ekanini tekshiring.");
    } finally {
        if (conn) conn.release();
    }
}
setupDB();

// API-lar
app.get('/api/data', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT * FROM kelganlar ORDER BY sana DESC");
        res.json(rows);
    } catch (err) { res.status(500).send(err); }
    finally { if (conn) conn.release(); }
});

app.post('/api/add', async (req, res) => {
    const { kim, nima, olcham } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("INSERT INTO kelganlar (kim_keldi, nima_opkeldi, olchami) VALUES (?, ?, ?)", [kim, nima, olcham]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err); }
    finally { if (conn) conn.release(); }
});

app.put('/api/update-status/:id', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("UPDATE kelganlar SET berildi_holati = TRUE WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err); }
    finally { if (conn) conn.release(); }
});

// Frontendni bitta fayl ichida yuborish
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="uz">
    <head>
        <meta charset="UTF-8">
        <title>Logistika Baza</title>
        <style>
            body { font-family: sans-serif; background: #f4f7f6; padding: 20px; }
            .container { max-width: 800px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            input { padding: 10px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; }
            button { padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #007bff; color: white; }
            .btn-give { background: #ffc107; color: black; padding: 5px 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>📦 Logistika Tizimi</h2>
            <input type="text" id="kim" placeholder="Kim keldi?">
            <input type="text" id="nima" placeholder="Nima opkeldi?">
            <input type="text" id="olcham" placeholder="O'lchami">
            <button onclick="qoshish()">Qo'shish</button>
            <table id="table">
                <thead><tr><th>Kim</th><th>Nima</th><th>O'lcham</th><th>Imzo</th><th>Holat</th></tr></thead>
                <tbody></tbody>
            </table>
        </div>
        <script>
            async function yuklash() {
                const res = await fetch('/api/data');
                const data = await res.json();
                document.querySelector('tbody').innerHTML = data.map(i => \`
                    <tr>
                        <td>\${i.kim_keldi}</td>
                        <td>\${i.nima_opkeldi}</td>
                        <td>\${i.olchami}</td>
                        <td>✅ Tekshirildi</td>
                        <td>\${i.berildi_holati ? '<b>🔵 Berildi</b>' : \`<button class="btn-give" onclick="topshirish(\${i.id})">Berish</button>\`}</td>
                    </tr>\`).join('');
            }
            async function qoshish() {
                const kim = document.getElementById('kim').value;
                const nima = document.getElementById('nima').value;
                const olcham = document.getElementById('olcham').value;
                await fetch('/api/add', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({kim, nima, olcham})
                });
                yuklash();
            }
            async function topshirish(id) {
                await fetch('/api/update-status/' + id, { method: 'PUT' });
                yuklash();
            }
            yuklash();
        </script>
    </body>
    </html>
    `);
});

app.listen(3000, () => console.log('🚀 Server ishga tushdi: http://localhost:3000'));
