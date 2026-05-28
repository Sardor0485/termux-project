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
    const pulse = itm.count < 5 ? 'pulse-red' : '';
    return `
        <div class="inventory-item ${pulse}" data-code="${itm.code}" id="item_${itm.id}" onclick="toggleActive(this)">
            <div class="item-code">${itm.code}</div>
            <div class="item-qty qty-${status}">${itm.count}</div>
            <div class="controls">
                <button onclick="updateStock(${itm.id},-1,event)">−</button>
                <button onclick="updateStock(${itm.id},1,event)">+</button>
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
                html += `<div class="rack"><div class="rack-num">${q}${st} Stellaj</div>`;
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
        :root { --bg: #0b0e14; --card: #151921; --border: #2d333b; --accent: #58a6ff; --lemon: #ccff00; --red: #ff4444; }
        body { background: var(--bg); color: #adbac7; font-family: 'Segoe UI', Roboto, sans-serif; margin: 0; padding-top: 130px; }

        /* GLASS HEADER */
        .header { position: fixed; top: 0; width: 100%; background: rgba(21, 25, 33, 0.85); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); z-index: 1000; padding: 15px; box-sizing: border-box; }
        .stats-bar { display: flex; gap: 15px; margin-bottom: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .stat-item { padding: 4px 10px; border-radius: 20px; background: rgba(255,255,255,0.05); }
        .stat-critical { color: var(--red); border: 1px solid var(--red); }

        .search-wrapper { position: relative; }
        #sInp { width: 100%; padding: 12px 15px; border-radius: 12px; border: 1px solid var(--border); background: #000; color: #fff; outline: none; transition: 0.3s; }
        #sInp:focus { border-color: var(--lemon); box-shadow: 0 0 15px rgba(204, 255, 0, 0.2); }
        
        #resPanel { display: none; background: #1c2128; border: 1px solid var(--lemon); margin-top: 10px; border-radius: 12px; padding: 5px; max-height: 250px; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .res-item { display: flex; justify-content: space-between; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; border-radius: 8px; }
        .res-item:hover { background: rgba(204, 255, 0, 0.1); }
        .res-loc { font-weight: bold; color: var(--lemon); }

        /* GRID STYLING */
        .row-section { margin-bottom: 30px; }
        .row-title { padding-left: 20px; font-weight: 900; color: #fff; margin-bottom: 15px; font-size: 18px; }
        .racks-container { display: flex; gap: 15px; overflow-x: auto; padding: 0 20px 20px; scrollbar-width: none; }
        .rack { background: var(--card); border: 1px solid var(--border); border-radius: 15px; padding: 10px; min-width: 250px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
        .rack-num { text-align: center; font-size: 12px; color: #636e7b; margin-bottom: 10px; letter-spacing: 1px; }
        .shelf { display: flex; gap: 6px; margin-bottom: 6px; }
        .cell { width: 55px; height: 55px; border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; position: relative; transition: 0.3s; background: #0d1117; }
        
        /* LIMON SEARCH HIGHLIGHT */
        .found-cell { background: var(--lemon) !important; border-color: var(--lemon) !important; transform: scale(1.1); z-index: 10; box-shadow: 0 0 20px var(--lemon); }
        .found-cell .item-code, .found-cell .item-qty { color: #000 !important; }

        .inventory-item { width: 100%; height: 100%; text-align: center; cursor: pointer; }
        .item-code { font-size: 8px; position: absolute; top: 5px; width: 100%; color: #636e7b; font-weight: bold; }
        .item-qty { font-size: 22px; font-weight: 800; margin-top: 10px; }
        .qty-danger { color: var(--red); }
        .qty-warning { color: #ffab70; }
        .qty-ok { color: #3fb950; }

        /* PULSE ANIMATION */
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); } }
        .pulse-red { animation: pulse 2s infinite; border-radius: 8px; }

        .controls { display: none; position: absolute; bottom: 0; width: 100%; background: #000; border-radius: 0 0 8px 8px; overflow: hidden; }
        .inventory-item.active .controls { display: flex; }
        .controls button { flex: 1; border: 0; color: #fff; padding: 8px 0; font-weight: bold; cursor: pointer; }
        .controls button:first-child { background: var(--red); }
        .controls button:last-child { background: #3fb950; }
        
        .btn-add { font-size: 24px; color: #2d333b; cursor: pointer; }
        #modal { display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--card); padding:25px; border:1px solid var(--border); border-radius:20px; z-index:2000; width: 85%; max-width: 350px; box-shadow: 0 20px 50px #000; }
    </style>
</head>
<body>

    <div class="header">
        <div class="stats-bar">
            <div class="stat-item">📦 Jami: ${totalItems}</div>
            <div class="stat-item stat-critical">🚨 Kritik: ${criticalCount} ta</div>
        </div>
        <div class="search-wrapper">
            <input type="text" id="sInp" placeholder="🔍 Kodni qidiring..." oninput="handleSearch()">
        </div>
        <div id="resPanel"></div>
    </div>

    <div id="mainContent"> ${html} </div>

    <div id="modal">
        <h3 style="margin-top:0; color:var(--lemon)">Yangi Tovar</h3>
        <input type="text" id="newCode" placeholder="Kod kiriting..." style="padding:15px; width:100%; background:#000; color:#fff; border:1px solid var(--border); margin-bottom:15px; border-radius:10px; box-sizing:border-box;">
        <button onclick="saveItem()" style="width:100%; padding:15px; background:var(--lemon); color:#000; border:0; border-radius:10px; font-weight:900; cursor:pointer;">SAQLASH</button>
        <button onclick="closeModal()" style="width:100%; margin-top:10px; background:none; color:#636e7b; border:0; cursor:pointer;">Bekor qilish</button>
    </div>

    <script>
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
                    const loc = \`\${coords.q}\${coords.s}-\${coords.e}\${coords.u}\`;
                    return \`<div class="res-item" onclick="goTo('\${i.parentElement.id}')">
                                <span><b>\${i.dataset.code}</b> (\${i.querySelector('.item-qty').innerText} ta)</span>
                                <span class="res-loc">\${loc}</span>
                            </div>\`;
                }).join('');
            } else {
                panel.style.display = 'none';
            }
        }

        function goTo(id) {
            const el = document.getElementById(id);
            el.classList.add('found-cell');
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            document.getElementById('resPanel').style.display = 'none';
            
            // 3 soniyadan keyin limon rangni yo'qotish (ixtiyoriy)
            setTimeout(() => { 
                // el.classList.remove('found-cell'); 
            }, 3000);
        }

        async function updateStock(id, delta, e) {
            e.stopPropagation();
            await fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, delta}) });
            window.location.reload();
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
            await fetch('/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code, coords: activeCoords}) });
            window.location.reload();
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

// [API kodlari avvalgidek qoladi]
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

