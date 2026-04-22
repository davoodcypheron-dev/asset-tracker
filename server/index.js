const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { poolPromise, sql } = require('./db');
const ExcelJS = require('exceljs');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// LOGIN route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
});

// Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Use the absolute path defined above
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// GET all assets
app.get('/api/assets', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Assets ORDER BY CreatedDate DESC');

        // Fetch images for each asset
        const assets = result.recordset;
        for (let asset of assets) {
            const imagesResult = await pool.request()
                .input('AssetID', sql.Int, asset.AssetID)
                .query('SELECT ImagePath FROM AssetImages WHERE AssetID = @AssetID');
            asset.images = imagesResult.recordset.map(img => img.ImagePath);
        }

        res.json(assets);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// GET single asset
app.get('/api/assets/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Assets WHERE AssetID = @id');

        if (result.recordset.length === 0) return res.status(404).send('Asset not found');

        const asset = result.recordset[0];
        const imagesResult = await pool.request()
            .input('AssetID', sql.Int, asset.AssetID)
            .query('SELECT ImagePath FROM AssetImages WHERE AssetID = @AssetID');
        asset.images = imagesResult.recordset.map(img => img.ImagePath);

        res.json(asset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// POST new asset
app.post('/api/assets', upload.array('images', 5), async (req, res) => {
    const { assetName, assetType, brand, model, description, status, serviceDetails, accessType } = req.body;
    try {
        const pool = await poolPromise;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const result = await transaction.request()
                .input('assetName', sql.NVarChar, assetName ? assetName.toUpperCase() : '')
                .input('assetType', sql.NVarChar, assetType ? assetType.toUpperCase() : '')
                .input('brand', sql.NVarChar, brand ? brand.toUpperCase() : '')
                .input('model', sql.NVarChar, model ? model.toUpperCase() : '')
                .input('description', sql.NVarChar, description ? description.toUpperCase() : '')
                .input('status', sql.NVarChar, status ? status.toUpperCase() : '')
                .input('serviceDetails', sql.NVarChar, serviceDetails ? serviceDetails.toUpperCase() : '')
                .input('accessType', sql.NVarChar, accessType ? accessType.toUpperCase() : '')
                .query(`
                    INSERT INTO Assets (AssetName, AssetType, Brand, Model, Description, Status, ServiceDetails, AccessType)
                    VALUES (@assetName, @assetType, @brand, @model, @description, @status, @serviceDetails, @accessType);
                    SELECT SCOPE_IDENTITY() AS AssetID;
                `);

            const assetId = result.recordset[0].AssetID;

            if (req.files && req.files.length > 0) {
                for (let file of req.files) {
                    await transaction.request()
                        .input('AssetID', sql.Int, assetId)
                        .input('ImagePath', sql.NVarChar, file.filename)
                        .query('INSERT INTO AssetImages (AssetID, ImagePath) VALUES (@AssetID, @ImagePath)');
                }
            }

            await transaction.commit();
            res.status(201).json({ assetId, message: 'Asset created successfully' });
        } catch (err) {
            console.error('Transaction Error:', err);
            if (transaction) await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// UPDATE asset
app.put('/api/assets/:id', upload.array('images', 5), async (req, res) => {
    const { assetName, assetType, brand, model, description, status, serviceDetails, accessType } = req.body;
    const assetId = req.params.id;
    try {
        const pool = await poolPromise;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        
        try {
            await transaction.request()
                .input('id', sql.Int, assetId)
                .input('assetName', sql.NVarChar, assetName ? assetName.toUpperCase() : '')
                .input('assetType', sql.NVarChar, assetType ? assetType.toUpperCase() : '')
                .input('brand', sql.NVarChar, brand ? brand.toUpperCase() : '')
                .input('model', sql.NVarChar, model ? model.toUpperCase() : '')
                .input('description', sql.NVarChar, description ? description.toUpperCase() : '')
                .input('status', sql.NVarChar, status ? status.toUpperCase() : '')
                .input('serviceDetails', sql.NVarChar, serviceDetails ? serviceDetails.toUpperCase() : '')
                .input('accessType', sql.NVarChar, accessType ? accessType.toUpperCase() : '')
                .query(`
                    UPDATE Assets SET 
                        AssetName = @assetName, 
                        AssetType = @assetType, 
                        Brand = @brand, 
                        Model = @model, 
                        Description = @description, 
                        Status = @status, 
                        ServiceDetails = @serviceDetails, 
                        AccessType = @accessType
                    WHERE AssetID = @id
                `);
            
            if (req.files && req.files.length > 0) {
                for (let file of req.files) {
                    await transaction.request()
                        .input('AssetID', sql.Int, assetId)
                        .input('ImagePath', sql.NVarChar, file.filename)
                        .query('INSERT INTO AssetImages (AssetID, ImagePath) VALUES (@AssetID, @ImagePath)');
                }
            }
            
            await transaction.commit();
            res.json({ message: 'Asset updated successfully' });
        } catch (err) {
            console.error('Transaction Error:', err);
            if (transaction) await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Excel Export
app.get('/api/export', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Assets ORDER BY CreatedDate DESC');
        const assets = result.recordset;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Assets');

        worksheet.columns = [
            { header: 'Asset Number', key: 'AssetNumber', width: 15 },
            { header: 'Name', key: 'AssetName', width: 25 },
            { header: 'Type', key: 'AssetType', width: 15 },
            { header: 'Brand', key: 'Brand', width: 15 },
            { header: 'Model', key: 'Model', width: 20 },
            { header: 'Description', key: 'Description', width: 40 },
            { header: 'Status', key: 'Status', width: 15 },
            { header: 'Access Type', key: 'AccessType', width: 15 },
            { header: 'Image 1', key: 'Image1', width: 20 },
            { header: 'Image 2', key: 'Image2', width: 20 },
            { header: 'Image 3', key: 'Image3', width: 20 },
            { header: 'Image 4', key: 'Image4', width: 20 },
            { header: 'Image 5', key: 'Image5', width: 20 }
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFECECEC' }
        };

        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            const row = worksheet.addRow({
                AssetNumber: asset.AssetNumber.toUpperCase(),
                AssetName: (asset.AssetName || '').toUpperCase(),
                AssetType: (asset.AssetType || '').toUpperCase(),
                Brand: (asset.Brand || '').toUpperCase(),
                Model: (asset.Model || '').toUpperCase(),
                Description: (asset.Description || '').toUpperCase(),
                Status: (asset.Status || '').toUpperCase(),
                AccessType: (asset.AccessType || '').toUpperCase()
            });
            row.height = 80;

            // Get all images
            const imagesResult = await pool.request()
                .input('AssetID', sql.Int, asset.AssetID)
                .query('SELECT ImagePath FROM AssetImages WHERE AssetID = @AssetID');

            const images = imagesResult.recordset;
            for (let j = 0; j < images.length; j++) {
                const imagePath = path.join(uploadDir, images[j].ImagePath);
                if (fs.existsSync(imagePath)) {
                    const imageId = workbook.addImage({
                        filename: imagePath,
                        extension: 'jpeg',
                    });
                    worksheet.addImage(imageId, {
                        tl: { col: 8 + j, row: i + 1 }, // Start from column 8 (Image 1) and shift right
                        ext: { width: 100, height: 100 },
                        editAs: 'oneCell'
                    });
                }
            }
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=assets.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

app.listen(port, () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
});
