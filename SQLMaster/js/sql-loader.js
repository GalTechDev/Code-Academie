let db = null;
let SQL_ENGINE = null;

const SqlLoader = {
    init: async () => {
        if (db) return db;

        try {
            if (!SQL_ENGINE) {
                SQL_ENGINE = await initSqlJs({
                    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
                });
            }

            // If we have an engine but no DB (e.g. after reset), creation happens in resetAndSetup usually.
            // But if init is called directly, we ensure a DB exists.
            if (!db) {
                db = new SQL_ENGINE.Database();
                console.log("Database initialized (empty).");
            }
            return db;
        } catch (err) {
            console.error("Failed to load SQL.js", err);
            throw err;
        }
    },

    // Create a fresh database and run setup SQL
    resetAndSetup: (setupSql) => {
        if (db) {
            try { db.close(); } catch (e) { console.warn("Error closing DB", e); }
        }

        // We need SQL_ENGINE to be ready. If not, this might fail if called before init.
        // But app.js calls init() first.
        if (!SQL_ENGINE) {
            console.error("SQL Engine not initialized. Call init() first.");
            return null;
        }

        db = new SQL_ENGINE.Database();
        if (setupSql) {
            try {
                db.run(setupSql);
            } catch (e) {
                console.error("Error running setup SQL:", e);
            }
        }
        return db;
    },

    getDb: () => db
};
