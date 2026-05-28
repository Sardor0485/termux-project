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

    const level = Math.min((itm.count / 50) * 100, 100);
    const hue = Math.min(itm.count * 5, 120);
    const qtyColor = `hsl(${hue}, 70%, 45%)`;
    
    return `
        <div class="cell item" id="it_${itm.id}"
             draggable="true" ondragstart="handleDrag(event, this)"
             ${pos} ondragover="allowDrop(event)" ondrop="handleDrop(event, this)" 
             data-code="${itm.code}"
             onmouseenter="handleSlosh(event, this)">

            <div class="water-container">
                <div class="glass-water" style="height: ${level}%"></div>
            </div>

            <div class="code-label">${itm.code}</div>
            
            <div class="qty-wrapper">
                <div class="qty-val" id="qv_${itm.id}" style="color: ${qtyColor}">${itm.count}</div>
            </div>

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
            content += `<div class="row-sect" id="sect_${q}"><h2>QATOR ${q}</h2><div class="racks-container">`;
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
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <style>
        :root {
            --bg: #0d0d0d; --card: #181818; --brd: #2a2a2a; --txt: #fff;
            --water-seriy: rgba(128, 128, 128, 0.45);
        }

        body { background: var(--bg); color: var(--txt); font-family: sans-serif; margin: 0; padding-top: 60px; scroll-behavior: smooth; }
        .racks-container { display: flex; gap: 15px; padding: 20px; overflow-x: auto; }
        .rack-box { background: var(--card); border: 1px solid var(--brd); border-radius: 12px; padding: 12px; min-width: 280px; }
        .floor-grid { display: flex; gap: 8px; margin-bottom: 8px; }

        .cell {
            flex: 1; height: 100px; border: 1.5px solid var(--brd); border-radius: 8px;
            position: relative; display: flex; align-items: center; justify-content: center; 
            overflow: hidden; background: transparent; transition: border-color 0.3s;
        }

        /* SUV FIZIKASI: TAGI MUSTAHKAMLANGAN */
        .water-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; pointer-events: none; }
        
        .glass-water { 
            position: absolute; 
            bottom: -30px; /* Tagidagi bo'shliqni butunlay yopish uchun zaxira */
            left: -50%; 
            width: 200%; 
            background: var(--water-seriy); 
            transition: height 0.6s ease;
            transform-origin: bottom center; /* Faqat pastdan yuqoriga o'sadi */
            padding-bottom: 30px; /* Tagini "cho'ziluvchan" qiladi */
        }

        /* ANIMATSIYA: SKEW VA SCALE KOMBINATSIYASI */
        .slosh-left { animation: slosh-L 4s ease-out; }
        .slosh-right { animation: slosh-R 4s ease-out; }

        @keyframes slosh-L {
            0% { transform: skewY(0deg) scale(1); }
            15% { transform: skewY(15deg) scale(1.1); }
            30% { transform: skewY(-10deg) scale(1.05); }
            50% { transform: skewY(5deg) scale(1.02); }
            100% { transform: skewY(0deg) scale(1); }
        }

        @keyframes slosh-R {
            0% { transform: skewY(0deg) scale(1); }
            15% { transform: skewY(-15deg) scale(1.1); }
            30% { transform: skewY(10deg) scale(1.05); }
            50% { transform: skewY(-5deg) scale(1.02); }
            100% { transform: skewY(0deg) scale(1); }
        }

        /* QIDIRUVDA TOPILGAN ELEMENT STILI */
        .found { border-color: #ffcc00 !important; box-shadow: 0 0 15px rgba(255, 204, 0, 0.4); z-index: 10; }

        .qty-val { font-size: 34px; font-weight: 900; z-index: 5; position: relative; }
        .code-label { position: absolute; top: 5px; font-size: 11px; color: #aaa; z-index: 5; }
        .btns { position: absolute; bottom: 4px; right: 4px; display: flex; gap: 3px; opacity: 0; transition: 0.2s; z-index: 10; }
        .cell:hover .btns { opacity: 1; }
        .btn-sm { background: #333; color: #fff; border: 0; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; }

        .header { position: fixed; top: 0; width: 100%; height: 50px; background: #181818; border-bottom: 1px solid var(--brd); display: flex; align-items: center; padding: 0 20px; z-index: 1000; box-sizing: border-box; }
        #srch { flex: 1; background: #000; border: 1px solid var(--brd); color: #fff; padding: 8px 15px; border-radius: 20px; margin: 0 20px; outline: none; }
        #modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:2000; align-items:center; justify-content:center; }
        .m-box { background:var(--card); padding:20px; border-radius:12px; width:260px; }
    </style>
</head>
<body>
    <div class="header">
        <button onclick="location.reload()" style="background:none; border:none; color:white; font-size:20px; cursor:pointer;">🔄</button>
        <input type="text" id="srch" placeholder="Artikulni qidiring..." oninput="doSearch(this.value)">
    </div>

    <div id="wrap">${content}</div>

    <div id="modal">
        <div class="m-box">
            <input type="text" id="newCode" placeholder="Kod" style="width:100%; padding:8px; margin-bottom:10px;">
            <input type="number" id="newCount" value="1" style="width:100%; padding:8px; margin-bottom:10px;">
            <button onclick="saveItem()" style="width:100%; padding:10px; background:green; color:white; border:none; border-radius:5px;">SAQLASH</button>
        </div>
    </div>

    <script>
        // QIDIRUV VA AUTO-SCROLL
        function doSearch(v) {
            const items = document.querySelectorAll('.item');
            items.forEach(it => it.classList.remove('found'));
            
            if(!v) return;

            let firstFound = null;
            items.forEach(it => {
                if(it.dataset.code.toLowerCase().includes(v.toLowerCase())) {
                    it.classList.add('found');
                    if(!firstFound) firstFound = it;
                }
            });

            // Agar natija bo'lsa, o'shanga skroll qilish
            if(firstFound) {
                firstFound.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        }

        // SUVNING CHAYQALISHI
        function handleSlosh(e, cell) {
            const water = cell.querySelector('.glass-water');
            const rect = cell.getBoundingClientRect();
            const x = e.clientX - rect.left;
            
            water.classList.remove('slosh-left', 'slosh-right');
            void water.offsetWidth; 
            
            if (x < rect.width / 2) {
                water.classList.add('slosh-left');
            } else {
                water.classList.add('slosh-right');
            }
        }

        async function changeQty(id, d, e) {
            e.stopPropagation();
            const el = document.getElementById('qv_'+id);
            const water = el.closest('.item').querySelector('.glass-water');
            let val = parseInt(el.innerText) + d;
            if(val < 0) val = 0;
            el.innerText = val;
            water.style.height = Math.min((val / 50) * 100, 100) + '%';
            fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, d}) });
        }

        function openModal(q, st, et, us) { window.currentPos = { q, st, et, us }; document.getElementById('modal').style.display = 'flex'; }
        async function saveItem() {
            const code = document.getElementById('newCode').value;
            const count = document.getElementById('newCount').value;
            await fetch('/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code, count, ...window.currentPos}) });
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

// ... Express POST yo'nalishlari (o'zgarishsiz)
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

app.listen(3000, () => console.log('Ambar Fix: http://localhost:3000'));

