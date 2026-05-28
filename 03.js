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
                <div class="item-content"><div class="add-icon">+</div></div>
            </div>`;
    }

    const isDanger = itm.count < 5;
    const isWarning = itm.count < 10 && itm.count >= 5;
    const status = isDanger ? 'danger' : isWarning ? 'warning' : 'ok';
    
    // Yumshoqroq tebranish
    const moveDur = (0.6 + Math.random() * 0.4).toFixed(2) + "s";
    const moveDelay = (Math.random() * 1).toFixed(2) + "s";
    const vibrateClass = (isDanger || isWarning) ? 'soft-vibe' : '';

    return `
        <div class="inventory-item ${vibrateClass}" 
             style="--v-dur: ${moveDur}; --v-del: ${moveDelay}"
             data-code="${itm.code}" id="item_${itm.id}" 
             draggable="true" ondragstart="drag(event, ${itm.id})"
             onclick="toggleActive(this, event)">
            <div class="item-content">
                <div class="star-flight"></div>
                <div class="item-code-box">${itm.code}</div>
                <div class="item-qty qty-${status}" id="qty_val_${itm.id}">${itm.count}</div>
            </div>
            <div class="controls">
                <button class="btn-minus" onclick="updateStock(${itm.id},-1,event)">−</button>
                <button class="btn-plus" onclick="updateStock(${itm.id},1,event)">+</button>
            </div>
        </div>`;
}

app.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM main_items");
        let htmlContent = "";
        ['C','D','E'].forEach(q => {
            htmlContent += `
            <div class="row-section">
                <div class="row-title">QATOR ${q}</div>
                <div class="racks-container">`;
            [1,2,3,4].forEach(st => {
                htmlContent += `<div class="rack"><div class="rack-header">${q}${st}</div>`;
                [3, 2, 1, 0].forEach(et => {
                    htmlContent += `<div class="shelf-line"><div class="shelf-label">${et}</div><div class="shelf-grid">`;
                    for(let us=1; us<=4; us++){
                        const item = rows.find(r => r.row_char==q && r.row_num==st && r.col_num==et && r.row_num_in_st==us);
                        htmlContent += renderCell(item, q, st, et, us);
                    }
                    htmlContent += `</div></div>`;
                });
                htmlContent += `</div>`;
            });
            htmlContent += `</div></div>`;
        });

        res.send(`
