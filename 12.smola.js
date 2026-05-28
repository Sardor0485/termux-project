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

function renderCell(itm, q, st, et, us) {
    const pos = `data-q="${q}" data-st="${st}" data-et="${et}" data-us="${us}"`;
    if (!itm) {
        return `<div class="cell empty" ${pos} onclick="openModal('${q}',${st},${et},${us})">+</div>`;
    }

    const hue = Math.min(itm.count * 5, 120);
    const level = Math.min((itm.count / 50) * 100, 100);
    const qtyColor = `hsl(${hue}, 70%, 45%)`;

    return `
        <div class="cell item" id="it_${itm.id}"
             draggable="true" ondragstart="handleDrag(event, this)"
             onmouseenter="triggerSplash(this)"
             ${pos} ondragover="allowDrop(event)" ondrop="handleDrop(event, this)" data-code="${itm.code}">

            <div class="water-container">
                <div class="glass-water" style="height: ${level}%">
                    <div class="water-line"></div>
                </div>
            </div>

            <div class="code-label">${itm.code}</div>
            <div class="qty-val" id="qv_${itm.id}" style="color: ${qtyColor}">${itm.count}</div>

            <div class="btns">
                <button class="btn-l" onclick="changeQty(${itm.id},-1,event)">−</button>
                <button class="btn-r" onclick="changeQty(${itm.id},1,event)">+</button>
            </div>
        </div>`;
}

