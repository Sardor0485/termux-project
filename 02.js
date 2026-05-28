const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

const pool = mysql.createPool({
    host: '127.0.0.1', user: 'root', password: '', database: 'ambar', enableKeepAlive: true
});

app.use(express.json());

function renderCell(itm, q, st, et, us) {
    if (!itm) {
        return `
            <div class="inventory-item empty-cell" 
                 onclick="openAddModal('${q}', ${st}, ${et}, ${us})"
                 ondragover="allowDrop(event)" 
                 ondrop="drop(event, '${q}', ${st}, ${et}, ${us})">
                <div class="item-content"><div class="add-icon">+</div></div>
            </div>`;
    }

    const isDanger = itm.count < 5;
    const isWarning = itm.count < 10 && itm.count >= 5;
    const status = isDanger ? 'danger' : isWarning ? 'warning' : 'ok';
    
    // Har bir katak uchun alohida random vaqt (vibratsiya sinxron bo'lib qolmasligi uchun)
    const rDelay = (Math.random() * 0.7).toFixed(2) + "s";
    const vibrateClass = (isDanger || isWarning) ? 'vibrate-random' : '';

    return `
        <div class="inventory-item ${vibrateClass}" 
             style="--v-delay: ${rDelay}"
             data-code="${itm.code}" id="item_${itm.id}" 
             draggable="true" ondragstart="drag(event, ${itm.id})"
             onclick="toggleActive(this, event)">
            <div class="item-content">
                <div class="star-comet"></div>
                <div class="hover-blick"></div>
                <div class="item-code-box">${itm.code}</div>
                <div class="item-qty qty-${status}" id="qty_val_${itm.id}">${itm.count}</div>
            </div>
            <div class="controls">
                <button class="minus" onclick="updateStock(${itm.id},-1,event)">−</button>
                <button class="plus" onclick="updateStock(${itm.id},1,event)">+</button>
            </div>
        </div>`;
}

