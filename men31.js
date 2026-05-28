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

// Katak render qilish
function renderCell(itm) {
    if (!itm) return `<div class="btn-add" onclick="openAddModal(this)">+</div>`;

    const status = itm.count < 5 ? 'danger' : itm.count < 10 ? 'warning' : itm.count < 20 ? 'ok' : 'super';
    const cid = `cell_${itm.row_char}_${itm.row_num}_${itm.col_num}_${itm.row_num_in_st}`;

    return `
        <div class="inventory-item qty-${status}"
             data-code="${itm.code}"
             data-id="${itm.id}"
             draggable="true"
             ondragstart="drag(event)"
             onclick="toggleActive(this)">
            <div class="item-code">${itm.code}</div>
            <div class="item-qty">${itm.count}</div>
            <div class="controls">
                <button class="btn-m" onclick="updateStock(${itm.id},-1,event,'${cid}')">−</button>
                <button class="btn-p" onclick="updateStock(${itm.id},1,event,'${cid}')">+</button>
            </div>
        </div>`;
}

app.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM main_items");
        let html = "";
        ['C','D','E'].forEach(q => {
            html += `<div class="row-title">QATOR ${q}</div><div class="racks-container">`;
            [1,2,3,4].forEach(st => {
                html += `<div class="rack"><div class="rack-header">${q}${st} Stellaj</div>`;
                [3,2,1,0].forEach(et => {
                    html += `<div class="shelf"><div class="shelf-label">${et}</div>`;
                    for(let us=1; us<=4; us++){
                        const item = rows.find(r => r.row_char==q && r.row_num==st && r.col_num==et && r.row_num_in_st==us);
                        const cid = `cell_${q}_${st}_${et}_${us}`;
                        html += `<div class="cell" id="${cid}"
                                     ondrop="drop(event)"
                                     ondragover="allowDrop(event)"
                                     ondragleave="removeDragOver(event)"
                                     data-coords='{"q":"${q}","s":${st},"e":${et},"u":${us}}'>${renderCell(item)}</div>`;
                    }
                    html += `</div>`;
                });
                html += `</div>`;
            });
            html += `</div>`;
        });

        res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root { --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #c9d1d9; --accent: #58a6ff; }
        body.light { --bg: #f6f8fa; --card: #ffffff; --border: #d0d7de; --text: #24292f; --accent: #0969da; }

        body { background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding: 20px; transition: 0.3s; }

        /* HEADER (Top side) */
        .top-nav { position: sticky; top: 0; z-index: 100; background: var(--bg); display: flex; justify-content: flex-end; padding: 10px 0; border-bottom: 1px solid var(--border); margin-bottom: 15px; }
        .theme-btn { padding: 8px 15px; border-radius: 20px; border: 1px solid var(--border); background: var(--card); color: var(--text); cursor: pointer; font-size: 14px; font-weight: bold; }

        .row-title { font-weight: bold; margin: 10px 0; color: var(--accent); }
        .racks-container { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 15px; }
        .rack { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; min-width: 290px; }
        .rack-header { text-align: center; font-weight: bold; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 10px; opacity: 0.8; }
        .shelf { display: flex; gap: 5px; margin-bottom: 5px; align-items: center; }
        .shelf-label { width: 15px; font-size: 11px; color: #8b949e; }

        .cell { border: 1px solid var(--border); width: 62px; height: 62px; display: flex; align-items: center; justify-content: center; position: relative; border-radius: 4px; }
        .cell.drag-over { background: rgba(88, 166, 255, 0.3) !important; border: 2px solid var(--accent); }

        /* SEARCH BUBBLE */
        .search-bubble { position: fixed; bottom: 30px; left: 30px; z-index: 1000; display: flex; align-items: center; }
        #searchInput {
            width: 0; opacity: 0; transition: 0.4s;
            padding: 12px; border-radius: 30px; border: 1px solid var(--accent);
            background: var(--card); color: var(--text); outline: none; box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        }
        .search-bubble.open #searchInput { width: 220px; opacity: 1; margin-right: 10px; }
        .search-trigger {
            width: 55px; height: 55px; border-radius: 50%; background: var(--accent);
            color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-size: 20px;
        }

        .inventory-item { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: grab; z-index: 5; }
        .item-code { font-size: 10px; position: absolute; top: 4px; font-weight: bold; pointer-events: none; color: var(--text); }
        .item-qty { font-size: 22px; font-weight: bold; pointer-events: none; }

        /* RANGLAR - faqat raqamga tegishli */
        .qty-danger  .item-qty { color: #f85149; }   /* < 5  : Qizil   */
        .qty-warning .item-qty { color: #d29922; }   /* < 10 : Sariq   */
        .qty-ok      .item-qty { color: #3fb950; }   /* < 20 : Yashil  */
        .qty-super   .item-qty { color: #3fb950; }   /* 20+  : Yashil  */

        .controls { display: none; position: absolute; bottom: -5px; z-index: 50; gap: 3px; }
        .inventory-item.active .controls { display: flex; }
        .btn-m, .btn-p { border: none; border-radius: 3px; color: white; cursor: pointer; padding: 2px 6px; font-weight: bold; }
        .btn-m { background: #f85149; } .btn-p { background: #3fb950; }
        .btn-add { color: var(--border); cursor: pointer; font-size: 22px; width: 100%; height: 100%; display:flex; align-items:center; justify-content:center; }
        .found { background: #d29922 !important; border-color: #fff !important; }
        .found div { color: #000 !important; }

        /* LEGEND */
        .legend { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; font-size: 13px; }
        .legend span { display: flex; align-items: center; gap: 5px; }
        .legend i { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
        .l-danger  { background: #f85149; }
        .l-warning { background: #d29922; }
        .l-ok      { background: #3fb950; }
        .l-super   { background: #1a7f37; }

        #modal { display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--card); padding:20px; border:1px solid var(--border); border-radius:12px; z-index:10001; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
    </style>
</head>
<body id="b">

    <div class="top-nav">
        <button class="theme-btn" onclick="toggleTheme()">🌓 Mode</button>
    </div>

    <!-- Rang izohlar -->
 <!--    <div class="legend">
        <span><i class="l-danger"></i>  1–4 ta (Kam!)</span>
        <span><i class="l-warning"></i> 5–9 ta (Oz)</span>
        <span><i class="l-ok"></i>      10–19 ta (Normal)</span>
        <span><i class="l-super"></i>   20+ ta (Ko'p)</span>
    </div> -->

    <div class="search-bubble" id="sb">
        <input type="text" id="searchInput" placeholder="Mahsulot kodi..." oninput="doSearch()">
        <button class="search-trigger" onclick="document.getElementById('sb').classList.toggle('open')">🔍</button>
    </div>

    <div> ${html} </div>

    <div id="modal">
        <input type="text" id="newCode" placeholder="Kod" style="padding:10px; margin-bottom:10px; width:100%; border-radius:6px; border:1px solid var(--border); background: #000; color: #fff;">
        <button onclick="saveItem()" style="width:100%; padding:10px; background:var(--accent); border:none; color:white; border-radius:6px; cursor:pointer; font-weight:bold;">SAQLASH</button>
        <button onclick="closeModal()" style="width:100%; margin-top:8px; background:transparent; color:var(--text); border:none; cursor:pointer;">Bekor qilish</button>
    </div>

    <script>
        // --- DRAG LOGIC ---
        function allowDrop(ev) {
            ev.preventDefault();
            ev.currentTarget.classList.add('drag-over');
        }

        function removeDragOver(ev) {
            ev.currentTarget.classList.remove('drag-over');
        }

        function drag(ev) {
            ev.dataTransfer.setData("itemId", ev.target.dataset.id);
            ev.dataTransfer.target = ev.target;
        }

        async function drop(ev) {
            ev.preventDefault();
            const cell = ev.currentTarget;
            cell.classList.remove('drag-over');

            if (cell.querySelector('.inventory-item')) return;

            const itemId = ev.dataTransfer.getData("itemId");
            const coords = JSON.parse(cell.dataset.coords);

            const res = await fetch('/move', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id: itemId, coords})
            });
            const data = await res.json();

            const oldItem = document.querySelector(\`[data-id="\${itemId}"]\`);
            if (oldItem) {
                const oldCell = oldItem.parentElement;
                oldCell.innerHTML = '<div class="btn-add" onclick="openAddModal(this)">+</div>';
            }
            cell.innerHTML = data.html;
        }

        // --- THEME & SEARCH ---
        function toggleTheme() {
            const isLight = document.body.classList.toggle('light');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
        }
        if(localStorage.getItem('theme') === 'light') document.body.classList.add('light');

        function doSearch() {
            const s = document.getElementById('searchInput').value.toUpperCase().trim();
            document.querySelectorAll('.cell').forEach(c => c.classList.remove('found'));
            if(!s) return;
            let first = null;
            document.querySelectorAll('.inventory-item').forEach(i => {
                if(i.dataset.code.includes(s)) {
                    i.parentElement.classList.add('found');
                    if(!first) first = i.parentElement;
                }
            });
            if(first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // --- STOCK ACTIONS ---
        function toggleActive(el) {
            document.querySelectorAll('.inventory-item').forEach(i => i !== el && i.classList.remove('active'));
            el.classList.toggle('active');
        }

        async function updateStock(id, delta, e, cid) {
            e.stopPropagation();
            const res = await fetch('/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id, delta})
            });
            const data = await res.json();
            document.getElementById(cid).innerHTML = data.html;
        }

        function openAddModal(el) {
            activeCoords = JSON.parse(el.closest('.cell').dataset.coords);
            document.getElementById('modal').style.display = 'block';
            document.getElementById('newCode').focus();
        }
        function closeModal() { document.getElementById('modal').style.display = 'none'; }

        async function saveItem() {
            const code = document.getElementById('newCode').value.toUpperCase();
            if(!code) return;
            const res = await fetch('/add', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({code, coords: activeCoords})
            });
            const data = await res.json();
            const cid = \`cell_\${activeCoords.q}_\${activeCoords.s}_\${activeCoords.e}_\${activeCoords.u}\`;
            document.getElementById(cid).innerHTML = data.html;
            closeModal();
            document.getElementById('newCode').value = '';
        }
    </script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

// MOVE API
app.post('/move', async (req, res) => {
    const {id, coords} = req.body;
    await pool.execute(
        "UPDATE main_items SET row_char=?, row_num=?, col_num=?, row_num_in_st=? WHERE id=?",
        [coords.q, coords.s, coords.e, coords.u, id]
    );
    const [rows] = await pool.execute("SELECT * FROM main_items WHERE id=?", [id]);
    res.json({html: renderCell(rows[0])});
});

app.post('/update', async (req,res) => {
    const {id, delta} = req.body;
    const [rows] = await pool.execute("SELECT * FROM main_items WHERE id=?", [id]);
    if(!rows.length) return res.json({html: renderCell(null)});
    const itm = rows[0];
    const newQty = itm.count + delta;
    if(newQty <= 0) {
        await pool.execute("DELETE FROM main_items WHERE id=?", [id]);
        res.json({html: renderCell(null)});
    } else {
        await pool.execute("UPDATE main_items SET count=? WHERE id=?", [newQty, id]);
        itm.count = newQty;
        res.json({html: renderCell(itm)});
    }
});

app.post('/add', async (req,res) => {
    const {code, coords} = req.body;
    const [r] = await pool.execute("INSERT INTO main_items (code, row_char, row_num, col_num, row_num_in_st, count) VALUES (?,?,?,?,?,1)",
        [code, coords.q, coords.s, coords.e, coords.u]);
    const itm = {id: r.insertId, code, count: 1, row_char: coords.q, row_num: coords.s, col_num: coords.e, row_num_in_st: coords.u};
    res.json({html: renderCell(itm)});
});

app.listen(3000, '0.0.0.0', () => console.log('Ambar Pro ishga tushdi: port 3000'));
