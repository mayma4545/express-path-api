const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite3');

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
        console.error('Error:', err);
        process.exit(1);
    }
    console.log('Tables in Express database:');
    tables.forEach(t => console.log(`  - ${t.name}`));
    db.close();
});
