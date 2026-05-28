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
            <div class="inventory-item empty-cell" 
                 onclick="openAddModal('${q}', ${st}, ${et}, ${us})"
                 ondragover="allowDrop(event)" 
                 ondrop="drop(event, '${q}', ${st}, ${et}, ${us})">
                <div class="item-content"><div class="add-icon">+</div></div>
            </div>`;
    }

    const isLow = itm.count < 10;
    const isCritical = itm.count < 5;
    const status = isCritical ? 'danger' : isLow ? 'warning' : 'ok';
    
    const randomDelay = (Math.random() * 2).toFixed(2);
    const randomDur = (0.7 + Math.random() * 0.3).toFixed(2);
    const shakeClass = isLow ? 'bell-shake' : '';

    return `
        <div class="inventory-item" 
             data-code="${itm.code}" id="item_${itm.id}" 
             draggable="true" ondragstart="drag(event, ${itm.id})"
             onclick="toggleActive(this, event)">
            
            <div class="item-content">
                <div class="item-code-inside">${itm.code}</div>
                
                <div class="shake-layer ${shakeClass}" style="--delay: ${randomDelay}s; --dur: ${randomDur}s">
                    <div class="item-qty qty-${status}" id="qty_val_${itm.id}">${itm.count}</div>
                </div>

                <div class="comet-star"></div>
                <div class="slow-glint"></div>
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
                html += `<div class="rack"><div class="rack-num">${st}-STELLAJ</div>`;
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            --bg: #0d1117; --card: #161b22; --border: #30363d;
            --text: #c9d1d9; --blue: #58a6ff; --red: #f85149; --orange: #d29922; --green: #3fb950;
        }
        [data-theme="light"] {
            --bg: #f6f8fa; --card: #ffffff; --border: #d0d7de;
            --text: #24292f; --blue: #0969da; --red: #cf222e; --orange: #9a6700; --green: #1a7f37;
        }

        body { background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding-top: 75px; transition: 0.3s; }
        ::-webkit-scrollbar { display: none; }

        .header { position: fixed; top: 0; width: 100%; height: 65px; background: var(--card); border-bottom: 1px solid var(--border); z-index: 1000; display: flex; align-items: center; padding: 0 20px; box-sizing: border-box; gap: 15px; }
        #sInp { flex: 1; padding: 12px; border-radius: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); outline: none; }
        .theme-btn { background: none; border: 1px solid var(--border); color: var(--text); padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 18px; }

        .racks-container { display: flex; gap: 20px; padding: 20px; overflow-x: auto; }
        .rack { background: var(--card); border-radius: 12px; padding: 15px; min-width: 330px; border: 1px solid var(--border); flex-shrink: 0; }
        .rack-num { color: var(--blue); text-align: center; margin-bottom: 15px; font-weight: 800; font-size: 14px; }

        .shelf-wrapper { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .floor-num { color: #8b949e; width: 15px; font-size: 11px; font-weight: bold; }
        .shelf-grid { display: flex; gap: 6px; flex: 1; }

        .inventory-item { flex: 1; min-width: 65px; position: relative; }
        .item-content { height: 80px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }

        /* KOD: STABIL */
        .item-code-inside { position: absolute; top: 6px; width: 100%; text-align: center; font-size: 10px; font-weight: 800; color: #8b949e; z-index: 25; pointer-events: none; }

        /* QO'NG'IROQ EFFEKTI */
        .shake-layer { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; transform-origin: top center; }
        .bell-shake { animation: bell-ring var(--dur) infinite ease-in-out; animation-delay: var(--delay); }
        @keyframes bell-ring { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(5deg); } 75% { transform: rotate(-5deg); } }

        /* KOMETA (OQ O'Q KABI) */
        .comet-star {
            position: absolute; top: 50%; left: -150%; width: 100px; height: 100px;
            background: linear-gradient(135deg, transparent 42%, #fff 48%, #fff 52%, transparent 58%);
            transform: translate(-50%, -50%); opacity: 0; z-index: 15;
        }
        .inventory-item:hover .comet-star { animation: comet-move 0.6s cubic-bezier(0.2, 0, 0.2, 1) forwards; }
        @keyframes comet-move { 0% { left: -150%; opacity: 1; } 100% { left: 150%; opacity: 0; } }

        /* SEKIN BLIK */
        .slow-glint {
            position: absolute; top: 0; left: -150%; width: 45%; height: 100%;
            background: linear-gradient(120deg, transparent, rgba(255,255,255,0.15), transparent);
            transform: skewX(-25deg); z-index: 14;
        }
        .inventory-item:hover .slow-glint { animation: glint-move 1.1s ease-in-out 0.4s forwards; }
        @keyframes glint-move { 0% { left: -150%; } 100% { left: 200%; } }

        .search-highlight .item-content { background: #ffea00 !important; border-color: #000 !important; transform: scale(1.05); z-index: 50; }
        .search-highlight .item-qty, .search-highlight .item-code-inside { color: #000 !important; font-weight: 900; }

        .item-qty { font-size: 26px; font-weight: 900; z-index: 10; }
        .qty-danger { color: var(--red); } .qty-warning { color: var(--orange); } .qty-ok { color: var(--green); }

        .controls { display: none; position: absolute; bottom: -35px; width: 100%; gap: 4px; z-index: 100; }
        .inventory-item.active .controls { display: flex; }
        .controls button { flex: 1; height: 30px; border: 0; border-radius: 4px; color: #fff; font-weight: bold; cursor: pointer; }
        .minus { background: #30363d; } .plus { background: var(--blue); }

        #modalOverlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: none; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
        .modal-card { background: var(--card); padding: 25px; border-radius: 12px; width: 300px; border: 1px solid var(--border); position: relative; }
        .close-btn { position: absolute; top: 12px; right: 15px; cursor: pointer; font-size: 22px; color: var(--text); }
        .row-title { font-size: 18px; font-weight: bold; margin: 25px 20px 10px; border-left: 4px solid var(--blue); padding-left: 12px; }
    </style>
</head>
<body onclick="closeAllActive(event)">
    <div class="header">
        <button class="theme-btn" onclick="toggleTheme()">🌓</button>
        <input type="text" id="sInp" placeholder="Tavar qidirish..." oninput="handleSearch()">
    </div>
    <div id="mainContent">${html}</div>

    <div id="modalOverlay">
        <div class="modal-card">
            <span class="close-btn" onclick="closeModal()">×</span>
            <h3 style="margin-top:0">Tavar qo'shish</h3>
            <p id="posLabel" style="color:var(--blue); font-size:12px; margin-bottom:15px;"></p>
            <input type="text" id="fCode" placeholder="Kod" style="width:100%; padding:10px; margin-bottom:10px; border-radius:6px; background:var(--bg); border:1px solid var(--border); color:var(--text); box-sizing:border-box;">
            <input type="number" id="fCount" value="1" style="width:100%; padding:10px; margin-bottom:15px; border-radius:6px; background:var(--bg); border:1px solid var(--border); color:var(--text); box-sizing:border-box;">
            <button onclick="saveItem()" style="width:100%; padding:12px; background:var(--blue); color:#fff; border:0; border-radius:6px; font-weight:bold; cursor:pointer">SAQLASH</button>
        </div>
    </div>

    <script>
        function toggleTheme() {
            const el = document.documentElement;
            const theme = el.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            el.setAttribute('data-theme', theme);
        }

        function drag(ev, id) { ev.dataTransfer.setData("text", id); }
        function allowDrop(ev) { ev.preventDefault(); }
        async function drop(ev, q, st, et, us) {
            ev.preventDefault();
            const id = ev.dataTransfer.getData("text");
            const res = await fetch('/move', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id, q, st, et, us }) });
            if(res.ok) window.location.reload();
        }

        function handleSearch() {
            const val = document.getElementById('sInp').value.toUpperCase();
            document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('search-highlight'));
            if(!val) return;
            let first = null;
            document.querySelectorAll('.inventory-item').forEach(i => {
                if(i.dataset.code && i.dataset.code.includes(val)) {
                    i.classList.add('search-highlight');
                    if(!first) first = i;
                }
            });
            if(first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function toggleActive(el, e) {
            e.stopPropagation();
            document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active'));
            el.classList.add('active');
        }
        function closeAllActive(e) { if (!e.target.closest('.inventory-item')) document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active')); }

        let cp = {};
        function openAddModal(q, st, et, us) {
            cp = { q, st, et, us };
            document.getElementById('posLabel').innerText = q + st + " | Joy: " + us;
            document.getElementById('modalOverlay').style.display = 'flex';
        }
        function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

        async function saveItem() {
            const code = document.getElementById('fCode').value.toUpperCase();
            const count = document.getElementById('fCount').value;
            if(!code) return;
            await fetch('/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...cp, code, count}) });
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

// API-LAR
app.post('/move', async (req, res) => {
    const { id, q, st, et, us } = req.body;
    await pool.execute("UPDATE main_items SET row_char=?, row_num=?, col_num=?, row_num_in_st=? WHERE id=?", [q, st, et, us, id]);
    res.json({ ok: true });
});
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

app.listen(3000);

