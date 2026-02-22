// server.js
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

/* ================== MAIN PAGE ================== */
app.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM main_items ORDER BY code");

        let htmlRows = "";

        ['C','D','E'].forEach(q=>{
            htmlRows += `<div class="row-block"><div class="row-title">Line ${q}</div><div class="stellaj-grid">`;

            [1,2,3,4].forEach(st=>{
                htmlRows += `<div class="st-card"><div class="st-name">Rack ${st}</div><div class="grid-layout">
                <div class="lb"></div><div class="lb">1</div><div class="lb">2</div><div class="lb">3</div><div class="lb">4</div>`;

                [3,2,1,0].forEach(et=>{
                    htmlRows += `<div class="lb floor-num">${et}</div>`;
                    for(let us=1;us<=4;us++){
                        const cellItems = rows.filter(r=>r.row_char==q && r.row_num==st && r.col_num==et && r.row_num_in_st==us);
                        let itemContent = cellItems.map(itm=>{
                            let count=parseInt(itm.count);
                            let textStatus="";
                            if(count<=3) textStatus="txt-red";
                            else if(count<10) textStatus="txt-black";
                            else if(count<=15) textStatus="txt-blue";
                            else textStatus="txt-green";

                            return `<div class="item-entry ${textStatus}" draggable="true" ondragstart="drag(event)" data-id="${itm.id}" data-code="${itm.code}" onclick="toggleControls(this)">
                                <div class="item-code">${itm.code}</div>
                                <div class="item-count">${count}</div>
                                <div class="counter-box">
                                    <button onmousedown="startHold(${itm.id}, -1, event)" onmouseup="stopHold(${itm.id})" onmouseleave="stopHold(${itm.id})">−</button>
                                    <button onmousedown="startHold(${itm.id}, 1, event)" onmouseup="stopHold(${itm.id})" onmouseleave="stopHold(${itm.id})">+</button>
                                </div>
                            </div>`;
                        }).join('');

                        htmlRows += `<div class="cell" data-coords='{"q":"${q}","s":${st},"e":${et},"u":${us}}' ondragover="allowDrop(event)" ondrop="drop(event)">
                            ${itemContent || `<div class="add-btn" onclick="openAddModal(this)">+</div>`}
                        </div>`;
                    }
                });

                htmlRows += `</div></div>`;
            });

            htmlRows += `</div></div>`;
        });

        res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ambar PRO</title>
