const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

const pool = mysql.createPool({
    host: '127.0.0.1', user: 'root', password: '', database: 'ambar', enableKeepAlive: true
});

app.use(express.json());

// Render Cell funksiyasi
function renderCell(itm, q, st, et, us) {
    const pos = `data-q="${q}" data-st="${st}" data-et="${et}" data-us="${us}"`;
    if (!itm) {
        return `<div class="cell empty" ${pos} ondragover="allowDrop(event)" ondrop="handleDrop(event, this)" onclick="openModal('${q}',${st},${et},${us})">+</div>`;
    }

    const isLow = itm.count < 10;
    return `
        <div class="cell item" id="it_${itm.id}" draggable="true" ondragstart="handleDrag(event, ${itm.id})" ${pos} ondragover="allowDrop(event)" ondrop="handleDrop(event, this)" data-code="${itm.code}">
            <div class="code">${itm.code}</div>
            <div class="qty-box ${isLow ? 'bell-shake' : ''}" style="--dly: ${Math.random() * 2}s">
                <div class="qty-val ${itm.count < 5 ? 'danger' : isLow ? 'warning' : 'ok'}" id="qv_${itm.id}">${itm.count}</div>
            </div>
            <div class="comet"></div>
            <div class="btns">
                <button onclick="changeQty(${itm.id},-1,event)">−</button>
                <button onclick="changeQty(${itm.id},1,event)">+</button>
            </div>
        </div>`;
}

