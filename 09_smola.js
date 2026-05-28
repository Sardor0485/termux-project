const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

const pool = mysql.createPool({
    host: '127.0.0.1', user: 'root', password: '', database: 'ambar', enableKeepAlive: true
});

app.use(express.json());

// ASOSIY RENDER FUNKSIYASI
function renderCell(itm, q, st, et, us) {
    const pos = `data-q="${q}" data-st="${st}" data-et="${et}" data-us="${us}"`;
    if (!itm) {
        return `<div class="cell empty" ${pos} ondragover="allowDrop(event)" ondrop="handleDrop(event, this)" onclick="openModal('${q}',${st},${et},${us})">+</div>`;
    }

    const level = Math.min((itm.count / 50) * 100, 100);
    const status = itm.count < 5 ? 'crit' : itm.count < 15 ? 'warn' : 'ok';

    return `
        <div class="cell item ${status}" id="it_${itm.id}" 
             draggable="true" ondragstart="handleDrag(event, this)" 
             onmouseenter="triggerSplash(this)"
             ${pos} ondragover="allowDrop(event)" ondrop="handleDrop(event, this)" data-code="${itm.code}">
            
            <div class="glass-water" style="height: ${level}%">
                <div class="water-surface"></div>
            </div>
            
            <div class="resin-layer"><div class="ripple"></div><div class="glint"></div></div>
            <div class="code-label">${itm.code}</div>
            <div class="qty-box ${itm.count < 10 ? 'bell-shake' : ''}">
                <div class="qty-val" id="qv_${itm.id}">${itm.count}</div>
            </div>
            <div class="comet-45"></div>
            <div class="btns">
                <button class="btn-l" onclick="changeQty(${itm.id},-1,event)">−</button>
                <button class="btn-r" onclick="changeQty(${itm.id},1,event)">+</button>
            </div>
        </div>`;
}

