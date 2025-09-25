const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Debug: Log the public directory path (with error handling)
const publicPath = path.join(__dirname, 'public');
console.log('Public directory path:', publicPath);
try {
    const files = require('fs').readdirSync(publicPath);
    console.log('Files in public directory:', files);
} catch (err) {
    console.log('Public directory not found, will create it if needed');
}

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

// Submit form data with file upload support
app.post('/api/submit', upload.fields([
    { name: 'phasingFile', maxCount: 1 },
    { name: 'timingPlans', maxCount: 1 }
]), (req, res) => {
    const {
        intersectionName,
        city,
        state,
        endUser,
        distributor,
        otherDistributor,
        cabinetType,
        otherCabinetType,
        tlsConnection,
        otherTlsConnection,
        detectionIO,
        otherDetectionIO,
        phasingText
    } = req.body;

    // Validate required fields
    if (!intersectionName || !city || !state || !endUser || !distributor || !cabinetType || !tlsConnection || !detectionIO) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Handle "Other" fields
    const finalDistributor = distributor === 'Other' ? otherDistributor : distributor;
    const finalCabinetType = cabinetType === 'Other' ? otherCabinetType : cabinetType;
    const finalTlsConnection = tlsConnection === 'Other' ? otherTlsConnection : tlsConnection;
    const finalDetectionIO = detectionIO === 'Other' ? otherDetectionIO : detectionIO;

    // Handle phasing (text or file)
    let phasing = phasingText || '';
    if (req.files && req.files.phasingFile && req.files.phasingFile[0]) {
        phasing = phasing ? `${phasing} | File: ${req.files.phasingFile[0].filename}` : `File: ${req.files.phasingFile[0].filename}`;
    }
    
    // Handle timing plans (file)
    let timingPlansInfo = '';
    if (req.files && req.files.timingPlans && req.files.timingPlans[0]) {
        timingPlansInfo = `File: ${req.files.timingPlans[0].filename}`;
    }

    const sql = `INSERT INTO submissions (
        intersection_name, city, state, end_user, distributor, 
        cabinet_type, tls_connection, detection_io, phasing, timing_plans
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
        intersectionName, city, state, endUser, finalDistributor,
        finalCabinetType, finalTlsConnection, finalDetectionIO, phasing, timingPlansInfo
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
    const indexPath = path.join(__dirname, 'public', 'index.html');
    console.log('Serving index.html from:', indexPath);
    
    // Check if file exists, if not serve inline HTML
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath, (err) => {
            if (err) {
                console.error('Error serving index.html:', err);
                res.status(500).send('Error loading form page');
            }
        });
    } else {
        console.log('index.html not found, serving inline HTML');
        res.send(getInlineFormHTML());
    }
});

// Serve the admin dashboard
app.get('/admin', (req, res) => {
    const adminPath = path.join(__dirname, 'public', 'admin.html');
    console.log('Serving admin.html from:', adminPath);
    
    // Check if file exists, if not serve inline HTML
    const fs = require('fs');
    if (fs.existsSync(adminPath)) {
        res.sendFile(adminPath, (err) => {
            if (err) {
                console.error('Error serving admin.html:', err);
                res.status(500).send('Error loading admin page');
            }
        });
    } else {
        console.log('admin.html not found, serving inline HTML');
        res.send(getInlineAdminHTML());
    }
});

// Fallback for any other routes - serve the main form
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error serving fallback index.html:', err);
            res.status(500).send('Error loading page');
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Form available at: http://localhost:${PORT}`);
    console.log(`Admin dashboard at: http://localhost:${PORT}/admin`);
});

