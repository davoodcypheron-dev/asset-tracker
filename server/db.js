require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true, // for azure
        trustServerCertificate: true // change to false for production
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(async (pool) => {
        console.log('Connected to MSSQL');
        await initializeDatabase(pool);
        return pool;
    })
    .catch(err => {
        console.error('Database Connection Failed! Bad Config: ', err);
        throw err;
    });

async function initializeDatabase(pool) {
    try {
        console.log('Checking/Initializing Database Tables...');
        
        // Create Assets Table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Assets')
            BEGIN
                CREATE TABLE Assets (
                    AssetID INT IDENTITY(1,1) PRIMARY KEY,
                    AssetNumber AS ('AST-' + RIGHT('000000' + CAST(AssetID AS VARCHAR(6)), 6)) PERSISTED,
                    AssetName NVARCHAR(255) NOT NULL,
                    AssetType NVARCHAR(50) NOT NULL,
                    Brand NVARCHAR(100),
                    Model NVARCHAR(100),
                    Description NVARCHAR(MAX),
                    Status NVARCHAR(50) DEFAULT 'working',
                    ServiceDetails NVARCHAR(MAX),
                    AccessType NVARCHAR(50) DEFAULT 'on premise',
                    CreatedDate DATETIME DEFAULT GETDATE()
                );
            END
        `);

        // Create AssetImages Table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AssetImages')
            BEGIN
                CREATE TABLE AssetImages (
                    ImageID INT IDENTITY(1,1) PRIMARY KEY,
                    AssetID INT FOREIGN KEY REFERENCES Assets(AssetID) ON DELETE CASCADE,
                    ImagePath NVARCHAR(MAX) NOT NULL,
                    UploadedDate DATETIME DEFAULT GETDATE()
                );
            END
        `);
        
        console.log('Database Tables Ready.');
    } catch (err) {
        console.error('Initialisation Error:', err);
    }
}

module.exports = {
    sql,
    poolPromise
};