app.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM main_items");
        let html = "";
        ['C','D','E'].forEach(q => {
            html += `<div class="row-section"><div class="row-title">QATOR ${q}</div><div class="racks-container">`;
            [1,2,3,4].forEach(st => {
                const rackName = q + st; 
                html += `<div class="rack"><div class="rack-header">${rackName}</div>`;
                [3, 2, 1, 0].forEach(et => {
                    html += `<div class="shelf-line">
                        <div class="shelf-label">${et}</div>
                        <div class="shelf-grid">`;
                    for(let us=1; us<=4; us++){
                        const item = rows.find(r => r.row_char==q && r.row_num==st && r.col_num==et && r.row_num_in_st==us);
                        html += renderCell(item, q, st, et, us);
                    }
                    html += `</div></div>`;
                });
                html += `</div>`;
            });
            html += `</div></div>`;
        });

        res.send(`
<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <style>
        :root {
            --bg: #0b0e14; --card: #161b22; --border: #30363d;
            --text-dim: rgba(240, 246, 252, 0.4); --text-main: rgba(240, 246, 252, 0.9);
            --blue: #58a6ff; --orange: #ff8c00; --red: #ff4444; --green: #3fb950;
        }

        ::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; box-sizing: border-box; }
        body { background: var(--bg); color: var(--text-dim); font-family: 'Segoe UI', sans-serif; margin: 0; padding-top: 100px; overflow-x: hidden; }
        
        .header { position: fixed; top: 0; width: 100%; height: 80px; background: rgba(11, 14, 20, 0.98); border-bottom: 1px solid var(--border); z-index: 2000; padding: 0 20px; display: flex; align-items: center; }
        #sInp { flex: 1; padding: 15px 30px; border-radius: 30px; background: #000; color: #fff; border: 2px solid var(--border); outline: none; font-size: 18px; transition: 0.3s; }
        #sInp:focus { border-color: var(--blue); box-shadow: 0 0 15px rgba(88, 166, 255, 0.2); }

        .racks-container { display: flex; gap: 25px; padding: 20px; overflow-x: auto; }
        .rack { background: var(--card); border-radius: 12px; padding: 15px; min-width: 380px; border: 1px solid var(--border); }
        .rack-header { text-align: center; color: var(--blue); margin-bottom: 12px; font-weight: 900; letter-spacing: 2px; }
        
        .shelf-line { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
        .shelf-label { font-size: 18px; font-weight: bold; color: var(--border); width: 25px; text-align: center; }
        .shelf-grid { display: flex; gap: 10px; flex: 1; }

        .inventory-item { flex: 1; min-width: 75px; position: relative; cursor: pointer; transition: 0.3s; }
        .item-content { height: 100px; border: 1px solid var(--border); border-radius: 10px; background: #0d1117; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden; }
        
        .item-code-box { font-size: 11px; color: var(--text-dim); position: absolute; top: 8px; font-weight: 600; text-transform: uppercase; }
        .item-qty { font-size: 32px; font-weight: 900; margin-top: 12px; }

        /* Vibratsiya Animatsiyasi */
        .vibrate-random { animation: vib 0.5s infinite alternate var(--v-delay); }
        @keyframes vib {
            0% { transform: translate(0,0) rotate(0deg); }
            25% { transform: translate(1px, -1px) rotate(0.5deg); }
            50% { transform: translate(-1px, 1px) rotate(-0.5deg); }
            100% { transform: translate(1px, 1px) rotate(0deg); }
        }

        /* Effektlar */
        .star-comet { position: absolute; top: -100%; left: -100%; width: 200%; height: 2px; background: linear-gradient(90deg, transparent, #fff, transparent); transform: rotate(45deg); opacity: 0; }
        .inventory-item:hover .star-comet { animation: fly 0.4s linear forwards; }
        @keyframes fly { 0% { top: -100%; left: -100%; opacity: 1; } 100% { top: 100%; left: 100%; opacity: 0; } }

        .hover-blick { position: absolute; top: 100%; left: 100%; width: 200%; height: 100%; background: linear-gradient(45deg, transparent, rgba(255,255,255,0.08), transparent); opacity: 0; }
        .inventory-item:hover .hover-blick { animation: blick 0.4s linear forwards; }
        @keyframes blick { 0% { top: 100%; left: 100%; opacity: 1; } 100% { top: -100%; left: -100%; opacity: 0; } }

        /* Qidiruvda topilgan katak stili */
        .search-found .item-content { 
            background: #fff !important; border-color: var(--blue) !important;
            transform: scale(1.05); box-shadow: 0 0 25px rgba(255,255,255,0.3);
        }
        .search-found .item-qty, .search-found .item-code-box { color: #000 !important; }

        .qty-ok { color: var(--green); } 
        .qty-warning { color: var(--orange); } 
        .qty-danger { color: var(--red); }

        .row-title { font-size: 26px; font-weight: 900; margin: 40px 20px 10px; color: var(--text-main); border-left: 5px solid var(--blue); padding-left: 15px; }

        .controls { display: none; position: absolute; bottom: -40px; width: 100%; gap: 5px; z-index: 100; }
        .inventory-item.active .controls { display: flex; }
        .controls button { flex: 1; height: 35px; border: 0; border-radius: 6px; background: var(--card); border: 1px solid var(--border); color: #fff; font-size: 20px; cursor: pointer; }
    </style>
</head>
<body onclick="closeAllActive(event)">
    <div class="header">
        <input type="text" id="sInp" placeholder="Tavar kodini yozing..." oninput="handleSearch()">
    </div>
    <div id="mainContent">${html}</div>

    <script>
        function handleSearch() {
            const val = document.getElementById('sInp').value.toUpperCase();
            // Eski natijalarni tozalash
            document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('search-found'));
            
            if(!val) return;

            let found = false;
            document.querySelectorAll('.inventory-item').forEach(i => {
                if(i.dataset.code && i.dataset.code.includes(val)) {
                    i.classList.add('search-found');
                    if(!found) {
                        // Birinchi topilgan elementga autoscroll
                        i.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                        found = true;
                    }
                }
            });
        }

        // Drag & Drop va boshqa funksiyalar (updateStock, toggleActive va h.k.) qoladi...
        function drag(ev, id) { ev.dataTransfer.setData("text", id); }
        async function drop(ev, q, st, et, us) {
            ev.preventDefault();
            const id = ev.dataTransfer.getData("text");
            await fetch('/move', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id, q, st, et, us }) });
            window.location.reload();
        }
        function allowDrop(ev) { ev.preventDefault(); }
        function closeAllActive(e) { if (!e.target.closest('.inventory-item')) document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active')); }
        function toggleActive(el, e) { e.stopPropagation(); document.querySelectorAll('.inventory-item').forEach(i => i.classList.remove('active')); el.classList.add('active'); }
        async function updateStock(id, delta, e) {
            e.stopPropagation();
            const res = await fetch('/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, delta}) });
            if(res.ok) {
                const span = document.getElementById('qty_val_' + id);
                let current = parseInt(span.innerText);
                if(current + delta <= 0) window.location.reload();
                else span.innerText = current + delta;
            }
        }
    </script>
</body>
</html>`);
    } catch(err) { res.status(500).send(err.message); }
});

// Move, Add, Update API... (avvalgi kod bilan bir xil)
app.post('/move', async (req, res) => {
    const { id, q, st, et, us } = req.body;
    await pool.execute("UPDATE main_items SET row_char=?, row_num=?, col_num=?, row_num_in_st=? WHERE id=?", [q, st, et, us, id]);
    res.json({ ok: true });
});
app.post('/update', async (req,res) => {
    const {id, delta} = req.body;
    const [rows] = await pool.execute("SELECT count FROM main_items WHERE id=?", [id]);
    if(rows.length === 0) return res.json({ok: false});
    let n = rows[0].count + delta;
    if(n <= 0) await pool.execute("DELETE FROM main_items WHERE id=?", [id]);
    else await pool.execute("UPDATE main_items SET count=? WHERE id=?", [n, id]);
    res.json({ok: true});
});

app.listen(3000, () => console.log('3000-portda tayyor!'));

