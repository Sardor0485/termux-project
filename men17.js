const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'ambar',
    enableKeepAlive: true
});

app.use(express.json());

app.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM main_items ORDER BY code");

        const totalItems = rows.length;
        const lowStock = rows.filter(r => r.count <= 3).length;
        const totalQty = rows.reduce((a, b) => a + parseInt(b.count || 0), 0);

        let sectionsHTML = "";

        ['C','D','E'].forEach(q => {
            sectionsHTML += `
            <div class="line-wrapper">
                <div class="line-header">
                    <div class="line-badge">🏭 ${q} — Qator</div>
                </div>
                <div class="racks-row">`;

            [1,2,3,4].forEach(st => {
                sectionsHTML += `
                <div class="card rack-card shadow-sm">
                    <div class="card-header-custom">
                        <span class="rack-label">${q}${st}</span>
                        <span class="rack-sub">Stellaj</span>
                    </div>
                    <div class="card-body-custom">
                        <div class="shelf-labels-row">
                            <div class="sl-empty"></div>
                            <div class="sl-item">1</div><div class="sl-item">2</div><div class="sl-item">3</div><div class="sl-item">4</div>
                        </div>`;

                [3,2,1,0].forEach(et => {
                    sectionsHTML += `
                        <div class="shelf-row">
                            <div class="shelf-num">${et}</div>`;

                    for(let us=1; us<=4; us++){
                        const items = rows.filter(r => r.row_char==q && r.row_num==st && r.col_num==et && r.row_num_in_st==us);
                        let cellContent = items.map(itm => {
                            let c = itm.count;
                            let status = c <= 3 ? 'danger' : c < 10 ? 'warning' : 'ok';
                            return `
                            <div class="inventory-item qty-${status}" data-id="${itm.id}" data-code="${itm.code}" onclick="toggleActive(this)">
                                <span class="item-code">${itm.code}</span>
                                <span class="item-qty">${c}</span>
                                <div class="action-popover">
                                    <button class="btn-ctrl btn-m" onclick="updateStock(${itm.id},-1,event)">−</button>
                                    <button class="btn-ctrl btn-p" onclick="updateStock(${itm.id},1,event)">+</button>
                                </div>
                            </div>`;
                        }).join('');

                        sectionsHTML += `
                            <div class="grid-cell" data-coords='{"q":"${q}","s":${st},"e":${et},"u":${us}}' ondragover="allowDrop(event)" ondrop="handleDrop(event)">
                                ${cellContent || `<div class="btn-add" onclick="openAddModal(this)">+</div>`}
                            </div>`;
                    }
                    sectionsHTML += `</div>`;
                });
                sectionsHTML += `</div></div>`;
            });
            sectionsHTML += `</div></div>`;
        });

        res.send(`<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Ambar Pro v3.0</title>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700;800&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0d1117; --surface: #161b22; --border: #30363d; --text: #e6edf3;
            --muted: #8b949e; --accent: #58a6ff; --green: #3fb950; --yellow: #d29922; --red: #f85149;
            --font-mono: 'JetBrains Mono', monospace;
        }
        body.light {
            --bg: #f6f8fa; --surface: #ffffff; --border: #d0d7de; --text: #24292f;
            --muted: #57606a; --accent: #0969da;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

        /* NAVBAR */
        .navbar { background: var(--surface); border-bottom: 1px solid var(--border); height: 60px; display: flex; align-items: center; padding: 0 1.5rem; justify-content: space-between; z-index: 500; }
        .brand { font-family: var(--font-mono); font-weight: 800; color: var(--accent); font-size: 1.1rem; letter-spacing: 1px; }
        .stats { display: flex; gap: 10px; }
        .stat-card { background: var(--bg); border: 1px solid var(--border); padding: 4px 12px; border-radius: 6px; font-size: 0.75rem; font-family: var(--font-mono); }

        /* VIEWPORT */
        .main-content { flex: 1; overflow-y: auto; padding: 1.5rem 1.5rem 80px 1.5rem; display: flex; flex-direction: column; gap: 2rem; }

        .line-wrapper { display: flex; flex-direction: column; gap: 12px; }
        .line-badge { background: var(--surface); border: 1px solid var(--border); padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; color: var(--muted); width: fit-content; }
        .racks-row { display: flex; gap: 1.5rem; overflow-x: auto; padding-bottom: 10px; }

        /* RACK CARD */
        .rack-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; min-width: 350px; flex-shrink: 0; }
        .card-header-custom { padding: 10px 15px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
        .rack-label { color: var(--accent); font-family: var(--font-mono); font-weight: 800; }
        .rack-sub { font-size: 10px; color: var(--muted); text-transform: uppercase; }

        /* GRID */
        .card-body-custom { padding: 12px; }
        .shelf-labels-row, .shelf-row { display: grid; grid-template-columns: 25px repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
        .sl-item, .shelf-num { font-size: 10px; color: var(--muted); font-family: var(--font-mono); text-align: center; align-self: center; }

        .grid-cell { 
            background: var(--bg); border: 1px solid var(--border); border-radius: 8px; height: 80px; 
            display: flex; align-items: center; justify-content: center; position: relative; transition: 0.2s;
        }
        .grid-cell:hover { border-color: var(--accent); }

        /* ITEM BOX - KODLAR KATTALASHTIRILDI */
        .inventory-item { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; border-radius: 8px; }
        .item-code { font-family: var(--font-mono); font-size: 15px; font-weight: 800; color: var(--text); }
        .item-qty { font-family: var(--font-mono); font-size: 26px; font-weight: 800; line-height: 1; }
        
        .qty-ok .item-qty { color: var(--green); }
        .qty-warning .item-qty { color: var(--yellow); }
        .qty-danger .item-qty { color: var(--red); }

        .action-popover { display: none; gap: 6px; position: absolute; bottom: 5px; z-index: 10; }
        .inventory-item.active .action-popover { display: flex; }
        .btn-ctrl { border: none; border-radius: 5px; width: 26px; height: 26px; font-weight: 800; cursor: pointer; transition: 0.1s; }
        .btn-m { background: rgba(248,81,73,0.2); color: var(--red); }
        .btn-p { background: rgba(63,185,80,0.2); color: var(--green); }
        .btn-ctrl:hover { transform: scale(1.1); }

        /* FLOATING SEARCH LUPA */
        .search-floating { position: fixed; bottom: 25px; right: 25px; z-index: 1000; display: flex; align-items: center; justify-content: flex-end; }
        .search-inner { 
            display: flex; align-items: center; background: var(--surface); border: 1px solid var(--border); 
            border-radius: 50px; padding: 5px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
            transition: width 0.3s; width: 52px; height: 52px; overflow: hidden;
        }
        .search-inner:focus-within { width: 300px; border-color: var(--accent); }
        .search-inner input { 
            border: none; outline: none; background: transparent; color: var(--text); 
            padding: 0 15px; width: 0; transition: width 0.3s; font-size: 16px; font-family: var(--font-mono);
        }
        .search-inner:focus-within input { width: 230px; }
        .lupa-btn { 
            width: 42px; height: 42px; background: var(--accent); color: #000; 
            border-radius: 50%; display: flex; align-items: center; justify-content: center; 
            font-size: 20px; flex-shrink: 0; cursor: pointer;
        }

        /* HIGHLIGHT */
        .found-item { border: 2px solid var(--yellow) !important; background: rgba(210,153,34,0.15) !important; box-shadow: 0 0 15px rgba(210,153,34,0.3); }

        /* MODAL */
        .modal-wrap { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
        .modal-box { background: var(--surface); border: 1px solid var(--border); padding: 25px; border-radius: 16px; width: 320px; }
        .modal-box input { 
            width: 100%; padding: 12px; background: var(--bg); border: 1px solid var(--border); 
            border-radius: 8px; color: var(--text); font-family: var(--font-mono); margin-bottom: 15px; outline: none;
        }
        .btn-save { width: 100%; padding: 12px; background: var(--accent); color: #000; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; }

        .btn-add { color: var(--border); font-size: 24px; cursor: pointer; transition: 0.2s; }
        .btn-add:hover { color: var(--accent); transform: scale(1.2); }
    </style>
</head>
<body class="dark">

<div class="navbar">
    <div class="brand">AMBAR<span>PRO</span></div>
    <div class="stats">
        <div class="stat-card">Turlar: <b>${totalItems}</b></div>
        <div class="stat-card">Kam: <b style="color:var(--red)">${lowStock}</b></div>
        <div class="stat-card">Jami: <b>${totalQty}</b></div>
        <button onclick="document.body.classList.toggle('light')" style="background:none; border:none; cursor:pointer; font-size:16px;">🌓</button>
    </div>
</div>

<div class="main-content">${sectionsHTML}</div>

<div class="search-floating">
    <div class="search-inner">
        <input type="text" id="searchInput" placeholder="Kodni qidiring..." oninput="handleSearch()" autocomplete="off">
        <div class="lupa-btn" onclick="document.getElementById('searchInput').focus()">🔍</div>
    </div>
</div>

<div class="modal-wrap" id="addModal">
    <div class="modal-box">
        <h3 style="margin-bottom:15px; font-size:14px; text-transform:uppercase; letter-spacing:1px; color:var(--accent);">📦 Yangi Mahsulot</h3>
        <input type="text" id="newItemCode" placeholder="Masalan: ABC-123" autocomplete="off">
        <button class="btn-save" onclick="saveNewItem()">Saqlash</button>
        <button onclick="closeAddModal()" style="background:none; border:none; color:var(--muted); width:100%; margin-top:10px; cursor:pointer; font-size:12px;">Bekor qilish</button>
    </div>
</div>

<script>
    let activeCoords = null;

    function toggleActive(el) {
        document.querySelectorAll('.inventory-item').forEach(i => i !== el && i.classList.remove('active'));
        el.classList.toggle('active');
    }

    function handleSearch() {
        const val = document.getElementById("searchInput").value.trim().toUpperCase();
        document.querySelectorAll('.grid-cell').forEach(c => c.classList.remove('found-item'));
        if(!val) return;

        let found = null;
        document.querySelectorAll('.inventory-item').forEach(item => {
            if(item.dataset.code.includes(val)) {
                let cell = item.closest('.grid-cell');
                cell.classList.add('found-item');
                if(!found) found = cell;
            }
        });
        if(found) found.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }

    async function updateStock(id, delta, e) {
        e.stopPropagation();
        const res = await fetch('/api/update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id, delta})
        });
        if(res.ok) location.reload();
    }

    function openAddModal(el) {
        activeCoords = JSON.parse(el.closest('.grid-cell').dataset.coords);
        document.getElementById("addModal").style.display = "flex";
        document.getElementById("newItemCode").focus();
    }
    function closeAddModal() { document.getElementById("addModal").style.display = "none"; }

    async function saveNewItem() {
        const code = document.getElementById("newItemCode").value.toUpperCase();
        if(!code) return;
        const res = await fetch('/api/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({code, coords: activeCoords})
        });
        if(res.ok) location.reload();
    }

    function allowDrop(e) { e.preventDefault(); }
    function handleDrop(e) { e.preventDefault(); }
</script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

// API MANTIQI
app.post('/api/update', async (req,res) => {
    const {id, delta} = req.body;
    const [rows] = await pool.execute("SELECT count FROM main_items WHERE id=?", [id]);
    const newCount = (rows[0].count || 0) + delta;
    if(newCount <= 0) await pool.execute("DELETE FROM main_items WHERE id=?", [id]);
    else await pool.execute("UPDATE main_items SET count=? WHERE id=?", [newCount, id]);
    res.json({ok: true});
});

app.post('/api/add', async (req,res) => {
    const {code, coords} = req.body;
    await pool.execute("INSERT INTO main_items (code, row_char, row_num, col_num, row_num_in_st, count) VALUES (?,?,?,?,?,1)", 
    [code, coords.q, coords.s, coords.e, coords.u]);
    res.json({ok: true});
});

app.listen(3000, () => console.log('✅ Ambar Pro Running on port 3000'));