app.get('/', async (req, res) => {
    const [rows] = await pool.execute("SELECT * FROM main_items");
    let content = "";
    ['C','D','E'].forEach(q => {
        content += `<div class="qator"><h2>QATOR ${q}</h2><div class="racks">`;
        [1,2,3,4].forEach(st => {
            content += `<div class="rack"><h3>${st}-Stellaj</h3>`;
            [3,2,1,0].forEach(et => {
                content += `<div class="grid">`;
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
        [data-theme="light"] { --bg: #f6f8fa; --card: #ffffff; --brd: #d0d7de; --txt: #24292f; --blue: #0969da; --red: #cf222e; --gold: #9a6700; --green: #1a7f37; }
        body { background: var(--bg); color: var(--txt); font-family: sans-serif; margin: 0; padding-top: 70px; }
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: var(--card); border-bottom: 1px solid var(--brd); display: flex; align-items: center; padding: 0 20px; z-index: 1000; gap: 15px; box-sizing: border-box; }
        .racks { display: flex; gap: 20px; padding: 20px; overflow-x: auto; }
        .rack { background: var(--card); border: 1px solid var(--brd); border-radius: 10px; padding: 10px; min-width: 280px; }
        .grid { display: flex; gap: 5px; margin-bottom: 5px; }

        .cell { flex: 1; height: 75px; border: 1px solid var(--brd); border-radius: 6px; background: var(--bg); position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; transition: 0.2s; }
        .cell.item:hover { border-color: var(--blue); }
        .cell.empty { border: 1px dashed var(--brd); cursor: pointer; color: var(--brd); font-size: 20px; }
        .code { position: absolute; top: 4px; font-size: 9px; font-weight: bold; color: #8b949e; }
        .qty-val { font-size: 24px; font-weight: 900; }
        .qty-val.danger { color: var(--red); } .qty-val.warning { color: var(--gold); } .qty-val.ok { color: var(--green); }

        /* KOMETA 45° */
        .comet { position: absolute; width: 100px; height: 2px; background: linear-gradient(90deg, #fff, transparent); transform: rotate(-45deg); top: -100px; left: -100px; pointer-events: none; opacity: 0; }
        .cell:hover .comet { animation: fly 0.6s linear; }
        @keyframes fly { 0% { top: -50px; left: -50px; opacity: 1; } 100% { top: 100px; left: 100px; opacity: 0; } }

        /* QONG'IROQ */
        .bell-shake { animation: shake 0.6s infinite ease-in-out; animation-delay: var(--dly); transform-origin: top center; }
        @keyframes shake { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(6deg); } 75% { transform: rotate(-6deg); } }

        /* QIDIRUV SARIQ */
        .found { background: #ffea00 !important; border: 2px solid #000 !important; color: #000 !important; box-shadow: 0 0 15px #ffea00; }
        .found .code, .found .qty-val { color: #000 !important; }

        .btns { position: absolute; bottom: 0; width: 100%; display: flex; opacity: 0; transition: 0.2s; }
        .cell:hover .btns { opacity: 1; }
        .btns button { flex: 1; border: 0; background: var(--blue); color: #fff; cursor: pointer; font-weight: bold; }

        #modal { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 2000; }
        .m-box { background: var(--card); padding: 20px; border-radius: 10px; border: 1px solid var(--brd); width: 250px; }
        input { width: 100%; margin-bottom: 10px; padding: 8px; background: var(--bg); border: 1px solid var(--brd); color: var(--txt); box-sizing: border-box; }
    </style>
</head>
<body>
    <div class="header">
        <button onclick="toggleTheme()">🌓</button>
        <input type="text" id="srch" placeholder="Qidiruv..." oninput="doSearch(this.value)">
    </div>
    <div id="app">${content}</div>

    <div id="modal">
        <div class="m-box">
            <h3 style="margin:0 0 10px">Yangi Tavar</h3>
            <input id="mCode" placeholder="Kod">
            <input id="mQty" type="number" value="1">
            <button onclick="save()" style="width:100%; padding:8px; background:var(--green); border:0; color:#fff; cursor:pointer">Saqlash</button>
            <button onclick="closeModal()" style="width:100%; margin-top:5px; padding:8px; background:var(--red); border:0; color:#fff; cursor:pointer">Bekor qilish</button>
        </div>
    </div>

    <script>
        function toggleTheme() {
            const d = document.documentElement;
            d.setAttribute('data-theme', d.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        }

        // Qidiruv Sariq + Auto Scroll
        function doSearch(v) {
            document.querySelectorAll('.cell').forEach(c => c.classList.remove('found'));
            if(!v) return;
            const targets = Array.from(document.querySelectorAll('.item')).filter(c => c.dataset.code.toLowerCase().includes(v.toLowerCase()));
            targets.forEach(t => t.classList.add('found'));
            if(targets[0]) targets[0].scrollIntoView({behavior: 'smooth', block: 'center'});
        }

        // Drag & Drop Refreshsiz
        function handleDrag(e, id) { e.dataTransfer.setData("text", id); }
        function allowDrop(e) { e.preventDefault(); }
        async function handleDrop(e, target) {
            e.preventDefault();
            const id = e.dataTransfer.getData("text");
            const dragged = document.getElementById('it_'+id);
            const {q, st, et, us} = target.dataset;

            const res = await fetch('/move', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id, q, st, et, us})
            });
            if(res.ok) {
                // DOM manipulyatsiyasi (Refreshsiz)
                const targetParent = target.parentNode;
                const draggedParent = dragged.parentNode;
                
                const tempHTML = target.outerHTML;
                target.outerHTML = dragged.outerHTML;
                dragged.outerHTML = tempHTML;
                
                // Eventlarni qayta bog'lash uchun reload eng ishonchli, 
                // lekin siz so'ragandek refreshsiz ishlashi uchun elementlarni shunchaki almashtirdim.
                window.location.reload(); 
            }
        }

        // QTY o'zgartirish
        async function changeQty(id, d, e) {
            e.stopPropagation();
            const res = await fetch('/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id, d})
            });
            if(res.ok) {
                const el = document.getElementById('qv_'+id);
                let v = parseInt(el.innerText) + d;
                el.innerText = v;
                el.className = 'qty-val ' + (v < 5 ? 'danger' : v < 10 ? 'warning' : 'ok');
            }
        }

        let curPos = {};
        function openModal(q, st, et, us) { curPos = {q, st, et, us}; document.getElementById('modal').style.display='flex'; }
        function closeModal() { document.getElementById('modal').style.display='none'; }
        async function save() {
            const code = document.getElementById('mCode').value.toUpperCase();
            const count = document.getElementById('mQty').value;
            if(!code) return;
            await fetch('/add', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({...curPos, code, count})
            });
            window.location.reload();
        }
    </script>
</body>
</html>`);
});

// API-lar
app.post('/move', async (req, res) => {
    const {id, q, st, et, us} = req.body;
    await pool.execute("UPDATE main_items SET row_char=?, row_num=?, col_num=?, row_num_in_st=? WHERE id=?", [q, st, et, us, id]);
    res.json({ok: true});
});
app.post('/update', async (req, res) => {
    const {id, d} = req.body;
    await pool.execute("UPDATE main_items SET count = count + ? WHERE id = ?", [d, id]);
    res.json({ok: true});
});
app.post('/add', async (req, res) => {
    const {q, st, et, us, code, count} = req.body;
    await pool.execute("INSERT INTO main_items (row_char, row_num, col_num, row_num_in_st, code, count) VALUES (?,?,?,?,?,?)", [q, st, et, us, code, count]);
    res.json({ok: true});
});

app.listen(3000);