<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <style>
        :root {
            --bg: #0d1117; --card: #161b22; --border: #30363d;
            --text-main: #f0f6fc; --text-dim: #8b949e;
            --blue: #58a6ff; --red: #f85149; --orange: #d29922; --green: #3fb950;
            --found-bg: #ffea00; /* Sariq rang */
        }

        * { box-sizing: border-box; scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }

        body { background: var(--bg); color: var(--text-main); font-family: -apple-system, system-ui, sans-serif; margin: 0; padding-top: 70px; }

        .header { position: fixed; top: 0; width: 100%; height: 60px; background: var(--bg); border-bottom: 1px solid var(--border); z-index: 2000; display: flex; align-items: center; padding: 0 20px; }
        #sInp { flex: 1; padding: 10px 20px; border-radius: 6px; border: 1px solid var(--border); background: #010409; color: #fff; font-size: 16px; outline: none; }

        .racks-container { display: flex; gap: 20px; padding: 20px; overflow-x: auto; }
        .rack { background: var(--card); border-radius: 10px; padding: 15px; min-width: 350px; border: 1px solid var(--border); flex-shrink: 0; }
        .rack-header { text-align: center; color: var(--blue); margin-bottom: 12px; font-weight: bold; font-size: 18px; }

        .shelf-line { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .shelf-label { font-size: 12px; color: var(--text-dim); width: 20px; text-align: center; }
        .shelf-grid { display: flex; gap: 8px; flex: 1; }

        .inventory-item { flex: 1; min-width: 70px; position: relative; }
        .item-content { 
            height: 85px; border: 1px solid var(--border); border-radius: 8px; 
            background: var(--card); display: flex; flex-direction: column; 
            align-items: center; justify-content: center; position: relative; overflow: hidden;
            transition: transform 0.2s, background 0.3s;
        }

        /* YUMSHOQ TEBRANISH (Ogohlantirish) */
        .soft-vibe { animation: vibe var(--v-dur) infinite ease-in-out var(--v-del); }
        @keyframes vibe {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
        }

        /* QIDIRUVDA TOPILGAN KATAK */
        .search-found .item-content { 
            background: var(--found-bg) !important; 
            border-color: #000 !important; 
            transform: scale(1.08); 
            z-index: 50;
        }
        .search-found .item-qty, .search-found .item-code-box { color: #000 !important; }

        /* UCHAR YULDUZ */
        .star-flight {
            position: absolute; top: -100%; left: -100%; width: 200%; height: 1.5px;
            background: linear-gradient(90deg, transparent, #fff, transparent);
            transform: rotate(45deg); opacity: 0;
        }
        .inventory-item:hover .star-flight { animation: star-anim 0.4s ease-out forwards; }
        @keyframes star-anim {
            0% { top: -100%; left: -100%; opacity: 1; }
            100% { top: 100%; left: 100%; opacity: 0; }
        }

        .item-qty { font-size: 24px; font-weight: 900; }
        .item-code-box { font-size: 10px; color: var(--text-dim); position: absolute; top: 6px; font-weight: bold; }
        
        .qty-ok { color: var(--green); }
        .qty-warning { color: var(--orange); }
        .qty-danger { color: var(--red); }

        .controls { display: none; position: absolute; bottom: -38px; width: 100%; gap: 5px; z-index: 100; }
        .inventory-item.active .controls { display: flex; }
        .controls button { flex: 1; height: 32px; border-radius: 5px; border: 1px solid var(--border); color: #fff; cursor: pointer; background: #30363d; font-size: 18px; }
        .btn-plus { background: var(--blue) !important; border: none !important; }

        .empty-cell .item-content { border: 1px dashed var(--border); opacity: 0.3; }
        .add-icon { color: var(--text-dim); font-size: 24px; }
        .row-title { font-size: 20px; font-weight: bold; margin: 30px 20px 10px; border-left: 5px solid var(--blue); padding-left: 15px; }

        #modalOverlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: none; align-items: center; justify-content: center; z-index: 3000; backdrop-filter: blur(4px); }
        .modal-card { background: var(--card); padding: 25px; border-radius: 12px; width: 300px; border: 1px solid var(--border); }
    </style>
</head>
<body onclick="closeAllActive(event)">
    <div class="header"><input type="text" id="sInp" placeholder="Tavar kodini kiriting..." oninput="handleSearch()"></div>
    
    <div id="mainContent">${htmlContent}</div>

    <div id="modalOverlay">
        <div class="modal-card">
            <h3 id="posLabel" style="color:var(--blue); margin:0 0 15px 0; font-size:18px;"></h3>
            <input type="text" id="fCode" placeholder="KOD" style="width:100%; padding:10px; margin-bottom:10px; background:#000; border:1px solid var(--border); color:#fff; border-radius:4px;">
            <input type="number" id="fCount" value="1" style="width:100%; padding:10px; margin-bottom:15px; background:#000; border:1px solid var(--border); color:#fff; border-radius:4px;">
            <button onclick="saveItem()" style="width:100%; padding:12px; background:var(--blue); color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">SAQLASH</button>
            <p onclick="closeModal()" style="text-align:center; color:var(--text-dim); cursor:pointer; margin-top:15px; font-size:13px;">Yopish</p>
        </div>
    </div>

    <script>
        function handleSearch() {
            const val = document.getElementById('sInp').value.toUpperCase();
            document.querySelectorAll('.inventory-item').forEach(i => {
                i.classList.remove('search-found');
                if(val && i.dataset.code && i.dataset.code.includes(val)) {
                    i.classList.add('search-found');
                }
            });
            // Topilgan birinchi elementga scroll qilish
            const first = document.querySelector('.search-found');
            if(first) first.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }

        function toggleActive(el, e) {
            e.stopPropagation();
            document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active'));
            el.classList.add('active');
        }

        function closeAllActive(e) {
            if (!e.target.closest('.inventory-item')) document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active'));
        }

        async function updateStock(id, delta, e) {
            e.stopPropagation();
            const res = await fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, delta}) });
            if(res.ok) {
                const span = document.getElementById('qty_val_' + id);
                let cur = parseInt(span.innerText);
                if(cur + delta <= 0) window.location.reload();
                else span.innerText = cur + delta;
            }
        }

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

        function drag(ev, id) { ev.dataTransfer.setData("text", id); }
        async function drop(ev, q, st, et, us) {
            ev.preventDefault();
            const id = ev.dataTransfer.getData("text");
            await fetch('/move', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id, q, st, et, us }) });
            window.location.reload();
        }
        function allowDrop(ev) { ev.preventDefault(); }
    </script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

// Backend API-lar... (o'zgarishsiz)
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

app.listen(3000, () => console.log('Sklad Pro: Sariq qidiruv tizimi tayyor!'));