app.get('/', async (req, res) => {
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
    <style>
        :root {
            --bg: #0d1117; --card: #161b22; --brd: #30363d; --txt: #c9d1d9;
            --blue: #00f2fe; --red: #ff3366; --gold: #ffcc00; --green: #00ff88;
        }
        body { background: var(--bg); color: var(--txt); font-family: sans-serif; margin: 0; padding-top: 65px; overflow-x: hidden; }
        .racks-container { display: flex; gap: 15px; padding: 10px 20px 30px; overflow-x: auto; }
        .header { position: fixed; top: 0; width: 100%; height: 50px; background: var(--card); border-bottom: 1px solid var(--brd); display: flex; align-items: center; padding: 0 20px; z-index: 1000; gap: 10px; box-sizing: border-box; }
        .rack-box { background: var(--card); border: 1px solid var(--brd); border-radius: 12px; padding: 10px; min-width: 270px; }
        .floor-grid { display: flex; gap: 6px; margin-bottom: 6px; }

        .cell { flex: 1; height: 85px; border: 1px solid var(--brd); border-radius: 10px; background: #050505; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: grab; }
        .cell.empty { border: 2px dashed var(--brd); opacity: 0.3; cursor: pointer; background: none; }

        /* SUV KONTEYNERI */
        .glass-water {
            position: absolute; bottom: 0; left: 0; width: 100%;
            z-index: 1; transition: height 0.8s ease;
            pointer-events: none;
            background: currentColor; opacity: 0.4;
            transform-origin: bottom;
        }
        .water-surface {
            position: absolute; top: 0; left: 0; width: 100%; height: 3px;
            background: #fff; box-shadow: 0 0 15px currentColor;
        }

        .item.ok { color: var(--green); }
        .item.warn { color: var(--gold); }
        .item.crit { color: var(--red); }

        /* JAVASCRIPT ORQALI QO'SHILADIGAN ANIMATSIYA (UZILMAYDI) */
        .sloshing .glass-water {
            animation: spring-slosh 2.5s ease-out forwards;
        }

        @keyframes spring-slosh {
            0%   { transform: scaleY(1); }
            10%  { transform: scaleY(1.25) translateY(-5px); }
            25%  { transform: scaleY(0.8) translateY(3px); }
            40%  { transform: scaleY(1.12) translateY(-2px); }
            55%  { transform: scaleY(0.9) translateY(1.5px); }
            70%  { transform: scaleY(1.05) translateY(-0.8px); }
            85%  { transform: scaleY(0.98) translateY(0.3px); }
            100% { transform: scaleY(1); }
        }

        .code-label { position: absolute; top: 6px; font-size: 13px; font-weight: 700; color: #fff; z-index: 10; text-shadow: 1px 1px 2px #000; }
        .qty-val { font-size: 26px; font-weight: 900; color: #fff; z-index: 10; text-shadow: 0 0 10px rgba(255,255,255,0.6); }

        .btns { position: absolute; bottom: 0; width: 100%; display: flex; transform: translateY(100%); transition: 0.2s; z-index: 20; }
        .cell:hover .btns { transform: translateY(0); }
        .btns button { flex: 1; border: 0; background: var(--blue); color: #000; cursor: pointer; height: 28px; font-weight: 800; font-size: 18px; }
        .btn-l { border-bottom-left-radius: 10px !important; }
        .btn-r { border-bottom-right-radius: 10px !important; }

        #modal { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: none; align-items: center; justify-content: center; z-index: 2000; }
        .m-box { background: var(--card); padding: 25px; border-radius: 15px; width: 280px; border: 1px solid var(--brd); }
    </style>
</head>
<body>
    <div class="header">
        <button onclick="document.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme')=='dark'?'light':'dark')">🌓</button>
        <input type="text" id="srch" placeholder="Qidiruv..." oninput="doSearch(this.value)" style="flex:1; background:var(--bg); border:1px solid var(--brd); color:var(--txt); padding:8px; border-radius:8px; outline:none;">
    </div>
    
    <div id="wrap">${content}</div>

    <div id="modal">
        <div class="m-box">
            <h4>Yangi Tavar</h4>
            <input id="mCode" placeholder="Kod">
            <input id="mQty" type="number" value="1" style="width:100%; margin-bottom:15px; padding:10px; background:var(--bg); color:var(--txt); border:1px solid var(--brd); border-radius:6px;">
            <button onclick="save()" style="width:100%; padding:12px; background:var(--green); border:0; color:#000; border-radius:8px; cursor:pointer; font-weight:bold; margin-bottom:10px;">SAQLASH</button>
            <button onclick="document.getElementById('modal').style.display='none'" style="width:100%; padding:10px; background:none; color:var(--red); border:1px solid var(--red); border-radius:8px; cursor:pointer;">BEKOR QILISH</button>
        </div>
    </div>

    <script>
        // ANIMATSIYA UZILMASLIGI UCHUN LOGIKA
        function triggerSplash(el) {
            if (el.classList.contains('sloshing')) return;
            el.classList.add('sloshing');
            // Animatsiya 2.5s davom etadi, tugagach klassni olib tashlaymiz
            setTimeout(() => {
                el.classList.remove('sloshing');
            }, 2500);
        }

        function doSearch(v) {
            document.querySelectorAll('.cell').forEach(c => c.classList.remove('found'));
            if(!v) return;
            const res = Array.from(document.querySelectorAll('.item')).filter(i => i.dataset.code.toLowerCase().includes(v.toLowerCase()));
            res.forEach(r => r.classList.add('found'));
            if(res[0]) res[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }

        function handleDrag(e, el) { 
            e.dataTransfer.setData("text", el.id); 
            e.dataTransfer.setDragImage(el, 0, 0); 
        }

        function allowDrop(e) { e.preventDefault(); }

        async function handleDrop(e, target) {
            e.preventDefault();
            const id = e.dataTransfer.getData("text").replace('it_', '');
            const {q, st, et, us} = target.dataset;
            const res = await fetch('/move', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, q, st, et, us}) });
            if(res.ok) window.location.reload();
        }

        async function changeQty(id, d, e) {
            e.stopPropagation();
            const res = await fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, d}) });
            if(res.ok) window.location.reload();
        }

        let cp = {};
        function openModal(q,st,et,us) { cp={q,st,et,us}; document.getElementById('modal').style.display='flex'; }
        async function save() {
            const code = document.getElementById('mCode').value.toUpperCase();
            const count = document.getElementById('mQty').value;
            if(!code) return;
            await fetch('/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...cp, code, count}) });
            window.location.reload();
        }
    </script>
</body>
</html>`);
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
app.post('/add', async (req,res) => {
    const {q, st, et, us, code, count} = req.body;
    await pool.execute("INSERT INTO main_items (row_char, row_num, col_num, row_num_in_st, code, count) VALUES (?,?,?,?,?,?)", [q,st,et,us,code,count]);
    res.json({ok:true});
});

app.listen(3000);

