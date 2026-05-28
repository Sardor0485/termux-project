const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

const pool = mysql.createPool({
    host: '127.0.0.1', user: 'root', password: '', database: 'ambar', enableKeepAlive: true
});

app.use(express.json());

function renderCell(itm, q, st, et, us) {
    if (!itm) {
        return `
            <div class="inventory-item empty-cell" onclick="openAddModal('${q}', ${st}, ${et}, ${us})">
                <div class="item-content">
                    <div class="blick-effect"></div>
                    <div class="add-icon">+</div>
                </div>
            </div>`;
    }

    // Mantiq: 5 tadan kam bo'lsa 'danger', 10 tadan kam bo'lsa 'warning'
    const isDanger = itm.count < 5;
    const isWarning = itm.count < 10 && itm.count >= 5;
    
    const status = isDanger ? 'danger' : isWarning ? 'warning' : 'ok';
    const pulseClass = isDanger ? 'pulse-red-border' : isWarning ? 'pulse-orange-border' : '';

    return `
        <div class="inventory-item ${pulseClass}" data-code="${itm.code}" id="item_${itm.id}" onclick="toggleActive(this, event)">
            <div class="item-content">
                <div class="shooting-star"></div>
                <div class="blick-effect"></div>
                <div class="item-code">${itm.code}</div>
                <div class="item-qty qty-${status}" id="qty_val_${itm.id}">${itm.count}</div>
            </div>
            <div class="controls">
                <button class="minus" onclick="updateStock(${itm.id},-1,event)">−</button>
                <button class="plus" onclick="updateStock(${itm.id},1,event)">+</button>
            </div>
        </div>`;
}

