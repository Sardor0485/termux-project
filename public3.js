const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

const pool = mysql.createPool({
    host: '127.0.0.1', user: 'root', password: '', database: 'ambar', enableKeepAlive: true
});

app.use(express.json());

// Katak ichini render qilish
function renderCell(itm) {
    if (!itm) return `<div class="btn-add" onclick="openAddModal(this)">+</div>`;
    const status = itm.count < 5 ? 'danger' : itm.count < 10 ? 'warning' : 'ok';
    return `
        <div class="inventory-item" data-code="${itm.code}" id="item_${itm.id}" onclick="toggleActive(this)">
            <div class="item-code">${itm.code}</div>
            <div class="item-qty qty-${status}" id="qty_val_${itm.id}">${itm.count}</div>
            <div class="controls">
                <button class="minus" onclick="updateStock(${itm.id},-1,event)">−</button>
                <button class="plus" onclick="updateStock(${itm.id},1,event)">+</button>
            </div>
        </div>`;
}

app.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM main_items");
        const totalItems = rows.length;
        const criticalCount = rows.filter(r => r.count < 5).length;

        let html = "";
        ['C','D','E'].forEach(q => {
            html += `<div class="row-section"><div class="row-title">QATOR ${q}</div><div class="racks-container">`;
            [1,2,3,4].forEach(st => {
                html += `<div class="rack"><div class="rack-num">${st}-STELLAJ</div>`;
                [3,2,1,0].forEach(et => {
                    html += `<div class="shelf">`;
                    for(let us=1; us<=4; us++){
                        const item = rows.find(r => r.row_char==q && r.row_num==st && r.col_num==et && r.row_num_in_st==us);
                        const cid = `cell_${q}_${st}_${et}_${us}`;
                        html += `<div class="cell" id="${cid}" data-coords='{"q":"${q}","s":${st},"e":${et},"u":${us}}'>${renderCell(item)}</div>`;
                    }
                    html += `</div>`;
                });
                html += `</div>`;
            });
            html += `</div></div>`;
        });

        res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        :root { --bg: #0b0e14; --card: #161b22; --border: #30363d; --red: #ff4444; --green: #3fb950; }
        body { background: var(--bg); color: #adbac7; font-family: sans-serif; margin: 0; padding-top: 140px; scroll-behavior: smooth; }

        .header { position: fixed; top: 0; width: 100%; background: #161b22; border-bottom: 2px solid var(--border); z-index: 1000; padding: 12px; box-sizing: border-box; }
        .stats-bar { display: flex; gap: 10px; margin-bottom: 10px; font-size: 13px; font-weight: bold; }
        .stat-item { padding: 4px 10px; border-radius: 6px; background: #000; border: 1px solid var(--border); }

        #sInp { width: 100%; padding: 14px; border-radius: 10px; border: 1px solid #444; background: #000; color: #fff; font-size: 18px; outline: none; }
        
        #resPanel { display: none; background: #1c2128; border: 1px solid #58a6ff; margin-top: 5px; border-radius: 10px; max-height: 250px; overflow-y: auto; box-shadow: 0 10px 30px #000; }
        .res-item { padding: 15px; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; flex-direction: column; gap: 5px; }
        .res-item b { font-size: 20px; color: #fff; }
        .res-loc-info { font-size: 16px; color: #58a6ff; font-weight: bold; }

        .row-section { margin-bottom: 30px; }
        .row-title { padding-left: 15px; font-weight: 900; color: #58a6ff; margin-bottom: 15px; font-size: 24px; border-left: 6px solid #58a6ff; }
        .racks-container { display: flex; gap: 15px; overflow-x: auto; padding: 0 15px 15px; }
        .rack { background: var(--card); border: 1px solid var(--border); border-radius: 15px; padding: 12px; min-width: 260px; }
        .rack-num { text-align: center; font-size: 26px; color: #fff; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 5px; font-weight: 800; }
        
        .shelf { display: flex; gap: 6px; margin-bottom: 6px; }
        .cell { width: 62px; height: 80px; border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; position: relative; background: #0d1117; overflow: hidden; }
        
        .found-cell { background: #ccc !important; border-color: #fff !important; transform: scale(1.05); z-index: 50; box-shadow: 0 0 15px #fff; }
        .found-cell .item-code, .found-cell .item-qty { color: #000 !important; font-weight: 900 !important; }

        .inventory-item { width: 100%; height: 100%; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; }
        .item-code { font-size: 9px; font-weight: bold; color: #8b949e; position: absolute; top: 3px; width: 100%; text-align: center; }
        .item-qty { font-size: 28px; font-weight: 900; margin-top: 15px; transition: 0.2s; }
        
        .qty-danger { color: var(--red); }
        .qty-warning { color: #e3b341; }
        .qty-ok { color: var(--green); }

        .controls { display: none; position: absolute; bottom: 0; width: 100%; height: 30px; }
        .inventory-item.active .controls { display: flex; }
        .controls button { flex: 1; border: 0; color: #fff; font-size: 20px; font-weight: bold; cursor: pointer; }
        .minus { background: var(--red); }
        .plus { background: var(--green); border-left: 1px solid rgba(0,0,0,0.2); }
        
        .btn-add { font-size: 24px; color: #30363d; cursor: pointer; }
        #modal { display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--card); padding:25px; border:2px solid #444; border-radius:15px; z-index:2000; width: 85%; max-width: 350px; }
    </style>
</head>
<body>

    <div class="header">
        <div class="stats-bar">
            <div class="stat-item">📦 JAMI: ${totalItems}</div>
            <div class="stat-item" style="color:var(--red)">🚨 KRITIK: ${criticalCount}</div>
        </div>
        <input type="text" id="sInp" placeholder="Tovar qidirish..." oninput="handleSearch()">
        <div id="resPanel"></div>
    </div>

    <div id="mainContent"> ${html} </div>

    <div id="modal">
        <h3 style="margin:0 0 15px 0; color:#58a6ff">Yangi tovar</h3>
        <input type="text" id="newCode" placeholder="Kod..." style="padding:12px; width:100%; background:#000; color:#fff; border:1px solid #444; margin-bottom:15px; border-radius:8px; font-size:18px; box-sizing:border-box;">
        <button onclick="saveItem()" style="width:100%; padding:14px; background:#58a6ff; color:#fff; border:0; border-radius:8px; font-weight:bold; font-size:18px;">SAQLASH</button>
        <button onclick="closeModal()" style="width:100%; margin-top:10px; background:none; color:#8b949e; border:0;">Yopish</button>
    </div>

    <script>
        // REFRESHSIZ YANGILASH (AJAX)
        async function updateStock(id, delta, e) {
            e.stopPropagation();
            try {
                const response = await fetch('/update', { 
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify({id, delta}) 
                });
                
                if(response.ok) {
                    const qtySpan = document.getElementById('qty_val_' + id);
                    if (!qtySpan) return;

                    let currentQty = parseInt(qtySpan.innerText);
                    let newQty = currentQty + delta;
                    
                    if (newQty <= 0) {
                        qtySpan.closest('.cell').innerHTML = '<div class="btn-add" onclick="openAddModal(this)">+</div>';
                    } else {
                        qtySpan.innerText = newQty;
                        // Status rangini yangilash
                        qtySpan.className = 'item-qty ' + (newQty < 5 ? 'qty-danger' : newQty < 10 ? 'qty-warning' : 'qty-ok');
                    }
                }
            } catch (err) { console.error(err); }
        }

        function handleSearch() {
            const val = document.getElementById('sInp').value.toUpperCase().trim();
            const panel = document.getElementById('resPanel');
            document.querySelectorAll('.cell').forEach(c => c.classList.remove('found-cell'));
            
            if (val.length < 2) { panel.style.display = 'none'; return; }

            const items = Array.from(document.querySelectorAll('.inventory-item'))
                               .filter(i => i.dataset.code.includes(val));

            if (items.length > 0) {
                panel.style.display = 'block';
                panel.innerHTML = items.map(i => {
                    const coords = JSON.parse(i.parentElement.dataset.coords);
                    return \`<div class="res-item" onclick="goTo('\${i.parentElement.id}')">
                                <b>\${i.dataset.code}</b>
                                <span class="res-loc-info">ST.\${coords.s} | ET.\${coords.e} (Qator \${coords.q})</span>
                            </div>\`;
                }).join('');
            } else { panel.style.display = 'none'; }
        }

        function goTo(id) {
            const el = document.getElementById(id);
            document.getElementById('resPanel').style.display = 'none';
            document.getElementById('sInp').value = '';
            el.classList.add('found-cell');
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }

        let activeCoords = null;
        function openAddModal(el) {
            activeCoords = JSON.parse(el.closest('.cell').dataset.coords);
            document.getElementById('modal').style.display = 'block';
            document.getElementById('newCode').focus();
        }
        function closeModal() { document.getElementById('modal').style.display = 'none'; }

        async function saveItem() {
            const code = document.getElementById('newCode').value.toUpperCase();
            if(!code) return;
            const res = await fetch('/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code, coords: activeCoords}) });
            if(res.ok) window.location.reload(); // Yangi tovar qo'shilganda reload normal
        }

        function toggleActive(el) {
            document.querySelectorAll('.inventory-item').forEach(i => i !== el && i.classList.remove('active'));
            el.classList.toggle('active');
        }
    </script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

// BACKEND API
app.post('/update', async (req,res) => {
    const {id, delta} = req.body;
    const [rows] = await pool.execute("SELECT * FROM main_items WHERE id=?", [id]);
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

