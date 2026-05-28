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
            --water: #333333; --code-color: #bbbbbb; --header-bg: #181818;
            --cell-glow: rgba(255, 255, 255, 0.1);
        }
        [data-theme="light"] {
            --bg: #f8f9fa; --card: #ffffff; --brd: #dee2e6; --txt: #212529;
            --water: #ced4da; --code-color: #495057; --header-bg: #ffffff;
            --cell-glow: rgba(0, 122, 255, 0.2);
        }

        body { background: var(--bg); color: var(--txt); font-family: 'Segoe UI', sans-serif; margin: 0; padding-top: 60px; transition: 0.3s; }
        .racks-container { display: flex; gap: 15px; padding: 20px; overflow-x: auto; scrollbar-width: none; }
        .rack-box { background: var(--card); border: 1.5px solid var(--brd); border-radius: 10px; padding: 12px; min-width: 280px; }
        .floor-grid { display: flex; gap: 8px; margin-bottom: 8px; }

        /* KATAKKA QO'LLANILGAN EFFEKT */
        .cell { 
            flex: 1; height: 100px; border: 1.5px solid var(--brd); border-radius: 8px; 
            background: rgba(0,0,0,0.02); position: relative; display: flex; 
            align-items: center; justify-content: center; overflow: hidden; cursor: grab;
            transition: border-color 0.3s, box-shadow 0.3s;
        }

        /* KATAK USTIGA BORGANDA JONLI EFFEKT */
        .cell:hover {
            border-color: #555;
            box-shadow: 0 0 15px var(--cell-glow);
            animation: cell-pulse 2s infinite ease-in-out;
        }

        @keyframes cell-pulse {
            0%, 100% { box-shadow: 0 0 5px var(--cell-glow); border-color: var(--brd); }
            50% { box-shadow: 0 0 20px var(--cell-glow); border-color: #666; }
        }

        .water-container {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            overflow: hidden; z-index: 1; pointer-events: none;
        }

        .glass-water {
            position: absolute; bottom: -15%; left: -15%; width: 130%; 
            background: var(--water);
            z-index: 1; 
            transition: height 1s cubic-bezier(0.4, 0, 0.2, 1);
            transform-origin: center bottom;
        }

        .water-line {
            position: absolute; top: 0; left: 0; width: 100%;
            height: 1px; background: rgba(255,255,255,0.1);
        }

        /* 5 SEKUNDLIK CHAYQALISH */
        .sloshing .glass-water { animation: deep-slosh 5s ease-in-out forwards; }
        @keyframes deep-slosh {
            0%   { transform: rotate(0deg) scale(1.1); }
            10%  { transform: rotate(7deg) scale(1.25); }
            20%  { transform: rotate(-6deg) scale(1.25); }
            40%  { transform: rotate(4deg) scale(1.15); }
            60%  { transform: rotate(-2deg) scale(1.1); }
            80%  { transform: rotate(0.5deg) scale(1.1); }
            100% { transform: rotate(0deg) scale(1.1); }
        }

        .code-label { 
            position: absolute; top: 10px; font-size: 15px; 
            font-weight: 600; color: var(--code-color); 
            z-index: 10; text-transform: uppercase;
        }
        
        /* SONI BOLD */
        .qty-val { font-size: 30px; font-weight: 900; z-index: 10; margin-top: 15px; }

        .btns { position: absolute; bottom: 0; width: 100%; display: flex; transform: translateY(100%); transition: 0.2s; z-index: 20; }
        .cell:hover .btns { transform: translateY(0); }
        .btns button { flex: 1; border: 0; background: #333; color: #fff; cursor: pointer; height: 30px; font-weight: bold; border-top: 1px solid var(--brd); }

        .header { position: fixed; top: 0; width: 100%; height: 50px; background: var(--header-bg); border-bottom: 2px solid var(--brd); display: flex; align-items: center; padding: 0 20px; z-index: 1000; box-sizing: border-box; }
        #srch { flex: 1; background: rgba(0,0,0,0.05); border: 1px solid var(--brd); color: var(--txt); padding: 7px 15px; border-radius: 5px; margin-left: 20px; outline: none; }
        .theme-btn { background: none; border: 1.5px solid var(--brd); color: var(--txt); cursor: pointer; padding: 5px 12px; border-radius: 5px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <button class="theme-btn" onclick="toggleTheme()">🌓 MODE</button>
        <input type="text" id="srch" placeholder="Qidiruv..." oninput="doSearch(this.value)">
    </div>
    <div id="wrap">${content}</div>

    <script>
        function toggleTheme() {
            const html = document.documentElement;
            const current = html.getAttribute('data-theme');
            html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
        }

        function triggerSplash(el) {
            if (el.classList.contains('sloshing')) return;
            el.classList.add('sloshing');
            setTimeout(() => el.classList.remove('sloshing'), 5000);
        }

        function doSearch(v) {
            document.querySelectorAll('.cell').forEach(c => {
                c.style.borderColor = 'var(--brd)';
                c.style.boxShadow = 'none';
            });
            if(!v) return;
            document.querySelectorAll('.item').forEach(it => {
                if(it.dataset.code.toLowerCase().includes(v.toLowerCase())) {
                    it.style.borderColor = '#007bff';
                    it.style.boxShadow = '0 0 20px rgba(0,123,255,0.5)';
                    it.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }

        async function changeQty(id, d, e) {
            e.stopPropagation();
            await fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, d}) });
            window.location.reload();
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

app.listen(3000, () => console.log('Tayyor: http://localhost:3000'));

