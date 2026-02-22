Full SKLAD ERP (MySQL) + Pinduoduo-style UI + NER (regex) project

How to run:
1. Copy files to server or Termux home.
2. Create .env from .env.example and set DB credentials.
3. Import DB schema: mysql -u root -p < db/schema.sql
4. npm install
5. node init_db.js (optional to apply schema)
6. npm start

Uploads are stored in uploads/ (ensure folder is writeable).

Notes: This project purposely avoids native-heavy packages like @tensorflow/tfjs-node and sharp to ensure Termux compatibility. Uses jimp for image processing (pure JS).
