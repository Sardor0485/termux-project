const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

// MySQL Cloud ulanishi (TiDB Cloud ma'lumotlari bilan)
const pool = mysql.createPool({
    host: 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '25efH3qxm3bEoLW.root',
    password: 'YXQnkZYVL29GgU6C',
    database: 'test',
    enableKeepAlive: true,
    ssl: {
        rejectUnauthorized: false // Cloud bazalar uchun bu shart!
    }
});

app.use(express.json());

// Jadval mavjud bo'lmasa, uni avtomatik yaratish funksiyasi
async function initDB() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS main_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(50) NOT NULL,
            row_char CHAR(1) NOT NULL,
            row_num INT NOT NULL,
            col_num INT NOT NULL,
            row_num_in_st INT NOT NULL,
            count INT DEFAULT 1
        );
    `;
    try {
        await pool.execute(createTableQuery);
        console.log('Ma\'lumotlar bazasi va jadvallar tayyor.');
    } catch (err) {
        console.error('DB yaratishda xato:', err);
    }
}
initDB();

// Katak ichini yaratish
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

        res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ambar Pro v3.3</title>
    <style>
        :root { --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #c9d1d9; --accent: #58a6ff; }
        body.light { --bg: #f6f8fa; --card: #ffffff; --border: #d0d7de; --text: #24292f; --accent: #0969da; }
        body { background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding: 20px; }
        .row-title { font-weight: bold; margin: 20px 0 10px 0; color: var(--accent); }
        .racks-container { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; }
        .rack { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 10px; min-width: 300px; }
        .rack-header { text-align: center; font-weight: bold; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 10px; }
        .shelf { display: flex; gap: 5px; margin-bottom: 5px; align-items: center; }
        .shelf-label { width: 20px; font-size: 12px; color: #8b949e; }
        .cell { border: 1px solid var(--border); width: 65px; height: 65px; display: flex; align-items: center; justify-content: center; position: relative; border-radius: 4px; }
        .found { background: #d29922 !important; color: #000 !important; }
        .item-code { font-size: 10px; position: absolute; top: 4px; font-weight: bold; }
        .item-qty { font-size: 24px; font-weight: bold; }
        .qty-ok { color: #3fb950; } .qty-warning { color: #d29922; } .qty-danger { color: #f85149; }
        .controls { display: none; position: absolute; bottom: -10px; z-index: 10; gap: 5px; }
        .inventory-item.active .controls { display: flex; }
        .btn-m, .btn-p { border: none; border-radius: 4px; color: white; cursor: pointer; padding: 2px 8px; }
        .btn-m { background: #f85149; } .btn-p { background: #3fb950; }
        .btn-add { color: var(--border); cursor: pointer; font-size: 24px; }
        #theme-toggle, #search { position: fixed; z-index: 1000; background: var(--card); color: var(--text); border: 1px solid var(--border); }
        #theme-toggle { top: 20px; right: 20px; padding: 8px 15px; border-radius: 20px; }
        #search { top: 20px; left: 50%; transform: translateX(-50%); width: 200px; padding: 10px; border-radius: 20px; outline: none; }
    </style>
</head>
<body id="b">
    <button id="theme-toggle" onclick="toggleTheme()">🌓 Mode</button>
    <input type="text" id="search" placeholder="Qidiruv..." oninput="doSearch()">
    <div style="margin-top: 60px;"> \${html} </div>

    <div id="modal" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--card); padding:20px; border:1px solid var(--border); border-radius:8px; z-index:2000;">
        <input type="text" id="newCode" placeholder="Kod" style="padding:8px; margin-bottom:10px; width:100%;">
        <button onclick="saveItem()" style="width:100%; padding:8px; background:var(--accent); border:none; color:white; border-radius:4px;">Saqlash</button>
        <button onclick="closeModal()" style="width:100%; margin-top:5px; background:transparent; color:var(--text); border:none;">Yopish</button>
    </div>

    <script>
        let activeCoords = null;
        function toggleTheme() { document.body.classList.toggle('light'); }
        function toggleActive(el) { el.classList.toggle('active'); }
        function openAddModal(el) {
            activeCoords = JSON.parse(el.closest('.cell').dataset.coords);
            document.getElementById('modal').style.display = 'block';
            document.getElementById('newCode').focus();
        }
        function closeModal() { document.getElementById('modal').style.display = 'none'; }

        async function updateStock(id, delta, e, cid) {
            e.stopPropagation();
            const res = await fetch('/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id, delta})
            });
            const data = await res.json();
            document.getElementById(cid).innerHTML = data.html;
        }

        async function saveItem() {
            const code = document.getElementById('newCode').value.toUpperCase();
            if(!code) return;
            const res = await fetch('/add', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({code, coords: activeCoords})
            });
            const data = await res.json();
            const cid = \`cell_\${activeCoords.q}_\${activeCoords.s}_\${activeCoords.e}_\${activeCoords.u}\`;
            document.getElementById(cid).innerHTML = data.html;
            closeModal();
            document.getElementById('newCode').value = '';
        }

        function doSearch() {
            const s = document.getElementById('search').value.toUpperCase();
            document.querySelectorAll('.cell').forEach(c => c.classList.remove('found'));
            if(!s) return;
            document.querySelectorAll('.inventory-item').forEach(i => {
                if(i.dataset.code.includes(s)) {
                    const cell = i.closest('.cell');
                    cell.classList.add('found');
                    cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    </script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

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

app.post('/add', async (req,res) => {
    const {code, coords} = req.body;
    const [r] = await pool.execute("INSERT INTO main_items (code, row_char, row_num, col_num, row_num_in_st, count) VALUES (?,?,?,?,?,1)",
        [code, coords.q, coords.s, coords.e, coords.u]);
    const itm = {id: r.insertId, code, count: 1, row_char: coords.q, row_num: coords.s, col_num: coords.e, row_num_in_st: coords.u};
    res.json({html: renderCell(itm)});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('Ambar Pro serverda ishga tushdi: ' + PORT));
