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
    const pulseClass = itm.count < 5 ? 'pulse-red' : '';
    
    return `
        <div class="inventory-item ${pulseClass}" data-code="${itm.code}" id="item_${itm.id}" onclick="toggleActive(this)">
            <div class="item-content">
                <div class="blick"></div> <div class="item-code">${itm.code}</div>
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
                    html += `<div class="shelf-wrapper">
                                <div class="floor-num">${et}</div>
                                <div class="shelf-grid">`;
                    for(let us=1; us<=4; us++){
                        const item = rows.find(r => r.row_char==q && r.row_num==st && r.col_num==et && r.row_num_in_st==us);
                        html += `<div class="fixed-cell">${renderCell(item)}</div>`;
                    }
                    html += `</div></div>`;
                });
                html += `</div>`;
            });
            html += `</div></div>`;
        });

        res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        :root { 
            --bg: #0b0e14; --card: #161b22; --border: #30363d; 
            --red: #ff4444; --green: #3fb950; --blue: #58a6ff; 
        }
        body { background: var(--bg); color: #adbac7; font-family: sans-serif; margin: 0; padding-top: 80px; }

        .header { position: fixed; top: 0; width: 100%; background: #161b22; border-bottom: 1px solid var(--border); z-index: 1000; padding: 10px; box-sizing: border-box; }
        #sInp { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #000; color: #fff; font-size: 16px; outline: none; }

        .racks-container { display: flex; gap: 20px; overflow-x: auto; padding: 0 15px 30px; }
        .rack { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px; min-width: 300px; max-width: 300px; flex-shrink: 0; }
        .rack-num { text-align: center; font-size: 18px; color: #fff; margin-bottom: 15px; font-weight: bold; border-bottom: 1px solid var(--border); padding-bottom: 8px; }

        .shelf-wrapper { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .floor-num { width: 15px; font-size: 12px; font-weight: 900; color: var(--blue); opacity: 0.7; }

        /* TABLITSA TARTIBI - QIYSHAYISHNI OLDINI OLADI */
        .shelf-grid { display: table; table-layout: fixed; width: 100%; border-spacing: 6px; }
        .fixed-cell { display: table-cell; width: 25%; vertical-align: top; }

        .item-content {
            height: 80px; border: 1px solid var(--border); border-radius: 6px; 
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            background: #0d1117; position: relative; overflow: hidden;
            transition: transform 0.2s, border-color 0.2s, background 0.2s;
            cursor: pointer;
        }

        /* HOVER EFFEKTLARI */
        .item-content:hover {
            border-color: var(--blue);
            transform: translateY(-3px);
            background: #1c2128;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }

        /* BLICK (NUR) EFFEKTI */
        .blick {
            position: absolute;
            top: 0; left: -150%; width: 60%; height: 100%;
            background: linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent);
            transform: skewX(-25deg);
            transition: 0s;
        }
        .item-content:hover .blick {
            left: 150%;
            transition: 0.7s;
        }

        .item-code { font-size: 11px; font-weight: 800; color: #888; position: absolute; top: 4px; width: 100%; text-align: center; white-space: nowrap; overflow: hidden; }
        .item-qty { font-size: 22px; font-weight: 900; margin-top: 12px; }

        /* QIDIRUV VA PULSATSIYA */
        @keyframes glow { 0% { box-shadow: 0 0 5px #fff; } 50% { box-shadow: 0 0 20px #fff; } 100% { box-shadow: 0 0 5px #fff; } }
        .found-cell .item-content { background: #fff !important; animation: glow 1s infinite; border-color: #fff !important; }
        .found-cell .item-code, .found-cell .item-qty { color: #000 !important; }

        @keyframes pulse-red { 0% { border-color: var(--border); } 50% { border-color: var(--red); } 100% { border-color: var(--border); } }
        .pulse-red .item-content { animation: pulse-red 2s infinite; }

        /* BOSHQARUV */
        .controls { display: none; width: 100%; height: 30px; margin-top: 4px; }
        .inventory-item.active .controls { display: flex; }
        .controls button { flex: 1; border: 0; color: #fff; font-size: 18px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .controls button:hover { filter: brightness(1.2); }
        
        .minus { background: var(--red); border-radius: 4px 0 0 4px; }
        .plus { background: var(--green); border-radius: 0 4px 4px 0; }

        .qty-danger { color: var(--red); }
        .qty-warning { color: #e3b341; }
        .qty-ok { color: var(--green); }
        
        .btn-add { width: 100%; height: 80px; border: 1px dashed #333; border-radius: 6px; font-size: 24px; color: #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .btn-add:hover { border-color: var(--blue); color: var(--blue); background: rgba(88,166,255,0.05); }

        .row-title { border-left: 5px solid var(--blue); padding-left: 10px; margin: 20px; font-size: 20px; font-weight: 800; }
        
        #modal { display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--card); padding:20px; border:2px solid var(--blue); border-radius:15px; z-index:2000; width: 85%; max-width: 300px; box-shadow: 0 0 30px rgba(0,0,0,0.5); }
    </style>
</head>
<body>
    <div class="header"><input type="text" id="sInp" placeholder="Tovar qidirish..." oninput="handleSearch()"></div>
    <div id="mainContent">${html}</div>

    <div id="modal">
        <h3 style="color:var(--blue); margin-top:0;">Yangi tovar</h3>
        <input type="text" id="newCode" placeholder="Kod..." style="width:100%; padding:10px; background:#000; color:#fff; border:1px solid #444; border-radius:8px; margin-bottom:15px; box-sizing:border-box;">
        <button style="width:100%; padding:10px; background:var(--blue); color:#fff; border:0; border-radius:8px; font-weight:bold;" onclick="saveItem()">SAQLASH</button>
        <button onclick="closeModal()" style="width:100%; margin-top:10px; background:none; color:#8b949e; border:0;">Bekor qilish</button>
    </div>

    <script>
        function handleSearch() {
            const val = document.getElementById('sInp').value.toUpperCase().trim();
            document.querySelectorAll('.fixed-cell').forEach(c => c.classList.remove('found-cell'));
            if (!val) return;
            const items = Array.from(document.querySelectorAll('.inventory-item')).filter(i => i.dataset.code.includes(val));
            if (items.length > 0) {
                items.forEach(i => i.closest('.fixed-cell').classList.add('found-cell'));
                items[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        async function updateStock(id, delta, e) {
            e.stopPropagation();
            const res = await fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, delta}) });
            if(res.ok) {
                const qtySpan = document.getElementById('qty_val_' + id);
                let n = parseInt(qtySpan.innerText) + delta;
                if (n <= 0) window.location.reload();
                qtySpan.innerText = n;
                qtySpan.className = 'item-qty ' + (n < 5 ? 'qty-danger' : n < 10 ? 'qty-warning' : 'qty-ok');
            }
        }

        function toggleActive(el) {
            const was = el.classList.contains('active');
            document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active'));
            if (!was) el.classList.add('active');
        }

        let activeCoords = null;
        function openAddModal(el) {
            const cell = el.closest('.fixed-cell');
            // Koordinatalarni aniqlash logikasi (masalan, data-coords dan)
            document.getElementById('modal').style.display = 'block';
        }

        function closeModal() { document.getElementById('modal').style.display = 'none'; }
        function saveItem() { window.location.reload(); }
    </script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

// Post marshrutlari (update, add) o'sha-o'sha qoladi...
app.post('/update', async (req,res) => {
    const {id, delta} = req.body;
    const [rows] = await pool.execute("SELECT count FROM main_items WHERE id=?", [id]);
    const n = rows[0].count + delta;
    if(n <= 0) await pool.execute("DELETE FROM main_items WHERE id=?", [id]);
    else await pool.execute("UPDATE main_items SET count=? WHERE id=?", [n, id]);
    res.json({ok: true});
});

app.listen(3000, '0.0.0.0');

