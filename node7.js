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
                 ondragleave="clearDropStyle(event)"
                 ondrop="drop(event, '${q}', ${st}, ${et}, ${us})">
                <div class="item-content">
                    <div class="add-icon">+</div>
                </div>
            </div>`;
    }

    const isDanger = itm.count < 5;
    const isWarning = itm.count < 10 && itm.count >= 5;
    const status = isDanger ? 'danger' : isWarning ? 'warning' : 'ok';
    const pulseClass = isDanger ? 'pulse-red-border' : isWarning ? 'pulse-orange-border' : '';

    return `
        <div class="inventory-item ${pulseClass}" 
             data-code="${itm.code}" id="item_${itm.id}" 
             draggable="true" ondragstart="drag(event, ${itm.id})"
             onclick="toggleActive(this, event)">
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        :root {
            --bg: #0b0e14; --card: #161b22; --border: #30363d;
            --text: #adbac7; --header: #161b22; --input: #0d1117;
            --blue: #1a4fa0; --orange-mitter: #ff8c00;
            --red: #ff4444; --green: #3fb950;
        }
        [data-theme="light"] {
            --bg: #f2f4f7; --card: #ffffff; --border: #d0d7de;
            --text: #1f2328; --header: #ffffff; --input: #ffffff;
            --blue: #0969da;
        }

        body { background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding-top: 85px; }

        .racks-container::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
        .racks-container, body { -ms-overflow-style: none; scrollbar-width: none; }

        .header { position: fixed; top: 0; width: 100%; background: var(--header); border-bottom: 1px solid var(--border); z-index: 1000; padding: 12px; display: flex; align-items: center; gap: 15px; box-sizing: border-box; }
        #sInp { flex: 1; padding: 12px; border-radius: 8px; background: var(--input); color: var(--text); border: 1px solid var(--border); outline: none; }

        .racks-container { display: flex; gap: 25px; padding: 20px; overflow-x: auto; align-items: flex-start; }
        .rack { background: var(--card); border-radius: 12px; padding: 15px; min-width: 320px; border: 1px solid var(--border); flex-shrink: 0; }
        .shelf-wrapper { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .floor-num { color: var(--blue); font-weight: 800; width: 20px; font-size: 12px; text-align: center; }
        .shelf-grid { display: flex; gap: 8px; flex: 1; }

        .inventory-item { flex: 1; min-width: 60px; position: relative; cursor: grab; }
        .item-content {
            height: 80px; border: 1px solid var(--border); border-radius: 8px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: var(--input); position: relative; overflow: hidden; transition: 0.3s;
        }

        /* --- 45 GRADUS HOVER ANIMATSIYALAR --- */
        
        /* Blick effekti: diagonal bo'ylab */
        .blick-effect {
            position: absolute; top: -50%; left: -150%; width: 100%; height: 200%;
            background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
            transform: rotate(45deg);
            pointer-events: none;
        }
        .inventory-item:hover .blick-effect {
            animation: diagonal-blick 0.8s ease-in-out forwards;
        }
        @keyframes diagonal-blick {
            0% { left: -150%; top: -50%; }
            100% { left: 150%; top: 50%; }
        }

        /* Uchar yulduz: diagonal bo'ylab */
        .shooting-star {
            position: absolute; top: 0; left: 0; width: 3px; height: 3px;
            background: #fff; border-radius: 50%; box-shadow: 0 0 10px #fff;
            opacity: 0; pointer-events: none;
        }
        .inventory-item:hover .shooting-star {
            animation: diagonal-star 0.6s ease-out forwards;
        }
        @keyframes diagonal-star {
            0% { transform: translate(-10px, -10px); opacity: 0; }
            30% { opacity: 1; }
            100% { transform: translate(100px, 80px); opacity: 0; }
        }

        /* Border effekti */
        .inventory-item:hover .item-content { border-color: var(--blue); }
        .pulse-red-border .item-content { border: 2px solid var(--red) !important; animation: border-shox 0.8s infinite alternate; }
        @keyframes border-shox { from { box-shadow: 0 0 2px var(--red); } to { box-shadow: 0 0 10px var(--red); } }

        /* Qolgan qismlar */
        .empty-cell .item-content { border: 1px dashed #555; background: transparent; }
        .item-code { font-size: 10px; font-weight: 700; color: #768390; position: absolute; top: 6px; }
        .item-qty { font-size: 22px; font-weight: 900; margin-top: 8px; }
        .qty-ok { color: var(--green); }
        .qty-warning { color: var(--orange-mitter); }
        .qty-danger { color: var(--red); }
        
        .controls { display: none; margin-top: 5px; gap: 4px; position: absolute; bottom: -35px; width: 100%; z-index: 10; }
        .inventory-item.active .controls { display: flex; }
        .controls button { flex: 1; height: 30px; border: 0; border-radius: 4px; font-weight: bold; cursor: pointer; color: #fff; }
        .minus { background: #444; } .plus { background: var(--green); }

        #modalOverlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
        .modal-card { background: var(--card); padding: 25px; border-radius: 12px; width: 320px; border: 1px solid var(--border); }
        .btn-save { width: 100%; background: var(--blue); color: white; border: 0; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .row-title { font-size: 22px; font-weight: 800; margin: 30px 20px 10px; color: var(--text); border-left: 5px solid var(--blue); padding-left: 15px; }
        .drag-over { background: rgba(63, 185, 80, 0.2) !important; border: 1px solid var(--green) !important; }
    </style>
</head>
<body onclick="closeAllActive(event)">
    <div class="header">
        <button onclick="toggleMode()" style="padding:10px; border-radius:8px; border:1px solid var(--border); background:var(--card); color:var(--text); cursor:pointer;">🌓</button>
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

        function drag(ev, id) {
            ev.dataTransfer.setData("text", id);
            ev.target.style.opacity = "0.4";
        }

        function allowDrop(ev) {
            ev.preventDefault();
            ev.currentTarget.classList.add('drag-over');
        }

        function clearDropStyle(ev) {
            ev.currentTarget.classList.remove('drag-over');
        }

        async function drop(ev, q, st, et, us) {
            ev.preventDefault();
            ev.currentTarget.classList.remove('drag-over');
            const id = ev.dataTransfer.getData("text");
            const res = await fetch('/move', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id, q, st, et, us })
            });
            if(res.ok) window.location.reload();
        }

        function handleSearch() {
            const val = document.getElementById('sInp').value.toUpperCase();
            document.querySelectorAll('.inventory-item').forEach(i => {
                i.style.opacity = (!val || (i.dataset.code && i.dataset.code.includes(val))) ? "1" : "0.1";
            });
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
        const [existing] = await pool.execute("SELECT id FROM main_items WHERE row_char=? AND row_num=? AND col_num=? AND row_num_in_st=?", [q, st, et, us]);
        if (existing.length > 0) return res.status(400).json({ error: "Band" });
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

// Portni band bo'lishidan himoya
const server = app.listen(3000, () => console.log('Server running on port 3000'));
server.on('error', (e) => { if (e.code === 'EADDRINUSE') { console.log('Port 3000 band. fuser -k 3000/tcp yozing.'); } });