// Inline HTML functions for fallback
function getInlineFormHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pre-Install Registration Form</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 flex items-center justify-center min-h-screen">
    <div class="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl">
        <h2 class="text-2xl font-bold mb-6 text-center text-gray-800">Pre-Install Registration Form</h2>
        
        <!-- Success/Error Messages -->
        <div id="messageContainer" class="hidden mb-4 p-4 rounded-md">
            <div id="successMessage" class="hidden bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                <span id="successText"></span>
            </div>
            <div id="errorMessage" class="hidden bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <span id="errorText"></span>
            </div>
        </div>
        
        <form id="preInstallForm" class="space-y-4">
            <div>
                <label for="intersectionName" class="block text-sm font-medium text-gray-700">Intersection Name</label>
                <input type="text" id="intersectionName" name="intersectionName" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="e.g., Main St & 1st Ave">
            </div>
            <div>
                <label for="city" class="block text-sm font-medium text-gray-700">City</label>
                <input type="text" id="city" name="city" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="e.g., Springfield">
            </div>
            <div>
                <label for="state" class="block text-sm font-medium text-gray-700">State</label>
                <input type="text" id="state" name="state" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="e.g., IL">
            </div>
            <div>
                <label for="endUser" class="block text-sm font-medium text-gray-700">End-User</label>
                <input type="text" id="endUser" name="endUser" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="e.g., City Traffic Department">
            </div>
            <div>
                <label for="distributor" class="block text-sm font-medium text-gray-700">Distributor</label>
                <select id="distributor" name="distributor" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" onchange="toggleOtherField('distributor', 'otherDistributor')">
                    <option value="" disabled selected>Select Distributor</option>
                    <option value="Orange Traffic">Orange Traffic</option>
                    <option value="General Highway Products">General Highway Products</option>
                    <option value="Texas Highway Products">Texas Highway Products</option>
                    <option value="General Traffic Controls">General Traffic Controls</option>
                    <option value="Traffic Signal Controls">Traffic Signal Controls</option>
                    <option value="Traffic Control Corp.">Traffic Control Corp.</option>
                    <option value="HighAngle">HighAngle</option>
                    <option value="Marlin">Marlin</option>
                    <option value="Utilicom">Utilicom</option>
                    <option value="TAPCO">TAPCO</option>
                    <option value="Swarco">Swarco</option>
                    <option value="JTB">JTB</option>
                    <option value="Southwest Traffic Systems">Southwest Traffic Systems</option>
                    <option value="Transportation Solutions & Lighting">Transportation Solutions & Lighting</option>
                    <option value="Blackstar">Blackstar</option>
                    <option value="ITS">ITS</option>
                    <option value="CTC">CTC</option>
                    <option value="Paradigm">Paradigm</option>
                    <option value="Other">Other</option>
                </select>
                <input type="text" id="otherDistributor" name="otherDistributor" class="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm hidden" placeholder="Specify other distributor">
            </div>
            <div>
                <label for="cabinetType" class="block text-sm font-medium text-gray-700">Cabinet Type</label>
                <select id="cabinetType" name="cabinetType" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" onchange="toggleOtherField('cabinetType', 'otherCabinetType')">
                    <option value="" disabled selected>Select Cabinet Type</option>
                    <option value="NEMA TS 1">NEMA TS 1</option>
                    <option value="NEMA TS 2">NEMA TS 2</option>
                    <option value="332">332</option>
                    <option value="335">335</option>
                    <option value="325i ATC">325i ATC</option>
                    <option value="336">336</option>
                    <option value="332D">332D</option>
                    <option value="ATC">ATC</option>
                    <option value="Type B">Type B</option>
                    <option value="ITS">ITS</option>
                    <option value="P44">P44</option>
                    <option value="Other">Other</option>
                </select>
                <input type="text" id="otherCabinetType" name="otherCabinetType" class="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm hidden" placeholder="Specify other cabinet type">
            </div>
            <div>
                <label for="tlsConnection" class="block text-sm font-medium text-gray-700">TLS Connection</label>
                <select id="tlsConnection" name="tlsConnection" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" onchange="toggleOtherField('tlsConnection', 'otherTlsConnection')">
                    <option value="" disabled selected>Select TLS Connection</option>
                    <option value="NTCIP">NTCIP</option>
                    <option value="SDLC">SDLC</option>
                    <option value="C1/C4 Harness">C1/C4 Harness</option>
                    <option value="DB25 Spade Cables">DB25 Spade Cables</option>
                    <option value="None">None</option>
                    <option value="Other">Other</option>
                </select>
                <input type="text" id="otherTlsConnection" name="otherTlsConnection" class="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm hidden" placeholder="Specify other TLS connection">
            </div>
            <div>
                <label for="detectionIO" class="block text-sm font-medium text-gray-700">Detection I/O</label>
                <select id="detectionIO" name="detectionIO" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" onchange="toggleOtherField('detectionIO', 'otherDetectionIO')">
                    <option value="" disabled selected>Select Detection I/O</option>
                    <option value="DB37 to Spades">DB37 to Spades</option>
                    <option value="SDLC - 15 PIN">SDLC - 15 PIN</option>
                    <option value="SDLC - 25/15 PIN">SDLC - 25/15 PIN</option>
                    <option value="NTCIP">NTCIP</option>
                    <option value="Other">Other</option>
                </select>
                <input type="text" id="otherDetectionIO" name="otherDetectionIO" class="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm hidden" placeholder="Specify other detection I/O">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Phasing</label>
                <div class="mt-1 space-y-2">
                    <label for="phasingText" class="block text-sm text-gray-600">Enter Phasing Details</label>
                    <textarea id="phasingText" name="phasingText" rows="4" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="e.g., 4-phase, 8-phase, etc."></textarea>
                    <label for="phasingFile" class="block text-sm text-gray-600">Or Upload Phasing File</label>
                    <input type="file" id="phasingFile" name="phasingFile" accept=".pdf,.doc,.docx,.txt" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100">
                </div>
            </div>
            <div>
                <label for="timingPlans" class="block text-sm font-medium text-gray-700">Timing Plans (File Upload)</label>
                <input type="file" id="timingPlans" name="timingPlans" accept=".pdf,.doc,.docx,.txt" required class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100">
            </div>
            <div class="flex justify-end">
                <button type="submit" id="submitBtn" class="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span id="submitText">Submit</span>
                    <svg id="submitSpinner" class="hidden animate-spin -mr-1 ml-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </button>
            </div>
        </form>
    </div>
    <script>
        function toggleOtherField(selectId, inputId) {
            const select = document.getElementById(selectId);
            const input = document.getElementById(inputId);
            if (select.value === 'Other') {
                input.classList.remove('hidden');
                input.required = true;
            } else {
                input.classList.add('hidden');
                input.required = false;
                input.value = '';
            }
        }

        document.getElementById('preInstallForm').addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const submitText = document.getElementById('submitText');
            const submitSpinner = document.getElementById('submitSpinner');
            const messageContainer = document.getElementById('messageContainer');
            const successMessage = document.getElementById('successMessage');
            const errorMessage = document.getElementById('errorMessage');
            const successText = document.getElementById('successText');
            const errorText = document.getElementById('errorText');
            
            // Show loading state
            submitBtn.disabled = true;
            submitText.textContent = 'Submitting...';
            submitSpinner.classList.remove('hidden');
            messageContainer.classList.add('hidden');
            
            // Collect form data
            const formData = new FormData(this);
            
            try {
                const response = await fetch('/api/submit', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // Show success message
                    successText.textContent = result.message;
                    successMessage.classList.remove('hidden');
                    errorMessage.classList.add('hidden');
                    messageContainer.classList.remove('hidden');
                    
                    // Reset form
                    document.getElementById('preInstallForm').reset();
                    
                    // Scroll to top to show message
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    // Show error message
                    errorText.textContent = result.error || 'An error occurred while submitting the form';
                    errorMessage.classList.remove('hidden');
                    successMessage.classList.add('hidden');
                    messageContainer.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Error:', error);
                errorText.textContent = 'Network error. Please check your connection and try again.';
                errorMessage.classList.remove('hidden');
                successMessage.classList.add('hidden');
                messageContainer.classList.remove('hidden');
            } finally {
                // Reset button state
                submitBtn.disabled = false;
                submitText.textContent = 'Submit';
                submitSpinner.classList.add('hidden');
            }
        });
    </script>
