const express = require('express');
const mysql = require('mysql2/promise');
const os = require('os');
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

        let sectionsHTML = "";
        ['C','D','E'].forEach(q => {
            sectionsHTML += `
            <div class="line-wrapper">
                <div class="line-header"><div class="line-badge">🏭 ${q} — QATOR</div></div>
                <div class="racks-row">`;

            [1,2,3,4].forEach(st => {
                sectionsHTML += `
                <div class="card rack-card shadow-sm">
                    <div class="card-header-custom">
                        <span class="rack-label">${q}${st}</span><span class="rack-sub">Stellaj</span>
                    </div>
                    <div class="card-body-custom">
                        <div class="shelf-labels-row">
                            <div class="sl-empty"></div><div class="sl-item">1</div><div class="sl-item">2</div><div class="sl-item">3</div><div class="sl-item">4</div>
                        </div>`;

                [3,2,1,0].forEach(et => {
                    sectionsHTML += `<div class="shelf-row"><div class="shelf-num">${et}</div>`;
                    for(let us=1; us<=4; us++){
                        const items = rows.filter(r => r.row_char==q && r.row_num==st && r.col_num==et && r.row_num_in_st==us);
                        
                        // Katak ID sini yaratamiz
                        const cellId = `cell_${q}_${st}_${et}_${us}`;
                        
                        sectionsHTML += `
                        <div class="grid-cell" id="${cellId}" data-coords='{"q":"${q}","s":${st},"e":${et},"u":${us}}' ondragover="allowDrop(event)" ondrop="handleDrop(event)">
                            ${renderCellContent(items)}
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
    <title>Ambar Pro v3.1</title>
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
        body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; height: 100vh; display: flex; flex-direction: column; overflow: hidden; transition: background 0.3s; }

        .navbar { background: var(--surface); border-bottom: 1px solid var(--border); height: 60px; display: flex; align-items: center; padding: 0 1.5rem; justify-content: space-between; z-index: 500; }
        .brand { font-family: var(--font-mono); font-weight: 800; color: var(--accent); font-size: 1.1rem; }
        
        .main-content { flex: 1; overflow-y: auto; padding: 1.5rem 1.5rem 80px 1.5rem; display: flex; flex-direction: column; gap: 2rem; }
        .racks-row { display: flex; gap: 1.5rem; overflow-x: auto; padding-bottom: 10px; }

        .rack-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; min-width: 350px; flex-shrink: 0; }
        .card-header-custom { padding: 10px 15px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
        .rack-label { color: var(--accent); font-family: var(--font-mono); font-weight: 800; }

        .shelf-row { display: grid; grid-template-columns: 25px repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
        .grid-cell { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; height: 85px; display: flex; align-items: center; justify-content: center; position: relative; transition: 0.2s; }
        
        /* SEARCH HIGHLIGHT */
        .found-item { border: 2px solid var(--yellow) !important; background: rgba(210,153,34,0.15) !important; transform: scale(1.02); z-index: 5; }

        .inventory-item { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; border-radius: 8px; }
        .item-code { font-family: var(--font-mono); font-size: 15px; font-weight: 800; color: var(--text); }
        .item-qty { font-family: var(--font-mono); font-size: 26px; font-weight: 800; line-height: 1; }
        
        .qty-ok .item-qty { color: var(--green); }
        .qty-warning .item-qty { color: var(--yellow); }
        .qty-danger .item-qty { color: var(--red); }

        .action-popover { display: none; gap: 8px; position: absolute; bottom: 5px; z-index: 100; background: var(--surface); padding: 4px; border-radius: 8px; border: 1px solid var(--border); }
        .inventory-item.active .action-popover { display: flex; }
        .btn-ctrl { border: none; border-radius: 6px; width: 32px; height: 32px; font-weight: 800; cursor: pointer; color: white; }
        .btn-m { background: var(--red); }
        .btn-p { background: var(--green); }

        /* FLOATING SEARCH */
        .search-floating { position: fixed; bottom: 25px; right: 25px; z-index: 2000; display: flex; align-items: center; }
        .search-inner { display: flex; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 50px; padding: 5px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); transition: 0.3s; width: 54px; height: 54px; overflow: hidden; }
        .search-inner:focus-within { width: 300px; border-color: var(--accent); }
        .search-inner input { border: none; outline: none; background: transparent; color: var(--text); padding: 0 15px; width: 0; transition: width 0.3s; font-size: 16px; }
        .search-inner:focus-within input { width: 230px; }
        .lupa-btn { width: 44px; height: 44px; background: var(--accent); color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 20px; }

        .modal-wrap { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 3000; backdrop-filter: blur(5px); }
        .modal-box { background: var(--surface); border: 1px solid var(--border); padding: 25px; border-radius: 16px; width: 320px; }
        
        .btn-add { color: var(--border); font-size: 28px; cursor: pointer; }
    </style>
</head>
<body id="bodyTag">

<div class="navbar">
    <div class="brand">AMBAR<span>PRO</span></div>
    <div class="stats">
        <button onclick="toggleTheme()" id="themeBtn" style="background:none; border:none; cursor:pointer; font-size:22px;">🌓</button>
    </div>
</div>

<div class="main-content">${sectionsHTML}</div>

<div class="search-floating">
    <div class="search-inner">
        <input type="text" id="searchInput" placeholder="Kodni qidiring..." oninput="handleSearch()" autocomplete="off">
        <div class="lupa-btn">🔍</div>
    </div>
</div>

<div class="modal-wrap" id="addModal">
    <div class="modal-box">
        <h3 style="margin-bottom:15px; font-size:14px; color:var(--accent);">📦 TOVAR QO'SHISH</h3>
        <input type="text" id="newItemCode" style="width:100%; padding:12px; margin-bottom:15px; border-radius:8px; border:1px solid var(--border); background:var(--bg); color:var(--text);" placeholder="ABC-123">
        <button onclick="saveNewItem()" style="width:100%; padding:12px; background:var(--accent); border:none; border-radius:8px; font-weight:700;">SAQLASH</button>
        <button onclick="closeAddModal()" style="background:none; border:none; color:var(--muted); width:100%; margin-top:12px; cursor:pointer;">BEKOR QILISH</button>
    </div>
</div>

<script>
    // --- TEMA BOSHQARUVI ---
    function applyTheme(theme) {
        const body = document.getElementById('bodyTag');
        if(theme === 'light') body.classList.add('light');
        else body.classList.remove('light');
    }

    function toggleTheme() {
        const body = document.getElementById('bodyTag');
        const newTheme = body.classList.contains('light') ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    }
    applyTheme(localStorage.getItem('theme') || 'dark');

    // --- REFRESHSIZ YANGILASH (AJAX) ---
    async function updateStock(id, delta, e, cellId) {
        e.stopPropagation();
        const res = await fetch('/api/update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id, delta})
        });
        const data = await res.json();
        if(data.ok) {
            // Butun sahifani emas, faqat o'sha katakni yangilaymiz
            document.getElementById(cellId).innerHTML = data.newHtml;
        }
    }

    async function saveNewItem() {
        const code = document.getElementById("newItemCode").value.toUpperCase();
        if(!code) return;
        const res = await fetch('/api/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({code, coords: activeCoords})
        });
        const data = await res.json();
        if(data.ok) {
            // Katakni yangilaymiz va modalni yopamiz
            const cellId = \`cell_\${activeCoords.q}_\${activeCoords.s}_\${activeCoords.e}_\${activeCoords.u}\`;
            document.getElementById(cellId).innerHTML = data.newHtml;
            closeAddModal();
            document.getElementById("newItemCode").value = "";
        }
    }

    // --- BOSHQA FUNKSIYALAR ---
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
        if(found) found.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function openAddModal(el) {
        activeCoords = JSON.parse(el.closest('.grid-cell').dataset.coords);
        document.getElementById("addModal").style.display = "flex";
        document.getElementById("newItemCode").focus();
    }
    function closeAddModal() { document.getElementById("addModal").style.display = "none"; }
</script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

// HTML Generatsiya funksiyasi (Ham server, ham AJAX uchun bitta joyda)
function renderCellContent(items, q, st, et, us) {
    if (items.length === 0) {
        return `<div class="btn-add" onclick="openAddModal(this)">+</div>`;
    }
    return items.map(itm => {
        const c = itm.count;
        const status = c <= 3 ? 'danger' : c < 10 ? 'warning' : 'ok';
        const cellId = `cell_${itm.row_char}_${itm.row_num}_${itm.col_num}_${itm.row_num_in_st}`;
        return `
        <div class="inventory-item qty-${status}" data-id="${itm.id}" data-code="${itm.code}" onclick="toggleActive(this)">
            <span class="item-code">${itm.code}</span>
            <span class="item-qty">${c}</span>
            <div class="action-popover">
                <button class="btn-ctrl btn-m" onclick="updateStock(${itm.id},-1,event,'${cellId}')">−</button>
                <button class="btn-ctrl btn-p" onclick="updateStock(${itm.id},1,event,'${cellId}')">+</button>
            </div>
        </div>`;
    }).join('');
}

// --- API YO'NALISHLARI (REFRSHSIZ) ---
app.post('/api/update', async (req,res) => {
    const {id, delta} = req.body;
    const [rows] = await pool.execute("SELECT * FROM main_items WHERE id=?", [id]);
    const item = rows[0];
    const newCount = (item.count || 0) + delta;

    if(newCount <= 0) {
        await pool.execute("DELETE FROM main_items WHERE id=?", [id]);
        res.json({ ok: true, newHtml: `<div class="btn-add" onclick="openAddModal(this)">+</div>` });
    } else {
        await pool.execute("UPDATE main_items SET count=? WHERE id=?", [newCount, id]);
        item.count = newCount;
        res.json({ ok: true, newHtml: renderCellContent([item]) });
    }
});

app.post('/api/add', async (req,res) => {
    const {code, coords} = req.body;
    const [result] = await pool.execute(
        "INSERT INTO main_items (code, row_char, row_num, col_num, row_num_in_st, count) VALUES (?,?,?,?,?,1)", 
        [code, coords.q, coords.s, coords.e, coords.u]
    );
    const newItem = { id: result.insertId, code, count: 1, row_char: coords.q, row_num: coords.s, col_num: coords.e, row_num_in_st: coords.u };
    res.json({ ok: true, newHtml: renderCellContent([newItem]) });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Ambar Pro v3.1 ishga tushdi (Port: ${PORT})`);
});
