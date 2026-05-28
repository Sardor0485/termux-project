const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

const pool = mysql.createPool({
    host: '127.0.0.1', user: 'root', password: '', database: 'ambar', enableKeepAlive: true
});

app.use(express.json());

function renderCell(itm) {
    if (!itm) {
        return `
            <div class="inventory-item empty-cell" onclick="openAddModal(this)">
                <div class="item-content">
                    <div class="shooting-star"></div>
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
        
        /* PERSPEKTIVA VA RACK (Oldingi dizayn) */
        .fixed-cell { perspective: 1000px; display: table-cell; width: 25%; vertical-align: top; }
        .rack { background: var(--card); border-radius: 16px; padding: 15px; min-width: 310px; border: 1px solid var(--border); transition: border-color 0.3s; }
        .rack-num { color: #768390; text-align: center; margin-bottom: 15px; font-weight: bold; font-size: 16px; transition: color 0.3s; }
        .rack:hover .rack-num { color: var(--blue); }

        .item-content {
            height: 85px; border: 1px solid var(--border); border-radius: 12px; 
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            background: #0d1117; position: relative; overflow: hidden;
            /* 3D tilt effekti saqlangan */
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.3s;
        }

        /* 1. HOVERDA RAMKA O'ZGARMAYDI (Minimalist) */
        .inventory-item:hover .item-content {
            transform: translateY(-5px) rotateX(8deg); /* 3D tilt */
            background: #1c2128;
            /* Border-color o'zgarishi olib tashlandi */
        }

        /* 2. BLICK EFFEKTI (Pastki chapdan yuqori o'ngga) */
        .blick-effect {
            position: absolute;
            top: 100%; left: -100%;
            width: 200%; height: 200%;
            background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
            transform: rotate(-15deg);
            pointer-events: none;
            z-index: 4;
        }
        .inventory-item:hover .blick-effect {
            top: -100%; left: 100%;
            transition: all 0.7s ease-in-out;
        }

        /* 3. UCHAR YULDUZ (Pastki chapdan yuqori o'ngga) */
        .shooting-star {
            position: absolute;
            bottom: -10px; left: -10px;
            width: 3px; height: 3px;
            background: #fff; border-radius: 50%;
            box-shadow: 0 0 10px 2px #fff;
            opacity: 0; z-index: 5;
        }
        .shooting-star::after {
            content: ""; position: absolute; 
            top: 50%; right: 50%;
            width: 45px; height: 1.5px;
            background: linear-gradient(-90deg, #fff, transparent);
            transform: translateY(-50%) rotate(-45deg);
            transform-origin: right;
        }
        @keyframes diagonalShoot {
            0% { transform: translate(0, 0); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translate(130px, -130px); opacity: 0; }
        }
        .inventory-item:hover .shooting-star {
            animation: diagonalShoot 0.5s ease-out 0.1s forwards;
        }

        /* QIZIL PULSATSYA (Oldingi dizayn) */
        @keyframes pulse-red {
            0% { border-color: var(--red); box-shadow: 0 0 5px rgba(255,68,68,0.2); }
            50% { border-color: #ff0000; box-shadow: 0 0 15px rgba(255,0,0,0.4); }
            100% { border-color: var(--red); box-shadow: 0 0 5px rgba(255,68,68,0.2); }
        }
        .pulse-red-border .item-content { animation: pulse-red 1.5s infinite ease-in-out; border-width: 1.5px; }

        .item-code { font-size: 10px; font-weight: 700; color: #768390; position: absolute; top: 8px; z-index: 6; }
        .item-qty { font-size: 24px; font-weight: 900; margin-top: 10px; z-index: 6; }
        .qty-danger { color: var(--red); }
        .qty-ok { color: var(--green); }

        /* CONTROLS VA BOSHQA STILLAR */
        .controls { display: none; margin-top: 8px; gap: 4px; }
        .inventory-item.active .controls { display: flex; animation: slideIn 0.2s; }
        @keyframes slideIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .controls button { flex: 1; height: 35px; border: 0; color: #fff; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .minus { background: #30363d; border: 1px solid var(--red); color: var(--red); }
        .plus { background: #30363d; border: 1px solid var(--green); color: var(--green); }
        .header { position: fixed; top: 0; width: 100%; background: #161b22; border-bottom: 1px solid var(--border); z-index: 1000; padding: 12px; }
        #sInp { width: 95%; padding: 12px; border-radius: 10px; background: #000; color: #fff; border: 1px solid #444; outline: none; }
        .racks-container { display: flex; gap: 20px; padding: 20px; overflow-x: auto; }
        .shelf-wrapper { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .floor-num { color: var(--blue); font-weight: bold; width: 15px; font-size: 12px; }
        .shelf-grid { display: table; width: 100%; border-spacing: 6px; }
        .row-title { font-size: 22px; font-weight: 800; margin: 25px 20px 10px; color: #fff; border-left: 5px solid var(--blue); padding-left: 15px; }
        .empty-cell .item-content { border: 1px dashed #333; background: transparent; }
        .add-icon { color: #333; font-size: 24px; }
    </style>
</head>
<body onclick="closeAllActive(event)">
    <div class="header"><input type="text" id="sInp" placeholder="Qidiruv..." oninput="handleSearch()"></div>
    <div id="mainContent">${html}</div>

    <script>
        function closeAllActive(e) {
            if (!e.target.closest('.inventory-item')) {
                document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active'));
            }
        }
        function toggleActive(el, e) {
            e.stopPropagation();
            const was = el.classList.contains('active');
            document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active'));
            if (!was) el.classList.add('active');
        }
        async function updateStock(id, delta, e) {
            e.stopPropagation();
            const res = await fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, delta}) });
            if(res.ok) {
                const span = document.getElementById('qty_val_' + id);
                let n = parseInt(span.innerText) + delta;
                if(n <= 0) window.location.reload();
                span.innerText = n;
                const parent = span.closest('.inventory-item');
                if (n < 5) parent.classList.add('pulse-red-border');
                else parent.classList.remove('pulse-red-border');
            }
        }
        function handleSearch() {
            const val = document.getElementById('sInp').value.toUpperCase();
            if(!val) return;
            const item = Array.from(document.querySelectorAll('.inventory-item')).find(i => i.dataset.code && i.dataset.code.includes(val));
            if(item) item.scrollIntoView({behavior:'smooth', block:'center'});
        }
        function openAddModal(el) { alert("Yangi tovar!"); }
    </script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

app.listen(3000);

