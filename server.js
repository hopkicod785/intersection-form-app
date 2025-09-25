const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize SQLite database
const db = new sqlite3.Database('./form_submissions.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        // Create table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            intersection_name TEXT NOT NULL,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            end_user TEXT NOT NULL,
            distributor TEXT NOT NULL,
            cabinet_type TEXT NOT NULL,
            tls_connection TEXT NOT NULL,
            detection_io TEXT,
            phasing TEXT,
            timing_plans TEXT,
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// API Routes

// Submit form data
app.post('/api/submit', (req, res) => {
    const {
        intersectionName,
        city,
        state,
        endUser,
        distributor,
        cabinetType,
        tlsConnection,
        detectionIO,
        phasing,
        timingPlans
    } = req.body;

    // Validate required fields
    if (!intersectionName || !city || !state || !endUser || !distributor || !cabinetType || !tlsConnection) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = `INSERT INTO submissions (
        intersection_name, city, state, end_user, distributor, 
        cabinet_type, tls_connection, detection_io, phasing, timing_plans
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
        intersectionName, city, state, endUser, distributor,
        cabinetType, tlsConnection, detectionIO || '', phasing || '', timingPlans || ''
    ], function(err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Failed to save submission' });
        }
        res.json({ 
            success: true, 
            message: 'Form submitted successfully!',
            id: this.lastID 
        });
    });
});

// Get all submissions with optional filtering and search
app.get('/api/submissions', (req, res) => {
    const { search, city, state, cabinetType, page = 1, limit = 50 } = req.query;
    
    let sql = 'SELECT * FROM submissions WHERE 1=1';
    let params = [];
    
    // Add search conditions
    if (search) {
        sql += ' AND (intersection_name LIKE ? OR city LIKE ? OR end_user LIKE ? OR distributor LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (city) {
        sql += ' AND city = ?';
        params.push(city);
    }
    
    if (state) {
        sql += ' AND state = ?';
        params.push(state);
    }
    
    if (cabinetType) {
        sql += ' AND cabinet_type = ?';
        params.push(cabinetType);
    }
    
    // Add ordering and pagination
    sql += ' ORDER BY submitted_at DESC';
    
    const offset = (page - 1) * limit;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Failed to fetch submissions' });
        }
        
        // Get total count for pagination
        let countSql = 'SELECT COUNT(*) as total FROM submissions WHERE 1=1';
        let countParams = [];
        
        if (search) {
            countSql += ' AND (intersection_name LIKE ? OR city LIKE ? OR end_user LIKE ? OR distributor LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        if (city) countSql += ' AND city = ?';
        if (state) countSql += ' AND state = ?';
        if (cabinetType) countSql += ' AND cabinet_type = ?';
        
        if (city) countParams.push(city);
        if (state) countParams.push(state);
        if (cabinetType) countParams.push(cabinetType);
        
        db.get(countSql, countParams, (err, countRow) => {
            if (err) {
                console.error('Count error:', err.message);
                return res.status(500).json({ error: 'Failed to count submissions' });
            }
            
            res.json({
                submissions: rows,
                total: countRow.total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countRow.total / limit)
            });
        });
    });
});

// Get unique values for filter dropdowns
app.get('/api/filters', (req, res) => {
    const queries = {
        cities: 'SELECT DISTINCT city FROM submissions ORDER BY city',
        states: 'SELECT DISTINCT state FROM submissions ORDER BY state',
        cabinetTypes: 'SELECT DISTINCT cabinet_type FROM submissions ORDER BY cabinet_type'
    };
    
    const results = {};
    let completed = 0;
    const total = Object.keys(queries).length;
    
    Object.keys(queries).forEach(key => {
        db.all(queries[key], (err, rows) => {
            if (err) {
                console.error(`Error fetching ${key}:`, err.message);
                results[key] = [];
            } else {
                results[key] = rows.map(row => row[key.slice(0, -1)]); // Remove 's' from key
            }
            
            completed++;
            if (completed === total) {
                res.json(results);
            }
        });
    });
});

// Get single submission by ID
app.get('/api/submissions/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM submissions WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Failed to fetch submission' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        res.json(row);
    });
});

// Delete submission
app.delete('/api/submissions/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM submissions WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Failed to delete submission' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        res.json({ success: true, message: 'Submission deleted successfully' });
    });
});

// Serve the main form page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the admin dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Form available at: http://localhost:${PORT}`);
    console.log(`Admin dashboard at: http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});
