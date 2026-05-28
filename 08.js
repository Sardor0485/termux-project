const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

const pool = mysql.createPool({
    host: '127.0.0.1', user: 'root', password: '', database: 'ambar', enableKeepAlive: true
});

app.use(express.json());

function renderCell(itm, q, st, et, us) {
    const pos = `data-q="${q}" data-st="${st}" data-et="${et}" data-us="${us}"`;
    if (!itm) {
        return `<div class="cell empty" ${pos} ondragover="allowDrop(event)" ondrop="handleDrop(event, this)" onclick="openModal('${q}',${st},${et},${us})">+</div>`;
    }

    const isLow = itm.count < 10;
    return `
        <div class="cell item" id="it_${itm.id}" draggable="true" ondragstart="handleDrag(event, this)" ${pos} ondragover="allowDrop(event)" ondrop="handleDrop(event, this)" data-code="${itm.code}">
            <div class="resin-layer"><div class="ripple"></div><div class="glint"></div></div>
            
            <div class="code-label">${itm.code}</div>
            
            <div class="qty-box ${isLow ? 'bell-shake' : ''}" style="--d: ${Math.random()}s">
                <div class="qty-val ${itm.count < 5 ? 'crit' : isLow ? 'warn' : 'ok'}" id="qv_${itm.id}">${itm.count}</div>
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
        :root { --bg: #0d1117; --card: #161b22; --brd: #30363d; --txt: #c9d1d9; --blue: #58a6ff; --red: #f85149; --gold: #d29922; --green: #3fb950; }
        [data-theme="light"] { --bg: #f5f7f9; --card: #ffffff; --brd: #d0d7de; --txt: #1f2328; --blue: #0969da; --red: #d1242f; --gold: #9a6700; --green: #1a7f37; }
        
        body { background: var(--bg); color: var(--txt); font-family: sans-serif; margin: 0; padding-top: 65px; }
        .racks-container { display: flex; gap: 15px; padding: 10px 20px 30px; overflow-x: auto; scrollbar-width: none; }
        .racks-container::-webkit-scrollbar { display: none; }
        .header { position: fixed; top: 0; width: 100%; height: 50px; background: var(--card); border-bottom: 1px solid var(--brd); display: flex; align-items: center; padding: 0 20px; z-index: 1000; gap: 10px; box-sizing: border-box; }
        
        .rack-box { background: var(--card); border: 1px solid var(--brd); border-radius: 12px; padding: 10px; min-width: 270px; }
        .floor-grid { display: flex; gap: 6px; margin-bottom: 6px; }

        .cell { flex: 1; height: 80px; border: 1px solid var(--brd); border-radius: 10px; background: var(--bg); position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; transition: 0.2s; cursor: grab; }
        .cell.empty { border: 2px dashed var(--brd); opacity: 0.4; font-size: 20px; cursor: pointer; }
        
        .code-label { position: absolute; top: 5px; font-size: 13px; font-weight: 700; color: #8b949e; z-index: 5; }
        .qty-val { font-size: 23px; font-weight: 800; z-index: 5; }
        .qty-val.crit { color: var(--red); } .qty-val.warn { color: var(--gold); } .qty-val.ok { color: var(--green); }

        /* YULDUZCHA HARAKATI 45 GRADUS */
        .comet-45 { position: absolute; width: 100px; height: 1.5px; background: linear-gradient(90deg, #fff, transparent); transform: rotate(-45deg); top: -100px; left: -100px; opacity: 0; z-index: 6; }
        .cell:hover .comet-45 { animation: fly-diag 0.5s ease-out; }
        @keyframes fly-diag { 0% { top: -30px; left: -30px; opacity: 1; } 100% { top: 100px; left: 100px; opacity: 0; } }

        .resin-layer { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
        .glint { position: absolute; width: 200%; height: 100%; background: linear-gradient(110deg, transparent, rgba(255,255,255,0.06), transparent); transform: translateX(-150%); }
        .ripple { position: absolute; top: 50%; left: 50%; width: 2px; height: 2px; background: rgba(255,255,255,0.2); border-radius: 50%; transform: translate(-50%,-50%) scale(0); opacity: 0; }
        .cell:hover .glint { transform: translateX(100%); transition: 0.7s; }
        .cell:hover .ripple { animation: rip 0.6s ease-out forwards; }
        @keyframes rip { 0% { scale: 0; opacity: 0.5; } 100% { scale: 28; opacity: 0; } }

        /* PLUS MINUS VA RADIUSNI SAQLASH */
        .btns { position: absolute; bottom: 0; width: 100%; display: flex; transform: translateY(100%); transition: 0.2s; z-index: 10; }
        .cell:hover .btns { transform: translateY(0); }
        .btns button { flex: 1; border: 0; background: var(--blue); color: #fff; cursor: pointer; height: 24px; font-weight: bold; font-size: 16px; }
        .btn-l { border-bottom-left-radius: 10px !important; border-right: 1px solid rgba(0,0,0,0.1); }
        .btn-r { border-bottom-right-radius: 10px !important; }

        .bell-shake { animation: shk 0.8s infinite; animation-delay: var(--d); transform-origin: top center; }
        @keyframes shk { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(3deg); } 75% { transform: rotate(-3deg); } }

        .found { background: #ffea00 !important; border-color: #000 !important; }
        .found .code-label, .found .qty-val { color: #000 !important; }

        /* MODAL VA BEKOR QILISH */
        #modal { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; z-index: 2000; }
        .m-box { background: var(--card); padding: 25px; border-radius: 12px; width: 260px; text-align: center; border: 1px solid var(--brd); }
        .m-box h4 { margin-top: 0; margin-bottom: 15px; }
        .m-box input { width: 100%; margin-bottom: 12px; padding: 10px; box-sizing: border-box; background: var(--bg); color: var(--txt); border: 1px solid var(--brd); border-radius: 6px; }
    </style>
</head>
<body>
    <div class="header">
        <button onclick="document.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme')=='dark'?'light':'dark')">🌓</button>
        <input type="text" id="srch" placeholder="Qidiruv..." oninput="doSearch(this.value)" style="flex:1; background:var(--bg); border:1px solid var(--brd); color:var(--txt); padding:6px; border-radius:6px; outline:none;">
    </div>
    <div id="wrap">${content}</div>

    <div id="modal">
        <div class="m-box">
            <h4>Yangi Tavar Qo'shish</h4>
            <input id="mCode" placeholder="Tavar kodi">
            <input id="mQty" type="number" value="1">
            <button onclick="save()" style="width:100%; padding:12px; background:var(--green); border:0; color:#fff; border-radius:6px; cursor:pointer; font-weight:bold; margin-bottom:10px;">SAQLASH</button>
            <button onclick="document.getElementById('modal').style.display='none'" style="width:100%; padding:10px; background:none; color:var(--red); border:1px solid var(--red); border-radius:6px; cursor:pointer; font-weight:bold;">BEKOR QILISH</button>
        </div>
    </div>

    <script>
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
            el.classList.add('dragging'); 
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
            if(res.ok) {
                const el = document.getElementById('qv_'+id);
                let v = parseInt(el.innerText) + d;
                el.innerText = v;
                el.className = 'qty-val ' + (v < 5 ? 'crit' : v < 10 ? 'warn' : 'ok');
            }
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

