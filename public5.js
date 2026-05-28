const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

const pool = mysql.createPool({
    host: '127.0.0.1', user: 'root', password: '', database: 'ambar', enableKeepAlive: true
});

app.use(express.json());

function renderCell(itm) {
    if (!itm) return `<div class="btn-add" onclick="openAddModal(this)">+</div>`;
    const status = itm.count < 5 ? 'danger' : itm.count < 10 ? 'warning' : 'ok';
    return `
        <div class="inventory-item" data-code="${itm.code}" id="item_${itm.id}" onclick="toggleActive(this)">
            <div class="item-content">
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
                            <div class="rack-num">${st}-STELLAJ</div>
                            <div class="rack-body">`;
                
                [3, 2, 1, 0].forEach(et => {
                    html += `<div class="shelf-wrapper">
                                <div class="floor-num">${et}</div>
                                <div class="shelf">`;
                    for(let us=1; us<=4; us++){
                        const item = rows.find(r => r.row_char==q && r.row_num==st && r.col_num==et && r.row_num_in_st==us);
                        const cid = `cell_${q}_${st}_${et}_${us}`;
                        html += `<div class="cell" id="${cid}" data-coords='{"q":"${q}","s":${st},"e":${et},"u":${us}}'>${renderCell(item)}</div>`;
                    }
                    html += `</div></div>`;
                });
                
                html += `   </div>
                        </div>`;
            });
            html += `</div></div>`;
        });

        res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        :root { 
            --bg: #0b0e14; 
            --card: #161b22; 
            --border: #30363d; 
            --red: #ff4444; 
            --green: #3fb950; 
            --blue: #58a6ff;
            --code-dark: #888; /* Yanada to'qroq kulrang */
        }
        body { background: var(--bg); color: #adbac7; font-family: 'Arial Black', sans-serif; margin: 0; padding-top: 150px; scroll-behavior: smooth; }

        .header { position: fixed; top: 0; width: 100%; background: rgba(22, 27, 34, 0.98); border-bottom: 2px solid var(--border); z-index: 1000; padding: 15px; box-sizing: border-box; }
        .stats-bar { display: flex; gap: 15px; margin-bottom: 15px; font-size: 16px; font-weight: bold; }
        .stat-item { padding: 8px 18px; border-radius: 10px; background: #000; border: 1px solid var(--border); }
        #sInp { width: 100%; padding: 18px; border-radius: 15px; border: 3px solid #444; background: #000; color: #fff; font-size: 24px; outline: none; box-sizing: border-box; }

        .row-section { margin-bottom: 60px; }
        .row-title { padding-left: 20px; font-weight: 900; color: var(--blue); margin-bottom: 30px; font-size: 38px; border-left: 14px solid var(--blue); }
        .racks-container { display: flex; gap: 30px; overflow-x: auto; padding: 0 20px 30px; }
        
        .rack { background: var(--card); border: 2px solid var(--border); border-radius: 15px; padding: 22px; min-width: 480px; }
        .rack-num { text-align: center; font-size: 34px; color: #fff; margin-bottom: 20px; border-bottom: 3px solid var(--border); padding-bottom: 12px; font-weight: 900; }
        
        .shelf-wrapper { display: flex; align-items: flex-start; gap: 15px; margin-bottom: 35px; }
        .floor-num { width: 45px; font-size: 30px; font-weight: 900; color: var(--blue); text-align: center; padding-top: 45px; opacity: 0.8; }

        .shelf { display: flex; gap: 14px; }
        
        .cell { width: 100px; display: flex; flex-direction: column; align-items: center; }
        .inventory-item { width: 100%; }

        .item-content {
            height: 140px; 
            border: 2px solid var(--border); 
            border-radius: 10px; 
            display: flex; 
            flex-direction: column;
            align-items: center; 
            justify-content: center; 
            background: #0d1117; 
            position: relative;
            transition: 0.2s;
        }

        /* TOVAR KODI - TO'Q KULRANG VA JUDA QALIN */
        .item-code { 
            font-size: 32px; 
            font-weight: 900; 
            color: var(--code-dark); 
            position: absolute; 
            top: 10px; 
            text-align: center; 
            width: 100%; 
            letter-spacing: -1px; /* Harflarni jipslashtirish */
        }
        
        .item-qty { font-size: 50px; font-weight: 900; margin-top: 45px; }
        
        .controls { display: none; width: 100%; height: 55px; margin-top: 10px; border-radius: 10px; overflow: hidden; }
        .inventory-item.active .controls { display: flex; }
        .controls button { flex: 1; border: 0; color: #fff; font-size: 36px; font-weight: bold; cursor: pointer; }
        .minus { background: var(--red); }
        .plus { background: var(--green); }

        /* QIDIRUVDA TOPILGANDA */
        .found-cell .item-content { 
            background: #ffffff !important; 
            border-color: #ffffff !important; 
            box-shadow: 0 0 50px #ffffff;
            transform: scale(1.08);
            z-index: 10;
        }
        .found-cell .item-code { color: #000 !important; font-weight: 900; }
        .found-cell .item-qty { color: #000 !important; }

        .qty-danger { color: var(--red); }
        .qty-warning { color: #e3b341; }
        .qty-ok { color: var(--green); }
        
        .btn-add { width: 100%; height: 140px; border: 2px dashed #333; border-radius: 10px; font-size: 55px; color: #333; display: flex; align-items: center; justify-content: center; cursor: pointer; }

        #modal { display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--card); padding:45px; border:4px solid var(--blue); border-radius:25px; z-index:2000; width: 90%; max-width: 450px; }
        #newCode { padding:20px; width:100%; background:#000; color:#fff; border:2px solid #444; margin-bottom:25px; border-radius:15px; font-size:28px; box-sizing:border-box; font-weight: bold; }
    </style>
</head>
<body>

    <div class="header">
        <div class="stats-bar">
            <div class="stat-item">📦 JAMI: ${rows.length}</div>
            <div class="stat-item" style="color:var(--red)">🚨 KRITIK: ${rows.filter(r => r.count < 5).length}</div>
        </div>
        <input type="text" id="sInp" placeholder="Tovar qidirish..." oninput="handleSearch()">
    </div>

    <div id="mainContent"> ${html} </div>

    <div id="modal">
        <h3 style="margin:0 0 25px 0; color:var(--blue); font-size: 30px;">Yangi tovar</h3>
        <input type="text" id="newCode" placeholder="Kod...">
        <button style="width:100%; padding:22px; background:var(--blue); color:#fff; border:0; border-radius:15px; font-weight:900; font-size:26px;" onclick="saveItem()">SAQLASH</button>
        <button onclick="closeModal()" style="width:100%; margin-top:20px; background:none; color:#8b949e; border:0; font-size:22px;">Bekor qilish</button>
    </div>

    <script>
        function handleSearch() {
            const val = document.getElementById('sInp').value.toUpperCase().trim();
            document.querySelectorAll('.cell').forEach(c => c.classList.remove('found-cell'));
            if (val.length < 2) return;
            const items = Array.from(document.querySelectorAll('.inventory-item'))
                               .filter(i => i.dataset.code.includes(val));
            if (items.length > 0) {
                items.forEach(i => i.closest('.cell').classList.add('found-cell'));
                items[0].closest('.cell').scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        }

        async function updateStock(id, delta, e) {
            e.stopPropagation();
            const response = await fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, delta}) });
            if(response.ok) {
                const qtySpan = document.getElementById('qty_val_' + id);
                if (!qtySpan) return;
                let newQty = parseInt(qtySpan.innerText) + delta;
                if (newQty <= 0) {
                    qtySpan.closest('.cell').innerHTML = '<div class="btn-add" onclick="openAddModal(this)">+</div>';
                } else {
                    qtySpan.innerText = newQty;
                    qtySpan.className = 'item-qty ' + (newQty < 5 ? 'qty-danger' : newQty < 10 ? 'qty-warning' : 'qty-ok');
                }
            }
        }

        function toggleActive(el) {
            const wasActive = el.classList.contains('active');
            document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active'));
            if (!wasActive) el.classList.add('active');
        }

        let activeCoords = null;
        function openAddModal(el) {
            activeCoords = JSON.parse(el.closest('.cell').dataset.coords);
            document.getElementById('modal').style.display = 'block';
            setTimeout(() => document.getElementById('newCode').focus(), 100);
        }
        function closeModal() { document.getElementById('modal').style.display = 'none'; }
        async function saveItem() {
            const code = document.getElementById('newCode').value.toUpperCase();
            if(!code) return;
            const res = await fetch('/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code, coords: activeCoords}) });
            if(res.ok) window.location.reload();
        }
    </script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

app.post('/update', async (req,res) => {
    const {id, delta} = req.body;
    const [rows] = await pool.execute("SELECT count FROM main_items WHERE id=?", [id]);
    if(!rows.length) return res.json({ok: false});
    const newQty = rows[0].count + delta;
    if(newQty <= 0) await pool.execute("DELETE FROM main_items WHERE id=?", [id]);
    else await pool.execute("UPDATE main_items SET count=? WHERE id=?", [newQty, id]);
    res.json({ok: true});
});

app.post('/add', async (req,res) => {
    const {code, coords} = req.body;
    await pool.execute("INSERT INTO main_items (code, row_char, row_num, col_num, row_num_in_st, count) VALUES (?,?,?,?,?,1)",
        [code, coords.q, coords.s, coords.e, coords.u]);
    res.json({ok: true});
});

app.listen(3000, '0.0.0.0');

