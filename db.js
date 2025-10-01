const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbFile = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbFile);
module.exports = db;