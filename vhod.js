const express = require('express');
const mariadb = require('mariadb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// MariaDB ulanishi
const pool = mariadb.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '', 
    database: 'logistika',
    connectionLimit: 10
});

// Baza va Jadvalni tayyorlash
async function initDB() {
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
        console.log("✅ Tizim tayyor: http://localhost:3000");
    } catch (err) {
        console.error("❌ Baza xatosi:", err.message);
    } finally {
        if (conn) conn.release();
    }
}
initDB();

// --- API-LAR ---
app.get('/api/data', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT * FROM kelganlar ORDER BY sana DESC");
        res.json(rows);
    } catch (err) { res.status(500).json(err); }
    finally { if (conn) conn.release(); }
});

app.post('/api/add', async (req, res) => {
    const { kim, nima, olcham } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("INSERT INTO kelganlar (kim_keldi, nima_opkeldi, olchami) VALUES (?, ?, ?)", [kim, nima, olcham]);
        res.json({ success: true });
    } catch (err) { res.status(500).json(err); }
    finally { if (conn) conn.release(); }
});

app.put('/api/update/:id', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("UPDATE kelganlar SET berildi_holati = TRUE WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json(err); }
    finally { if (conn) conn.release(); }
});

app.delete('/api/delete/:id', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("DELETE FROM kelganlar WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json(err); }
    finally { if (conn) conn.release(); }
});

// --- FRONTEND ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="uz">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Logistika Nazorati</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; }
            body { background: #f4f7f9; padding: 10px; }
            .container { max-width: 1000px; margin: auto; background: white; padding: 20px; border-radius: 15px; shadow: 0 4px 20px rgba(0,0,0,0.08); }
            header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .stats { background: #3498db; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; }
            
            .form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 20px; }
            input { padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; outline: none; }
            input:focus { border-color: #3498db; }
            .add-btn { background: #27ae60; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.3s; }
            .add-btn:hover { background: #219150; }

            .table-wrapper { overflow-x: auto; }
            table { width: 100%; border-collapse: collapse; min-width: 600px; }
            th { background: #f8f9fa; color: #777; font-size: 13px; text-transform: uppercase; padding: 15px; text-align: left; }
            td { padding: 15px; border-bottom: 1px solid #eee; font-size: 15px; }
            
            .badge-done { background: #d4edda; color: #155724; padding: 5px 10px; border-radius: 5px; font-size: 12px; font-weight: bold; }
            .btn-action { padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; margin-right: 5px; }
            .btn-give { background: #f39c12; color: white; }
            .btn-del { background: #e74c3c; color: white; }
            
            @media (max-width: 600px) {
                .container { padding: 15px; }
                header h2 { font-size: 18px; }
                td, th { padding: 10px; font-size: 13px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h2>📦 Logistika</h2>
                <div class="stats" id="counter">Jami: 0</div>
            </header>
            
            <div class="form">
                <input type="text" id="k" placeholder="Kim keldi?">
                <input type="text" id="n" placeholder="Nima olib keldi?">
                <input type="text" id="o" placeholder="O'lchami">
                <button class="add-btn" onclick="add()">Qo'shish</button>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>Kim</th><th>Nima</th><th>O'lcham</th><th>Holat</th><th>Amallar</th></tr>
                    </thead>
                    <tbody id="list"></tbody>
                </table>
            </div>
        </div>

        <script>
            async function load() {
                const r = await fetch('/api/data');
                const data = await r.json();
                document.getElementById('counter').innerText = 'Jami: ' + data.length;
                document.getElementById('list').innerHTML = data.map(i => \`
                    <tr>
                        <td><b>\${i.kim_keldi}</b></td>
                        <td>\${i.nima_opkeldi}</td>
                        <td>\${i.olchami}</td>
                        <td>\${i.berildi_holati ? '<span class="badge-done">BERILDI</span>' : '<i>Kutilmoqda</i>'}</td>
                        <td>
                            \${!i.berildi_holati ? \`<button class="btn-action btn-give" onclick="upd(\${i.id})">Berish</button>\` : ''}
                            <button class="btn-action btn-del" onclick="del(\${i.id})">O'chirish</button>
                        </td>
                    </tr>\`).join('');
            }

            async function add() {
                const k = document.getElementById('k'), n = document.getElementById('n'), o = document.getElementById('o');
                if(!k.value || !n.value) return alert("Ma'lumot kiriting!");
                await fetch('/api/add', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ kim: k.value, nima: n.value, olcham: o.value })
                });
                k.value = ''; n.value = ''; o.value = '';
                load();
            }

            async function upd(id) {
                await fetch('/api/update/' + id, { method: 'PUT' });
                load();
            }

            async function del(id) {
                if(confirm("O'chirilsinmi?")) {
                    await fetch('/api/delete/' + id, { method: 'DELETE' });
                    load();
                }
            }
            load();
        </script>
    </body>
    </html>
    `);
});

app.listen(3000);