app.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM main_items");
        let content = "";
        ['C','D','E'].forEach(q => {
            content += `<div class="row-sect"><h2>QATOR ${q}</h2><div class="racks-container">`;
            [1,2,3,4].forEach(st => {
                content += `<div class="rack-box"><h3>${st}-Stellaj</h3>`;
                [3,2,1,0].forEach(et => {
                    content += `<div class="floor-grid">`;
                    for(let us=1; us<=4; us++){
                        const item = rows.find(r => r.row_char==q && r.row_num==st && r.col_num==et && r.row_num_in_st==us);
                        content += renderCell(item, q, st, et, us);
                    }
                    content += `</div>`;
                });
                content += `</div>`;
            });
            content += `</div></div>`;
        });

        res.send(`
<!DOCTYPE html>
<html lang="uz" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <style>
        :root {
            --bg: #0d0d0d; --card: #181818; --brd: #2a2a2a; --txt: #fff;
            --water: rgba(255,255,255,0.1); --code-color: #bbbbbb; --header-bg: #181818;
        }
        [data-theme="light"] {
            --bg: #f0f2f5; --card: #ffffff; --brd: #d1d9e6; --txt: #1c1e21;
            --water: rgba(0,0,0,0.05); --code-color: #606770; --header-bg: #ffffff;
        }

        body { background: var(--bg); color: var(--txt); font-family: 'Segoe UI', system-ui; margin: 0; padding-top: 60px; transition: 0.3s; }
        .racks-container { display: flex; gap: 15px; padding: 20px; overflow-x: auto; scrollbar-width: none; }
        .rack-box { background: var(--card); border: 1px solid var(--brd); border-radius: 12px; padding: 12px; min-width: 280px; transition: 0.3s; }
        .floor-grid { display: flex; gap: 8px; margin-bottom: 8px; }

        .cell {
            flex: 1; height: 100px; border: 1.5px solid var(--brd); border-radius: 8px;
            background: transparent; position: relative; display: flex;
            align-items: center; justify-content: center; overflow: hidden; cursor: grab;
            transition: all 0.2s ease;
        }
        
        /* TOPILGANLARNI SARIQ FONGA BOYASH */
        .found { 
            border-color: #ffcc00 !important; 
            background: rgba(255, 204, 0, 0.35) !important; 
            box-shadow: 0 0 15px rgba(255, 204, 0, 0.5) !important;
            transform: scale(1.02);
            z-index: 50;
        }
        [data-theme="light"] .found { background: rgba(255, 204, 0, 0.5) !important; }

        .empty { font-size: 24px; color: var(--brd); cursor: pointer; }
        .empty:hover { background: rgba(0,0,0,0.05); }

        .water-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; z-index: 1; pointer-events: none; }
        .glass-water { position: absolute; bottom: -15%; left: -15%; width: 130%; background: var(--water); z-index: 1; transition: height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2); transform-origin: center bottom; }
        
        .sloshing .glass-water { animation: fast-slosh 1.2s ease-in-out forwards; }
        @keyframes fast-slosh {
            0%, 100% { transform: rotate(0deg) scale(1.1); }
            25% { transform: rotate(7deg); }
            50% { transform: rotate(-5deg); }
        }

        .code-label { position: absolute; top: 10px; font-size: 13px; font-weight: 700; color: var(--code-color); z-index: 10; }
        .qty-val { font-size: 32px; font-weight: 900; z-index: 10; margin-top: 12px; }

        .btns { position: absolute; bottom: 0; width: 100%; display: flex; transform: translateY(100%); transition: 0.15s; z-index: 20; }
        .cell:hover .btns { transform: translateY(0); }
        .btns button { flex: 1; border: 0; background: #333; color: #fff; cursor: pointer; height: 32px; font-weight: bold; }
        [data-theme="light"] .btns button { background: #ddd; color: #000; }

        .header { position: fixed; top: 0; width: 100%; height: 50px; background: var(--header-bg); border-bottom: 1px solid var(--brd); display: flex; align-items: center; padding: 0 20px; z-index: 1000; box-sizing: border-box; }
        #srch { flex: 1; background: var(--bg); border: 1px solid var(--brd); color: var(--txt); padding: 8px 15px; border-radius: 20px; margin: 0 20px; outline: none; }
        .theme-btn { background: var(--card); border: 1px solid var(--brd); color: var(--txt); cursor: pointer; padding: 5px 12px; border-radius: 12px; font-weight: bold; }

        #modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:2000; align-items:center; justify-content:center; backdrop-filter: blur(3px); }
        .m-box { background:var(--card); padding:25px; border-radius:15px; width:280px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .m-box input { width:100%; padding:10px; margin:10px 0; background:var(--bg); border:1px solid var(--brd); color:var(--txt); border-radius:8px; box-sizing:border-box; }
    </style>
</head>
<body>
    <div class="header">
        <button class="theme-btn" onclick="toggleTheme()">🌓 MODE</button>
        <input type="text" id="srch" placeholder="Qidiruv (masalan: 222)..." oninput="doSearch(this.value)">
        <button onclick="location.reload()" style="background:none; border:none; cursor:pointer; font-size:20px">🔄</button>
    </div>

    <div id="wrap">${content}</div>

    <div id="modal">
        <div class="m-box">
            <h3 style="margin-top:0">Yangi tovar</h3>
            <input type="text" id="newCode" placeholder="Kod">
            <input type="number" id="newCount" placeholder="Soni" value="1">
            <div style="display:flex; gap:10px">
                <button onclick="saveItem()" style="flex:1; padding:10px; background:#28a745; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:bold">SAQLASH</button>
                <button onclick="closeModal()" style="flex:1; padding:10px; background:#444; color:#fff; border:none; border-radius:8px; cursor:pointer">X</button>
            </div>
        </div>
    </div>

    <script>
        let currentPos = {};

        function toggleTheme() {
            const html = document.documentElement;
            const current = html.getAttribute('data-theme');
            html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
        }

        function triggerSplash(el) {
            if (el.classList.contains('sloshing')) return;
            el.classList.add('sloshing');
            setTimeout(() => el.classList.remove('sloshing'), 1200);
        }

        function doSearch(v) {
            const items = document.querySelectorAll('.item');
            items.forEach(it => it.classList.remove('found'));

            if(!v || v.length < 1) return;

            let firstFound = null;
            
            items.forEach(it => {
                if(it.dataset.code.toLowerCase().includes(v.toLowerCase())) {
                    it.classList.add('found');
                    if(!firstFound) firstFound = it;
                }
            });

            if(firstFound) {
                firstFound.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        function openModal(q, st, et, us) {
            currentPos = { q, st, et, us };
            document.getElementById('modal').style.display = 'flex';
            document.getElementById('newCode').focus();
        }

        function closeModal() { document.getElementById('modal').style.display = 'none'; }

        async function saveItem() {
            const code = document.getElementById('newCode').value;
            const count = document.getElementById('newCount').value;
            if(!code) return;
            await fetch('/add', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({code, count, ...currentPos})
            });
            window.location.reload();
        }

        async function changeQty(id, d, e) {
            e.stopPropagation();
            const el = document.getElementById('qv_'+id);
            const water = el.parentElement.querySelector('.glass-water');
            let val = parseInt(el.innerText) + d;
            if(val < 0) val = 0;
            el.innerText = val;
            water.style.height = Math.min((val / 50) * 100, 100) + '%';
            fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, d}) });
        }

        function handleDrag(e, el) { e.dataTransfer.setData("text", el.id); }
        function allowDrop(e) { e.preventDefault(); }
        async function handleDrop(e, target) {
            e.preventDefault();
            const id = e.dataTransfer.getData("text").replace('it_', '');
            const {q, st, et, us} = target.dataset;
            await fetch('/move', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, q, st, et, us}) });
            window.location.reload();
        }
    </script>
</body>
</html>`);
    } catch (err) { res.send(err.message); }
});

app.post('/add', async (req,res) => {
    const {code, count, q, st, et, us} = req.body;
    await pool.execute("INSERT INTO main_items (code, count, row_char, row_num, col_num, row_num_in_st) VALUES (?,?,?,?,?,?)", [code, count, q, st, et, us]);
    res.json({ok:true});
});

app.post('/move', async (req,res) => {
    const {id, q, st, et, us} = req.body;
    await pool.execute("UPDATE main_items SET row_char=?, row_num=?, col_num=?, row_num_in_st=? WHERE id=?", [q, st, et, us, id]);
    res.json({ok:true});
});

app.post('/update', async (req,res) => {
    const {id, d} = req.body;
    await pool.execute("UPDATE main_items SET count = count + ? WHERE id = ?", [d, id]);
    res.json({ok:true});
});

app.listen(3000, () => console.log('Ambar v3.0: http://localhost:3000'));

