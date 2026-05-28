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
    // Vibratsiya faqat qizil va sariq holatdagilar uchun
    const vibrateClass = (isDanger || isWarning) ? 'vibrate-item' : '';

    return `
        <div class="inventory-item ${vibrateClass}" 
             data-code="${itm.code}" id="item_${itm.id}" 
             draggable="true" ondragstart="drag(event, ${itm.id})"
             onclick="toggleActive(this, event)">
            <div class="item-content">
                <div class="comet"></div>
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
            --bg: #0b0e14; --card: #161b22; --border: #30363d;
            --text: #adbac7; --header: rgba(22, 27, 34, 0.98); --input: #0d1117;
            --blue: #1a4fa0; --orange: #ff8c00; --red: #ff4444; --green: #3fb950;
            --limon: #9ACD32; /* To'q limon sariq */
        }
        [data-theme="light"] {
            --bg: #f6f8fa; --card: #ffffff; --border: #d0d7de;
            --text: #24292f; --header: rgba(255, 255, 255, 0.98); --input: #ffffff;
            --blue: #0969da;
        }

        body { background: var(--bg); color: var(--text); font-family: -apple-system, sans-serif; margin: 0; padding-top: 100px; transition: 0.3s; }
        .racks-container::-webkit-scrollbar { display: none; }

        /* FIXED SEARCH BAR */
        .header { 
            position: fixed; top: 0; width: 100%; height: 80px;
            background: var(--header); border-bottom: 1px solid var(--border); 
            z-index: 2000; padding: 0 20px; display: flex; align-items: center; 
            backdrop-filter: blur(10px); box-sizing: border-box;
        }
        .search-wrapper { position: relative; flex: 1; display: flex; align-items: center; }
        .search-wrapper::before { content: '🔍'; position: absolute; left: 15px; z-index: 1; }
        
        #sInp { 
            width: 100%; padding: 12px 12px 12px 45px; border-radius: 25px; 
            background: var(--input); color: var(--text); border: 1px solid var(--border); 
            outline: none; font-size: 16px; transition: 0.3s;
        }

        .racks-container { display: flex; gap: 25px; padding: 20px; overflow-x: auto; }
        .rack { background: var(--card); border-radius: 12px; padding: 15px; min-width: 320px; border: 1px solid var(--border); flex-shrink: 0; }
        .shelf-grid { display: flex; gap: 8px; flex: 1; }

        .inventory-item { flex: 1; min-width: 65px; position: relative; transition: transform 0.3s; }
        
        /* HOVER QIMIRLASH */
        .inventory-item:hover { transform: translateY(-5px) scale(1.03); z-index: 5; }

        .item-content {
            height: 80px; border: 1px solid var(--border); border-radius: 8px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: var(--input); position: relative; overflow: hidden;
        }

        /* VIBRATSIYA (SHAKE) ANIMATSIYASI */
        .vibrate-item { animation: shake-move 2.5s infinite ease-in-out; }
        @keyframes shake-move {
            0%, 100% { transform: rotate(0deg); }
            10%, 30%, 50% { transform: rotate(-1deg); }
            20%, 40%, 60% { transform: rotate(1deg); }
            70% { transform: scale(1.02); }
        }

        /* KOMETA VA BLICK */
        .comet {
            position: absolute; top: -10px; left: -10px; width: 6px; height: 6px;
            background: #fff; border-radius: 50%; box-shadow: 0 0 15px #fff; opacity: 0;
        }
        .comet::after {
            content: ''; position: absolute; top: 50%; left: 0; width: 35px; height: 2px;
            background: linear-gradient(90deg, #fff, transparent); transform: rotate(-135deg); transform-origin: left;
        }
        .inventory-item:hover .comet { animation: diag-comet 0.8s ease-out forwards; }
        @keyframes diag-comet {
            0% { transform: translate(0, 0); opacity: 0; }
            20% { opacity: 1; }
            100% { transform: translate(120px, 100px); opacity: 0; }
        }

        .counter-blick {
            position: absolute; top: -50%; right: -150%; width: 100%; height: 200%;
            background: linear-gradient(-45deg, transparent, rgba(255,255,255,0.1), transparent);
            transform: rotate(-45deg); pointer-events: none;
        }
        .inventory-item:hover .counter-blick { animation: diag-blick 0.8s ease-in-out forwards; }
        @keyframes diag-blick {
            0% { right: -150%; top: -50%; }
            100% { right: 150%; top: 50%; }
        }

        /* QIDIRUV: TO'Q LIMON SARIQ */
        .search-highlight .item-content {
            background: var(--limon) !important; border-color: #fff !important;
            box-shadow: 0 0 15px var(--limon);
        }
        .search-highlight .item-code, .search-highlight .item-qty { color: #000 !important; font-weight: 800; }

        /* STATUS RANGLARI */
        .item-qty { font-size: 22px; font-weight: 900; }
        .qty-ok { color: var(--green); }
        .qty-warning { color: var(--orange); }
        .qty-danger { color: var(--red); }
        .item-code { font-size: 10px; font-weight: 700; color: #768390; position: absolute; top: 6px; }

        .controls { display: none; margin-top: 5px; gap: 4px; position: absolute; bottom: -35px; width: 100%; z-index: 10; }
        .inventory-item.active .controls { display: flex; }
        .controls button { flex: 1; height: 30px; border: 0; border-radius: 4px; cursor: pointer; color: #fff; font-weight: bold; }
        .minus { background: #444; } .plus { background: var(--green); }
        .row-title { font-size: 22px; font-weight: 800; margin: 30px 20px 10px; color: var(--text); border-left: 5px solid var(--blue); padding-left: 15px; }

        #modalOverlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 3000; backdrop-filter: blur(4px); }
        .modal-card { background: var(--card); padding: 25px; border-radius: 12px; width: 320px; border: 1px solid var(--border); color: var(--text); }
    </style>
</head>
<body onclick="closeAllActive(event)">
    <div class="header">
        <button onclick="toggleMode()" style="margin-right:15px; padding:10px; border-radius:50%; border:1px solid var(--border); background:var(--card); cursor:pointer; color: var(--text);">🌓</button>
        <div class="search-wrapper">
            <input type="text" id="sInp" placeholder="Tovar qidirish..." oninput="handleSearch()">
        </div>
    </div>

    <div id="mainContent">${html}</div>

    <div id="modalOverlay">
        <div class="modal-card">
            <h3 style="margin-top:0">Yangi tovar</h3>
            <p id="posLabel" style="font-size: 11px; color: var(--blue);"></p>
            <input type="text" id="fCode" style="width:100%; padding:12px; margin-bottom:10px; border-radius:8px; border:1px solid var(--border); background:var(--input); color:var(--text);" placeholder="KOD">
            <input type="number" id="fCount" style="width:100%; padding:12px; margin-bottom:10px; border-radius:8px; border:1px solid var(--border); background:var(--input); color:var(--text);" value="1">
            <button onclick="saveItem()" style="width:100%; background:var(--blue); color:white; border:0; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer">SAQLASH</button>
            <button onclick="closeModal()" style="width:100%; background:none; border:0; color:var(--text); margin-top:10px; cursor:pointer">Yopish</button>
        </div>
    </div>

    <script>
        function toggleMode() {
            const html = document.documentElement;
            const current = html.getAttribute('data-theme');
            html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
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
            if(first) first.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }

        function drag(ev, id) { ev.dataTransfer.setData("text", id); ev.target.style.opacity = "0.4"; }
        function allowDrop(ev) { ev.preventDefault(); }
        async function drop(ev, q, st, et, us) {
            ev.preventDefault();
            const id = ev.dataTransfer.getData("text");
            const res = await fetch('/move', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id, q, st, et, us }) });
            if(res.ok) window.location.reload();
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
            document.getElementById('posLabel').innerText = q + " qator, " + st + "-stellaj";
            document.getElementById('modalOverlay').style.display = 'flex';
        }
        function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

        async function saveItem() {
            const code = document.getElementById('fCode').value.toUpperCase();
            const count = document.getElementById('fCount').value;
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
                span.className = 'item-qty ' + (n < 5 ? 'qty-danger' : n < 10 ? 'qty-warning' : 'qty-ok');
            }
        }
    </script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

app.post('/move', async (req, res) => {
    const { id, q, st, et, us } = req.body;
    try {
        await pool.execute("UPDATE main_items SET row_char=?, row_num=?, col_num=?, row_num_in_st=? WHERE id=?", [q, st, et, us, id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).send(err.message); }
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

