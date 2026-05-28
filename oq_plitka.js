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
                <div class="item-content">
                    <div class="add-icon">+</div>
                </div>
            </div>`;
    }

    const isDanger = itm.count < 5;
    const isWarning = itm.count < 10 && itm.count >= 5;
    const status = isDanger ? 'danger' : isWarning ? 'warning' : 'ok';
    const randomDelay = (Math.random() * 0.5).toFixed(2) + "s"; // Tezroq random
    const vibrateClass = (isDanger || isWarning) ? 'vibrate-heavy' : '';

    return `
        <div class="inventory-item ${vibrateClass}" 
             style="--v-delay: ${randomDelay}"
             data-code="${itm.code}" id="item_${itm.id}" 
             draggable="true" ondragstart="drag(event, ${itm.id})"
             onclick="toggleActive(this, event)">
            <div class="item-content">
                <div class="comet-path"><div class="comet"></div></div>
                <div class="counter-blick"></div>
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
                html += `<div class="rack"><div class="rack-header">${st}-STELLAJ</div>`;
                [3, 2, 1, 0].forEach(et => {
                    html += `<div class="shelf-line"><div class="shelf-label">${et}</div><div class="shelf-grid">`;
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
            --bg: #0b0e14; --card: #161b22; --border: #30363d;
            --text: #adbac7; --header: rgba(22, 27, 34, 0.98); --input: #0d1117;
            --blue: #1a4fa0; --orange: #ff8c00; --red: #ff4444; --green: #3fb950;
            --limon: #A4C639;
        }
        [data-theme="light"] {
            --bg: #f6f8fa; --card: #ffffff; --border: #d0d7de;
            --text: #24292f; --header: rgba(255, 255, 255, 0.98); --input: #f0f2f5;
            --blue: #0969da;
        }

        body { background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding-top: 100px; }
        .racks-container::-webkit-scrollbar { display: none; }

        .header { 
            position: fixed; top: 0; width: 100%; height: 80px; background: var(--header); 
            border-bottom: 1px solid var(--border); z-index: 2000; padding: 0 20px; 
            display: flex; align-items: center; backdrop-filter: blur(10px); box-sizing: border-box;
        }
        #sInp { flex: 1; padding: 12px 12px 12px 45px; border-radius: 30px; background: var(--input); color: var(--text); border: 1px solid var(--border); outline: none; }

        .racks-container { display: flex; gap: 30px; padding: 20px; overflow-x: auto; }
        .rack { background: var(--card); border-radius: 15px; padding: 15px; min-width: 350px; border: 1px solid var(--border); }
        .rack-header { text-align: center; font-weight: 800; margin-bottom: 15px; color: var(--blue); }
        .shelf-line { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .shelf-label { font-size: 16px; font-weight: 800; color: var(--blue); width: 25px; text-align: center; }
        .shelf-grid { display: flex; gap: 8px; flex: 1; }

        .inventory-item { flex: 1; min-width: 65px; position: relative; cursor: grab; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        
        /* HOVERDA KATAK QIMIRLASHI */
        .inventory-item:hover { 
            transform: translateY(-8px) scale(1.08); 
            z-index: 100;
        }

        .item-content {
            height: 85px; border: 1px solid var(--border); border-radius: 10px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: var(--input); position: relative; overflow: hidden;
            box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
        }

        /* KUCHLI RANDOM VIBRATSIYA (Kam qolganlar uchun) */
        .vibrate-heavy { animation: shake-extreme 0.2s infinite alternate var(--v-delay); }
        @keyframes shake-extreme {
            0% { transform: translate(1px, 1px) rotate(0deg); }
            50% { transform: translate(-1px, -1px) rotate(-1deg); }
            100% { transform: translate(1px, -1px) rotate(1deg); }
        }

        /* KOMETA (Diagonal va Yorqin) */
        .comet-path { position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none; z-index: 5; }
        .comet {
            position: absolute; top: -30%; left: -30%; width: 6px; height: 6px;
            background: #fff; border-radius: 50%; 
            box-shadow: 0 0 15px 2px #fff, 0 0 30px 5px var(--blue); opacity: 0;
        }
        .comet::after {
            content: ''; position: absolute; width: 80px; height: 3px;
            background: linear-gradient(to left, #fff, transparent);
            top: 50%; right: 50%; transform: rotate(45deg); transform-origin: right;
        }
        .inventory-item:hover .comet { animation: fly-bright 0.5s ease-in-out forwards; }
        @keyframes fly-bright { 0% { top: -30%; left: -30%; opacity: 0; } 20% { opacity: 1; } 100% { top: 130%; left: 130%; opacity: 0; } }

        /* BLICK (Qarama-qarshi va Sezilarli) */
        .counter-blick {
            position: absolute; top: -50%; right: -180%; width: 120%; height: 250%;
            background: linear-gradient(-45deg, transparent, rgba(255,255,255,0.2), transparent);
            transform: rotate(-45deg); pointer-events: none; z-index: 4;
        }
        .inventory-item:hover .counter-blick { animation: blick-strong 0.5s ease-in-out forwards; }
        @keyframes blick-strong { 0% { right: -180%; } 100% { right: 180%; } }

        /* QIDIRUV (TO'Q LIMON) */
        .search-highlight .item-content { 
            background: var(--limon) !important; 
            border-color: #fff !important; 
            box-shadow: 0 0 30px var(--limon); 
            transform: scale(1.05);
        }
        .search-highlight .item-code, .search-highlight .item-qty { color: #000 !important; font-weight: 900; }

        .item-qty { font-size: 24px; font-weight: 900; z-index: 6; }
        .qty-ok { color: var(--green); } 
        .qty-warning { color: var(--orange); text-shadow: 0 0 10px rgba(255,140,0,0.5); } 
        .qty-danger { color: var(--red); text-shadow: 0 0 15px rgba(255,68,68,0.7); }
        .item-code { font-size: 11px; font-weight: 700; color: #768390; position: absolute; top: 8px; z-index: 6; }

        .row-title { font-size: 26px; font-weight: 900; margin: 40px 20px 10px; border-left: 8px solid var(--blue); padding-left: 20px; }
        .controls { display: none; position: absolute; bottom: -40px; width: 100%; gap: 5px; z-index: 100; }
        .inventory-item.active .controls { display: flex; }
        .controls button { flex: 1; height: 35px; border: 0; border-radius: 6px; color: #fff; cursor: pointer; font-weight: bold; font-size: 18px; }
        .minus { background: #333; } .plus { background: var(--green); }

        #modalOverlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: none; align-items: center; justify-content: center; z-index: 3000; backdrop-filter: blur(5px); }
        .modal-card { background: var(--card); padding: 30px; border-radius: 15px; width: 340px; border: 1px solid var(--border); }
    </style>
</head>
<body onclick="closeAllActive(event)">
    <div class="header">
        <button onclick="toggleMode()" style="margin-right:20px; padding:12px; border-radius:50%; border:1px solid var(--border); background:var(--card); color:var(--text); cursor:pointer; font-size:20px;">🌓</button>
        <div style="position:relative; flex:1;">
            <span style="position:absolute; left:15px; top:12px; font-size:20px;">🔍</span>
            <input type="text" id="sInp" placeholder="Tovar kodini yozing..." oninput="handleSearch()">
        </div>
    </div>

    <div id="mainContent">${html}</div>

    <div id="modalOverlay">
        <div class="modal-card">
            <h2 style="margin-top:0">Yangi Tovar</h2>
            <p id="posLabel" style="color:var(--blue); font-weight:bold;"></p>
            <input type="text" id="fCode" style="width:100%; padding:15px; margin-bottom:15px; border-radius:10px; border:1px solid var(--border); background:var(--input); color:var(--text); font-size:16px;" placeholder="KOD">
            <input type="number" id="fCount" style="width:100%; padding:15px; margin-bottom:15px; border-radius:10px; border:1px solid var(--border); background:var(--input); color:var(--text); font-size:16px;" value="1">
            <button onclick="saveItem()" style="width:100%; background:var(--blue); color:white; border:0; padding:15px; border-radius:10px; font-weight:bold; cursor:pointer; font-size:16px;">SAQLASH</button>
            <button onclick="closeModal()" style="width:100%; background:none; border:0; color:var(--text); margin-top:15px; cursor:pointer;">Bekor qilish</button>
        </div>
    </div>

    <script>
        function toggleMode() {
            const html = document.documentElement;
            html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
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
            if(first) first.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }

        function drag(ev, id) { 
            ev.dataTransfer.setData("text", id); 
            ev.currentTarget.style.opacity = "0.4";
        }
        function allowDrop(ev) { ev.preventDefault(); }
        async function drop(ev, q, st, et, us) {
            ev.preventDefault();
            const id = ev.dataTransfer.getData("text");
            await fetch('/move', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id, q, st, et, us }) });
            window.location.reload();
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
            document.getElementById('posLabel').innerText = q + " qator | " + st + "-Stellaj | " + et + "-Qavat";
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
            }
        }
    </script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

// API (Move, Add, Update)
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
    if(rows.length === 0) return res.json({ok: false});
    let n = rows[0].count + delta;
    if(n <= 0) await pool.execute("DELETE FROM main_items WHERE id=?", [id]);
    else await pool.execute("UPDATE main_items SET count=? WHERE id=?", [n, id]);
    res.json({ok: true});
});

app.listen(3000, () => console.log('Server: http://localhost:3000'));

