# Intersection Equipment Pre-Install Registration Form

A web application for collecting and managing pre-installation registration forms for intersection equipment installations. This application allows agencies to submit installation details and provides an admin dashboard for viewing, filtering, and managing submissions.

## Features

- **Public Form**: Clean, responsive form for agencies to submit installation details
- **Admin Dashboard**: Complete management interface with search, filtering, and pagination
- **Database Storage**: SQLite database for storing all form submissions
- **API Endpoints**: RESTful API for form submission and data retrieval
- **Real-time Validation**: Client-side and server-side form validation
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Form Fields

- Intersection Name (required)
- City (required)
- State (required)
- End-User (required)
- Distributor (required)
- Cabinet Type (required) - Type 170, Type 2070, NEMA, Other
- TLS Connection (required) - Ethernet, Serial, Fiber, None
- Detection I/O (optional)
- Phasing (optional)
- Timing Plans (optional)

## Quick Start

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the application:**
   ```bash
   npm start
   ```

3. **Access the application:**
   - **Public Form**: http://localhost:3000
   - **Admin Dashboard**: http://localhost:3000/admin

### Development Mode

For development with auto-restart on file changes:
```bash
npm run dev
```

## Usage

### For Agencies (Form Submission)

1. Visit the form URL (e.g., http://your-domain.com)
2. Fill out all required fields (marked with *)
3. Optionally fill out additional details
4. Click Submit
5. Receive confirmation of successful submission

### For Administrators (Data Management)

1. Visit the admin dashboard (e.g., http://your-domain.com/admin)
2. Use the search and filter options to find specific submissions
3. Click "View" to see full submission details
4. Use "Delete" to remove submissions if needed
5. Navigate through pages using pagination controls

## API Endpoints

### Submit Form
- **POST** `/api/submit`
- **Body**: JSON object with form data
- **Response**: Success/error message with submission ID

### Get Submissions
- **GET** `/api/submissions`
- **Query Parameters**:
  - `search` - Search across intersection name, city, end user, distributor
  - `city` - Filter by city
  - `state` - Filter by state
  - `cabinetType` - Filter by cabinet type
  - `page` - Page number (default: 1)
  - `limit` - Results per page (default: 50)

### Get Filter Options
- **GET** `/api/filters`
- **Response**: Available cities, states, and cabinet types for filtering

### Get Single Submission
- **GET** `/api/submissions/:id`
- **Response**: Full submission details

### Delete Submission
- **DELETE** `/api/submissions/:id`
- **Response**: Success/error message

## Database

The application uses SQLite for data storage. The database file (`form_submissions.db`) is created automatically on first run.

### Database Schema

```sql
CREATE TABLE submissions (
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
);
```

## Deployment Options

### Option 1: Heroku (Recommended for Free Hosting)

1. **Create a Heroku account** at https://heroku.com
2. **Install Heroku CLI** from https://devcenter.heroku.com/articles/heroku-cli
3. **Login to Heroku:**
   ```bash
   heroku login
   ```
4. **Create a new app:**
   ```bash
   heroku create your-app-name
   ```
5. **Deploy:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push heroku main
   ```
6. **Open your app:**
   ```bash
   heroku open
   ```

### Option 2: Railway

1. **Create a Railway account** at https://railway.app
2. **Connect your GitHub repository**
3. **Deploy automatically** - Railway will detect the Node.js app and deploy it

### Option 3: Render

1. **Create a Render account** at https://render.com
2. **Create a new Web Service**
3. **Connect your repository**
4. **Set build command:** `npm install`
5. **Set start command:** `npm start`

### Option 4: VPS/Cloud Server

1. **Set up a server** (Ubuntu/CentOS recommended)
2. **Install Node.js and npm**
3. **Clone the repository**
4. **Install dependencies:** `npm install`
5. **Install PM2 for process management:**
   ```bash
   npm install -g pm2
   ```
6. **Start the application:**
   ```bash
   pm2 start server.js --name "intersection-form"
   ```
7. **Set up reverse proxy** with Nginx (optional but recommended)

## Environment Variables

You can customize the application using environment variables:

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Security Considerations

- The current implementation is suitable for internal use
- For production deployment, consider adding:
  - Rate limiting
  - Input sanitization
  - Authentication for admin access
  - HTTPS/SSL certificates
  - Database backups

## File Structure

```
├── package.json          # Dependencies and scripts
├── server.js             # Express server and API routes
├── public/               # Static files
│   ├── index.html        # Public form page
│   └── admin.html        # Admin dashboard
├── form_submissions.db   # SQLite database (created automatically)
└── README.md            # This file
```

## Troubleshooting

### Common Issues

1. **Port already in use:**
   - Change the PORT environment variable
   - Kill the process using the port: `lsof -ti:3000 | xargs kill -9`

2. **Database errors:**
   - Ensure the application has write permissions in the directory
   - Check if SQLite3 is properly installed

3. **Form submission fails:**
   - Check browser console for JavaScript errors
   - Verify the server is running
   - Check network connectivity

### Getting Help

If you encounter issues:
1. Check the console logs for error messages
2. Verify all dependencies are installed correctly
3. Ensure the database file has proper permissions
4. Test the API endpoints directly using tools like Postman

## License

MIT License - feel free to modify and use for your organization's needs.
