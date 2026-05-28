const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
app.use(express.json());

const pool = mysql.createPool({
    host: 'localhost', user: 'root', database: 'dynamic_wms', password: '', enableKeepAlive: true
});

function renderCell(itm, pos) {
    const posJson = JSON.stringify(pos);
    if (!itm) {
        return `<div class="cell-unit empty"
                     onclick='openItemModal(${posJson}, event)'
                     ondragover="allowDrop(event)"
                     ondrop="dropItem(event, ${posJson})">
                    <span class="plus-icon">+</span>
                </div>`;
    }
    const status = itm.count <= 5 ? 'danger' : itm.count <= 10 ? 'warning' : 'ok';
    return `
        <div class="inventory-item filled qty-${status}"
             data-code="${itm.code}"
             data-id="${itm.id}"
             draggable="true"
             ondragstart="dragStart(event, ${itm.id})"
             onclick="toggleControls(this, event)">
            <div class="item-code">${itm.code}</div>
            <div class="item-qty">${itm.count}</div>
            <div class="controls">
                <button class="btn-m" onclick="updateStock(${itm.id},-1,event)">-</button>
                <button class="btn-p" onclick="updateStock(${itm.id},1,event)">+</button>
            </div>
        </div>`;
}

app.get('/', async (req, res) => {
    try {
        const [config] = await pool.execute("SELECT * FROM warehouse_config ORDER BY row_name ASC");
        const [items] = await pool.execute("SELECT * FROM items");

        let htmlRows = "";
        config.forEach(row => {
            htmlRows += `
            <div class="qator-wrapper">
                <div class="qator-header">
                    <div class="qator-title">QATOR ${row.row_name}</div>
                    <div class="more-menu" onclick="deleteRow(${row.id}, event)">⋮</div>
                </div>
                <div class="racks-container no-scrollbar">`;

            for(let st=1; st <= row.racks_count; st++){
                htmlRows += `
                <div class="stellaj-card">
                    <div class="stellaj-header">${row.row_name}${st} Stellaj</div>
                    <div class="grid-table" style="grid-template-columns: 25px repeat(${row.slots_per_shelf}, 1fr);">`;

                for(let et=row.shelves_count - 1; et >= 0; et--){
                    htmlRows += `<div class="etaj-label">${et}</div>`;
                    for(let sl=1; sl <= row.slots_per_shelf; sl++){
                        const item = items.find(it => it.row_id==row.id && it.rack_no==st && it.shelf_no==et && it.slot_no==sl);
                        htmlRows += `<div class="cell-box">${renderCell(item, {r:row.id, st, et, sl})}</div>`;
                    }
                }
                htmlRows += `</div></div>`;
            }
            htmlRows += `</div></div>`;
        });

        res.send(`
<!DOCTYPE html>
<html lang="uz" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        :root[data-theme="dark"] { --bg: #0b0e14; --card: #161b22; --border: #30363d; --cell: #0b0e14; --text: #c9d1d9; --accent: #58a6ff; --header: #0d1117; }
        :root[data-theme="light"] { --bg: #f6f8fa; --card: #ffffff; --border: #d0d7de; --cell: #f6f8fa; --text: #24292f; --accent: #0969da; --header: #ffffff; }

        * { user-select: none; -webkit-user-select: none; box-sizing: border-box; }
        input { user-select: text; -webkit-user-select: text; }

        body { background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding: 15px; padding-top: 130px; }
        header { position: fixed; top: 0; left: 0; right: 0; background: var(--header); border-bottom: 1px solid var(--border); z-index: 1000; padding: 10px 15px; }
        .search-input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); outline: none; }

        .qator-wrapper { margin-bottom: 30px; }
        .qator-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .racks-container { display: flex; gap: 15px; overflow-x: auto; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        
        .stellaj-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px; min-width: fit-content; }
        .grid-table { display: grid; gap: 6px; }
        .cell-box { width: 62px; height: 62px; border: 1px solid var(--border); border-radius: 8px; position: relative; background: var(--cell); }
        .etaj-label { font-size: 10px; opacity: 0.5; text-align: center; line-height: 62px; }

        .plus-icon { color: #eee; font-size: 20px; opacity: 0.2; }

        .inventory-item { width: 100%; height: 100%; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 7px; transition: 0.2s; }
        .item-code { font-size: 9px; position: absolute; top: 4px; font-weight: bold; opacity: 0.7; z-index: 1; }
        .item-qty { font-size: 20px; font-weight: bold; z-index: 1; }

        /* QIDIRUVDA PUSHTI FON VA QORA YOZUV (SOYASIZ VA RAMKASIZ) */
        .highlight { 
            border: none !important; 
            box-shadow: none !important; 
            background-color: #FFB6C1 !important; 
            transform: scale(1.1); 
            z-index: 100;
        }
        .highlight .item-code, .highlight .item-qty { 
            color: #000000 !important; 
            opacity: 1 !important; 
        }

        .qty-ok .item-qty { color: #3fb950; }
        .qty-warning .item-qty { color: #d29922; }
        .qty-danger .item-qty { color: #f85149; }

        /* TUGMALAR: RAQAMNI TO'SIB QO'YMAYDIGAN QILIB PASTDAN JOYLANDI */
        .controls { 
            display: none; 
            position: absolute; 
            bottom: 2px; 
            left: 0; 
            right: 0; 
            background: rgba(0,0,0,0.6); 
            border-radius: 0 0 7px 7px; 
            align-items: center; 
            justify-content: space-around; 
            padding: 2px 0; 
            z-index: 10; 
        }
        .inventory-item.active .controls { display: flex; }
        .controls button { border: none; color: white; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; }
        .btn-m { background: #f85149 !important; }
        .btn-p { background: #3fb950 !important; }

        .modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:2000; align-items:center; justify-content:center; }
        .modal-box { background: var(--card); padding: 25px; border-radius: 20px; width: 300px; text-align: center; border: 1px solid var(--border); }
        .modal-box input { width: 100%; padding: 12px; margin-bottom: 12px; background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 10px; text-align: center; }
    </style>
</head>
<body onclick="closeAll()">

<header>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div style="font-weight:bold; color:var(--accent); font-size:18px;">AMBAR PRO</div>
        <div style="display:flex; gap:10px;">
            <button onclick="toggleTheme(event)" style="background:none; border:1px solid var(--border); color:var(--text); padding:5px 10px; border-radius:8px;">🌓</button>
            <button onclick="openConfigModal(event)" style="background:var(--accent); color:white; border:none; width:35px; height:35px; border-radius:50%; font-size:22px;">+</button>
        </div>
    </div>
    <input type="text" id="searchInput" class="search-input" placeholder="Tavar kodi..." onkeyup="searchItem(event)">
</header>

<div id="content">${htmlRows}</div>

<div id="itemModal" class="modal"><div class="modal-box" onclick="event.stopPropagation()">
    <h3>Yangi Tavar</h3>
    <input type="text" id="newCode" placeholder="Kod">
    <input type="number" id="newQty" placeholder="Soni">
    <button onclick="saveItem()" style="width:100%; padding:12px; background:var(--accent); color:white; border:none; border-radius:10px; font-weight:bold;">SAQLASH</button>
</div></div>

<div id="configModal" class="modal"><div class="modal-box" onclick="event.stopPropagation()">
    <h3>Yangi Bo'lim</h3>
    <input type="text" id="rn" placeholder="Nomi"><input type="number" id="rc" placeholder="Stellaj"><input type="number" id="sc" placeholder="Etaj"><input type="number" id="sl" placeholder="Slot">
    <button onclick="saveConfig()" style="width:100%; padding:12px; background:var(--accent); color:white; border:none; border-radius:10px; font-weight:bold;">OCHISH</button>
</div></div>

<script>
    let currentPos = null, draggedId = null;

    function toggleTheme(e) {
        e.stopPropagation();
        const html = document.documentElement;
        html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    }

    function dragStart(e, id) { draggedId = id; e.dataTransfer.setData("text", id); }
    function allowDrop(e) { e.preventDefault(); }

    async function dropItem(e, pos) {
        e.preventDefault();
        const id = e.dataTransfer.getData("text") || draggedId;
        if(id) {
            await fetch('/move-item', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, pos}) });
            location.reload();
        }
    }

    function searchItem(e) {
        const val = e.target.value.toUpperCase().trim();
        document.querySelectorAll('.inventory-item').forEach(el => el.classList.remove('highlight'));
        if(!val) return;
        const target = Array.from(document.querySelectorAll('.inventory-item')).find(el => el.dataset.code.includes(val));
        if(target) {
            target.classList.add('highlight');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function openItemModal(pos, e) { e.stopPropagation(); currentPos = pos; document.getElementById('itemModal').style.display = 'flex'; }
    function openConfigModal(e) { e.stopPropagation(); document.getElementById('configModal').style.display = 'flex'; }
    function closeAll() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active')); }
    function toggleControls(el, e) { e.stopPropagation(); const active = el.classList.contains('active'); closeAll(); if(!active) el.classList.add('active'); }

    async function saveItem() {
        const code = document.getElementById('newCode').value.toUpperCase();
        const count = parseInt(document.getElementById('newQty').value);
        if(!code || isNaN(count)) return;
        await fetch('/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code, count, pos: currentPos}) });
        location.reload();
    }

    async function updateStock(id, delta, e) {
        e.stopPropagation();
        await fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, delta}) });
        location.reload();
    }

    async function saveConfig() {
        const n = document.getElementById('rn').value.toUpperCase(), r = document.getElementById('rc').value, s = document.getElementById('sc').value, sl = document.getElementById('sl').value;
        await fetch('/config', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({n, r, s, sl}) });
        location.reload();
    }

    async function deleteRow(id, e) {
        e.stopPropagation();
        if(confirm("O'chirilsinmi?")) {
            await fetch('/delete-row', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id}) });
            location.reload();
        }
    }
</script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

app.post('/move-item', async (req, res) => {
    const {id, pos} = req.body;
    await pool.execute("UPDATE items SET row_id=?, rack_no=?, shelf_no=?, slot_no=? WHERE id=?", [pos.r, pos.st, pos.et, pos.sl, id]);
    res.json({ok:true});
});
app.post('/add', async (req,res) => {
    const {code, count, pos} = req.body;
    await pool.execute("INSERT INTO items (code, count, row_id, rack_no, shelf_no, slot_no) VALUES (?,?,?,?,?,?)", [code, count, pos.r, pos.st, pos.et, pos.sl]);
    res.json({ok:true});
});
app.post('/update', async (req,res) => {
    const {id, delta} = req.body;
    await pool.execute("UPDATE items SET count = count + ? WHERE id = ?", [delta, id]);
    await pool.execute("DELETE FROM items WHERE count <= 0");
    res.json({ok:true});
});
app.post('/config', async (req, res) => {
    const {n, r, s, sl} = req.body;
    await pool.execute("INSERT INTO warehouse_config (row_name, racks_count, shelves_count, slots_per_shelf) VALUES (?,?,?,?)", [n, r, s, sl]);
    res.json({ok:true});
});
app.post('/delete-row', async (req, res) => {
    await pool.execute("DELETE FROM items WHERE row_id = ?", [req.body.id]);
    await pool.execute("DELETE FROM warehouse_config WHERE id = ?", [req.body.id]);
    res.json({ok:true});
});

app.listen(3000, '0.0.0.0', () => console.log("Server ishlamoqda..."));

