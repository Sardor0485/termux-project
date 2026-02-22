const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const app = express();

const dbConfig = {
    host: '127.0.0.1', user: 'root', password: '', database: 'ambar',
    enableKeepAlive: true
};

app.use(bodyParser.json());

app.get('/', async (req, res) => {
    try {
        const pool = mysql.createPool(dbConfig);
        const [rows] = await pool.execute("SELECT * FROM main_items");

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
                        const hasItems = cellItems.length > 0;
                        const cls = hasItems ? 'cell has-item' : 'cell empty';

                        let itemContent = cellItems.map(itm => {
                            let countColor = '#222'; 
                            const c = parseInt(itm.count);
                            if (c <= 5) countColor = '#ff4405'; 
                            else if (c > 20) countColor = '#0ba344'; 
                            else if (c > 10) countColor = '#1a73e8'; 

                            return `
                            <div class="item-entry" draggable="true" ondragstart="drag(event)"
                                 data-id="${itm.id}" data-code="${itm.code}">
                                <div class="item-code">${itm.code}</div>
                                <div class="item-count" style="color: ${countColor}">${itm.count} ta</div>
                            </div>`;
                        }).join('');

                        htmlRows += `
                        <div class="${cls}" id="cell-${q}-${st}-${et}-${us}"
                             data-coords='{"q":"${q}","s":${st},"e":${et},"u":${us}}'
                             ondragover="allowDrop(event)" ondrop="drop(event)"
                             onclick="addItem('${q}',${st},${et},${us})">
                            ${itemContent || '<span class="plus">+</span>'}
                        </div>`;
                    }
                });
                htmlRows += `</div></div>`;
            });
            htmlRows += `</div></div>`;
        });

        res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Ambar Temu Style</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                :root { 
                    --temu-orange: #ff4405; 
                    --temu-bg: #f7f7f7; 
                    --found-yellow: #ffeb3b;
                }
                body { background: var(--temu-bg); font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; color: #222; }
                
                .header { 
                    position: sticky; top: 0; z-index: 1000; 
                    background: white; color: var(--temu-orange); 
                    padding: 8px 20px; display: flex; justify-content: space-between; align-items: center; 
                    border-bottom: 2px solid var(--temu-orange);
                }
                .search-box { 
                    border-radius: 20px; border: 1px solid #ddd; 
                    background: #eee; color: #222; padding: 6px 20px; 
                    width: 300px; outline: none; font-size: 14px;
                }
                .search-box:focus { border-color: var(--temu-orange); background: #fff; }

                .main-content { padding: 15px; }
                .row-block { 
                    background: white; border-radius: 5px; margin-bottom: 15px; 
                    padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                .row-title { font-weight: 900; color: #222; margin-bottom: 10px; font-size: 1.1rem; border-left: 5px solid var(--temu-orange); padding-left: 10px; }
                
                .stellaj-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
                @media (max-width: 1200px) { .stellaj-grid { grid-template-columns: repeat(2, 1fr); } }

                .st-card { background: #fff; border: 1px solid #eee; padding: 8px; border-radius: 5px; }
                .st-name { font-size: 10px; font-weight: bold; text-align: left; color: #999; margin-bottom: 5px; text-transform: uppercase; }
                
                .grid-layout { display: grid; grid-template-columns: 15px repeat(4, 1fr); gap: 4px; }
                .floor-num { color: #ccc; font-weight: bold; font-size: 10px; }

                /* KATAKLAR - BORDER RADIUS 5PX */
                .cell {
                    min-height: 55px; 
                    border: 1px solid #f2f2f2; 
                    border-radius: 5px; 
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    background: #fff; transition: 0.2s; cursor: pointer;
                }
                .cell:hover { border-color: var(--temu-orange); transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                
                .has-item { background: #fff !important; }
                .empty { background: #fafafa; border: 1px dashed #ddd; }
                
                .item-entry { width: 95%; padding: 2px; text-align: center; }
                .item-code { font-weight: 700; font-size: 11px; color: #222; }
                .item-count { font-size: 10px; font-weight: 800; margin-top: 2px; }

                .lb { display: flex; align-items: center; justify-content: center; font-size: 9px; color: #bbb; }
                .plus { color: #eee; font-size: 18px; }

                /* TOPILGAN KATAK - SARIQ */
                .highlight { 
                    background: var(--found-yellow) !important; 
                    border: 2px solid #fbc02d !important; 
                    transform: scale(1.05); 
                    z-index: 10;
                }
                
                .drag-over { background: #fff5f2 !important; border: 2px dashed var(--temu-orange) !important; }
            </style>
        </head>
        <body>
            <div class="header">
                <div style="font-weight:900; font-size:22px; font-style: italic;">TEMU <span style="font-weight:400; font-size:14px; color:#666; font-style: normal;">Warehouse</span></div>
                <input type="text" id="sInput" class="search-box" placeholder="Search items..." onkeyup="search(event)">
            </div>
            
            <div class="main-content">${htmlRows}</div>

            <script>
                function allowDrop(ev) { ev.preventDefault(); ev.currentTarget.classList.add('drag-over'); }
                function drag(ev) { ev.dataTransfer.setData("itemID", ev.target.dataset.id); }

                async function drop(ev) {
                    ev.preventDefault();
                    ev.currentTarget.classList.remove('drag-over');
                    const itemID = ev.dataTransfer.getData("itemID");
                    const targetCoords = JSON.parse(ev.currentTarget.dataset.coords);

                    if (itemID) {
                        const res = await fetch('/api/move', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ id: itemID, target: targetCoords })
                        });
                        if (res.ok) location.reload();
                    }
                }

                async function addItem(q, s, e, u) {
                    if (event.target !== event.currentTarget && !event.target.classList.contains('plus')) return;
                    let code = prompt("Item Code:");
                    if (!code) return;
                    let count = prompt("Quantity:", "1");
                    await fetch('/api/save', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({q, s, e, u, code, count})
                    });
                    location.reload();
                }

                function search(event) {
                    let v = document.getElementById('sInput').value.trim().toUpperCase();
                    document.querySelectorAll('.cell').forEach(c => c.classList.remove('highlight'));
                    if (v.length < 2) return;
                    const items = Array.from(document.querySelectorAll('.item-entry'));
                    const found = items.filter(i => i.dataset.code.toUpperCase().includes(v));
                    if (found.length > 0) {
                        found.forEach(item => item.parentElement.classList.add('highlight'));
                        if(event.key === 'Enter') found[0].parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            </script>
        </body>
        </html>
        `);
    } catch (err) { res.status(500).send(err.message); }
});

// API-lar
app.post('/api/move', async (req, res) => {
    const { id, target } = req.body;
    try {
        const pool = mysql.createPool(dbConfig);
        await pool.execute("UPDATE main_items SET row_char=?, row_num=?, col_num=?, row_num_in_st=? WHERE id=?", [target.q, target.s, target.e, target.u, id]);
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/save', async (req, res) => {
    const {q, s, e, u, code, count} = req.body;
    try {
        const pool = mysql.createPool(dbConfig);
        await pool.execute("INSERT INTO main_items (code, count, row_char, row_num, col_num, row_num_in_st) VALUES (?, ?, ?, ?, ?, ?)", [code, count, q, s, e, u]);
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(3000, '0.0.0.0');

