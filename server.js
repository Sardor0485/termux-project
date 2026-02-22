require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const mysql = require('mysql2/promise');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const Jimp = require('jimp');
const ner = require('./ner');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
if(!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.set('view engine','ejs');
app.set('views', path.join(__dirname,'views'));
app.use('/public', express.static(path.join(__dirname,'public')));
app.use('/uploads', express.static(path.join(__dirname, UPLOAD_DIR)));
app.use(bodyParser.urlencoded({ extended:true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'sklad',
  waitForConnections: true,
  connectionLimit: 10
});

// multer setup
const storage = multer.diskStorage({
  destination: function(req, file, cb){ cb(null, UPLOAD_DIR); },
  filename: function(req, file, cb){ cb(null, Date.now() + '_' + file.originalname.replace(/\s+/g,'_')); }
});
const upload = multer({ storage });

// helpers
async function query(sql, params){ const [rows] = await pool.query(sql, params); return rows; }

// DASHBOARD
app.get(['/', '/dashboard'], async (req, res) => {
  try {
    const totalProductsRow = await query('SELECT COUNT(*) AS c, SUM(soni) AS total_soni FROM items');
    const totalProducts = totalProductsRow[0].c || 0;
    const totalQuantity = totalProductsRow[0].total_soni || 0;
    const todayInRow = await query("SELECT IFNULL(SUM(amount),0) AS s FROM logs WHERE type='kirim' AND DATE(created_at)=CURDATE()");
    const todayOutRow = await query("SELECT IFNULL(SUM(amount),0) AS s FROM logs WHERE type='chiqim' AND DATE(created_at)=CURDATE()");
    const todayIn = todayInRow[0].s || 0;
    const todayOut = todayOutRow[0].s || 0;
    const capacity = Number(process.env.WAREHOUSE_CAPACITY || 5000);
    const fullness = Math.round((totalQuantity / capacity) * 100);
    const logs = await query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 10');
    const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 20);
    const lowStock = await query('SELECT id, nomi AS name, soni FROM items WHERE soni <= ? ORDER BY soni ASC LIMIT 10', [threshold]);
    res.render('dashboard', { totalProducts, todayIn, todayOut, fullness, logs, lowStock });
  } catch(err){
    console.error(err); res.status(500).send('Server error');
  }
});

// ITEMS CRUD
app.get('/items', async (req, res) => {
  const items = await query('SELECT * FROM items ORDER BY id DESC');
  res.render('items/index', { items });
});

app.get('/items/add', (req, res) => res.render('items/add'));
app.post('/items/add', upload.single('image'), async (req, res) => {
  try{
    const { kod, nomi, rangi, soni, qator, stellaj } = req.body;
    let image = null;
    if(req.file){
      image = req.file.filename;
      // create thumbnail
      const imgPath = path.join(process.cwd(), UPLOAD_DIR, image);
      const thumbPath = path.join(process.cwd(), UPLOAD_DIR, 'thumb_' + image);
      const imageObj = await Jimp.read(imgPath);
      await imageObj.resize(300, Jimp.AUTO).quality(80).writeAsync(thumbPath);
    }
    await query('INSERT INTO items (kod, nomi, rangi, soni, qator, stellaj, image) VALUES (?, ?, ?, ?, ?, ?, ?)', [kod, nomi, rangi, Number(soni)||0, qator, stellaj, image]);
    res.redirect('/items');
  } catch(e){ console.error(e); res.status(500).send('Error'); }
});

app.get('/items/edit/:id', async (req, res) => {
  const rows = await query('SELECT * FROM items WHERE id=?', [req.params.id]);
  if(!rows.length) return res.status(404).send('Not found');
  res.render('items/edit', { item: rows[0] });
});

app.post('/items/edit/:id', upload.single('image'), async (req, res) => {
  try{
    const { kod, nomi, rangi, soni, qator, stellaj } = req.body;
    let image = null;
    if(req.file){
      image = req.file.filename;
      const imgPath = path.join(process.cwd(), UPLOAD_DIR, image);
      const thumbPath = path.join(process.cwd(), UPLOAD_DIR, 'thumb_' + image);
      const imageObj = await Jimp.read(imgPath);
      await imageObj.resize(300, Jimp.AUTO).quality(80).writeAsync(thumbPath);
      await query('UPDATE items SET image=? WHERE id=?', [image, req.params.id]);
    }
    await query('UPDATE items SET kod=?, nomi=?, rangi=?, soni=?, qator=?, stellaj=?, updated_at=NOW() WHERE id=?', [kod, nomi, rangi, Number(soni)||0, qator, stellaj, req.params.id]);
    res.redirect('/items');
  } catch(e){ console.error(e); res.status(500).send('Error'); }
});

app.post('/items/delete/:id', async (req, res) => {
  await query('DELETE FROM items WHERE id=?', [req.params.id]);
  res.redirect('back');
});

// KIRIM / CHIQIM
app.get('/kirim', async (req, res) => {
  const items = await query('SELECT id, kod, nomi, soni FROM items ORDER BY nomi');
  res.render('kirim/add', { items });
});
app.post('/kirim', async (req, res) => {
  const { item_id, amount, note } = req.body;
  const rows = await query('SELECT id, nomi FROM items WHERE id=?', [item_id]);
  if(!rows.length) return res.status(400).send('Not found');
  const item = rows[0];
  await query('UPDATE items SET soni = soni + ? WHERE id=?', [Number(amount)||0, item_id]);
  await query('INSERT INTO logs (item_id, item_name, type, amount, note) VALUES (?, ?, "kirim", ?, ?)', [item_id, item.nomi, Number(amount)||0, note||null]);
  res.redirect('/dashboard');
});

app.get('/chiqim', async (req, res) => {
  const items = await query('SELECT id, kod, nomi, soni FROM items ORDER BY nomi');
  res.render('chiqim/add', { items });
});
app.post('/chiqim', async (req, res) => {
  const { item_id, amount, note } = req.body;
  const rows = await query('SELECT id, nomi, soni FROM items WHERE id=?', [item_id]);
  if(!rows.length) return res.status(400).send('Not found');
  const item = rows[0];
  const amt = Number(amount)||0;
  const newSoni = Math.max(0, (item.soni||0) - amt);
  await query('UPDATE items SET soni = ? WHERE id=?', [newSoni, item_id]);
  await query('INSERT INTO logs (item_id, item_name, type, amount, note) VALUES (?, ?, "chiqim", ?, ?)', [item_id, item.nomi, amt, note||null]);
  res.redirect('/dashboard');
});

// Logs
app.get('/logs', async (req, res) => {
  const logs = await query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 200');
  res.render('logs/index', { logs });
});

// NER parse endpoint
app.post('/parse', (req, res) => {
  const text = req.body.text || '';
  const result = ner(text);
  res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server running on http://localhost:' + PORT));