</body>
</html>`;
}

function getInlineAdminHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - Form Submissions</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="container mx-auto px-4 py-8" x-data="adminDashboard()">
        <!-- Header -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div class="flex justify-between items-center">
                <h1 class="text-3xl font-bold text-gray-800">Form Submissions Dashboard</h1>
                <div class="flex space-x-4">
                    <a href="/" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">View Form</a>
                    <button @click="refreshData()" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Refresh</button>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div x-show="loading" class="bg-white rounded-lg shadow-lg p-8 text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p class="mt-4 text-gray-600">Loading submissions...</p>
        </div>

        <!-- Error State -->
        <div x-show="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <span x-text="error"></span>
        </div>

        <!-- Submissions Table -->
        <div x-show="!loading && !error" class="bg-white rounded-lg shadow-lg overflow-hidden">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intersection</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City/State</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End User</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distributor</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cabinet Type</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TLS</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <template x-for="submission in submissions" :key="submission.id">
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" x-text="submission.id"></td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="submission.intersection_name"></td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="\`\${submission.city}, \${submission.state}\`"></td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="submission.end_user"></td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="submission.distributor"></td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="submission.cabinet_type"></td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="submission.tls_connection"></td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="formatDate(submission.submitted_at)"></td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        function adminDashboard() {
            return {
                submissions: [],
                loading: false,
                error: null,

                init() {
                    this.loadSubmissions();
                },

                async loadSubmissions() {
                    this.loading = true;
                    this.error = null;
                    
                    try {
                        const response = await fetch('/api/submissions');
                        const data = await response.json();
                        
                        if (response.ok) {
                            this.submissions = data.submissions || [];
                        } else {
                            this.error = data.error || 'Failed to load submissions';
                        }
                    } catch (error) {
                        this.error = 'Network error. Please check your connection.';
                        console.error('Error loading submissions:', error);
                    } finally {
                        this.loading = false;
                    }
                },

                refreshData() {
                    this.loadSubmissions();
                },

                formatDate(dateString) {
                    return new Date(dateString).toLocaleString();
                }
            }
        }
    </script>
</body>
</html>`;
}

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
