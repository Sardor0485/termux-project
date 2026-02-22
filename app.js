const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

// TiDB Cloud ulanish sozlamalari
const pool = mysql.createPool({
    host: 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '25efH3qxm3bEoLW.root',
    password: 'YXQnkZYVL29GgU6C',
    database: 'test',
    enableKeepAlive: true,
    ssl: {
        rejectUnauthorized: false // Cloud baza uchun shart
    }
});

app.use(express.json());

// Bazada jadval borligini tekshirish
async function initDB() {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS main_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) NOT NULL,
                row_char CHAR(1) NOT NULL,
                row_num INT NOT NULL,
                col_num INT NOT NULL,
                row_num_in_st INT NOT NULL,
                count INT DEFAULT 1
            )
        `);
        console.log('Baza tayyor.');
    } catch (err) {
        console.error('Baza ulanishida xato:', err.message);
    }
}
initDB();

// HTML Render funksiyasi
function renderCell(itm) {
    if (!itm) return `<div class="btn-add" onclick="openAddModal(this)">+</div>`;
    const status = itm.count <= 3 ? 'danger' : itm.count < 10 ? 'warning' : 'ok';
    const cid = `cell_${itm.row_char}_${itm.row_num}_${itm.col_num}_${itm.row_num_in_st}`;
    return `
        <div class="inventory-item qty-${status}" data-code="${itm.code}" onclick="toggleActive(this)">
            <div class="item-code">${itm.code}</div>
            <div class="item-qty">${itm.count}</div>
            <div class="controls">
                <button class="btn-m" onclick="updateStock(${itm.id},-1,event,'${cid}')">−</button>
                <button class="btn-p" onclick="updateStock(${itm.id},1,event,'${cid}')">+</button>
            </div>
        </div>`;
}

// Asosiy sahifa
app.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM main_items");
        let html = "";
        ['C','D','E'].forEach(q => {
            html += `<div class="row-title">QATOR ${q}</div><div class="racks-container">`;
            [1,2,3,4].forEach(st => {
                html += `<div class="rack"><div class="rack-header">${q}${st} Stellaj</div>`;
                [3,2,1,0].forEach(et => {
                    html += `<div class="shelf"><div class="shelf-label">${et}</div>`;
                    for(let us=1; us<=4; us++){
                        const item = rows.find(r => r.row_char==q && r.row_num==st && r.col_num==et && r.row_num_in_st==us);
                        const cid = `cell_${q}_${st}_${et}_${us}`;
                        html += `<div class="cell" id="${cid}" data-coords='{"q":"${q}","s":${st},"e":${et},"u":${us}}'>${renderCell(item)}</div>`;
                    }
                    html += `</div>`;
                });
                html += `</div>`;
            });
            html += `</div>`;
        });
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
            :root { --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #c9d1d9; --accent: #58a6ff; }
            body { background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding: 20px; }
            .racks-container { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; }
            .rack { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 10px; min-width: 300px; }
            .shelf { display: flex; gap: 5px; margin-bottom: 5px; align-items: center; }
            .cell { border: 1px solid var(--border); width: 65px; height: 65px; display: flex; align-items: center; justify-content: center; position: relative; border-radius: 4px; }
            .item-code { font-size: 10px; position: absolute; top: 4px; font-weight: bold; }
            .item-qty { font-size: 24px; font-weight: bold; }
            .qty-ok { color: #3fb950; } .qty-warning { color: #d29922; } .qty-danger { color: #f85149; }
            .btn-add { color: var(--border); cursor: pointer; font-size: 24px; }
            .controls { display: none; position: absolute; bottom: -10px; z-index: 10; gap: 5px; }
            .inventory-item.active .controls { display: flex; }
            .btn-m { background: #f85149; color: white; border:none; padding: 2px 8px; border-radius: 4px;}
            .btn-p { background: #3fb950; color: white; border:none; padding: 2px 8px; border-radius: 4px;}
        </style></head><body>
        <div id="main">${html}</div>
        <script>
            function toggleActive(el) { el.classList.toggle('active'); }
            async function updateStock(id, delta, e, cid) {
                e.stopPropagation();
                const res = await fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, delta}) });
                const data = await res.json();
                document.getElementById(cid).innerHTML = data.html;
            }
        </script></body></html>`);
    } catch(err) { res.status(500).send("Baza xatosi: " + err.message); }
});

// API qismlari
app.post('/update', async (req,res) => {
    const {id, delta} = req.body;
    const [rows] = await pool.execute("SELECT * FROM main_items WHERE id=?", [id]);
    const itm = rows[0];
    const newQty = itm.count + delta;
    if(newQty <= 0) {
        await pool.execute("DELETE FROM main_items WHERE id=?", [id]);
        res.json({html: renderCell(null)});
    } else {
        await pool.execute("UPDATE main_items SET count=? WHERE id=?", [newQty, id]);
        itm.count = newQty;
        res.json({html: renderCell(itm)});
    }
});

// Render uchun Portni sozlash
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Server yonik: ' + PORT));

