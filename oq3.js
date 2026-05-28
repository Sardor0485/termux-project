const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

const pool = mysql.createPool({
    host: '127.0.0.1', user: 'root', password: '', database: 'ambar', enableKeepAlive: true
});

app.use(express.json());

// Kataklarni chizish funksiyasi
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

    const isLow = itm.count < 5;
    const status = isLow ? 'danger' : itm.count < 10 ? 'warning' : 'ok';
    const pulseClass = isLow ? 'pulse-red-border' : '';
    
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
                        html += `<div class="fixed-cell">${renderCell(item, q, st, et, us)}</div>`;
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
            --blue-deep: #1a4fa0; --orange-matte: #ff8c00;
            --red: #ff4444; --green: #3fb950;
        }
        [data-theme="light"] {
            --bg: #f6f8fa; --card: #ffffff; --border: #d0d7de; 
            --text: #24292f; --header: #ffffff; --input: #ffffff;
            --blue-deep: #0969da;
        }

        body { background: var(--bg); color: var(--text); font-family: -apple-system, sans-serif; margin: 0; padding-top: 80px; transition: 0.3s; }

        /* HEADER & CONTROLS */
        .header { position: fixed; top: 0; width: 100%; background: var(--header); border-bottom: 1px solid var(--border); z-index: 1000; padding: 12px; display: flex; align-items: center; gap: 15px; box-sizing: border-box; }
        #sInp { flex: 1; padding: 12px; border-radius: 8px; background: var(--input); color: var(--text); border: 1px solid var(--border); outline: none; font-size: 16px; }
        .theme-btn { padding: 10px 15px; border-radius: 8px; border: 1px solid var(--border); background: var(--card); color: var(--text); cursor: pointer; font-size: 18px; }

        /* RACK & DYNAMIC TITLE */
        .racks-container { display: flex; gap: 20px; padding: 20px; overflow-x: auto; }
        .rack { background: var(--card); border-radius: 12px; padding: 15px; min-width: 310px; border: 1px solid var(--border); transition: 0.3s; }
        .rack-num { color: #768390; text-align: center; margin-bottom: 15px; font-weight: 800; font-size: 14px; transition: 0.3s; }
        /* Sichqoncha turganda stellaj yozuvi to'q ko'k */
        .rack:hover .rack-num { color: var(--blue-deep); }
        .rack:hover { border-color: var(--blue-deep); }

        /* ITEM CONTENT */
        .item-content {
            height: 85px; border: 1px solid var(--border); border-radius: 8px; 
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            background: var(--input); position: relative; overflow: hidden;
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.3s;
        }
        .inventory-item:hover .item-content { transform: translateY(-5px) rotateX(8deg); }

        /* SEARCH HIGHLIGHT: TO'Q SARIQ MATOVIY VA QORA YOZUV */
        .search-highlight .item-content {
            background: var(--orange-matte) !important;
            border-color: #e67e22 !important;
            transform: scale(1.08) translateY(-8px) !important;
        }
        .search-highlight .item-code, .search-highlight .item-qty { 
            color: #000000 !important; font-weight: 900; 
        }

        /* EFFECT: BLICK & STAR */
        .blick-effect {
            position: absolute; top: 150%; left: -150%; width: 300%; height: 300%;
            background: linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent);
            transform: rotate(-20deg); pointer-events: none;
        }
        .inventory-item:hover .blick-effect { top: -150%; left: 150%; transition: 0.7s ease-in-out; }

        .shooting-star {
            position: absolute; bottom: -5px; left: -5px; width: 4px; height: 4px;
            background: #fff; border-radius: 50%; opacity: 0;
        }
        .shooting-star::after {
            content: ""; position: absolute; top: 50%; right: 50%; width: 45px; height: 2px;
            background: linear-gradient(-90deg, #fff, transparent);
            transform: translateY(-50%) rotate(-45deg); transform-origin: right;
        }
        @keyframes diagonalShoot { 0% { transform: translate(0, 0); opacity: 1; } 100% { transform: translate(140px, -140px); opacity: 0; } }
        .inventory-item:hover .shooting-star { animation: diagonalShoot 0.5s ease-out forwards; }

        /* SHELF GRID */
        .fixed-cell { perspective: 1000px; display: table-cell; width: 25%; vertical-align: top; }
        .shelf-wrapper { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .floor-num { color: var(--blue-deep); font-weight: bold; width: 15px; font-size: 11px; }
        .shelf-grid { display: table; width: 100%; border-spacing: 4px; }
        .row-title { font-size: 22px; font-weight: 800; margin: 25px 20px 5px; color: var(--text); border-left: 5px solid var(--blue-deep); padding-left: 15px; }

        /* ITEM DATA */
        .item-code { font-size: 10px; font-weight: 700; color: #768390; position: absolute; top: 8px; }
        .item-qty { font-size: 24px; font-weight: 900; margin-top: 10px; }
        .qty-danger { color: var(--red); }
        .qty-ok { color: var(--green); }

        /* CONTROLS */
        .controls { display: none; margin-top: 6px; gap: 4px; }
        .inventory-item.active .controls { display: flex; }
        .controls button { flex: 1; height: 32px; border: 0; border-radius: 6px; font-weight: bold; cursor: pointer; color: #fff; }
        .minus { background: #444; } .plus { background: var(--green); }

        /* MODAL */
        #modalOverlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
        .modal-card { background: var(--card); padding: 30px; border-radius: 16px; width: 350px; border: 1px solid var(--border); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .modal-card input { width: 100%; padding: 12px; margin: 10px 0; border-radius: 8px; background: var(--input); border: 1px solid var(--border); color: var(--text); box-sizing: border-box; }
        .btn-save { width: 100%; background: var(--blue-deep); color: white; border: 0; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }

        @keyframes pulse-red-flat { 0%, 100% { border-color: var(--red); } 50% { border-color: #7a1a1a; } }
        .pulse-red-border .item-content { animation: pulse-red-flat 2s infinite ease-in-out; border-width: 2px; }
        .empty-cell .item-content { border: 1px dashed #444; background: transparent; cursor: pointer; }
        .add-icon { color: #444; font-size: 24px; }
    </style>
</head>
<body onclick="closeAllActive(event)">
    <div class="header">
        <button class="theme-btn" onclick="toggleMode()">🌓</button>
        <input type="text" id="sInp" placeholder="Qidiruv (masalan: 222)..." oninput="handleSearch()">
    </div>

    <div id="mainContent">${html}</div>

    <div id="modalOverlay">
        <div class="modal-card">
            <h3 style="margin:0">Yangi Tovar</h3>
            <p id="posLabel" style="font-size: 11px; color: var(--blue-deep); margin-bottom: 15px;"></p>
            <input type="text" id="fCode" placeholder="Tovar kodi">
            <input type="number" id="fCount" placeholder="Soni" value="1">
            <button class="btn-save" onclick="saveItem()">Saqlash</button>
            <button onclick="closeModal()" style="width:100%; background:none; border:0; color:var(--text); margin-top:10px; cursor:pointer">Bekor qilish</button>
        </div>
    </div>

    <script>
        // MODES
        function toggleMode() {
            const html = document.documentElement;
            const isDark = html.getAttribute('data-theme') === 'dark';
            html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        }

        // QIDIRUV FUNKSIYASI
        function handleSearch() {
            const val = document.getElementById('sInp').value.toUpperCase();
            const items = document.querySelectorAll('.inventory-item');
            items.forEach(i => i.classList.remove('search-highlight'));

            if(!val) return;

            let firstFound = null;
            items.forEach(i => {
                if(i.dataset.code && i.dataset.code.includes(val)) {
                    i.classList.add('search-highlight');
                    if(!firstFound) firstFound = i;
                }
            });

            if(firstFound) firstFound.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function closeAllActive(e) { if (!e.target.closest('.inventory-item')) document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active')); }
        function toggleActive(el, e) { e.stopPropagation(); const was = el.classList.contains('active'); document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active')); if (!was) el.classList.add('active'); }

        let currentPos = {};
        function openAddModal(q, st, et, us) {
            currentPos = { q, st, et, us };
            document.getElementById('posLabel').innerText = q + " qator, " + st + "-stellaj, " + et + "-qavat";
            document.getElementById('modalOverlay').style.display = 'flex';
            document.getElementById('fCode').focus();
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
            }
        }
    </script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

// BACKEND
app.post('/add', async (req,res) => {
    const {q, st, et, us, code, count} = req.body;
    await pool.execute("INSERT INTO main_items (row_char, row_num, col_num, row_num_in_st, code, count) VALUES (?, ?, ?, ?, ?, ?)", [q, st, et, us, code, count]);
    res.json({ok: true});
});

app.post('/update', async (req,res) => {
    const {id, delta} = req.body;
    const [rows] = await pool.execute("SELECT count FROM main_items WHERE id=?", [id]);
    let n = rows[0].count + delta;
    if(n <= 0) await pool.execute("DELETE FROM main_items WHERE id=?", [id]);
    else await pool.execute("UPDATE main_items SET count=? WHERE id=?", [n, id]);
    res.json({ok: true});
});

app.listen(3000, () => console.log("Ambor tizimi ishlamoqda: port 3000"));

