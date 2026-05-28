const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

const pool = mysql.createPool({
    host: '127.0.0.1', user: 'root', password: '', database: 'ambar',
    enableKeepAlive: true
});

app.use(express.json());

app.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM main_items ORDER BY code");

        let htmlRows = "";
        ['C', 'D', 'E'].forEach(q => {
            htmlRows += `
            <div class="row-block">
                <div class="row-title">Line ${q}</div>
                <div class="stellaj-grid">`;

            [1, 2, 3, 4].forEach(st => {
                htmlRows += `
                <div class="st-card">
                    <div class="st-name">Rack ${st}</div>
                    <div class="grid-layout">
                        <div class="lb"></div><div class="lb">1</div><div class="lb">2</div><div class="lb">3</div><div class="lb">4</div>`;

                [3, 2, 1, 0].forEach(et => {
                    htmlRows += `<div class="lb floor-num">${et}</div>`;
                    for (let us = 1; us <= 4; us++) {
                        const cellItems = rows.filter(r => r.row_char == q && r.row_num == st && r.col_num == et && r.row_num_in_st == us);
                        
                        let textStatus = "txt-empty";
                        let totalCount = 0;
                        
                        if (cellItems.length > 0) {
                            totalCount = cellItems.reduce((sum, item) => sum + parseInt(item.count), 0);
                            
                            if (totalCount <= 3) textStatus = "txt-red";
                            else if (totalCount < 10) textStatus = "txt-black";
                            else if (totalCount <= 15) textStatus = "txt-blue";
                            else textStatus = "txt-green";
                        }

                        const cellId = `cell-${q}-${st}-${et}-${us}`;
                        let itemContent = cellItems.map(itm => `
                            <div class="item-entry ${textStatus}" draggable="true" ondragstart="drag(event)" data-id="${itm.id}" data-code="${itm.code}">
                                <div class="item-code">${itm.code}</div>
                                <div class="item-count">${itm.count} ta</div>
                            </div>
                        `).join('');

                        htmlRows += `
                        <div class="cell" 
                             id="${cellId}" 
                             data-coords='{"q":"${q}","s":${st},"e":${et},"u":${us}}'
                             ondragover="allowDrop(event)" 
                             ondrop="drop(event)">
                            ${itemContent}
                        </div>`;
                    }
                });
                htmlRows += `</div></div>`;
            });
            htmlRows += `</div></div>`;
        });

        res.send(`<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <title>Ambar Dashboard Roboto</title>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
        :root { 
            --ios-bg: #f4f5f7; 
            --ios-blue: #007AFF;
            --ios-red: #FF3B30;
            --ios-green: #28A745;
            --cell-size: 72px;
        }

        body { 
            background-color: var(--ios-bg); 
            /* ROBOTO shrifti */
            font-family: 'Roboto', sans-serif; 
            margin: 0; padding-bottom: 40px; 
        }
        
        .header { 
            position: sticky; top: 0; z-index: 1000; 
            background: #fff; padding: 15px 20px; 
            border-bottom: 1px solid #ddd;
            display: flex; justify-content: space-between; align-items: center;
            box-shadow: 0 1px 5px rgba(0,0,0,0.1);
        }
        .header-title { font-size: 22px; font-weight: 900; color: #333; }
        .search-box { 
            background: #fff; border: 1px solid #ccc; border-radius: 8px; 
            padding: 8px 12px; font-size: 15px; outline: none; width: 200px;
            font-family: inherit;
        }

        .main-content { padding: 15px; }
        .row-block { margin-bottom: 25px; }
        .row-title { font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #222; }

        .stellaj-grid { display: flex; gap: 15px; overflow-x: auto; padding: 5px; }
        .st-card { 
            background: #fff; border-radius: 12px; padding: 12px; 
            flex: 0 0 auto;
            border: 1px solid #eee;
        }
        .st-name { font-size: 13px; font-weight: 700; color: #888; margin-bottom: 10px; text-transform: uppercase; }

        .grid-layout { display: grid; grid-template-columns: 18px repeat(4, var(--cell-size)); gap: 8px; }
        .lb { display: flex; align-items: center; justify-content: center; font-size: 11px; color: #bbb; font-weight: bold; }
        
        /* KATAKLAR VA SIZ SO'RAGAN BOX-SHADOW */
        .cell {
            width: var(--cell-size); height: var(--cell-size); 
            background: #ffffff; border-radius: 8px; 
            border: 1px solid #eee;
            /* BOX SHADOW: 2px 2px 2px #ccc */
            box-shadow: 2px 2px 2px #ccc;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            transition: 0.2s;
        }

        /* YOZUVLARNI KATTALASHTIRISH VA RANGLAR */
        .item-entry { text-align: center; width: 100%; cursor: grab; }
        
        .item-code { 
            font-weight: 700; 
            font-size: 15px; /* Kattaroq yozuv */
            display: block; 
        }
        .item-count { 
            font-size: 13px; /* Kattaroq yozuv */
            font-weight: 900; 
        }

        .txt-red .item-code, .txt-red .item-count { color: var(--ios-red); }
        .txt-black .item-code, .txt-black .item-count { color: #000; }
        .txt-blue .item-code, .txt-blue .item-count { color: var(--ios-blue); }
        .txt-green .item-code, .txt-green .item-count { color: var(--ios-green); }

        /* Qidiruv fokus */
        .highlight {
            border: 2px solid #ffcc00 !important;
            background: #fffde7 !important;
            transform: scale(1.08);
            box-shadow: 3px 3px 5px #aaa !important;
        }

        .item-entry:active { cursor: grabbing; }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-title">AMBAR <span style="color:var(--ios-red)">PRO</span></div>
        <input type="text" id="sInput" class="search-box" placeholder="Kod..." oninput="doSearch()">
    </div>

    <div class="main-content">${htmlRows}</div>

    <script>
        function allowDrop(ev) { ev.preventDefault(); }
        function drag(ev) { 
            const entry = ev.target.closest('.item-entry');
            ev.dataTransfer.setData("itemId", entry.dataset.id); 
        }

        async function drop(ev) {
            ev.preventDefault();
            const itemId = ev.dataTransfer.getData("itemId");
            const targetCell = ev.target.closest('.cell');
            if (itemId && targetCell) {
                const coords = JSON.parse(targetCell.dataset.coords);
                await fetch('/api/move', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ id: itemId, target: coords })
                });
                location.reload();
            }
        }

        function doSearch() {
            const val = document.getElementById('sInput').value.trim().toUpperCase();
            document.querySelectorAll('.cell').forEach(c => c.classList.remove('highlight'));
            if (val.length < 2) return;
            document.querySelectorAll('.item-entry').forEach(item => {
                if (item.dataset.code.toUpperCase().includes(val)) {
                    const cell = item.closest('.cell');
                    cell.classList.add('highlight');
                    cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    </script>
</body>
</html>`);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/move', async (req, res) => {
    const { id, target } = req.body;
    try {
        await pool.execute(
            "UPDATE main_items SET row_char=?, row_num=?, col_num=?, row_num_in_st=? WHERE id=?",
            [target.q, target.s, target.e, target.u, id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(3000, () => console.log('✅ Roboto UI ishga tushdi: http://localhost:3000'));