<style>
body { background:#f4f5f7; font-family:Arial; margin:0; padding:15px; }
.row-title { font-size:22px; font-weight:bold; margin:15px 0; }
.stellaj-grid { display:flex; gap:15px; overflow-x:auto; }
.st-card { background:#fff; padding:10px; border-radius:12px; }
.grid-layout { display:grid; grid-template-columns:18px repeat(4,85px); gap:10px; }
.lb { font-size:12px; text-align:center; }
.cell { width:85px; height:85px; border:1px solid #ddd; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-direction:column; transition:0.2s; background:white; position:relative; }
.item-entry { width:100%; text-align:center; cursor:pointer; position:relative; }
.item-code { font-size:18px; font-weight:900; }
.item-count { font-size:22px; font-weight:900; }
.txt-red .item-code, .txt-red .item-count { color:red; }
.txt-black .item-code, .txt-black .item-count { color:black; }
.txt-blue .item-code, .txt-blue .item-count { color:#007AFF; }
.txt-green .item-code, .txt-green .item-count { color:green; }
.counter-box { display:flex; justify-content:center; gap:8px; margin-top:6px; opacity:0; transform:translateY(5px); transition:0.2s ease; pointer-events:none; }
.item-entry.active .counter-box { opacity:1; transform:translateY(0); pointer-events:auto; }
.counter-box button { width:30px; height:30px; border:none; border-radius:8px; background:#007AFF; color:white; font-size:20px; font-weight:bold; cursor:pointer; }
.counter-box button:active { transform:scale(0.85); }
.pop { animation:popAnim 0.2s ease; }
@keyframes popAnim { 0%{transform:scale(1);} 50%{transform:scale(1.4);} 100%{transform:scale(1);} }
/* ADD + BUTTON */
.add-btn { font-size:28px; font-weight:bold; color:#007AFF; cursor:pointer; opacity:0; transition:0.2s; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);}
.cell:hover .add-btn { opacity:1; }
/* MODAL */
#addModal{position:fixed; inset:0; background:rgba(0,0,0,.4); display:none; align-items:center; justify-content:center;}
#addModal div{background:white;padding:20px;width:300px;border-radius:12px;}
#addModal input{width:100%;padding:8px;margin-bottom:10px;font-size:16px;}
#addModal button{width:100%;padding:8px;background:#007AFF;color:white;border:none;border-radius:8px;}
/* SEARCH */
#sInput { width:95%; padding:10px; font-size:18px; margin-bottom:15px; border-radius:8px; border:1px solid #ccc;}
.highlight { background:#fffde7 !important; transition:0.3s; }
</style>
</head>
<body>

<input type="text" id="sInput" placeholder="Kod bo'yicha qidiring..." oninput="doSearch()">

${htmlRows}

<!-- ADD MODAL -->
<div id="addModal">
  <div>
    <input id="searchInput" placeholder="Code yozing...">
    <button onclick="confirmAdd()">Qo'shish</button>
  </div>
</div>

<script>
let intervalMap={};
function allowDrop(ev){ev.preventDefault();}
function drag(ev){ const entry = ev.target.closest('.item-entry'); ev.dataTransfer.setData("itemId", entry.dataset.id);}
async function drop(ev){
  ev.preventDefault();
  const itemId = ev.dataTransfer.getData("itemId");
  const targetCell = ev.target.closest('.cell');
  if(itemId && targetCell){
      const coords = JSON.parse(targetCell.dataset.coords);
      const res = await fetch('/api/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ id:itemId, target:coords })});
      if(res.ok){ targetCell.style.background="#fffde7"; setTimeout(()=>targetCell.style.background="white",400);}
  }
}
function toggleControls(el){
    document.querySelectorAll('.item-entry').forEach(i=>{ if(i!==el)i.classList.remove('active'); });
    el.classList.toggle('active');
}
async function updateServer(id,newValue){
    return await fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,count:newValue})});
}
function getColorClass(count){
    if(count<=3)return "txt-red";
    if(count<10)return "txt-black";
    if(count<=15)return "txt-blue";
    return "txt-green";
}
async function changeCount(id,delta){
    const itemEl=document.querySelector('[data-id="'+id+'"]');
    if(!itemEl) return;
    const countEl=itemEl.querySelector('.item-count');
    let current=parseInt(countEl.innerText);
    let newValue=current+delta;
    if(newValue<0)newValue=0;
    const res=await updateServer(id,newValue);
    if(res.ok){
        if(newValue===0){ itemEl.style.transform="scale(0)"; setTimeout(()=>itemEl.remove(),200); return;}
        countEl.innerText=newValue;
        itemEl.classList.remove("txt-red","txt-black","txt-blue","txt-green");
        itemEl.classList.add(getColorClass(newValue));
        countEl.classList.add("pop"); setTimeout(()=>countEl.classList.remove("pop"),200);
    }
}
function startHold(id,delta,e){ e.stopPropagation(); changeCount(id,delta); intervalMap[id]=setInterval(()=>changeCount(id,delta),150);}
function stopHold(id){ clearInterval(intervalMap[id]); }

/* ADD MODAL */
let selectedCoords=null;
function openAddModal(btn){
  const cell = btn.closest('.cell');
  selectedCoords = JSON.parse(cell.dataset.coords);
  document.getElementById("addModal").style.display="flex";
}
async function confirmAdd(){
  const code = document.getElementById("searchInput").value.trim();
  if(!code) return;
  const res = await fetch('/api/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ code:code, target:selectedCoords })});
  if(res.ok){ location.reload(); }
}

/* ===== SEARCH ===== */
function doSearch(){
    const val = document.getElementById('sInput').value.trim().toUpperCase();
    if(!val) return document.querySelectorAll('.cell').forEach(c=>c.classList.remove('highlight'));
    document.querySelectorAll('.cell').forEach(c=>c.classList.remove('highlight'));
    const searchVal = val.replace(/^C/,'').replace(/^D/,'').replace(/^E/,''); // CDE bo'lsa olib tashlaymiz
    document.querySelectorAll('.item-entry').forEach(item=>{
        if(item.dataset.code.toUpperCase().includes(searchVal)){
            const cell = item.closest('.cell');
            cell.classList.add('highlight');
            cell.scrollIntoView({behavior:'smooth',block:'center'});
        }
    });
}
</script>

</body>
</html>`);

    }catch(err){
        res.status(500).send(err.message);
    }
});

/* ================== APIs ================== */
app.post('/api/move', async (req,res)=>{
    const {id,target}=req.body;
    try{
        await pool.execute("UPDATE main_items SET row_char=?,row_num=?,col_num=?,row_num_in_st=? WHERE id=?",
        [target.q,target.s,target.e,target.u,id]);
        res.json({success:true});
    }catch(err){ res.status(500).send(err.message); }
});

app.post('/api/update', async (req,res)=>{
    const {id,count}=req.body;
    try{
        await pool.execute("UPDATE main_items SET count=? WHERE id=?",[count,id]);
        res.json({success:true});
    }catch(err){ res.status(500).send(err.message); }
});

app.post('/api/add', async (req,res)=>{
    const {code,target}=req.body;
    try{
        await pool.execute(
            "INSERT INTO main_items (code,row_char,row_num,col_num,row_num_in_st,count) VALUES (?,?,?,?,?,1)",
            [code,target.q,target.s,target.e,target.u]
        );
        res.json({success:true});
    }catch(err){ res.status(500).send(err.message); }
});

app.listen(3000,()=>console.log("✅ Ambar PRO Telegram Web App tayyor: http://localhost:3000"));
