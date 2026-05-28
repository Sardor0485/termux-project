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
        return `<div class="cell empty" ${pos} ondragover="allowDrop(event)" ondrop="handleDrop(event, this)" onclick="openModal('${q}',${st},${et},${us})">+</div>`;
    }

    const level = Math.min((itm.count / 50) * 100, 100);
    const hue = Math.min(itm.count * 5, 120);
    const qtyColor = `hsl(${hue}, 75%, 45%)`;
    
    return `
        <div class="cell item" id="it_${itm.id}"
             draggable="true" ondragstart="handleDrag(event, this)"
             ${pos} ondragover="allowDrop(event)" ondrop="handleDrop(event, this)" 
             data-code="${itm.code}"
             onmouseenter="handleSlosh(event, this)">
            <div class="water-container">
                <div class="glass-water" style="height: calc(${level}% + 60px)"></div>
            </div>
            <div class="code-label">${itm.code}</div>
            <div class="qty-val" id="qv_${itm.id}" style="color: ${qtyColor}">${itm.count}</div>
            <div class="btns">
                <button class="btn-sm" onclick="changeQty(${itm.id},-1,event)">−</button>
                <button class="btn-sm" onclick="changeQty(${itm.id},1,event)">+</button>
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
                    for(let us=1; us<=4; us++) {
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
            --water: rgba(120, 120, 120, 0.4);
        }
        [data-theme="light"] {
            --bg: #f4f7f6; --card: #ffffff; --brd: #d1d9e6; --txt: #2c3e50;
            --water: rgba(150, 150, 150, 0.35);
        }

        body { background: var(--bg); color: var(--txt); font-family: sans-serif; margin: 0; padding-top: 60px; }
        .racks-container { display: flex; gap: 15px; padding: 20px; overflow-x: auto; }
        .rack-box { background: var(--card); border: 1px solid var(--brd); border-radius: 12px; padding: 12px; min-width: 280px; }
        .floor-grid { display: flex; gap: 8px; margin-bottom: 8px; }
        
        .cell {
            flex: 1; height: 110px; border: 1.5px solid var(--brd); border-radius: 18px;
            position: relative; display: flex; align-items: center; justify-content: center; 
            overflow: hidden; background: transparent;
        }

        .water-container { position: absolute; inset: 0; overflow: hidden; pointer-events: none; border-radius: 16px; }
        
        .glass-water { 
            position: absolute; 
            bottom: -50px; 
            left: -55%; 
            width: 210%; 
            background: var(--water); 
            transition: height 0.7s cubic-bezier(0.4, 0, 0.2, 1);
            transform-origin: center bottom;
        }

        .slosh-left { animation: fluid-L 7s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
        .slosh-right { animation: fluid-R 7s cubic-bezier(0.25, 0.46, 0.45, 0.94); }

        @keyframes fluid-L {
            0% { transform: rotate(0deg); }
            8% { transform: rotate(15deg) scale(1.1); }
            22% { transform: rotate(-12deg); }
            38% { transform: rotate(8deg); }
            100% { transform: rotate(0deg); }
        }
        @keyframes fluid-R {
            0% { transform: rotate(0deg); }
            8% { transform: rotate(-15deg) scale(1.1); }
            22% { transform: rotate(12deg); }
            38% { transform: rotate(-8deg); }
            100% { transform: rotate(0deg); }
        }

        .qty-val { font-size: 38px; font-weight: 900; z-index: 5; pointer-events: none; }
        .code-label { position: absolute; top: 8px; font-size: 11px; font-weight: bold; opacity: 0.5; z-index: 5; }
        
        /* TUGMALAR - ORASI YAQINLASHTIRILDI */
        .btns { 
            position: absolute; bottom: 8px; width: 100%; 
            display: flex; justify-content: center; 
            gap: 12px; /* Orasi yaqinlashtirildi */
            opacity: 0; transform: translateY(10px); transition: 0.3s; z-index: 10;
        }
        .cell:hover .btns { opacity: 1; transform: translateY(0); }
        
        .btn-sm { 
            background: none; color: var(--txt); border: 0; 
            font-size: 24px; cursor: pointer; font-weight: bold;
            display: flex; align-items: center; justify-content: center;
            width: 30px; height: 30px;
            transition: 0.2s;
        }
        .btn-sm:hover { transform: scale(1.3); color: #fff; text-shadow: 0 0 8px rgba(255,255,255,0.5); }

        .header { position: fixed; top: 0; width: 100%; height: 55px; background: var(--card); border-bottom: 1px solid var(--brd); display: flex; align-items: center; padding: 0 20px; z-index: 1000; box-sizing: border-box; }
        #srch { flex: 1; background: var(--bg); border: 1px solid var(--brd); color: var(--txt); padding: 10px 15px; border-radius: 20px; margin: 0 20px; outline: none; }
        #modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:2000; align-items:center; justify-content:center; }
        .m-box { background: var(--card); padding:25px; border-radius:15px; width:280px; border: 1px solid var(--brd); }
    </style>
</head>
<body onclick="if(event.target==document.getElementById('modal')) closeModal()">

    <div class="header">
        <button onclick="toggleMode()" style="cursor:pointer; padding:5px 10px; border-radius:8px; border:1px solid var(--brd); background:none; color:var(--txt);">MODE</button>
        <input type="text" id="srch" placeholder="Qidiruv..." oninput="doSearch(this.value)">
        <button onclick="location.reload()" style="background:none; border:none; color:white; cursor:pointer; font-size:20px;">🔄</button>
    </div>

    <div id="wrap">${content}</div>

    <div id="modal">
        <div class="m-box">
            <h3>Yangi tovar</h3>
            <input type="text" id="newCode" placeholder="Kod" style="width:100%; padding:10px; margin-bottom:10px; background:var(--bg); color:#fff; border:1px solid var(--brd);">
            <input type="number" id="newCount" value="1" style="width:100%; padding:10px; margin-bottom:15px; background:var(--bg); color:#fff; border:1px solid var(--brd);">
            <div style="display:flex; gap:10px">
                <button onclick="saveItem()" style="flex:2; padding:10px; background:#27ae60; color:white; border:none; border-radius:5px;">SAQLASH</button>
                <button onclick="closeModal()" style="flex:1; padding:10px; background:#444; color:white; border:none; border-radius:5px;">X</button>
            </div>
        </div>
    </div>

    <script>
        function toggleMode() {
            const html = document.documentElement;
            html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        }

        function handleSlosh(e, cell) {
            const water = cell.querySelector('.glass-water');
            const rect = cell.getBoundingClientRect();
            water.classList.remove('slosh-left', 'slosh-right');
            void water.offsetWidth; 
            water.style.animationDuration = (6 + Math.random() * 2) + 's';
            if (e.clientX - rect.left < rect.width / 2) water.classList.add('slosh-left');
            else water.classList.add('slosh-right');
        }

        function doSearch(v) {
            const items = document.querySelectorAll('.item');
            items.forEach(it => it.style.borderColor = '');
            if(!v) return;
            items.forEach(it => {
                if(it.dataset.code.toLowerCase().includes(v.toLowerCase())) {
                    it.style.borderColor = '#f1c40f';
                    it.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }

        function handleDrag(e, el) { e.dataTransfer.setData("text", el.id); el.style.opacity = "0.4"; }
        function allowDrop(e) { e.preventDefault(); }
        async function handleDrop(e, target) {
            e.preventDefault();
            const id = e.dataTransfer.getData("text").replace('it_', '');
            if(target.classList.contains('empty')) {
                const {q, st, et, us} = target.dataset;
                await fetch('/move', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, q, st, et, us}) });
                window.location.reload();
            }
        }

        function openModal(q, st, et, us) { window.currentPos = { q, st, et, us }; document.getElementById('modal').style.display = 'flex'; }
        function closeModal() { document.getElementById('modal').style.display = 'none'; }
        
        async function saveItem() {
            const code = document.getElementById('newCode').value;
            const count = document.getElementById('newCount').value;
            await fetch('/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code, count, ...window.currentPos}) });
            window.location.reload();
        }

        async function changeQty(id, d, e) {
            e.stopPropagation();
            const el = document.getElementById('qv_'+id);
            const water = el.closest('.item').querySelector('.glass-water');
            let val = parseInt(el.innerText) + d;
            if(val < 0) val = 0;
            el.innerText = val;
            water.style.height = 'calc(' + Math.min((val/50)*100, 100) + '% + 60px)';
            fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, d}) });
        }
    </script>
</body>
</html>`);
    } catch (err) { res.send(err.message); }
});

app.post('/update', async (req,res) => {
    const {id, d} = req.body;
    await pool.execute("UPDATE main_items SET count = count + ? WHERE id = ?", [d, id]);
    res.json({ok:true});
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

app.listen(3000, () => console.log('Ambar Final Optimized: http://localhost:3000'));