app.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM main_items");
        let html = "";
        ['C','D','E'].forEach(q => {
            html += `<div class="row-section"><div class="row-title">QATOR ${q}</div><div class="racks-container">`;
            [1,2,3,4].forEach(st => {
                html += `<div class="rack">
                            <div class="rack-num">${st}-STELLAJ</div>`;
                [3, 2, 1, 0].forEach(et => {
                    html += `<div class="shelf-wrapper"><div class="floor-num">${et}</div><div class="shelf-grid">`;
                    for(let us=1; us<=4; us++){
                        const item = rows.find(r => r.row_char==q && r.row_num==st && r.col_num==et && r.row_num_in_st==us);
                        html += renderCell(item, q, st, et, us);
                    }
                    html += `</div></div>`;
                });
                html += `</div>`;
            });
            html += `</div></div>`;
        });

        res.send(`
<!DOCTYPE html>
<html lang="uz" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        :root {
            --bg: #0b0e14; --card: #161b22; --border: #30363d;
            --text: #adbac7; --header: #161b22; --input: #0d1117;
            --blue: #1a4fa0; --orange-mitter: #ff8c00;
            --red: #ff4444; --green: #3fb950;
            --star-color: rgba(255, 255, 255, 0.8);
            --star-tail: linear-gradient(-90deg, rgba(255,255,255,0.8), transparent);
        }
        [data-theme="light"] {
            --bg: #f2f4f7; --card: #ffffff; --border: #d0d7de;
            --text: #1f2328; --header: #ffffff; --input: #ffffff;
            --blue: #0969da;
        }

        body {
            background: var(--bg); color: var(--text); font-family: sans-serif;
            margin: 0; padding-top: 85px; transition: 0.3s; overflow-x: hidden;
        }

        .header { position: fixed; top: 0; width: 100%; background: var(--header); border-bottom: 1px solid var(--border); z-index: 1000; padding: 12px; display: flex; align-items: center; gap: 15px; box-sizing: border-box; }
        #sInp { flex: 1; padding: 12px; border-radius: 8px; background: var(--input); color: var(--text); border: 1px solid var(--border); outline: none; }
        
        .racks-container { display: flex; gap: 25px; padding: 20px; overflow-x: auto; align-items: flex-start; }
        .rack { background: var(--card); border-radius: 12px; padding: 15px; min-width: 320px; border: 1px solid var(--border); flex-shrink: 0; }
        .shelf-wrapper { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .floor-num { color: var(--blue); font-weight: 800; width: 20px; font-size: 12px; text-align: center; }
        .shelf-grid { display: flex; gap: 8px; flex: 1; }

        .inventory-item { flex: 1; min-width: 60px; position: relative; }
        .item-content {
            height: 80px; border: 1px solid var(--border); border-radius: 8px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: var(--input); position: relative; overflow: hidden;
        }

        /* --- SHOK EFFEKTLARI (ANIMATSIYALAR) --- */

        /* 10 dan past bo'lsa: Sariq miltillash (O'rtacha tezlik) */
        .qty-warning { 
            color: var(--orange-mitter) !important; 
            animation: warning-blink 0.6s infinite alternate ease-in-out;
            text-shadow: 0 0 8px rgba(255, 140, 0, 0.4);
        }
        @keyframes warning-blink {
            0% { opacity: 1; transform: scale(1); }
            100% { opacity: 0.5; transform: scale(1.1); }
        }

        /* 5 dan past bo'lsa: Qizil shox-shox urishi (Juda tez) */
        .qty-danger { 
            color: var(--red) !important; 
            animation: danger-shox 0.25s infinite alternate cubic-bezier(0.1, 0.7, 1.0, 0.1);
            text-shadow: 0 0 12px var(--red);
            font-weight: 900;
        }
        @keyframes danger-shox {
            0% { transform: scale(1); filter: brightness(1.2); }
            100% { transform: scale(1.4); filter: brightness(0.4); opacity: 0.6; }
        }

        /* Katak atrofini miltillatish */
        .pulse-red-border .item-content {
            border: 2px solid var(--red) !important;
            animation: border-shox 0.25s infinite alternate;
        }
        @keyframes border-shox {
            from { box-shadow: 0 0 2px var(--red); }
            to { box-shadow: 0 0 15px var(--red); }
        }

        /* Qidirilganda animatsiyalarni to'xtatish (ko'zni charchatmaslik uchun) */
        .search-highlight .item-content { background: #FFD700 !important; border-color: #000 !important; transform: scale(1.05); z-index: 5; }
        .search-highlight .item-code, .search-highlight .item-qty { color: #000 !important; animation: none !important; }

        /* Boshqa stillar */
        .item-code { font-size: 10px; font-weight: 700; color: #768390; position: absolute; top: 6px; }
        .item-qty { font-size: 22px; font-weight: 900; margin-top: 8px; transition: 0.2s; }
        .qty-ok { color: var(--green); }
        .controls { display: none; margin-top: 5px; gap: 4px; position: absolute; bottom: -35px; width: 100%; z-index: 10; }
        .inventory-item.active .controls { display: flex; }
        .controls button { flex: 1; height: 30px; border: 0; border-radius: 4px; font-weight: bold; cursor: pointer; color: #fff; }
        .minus { background: #444; } .plus { background: var(--green); }
        #modalOverlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
        .modal-card { background: var(--card); padding: 25px; border-radius: 12px; width: 320px; border: 1px solid var(--border); }
        .btn-save { width: 100%; background: var(--blue); color: white; border: 0; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .row-title { font-size: 22px; font-weight: 800; margin: 30px 20px 10px; color: var(--text); border-left: 5px solid var(--blue); padding-left: 15px; }
        .empty-cell .item-content { border: 1px dashed #555; background: transparent; cursor: pointer; }
    </style>
</head>
<body onclick="closeAllActive(event)">
    <div class="header">
        <button class="theme-btn" onclick="toggleMode()" style="padding:10px; border-radius:8px; border:1px solid var(--border); background:var(--card); color:var(--text); cursor:pointer;">🌓</button>
        <input type="text" id="sInp" placeholder="Tovar qidirish..." oninput="handleSearch()">
    </div>

    <div id="mainContent">${html}</div>

    <div id="modalOverlay">
        <div class="modal-card">
            <h3 style="margin:0">Yangi tovar</h3>
            <p id="posLabel" style="font-size: 11px; color: var(--blue); margin: 5px 0 15px;"></p>
            <input type="text" id="fCode" style="width:100%; padding:12px; margin-bottom:10px; border-radius:8px; border:1px solid var(--border); background:var(--input); color:var(--text);" placeholder="Kod">
            <input type="number" id="fCount" style="width:100%; padding:12px; margin-bottom:10px; border-radius:8px; border:1px solid var(--border); background:var(--input); color:var(--text);" value="1">
            <button class="btn-save" onclick="saveItem()">Saqlash</button>
            <button onclick="closeModal()" style="width:100%; background:none; border:0; color:var(--text); margin-top:10px; cursor:pointer">Yopish</button>
        </div>
    </div>

    <script>
        function toggleMode() {
            const html = document.documentElement;
            html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        }

        function handleSearch() {
            const val = document.getElementById('sInp').value.toUpperCase();
            const items = document.querySelectorAll('.inventory-item');
            items.forEach(i => i.classList.remove('search-highlight'));
            if(!val) return;
            let first = null;
            items.forEach(i => {
                if(i.dataset.code && i.dataset.code.includes(val)) {
                    i.classList.add('search-highlight');
                    if(!first) first = i;
                }
            });
            if(first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function closeAllActive(e) { if (!e.target.closest('.inventory-item')) document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active')); }
        function toggleActive(el, e) {
            e.stopPropagation();
            const was = el.classList.contains('active');
            document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active'));
            if (!was) el.classList.add('active');
        }

        let currentPos = {};
        function openAddModal(q, st, et, us) {
            currentPos = { q, st, et, us };
            document.getElementById('posLabel').innerText = q + " qator, " + st + "-stellaj, " + et + "-qavat";
            document.getElementById('modalOverlay').style.display = 'flex';
        }
        function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

        async function saveItem() {
            const code = document.getElementById('fCode').value.toUpperCase();
            const count = document.getElementById('fCount').value;
            if(!code) return;
            await fetch('/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...currentPos, code, count}) });
            window.location.reload();
        }

        async function updateStock(id, delta, e) {
            e.stopPropagation();
            const res = await fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, delta}) });
            if(res.ok) {
                const span = document.getElementById('qty_val_' + id);
                let n = parseInt(span.innerText) + delta;
                if(n <= 0) window.location.reload();
                span.innerText = n;
                // Sahifani yangilamasdan ranglarni o'zgartirish (dinamiklik uchun)
                const parent = span.parentElement.parentElement;
                span.className = 'item-qty ' + (n < 5 ? 'qty-danger' : n < 10 ? 'qty-warning' : 'qty-ok');
            }
        }
    </script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

app.post('/add', async (req,res) => {
    const {q, st, et, us, code, count} = req.body;
    await pool.execute("INSERT INTO main_items (row_char, row_num, col_num, row_num_in_st, code, count) VALUES (?, ?, ?, ?, ?, ?)", [q, st, et, us, code, count]);
    res.json({ok: true});
});

app.post('/update', async (req,res) => {
    const {id, delta} = req.body;
    const [rows] = await pool.execute("SELECT count FROM main_items WHERE id=?", [id]);
    if(rows.length === 0) return res.json({ok: false});
    let n = rows[0].count + delta;
    if(n <= 0) await pool.execute("DELETE FROM main_items WHERE id=?", [id]);
    else await pool.execute("UPDATE main_items SET count=? WHERE id=?", [n, id]);
    res.json({ok: true});
});

app.listen(3000, () => console.log('Server running on port 3000'));

