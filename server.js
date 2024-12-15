const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const app = express();
const port = 3005;

// JWT secret key
const JWT_SECRET = 'your-secret-key'; // In production, use environment variable

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com', // Replace with your Gmail
        pass: 'your-app-password' // Replace with your Gmail app password
    }
});

// Middleware
app.use(express.json());

// Enable CORS for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Serve static files
app.use('/', express.static(__dirname));

// Serve index.html for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const VERSES_FILE = path.join(DATA_DIR, 'verses.json');
const SERMON_NOTES_FILE = path.join(DATA_DIR, 'sermon_notes.json');
const QUIET_TIME_FILE = path.join(DATA_DIR, 'quiet_time.json');

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid token' });
    }
};

// Ensure data directory exists
async function initializeDataFiles() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        // Initialize files if they don't exist
        const files = [USERS_FILE, VERSES_FILE, SERMON_NOTES_FILE, QUIET_TIME_FILE];
        for (const file of files) {
            try {
                await fs.access(file);
            } catch {
                await fs.writeFile(file, '[]');
            }
        }
    } catch (error) {
        console.error('Error initializing data files:', error);
    }
}

// Helper functions for file operations
async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
    }
}

async function writeJsonFile(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        throw error;
    }
}

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        const users = await readJsonFile(USERS_FILE);

        // Check if user already exists
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const newUser = {
            id: Date.now().toString(),
            email,
            name,
            password: hashedPassword
        };

        users.push(newUser);
        await writeJsonFile(USERS_FILE, users);

        // Create token
        const token = jwt.sign({ id: newUser.id }, JWT_SECRET);
        res.status(201).json({ token, user: { id: newUser.id, email: newUser.email, name: newUser.name } });
    } catch (error) {
        res.status(500).json({ error: 'Error creating user' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = await readJsonFile(USERS_FILE);
        const user = users.find(u => u.email === email);

        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET);
        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Password reset endpoints
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const users = await readJsonFile(USERS_FILE);
        const user = users.find(u => u.email === email);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { id: user.id, purpose: 'password-reset' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Store reset token with user
        user.resetToken = resetToken;
        user.resetTokenExpires = Date.now() + 3600000; // 1 hour
        await writeJsonFile(USERS_FILE, users);

        // Send reset email
        const resetLink = `http://localhost:3005/reset-password.html?token=${resetToken}`;
        const mailOptions = {
            from: 'your-email@gmail.com',
            to: email,
            subject: 'Password Reset - Bible Verse Journal',
            html: `
                <h1>Password Reset Request</h1>
                <p>You requested a password reset for your Bible Verse Journal account.</p>
                <p>Click the link below to reset your password. This link will expire in 1 hour.</p>
                <a href="${resetLink}">Reset Password</a>
                <p>If you didn't request this, please ignore this email.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: 'Password reset email sent' });
    } catch (error) {
        console.error('Error in forgot-password:', error);
        res.status(500).json({ error: 'Error processing password reset request' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || decoded.purpose !== 'password-reset') {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const users = await readJsonFile(USERS_FILE);
        const user = users.find(u => u.id === decoded.id);

        if (!user || !user.resetToken || user.resetToken !== token || user.resetTokenExpires < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password and clear reset token
        user.password = hashedPassword;
        user.resetToken = null;
        user.resetTokenExpires = null;

        await writeJsonFile(USERS_FILE, users);
        res.json({ message: 'Password successfully reset' });
    } catch (error) {
        console.error('Error in reset-password:', error);
        res.status(500).json({ error: 'Error resetting password' });
    }
});

// Protected routes
app.get('/api/verses', authenticateToken, async (req, res) => {
    try {
        const verses = await readJsonFile(VERSES_FILE);
        const userVerses = verses.filter(v => v.userId === req.user.id);
        res.json(userVerses);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch verses' });
    }
});

app.post('/api/verses', authenticateToken, async (req, res) => {
    try {
        const verses = await readJsonFile(VERSES_FILE);
        const newVerse = {
            ...req.body,
            id: Date.now(),
            userId: req.user.id,
            dateAdded: new Date().toISOString()
        };
        verses.push(newVerse);
        await writeJsonFile(VERSES_FILE, verses);
        res.status(201).json(newVerse);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save verse' });
    }
});

app.delete('/api/verses/:id', authenticateToken, async (req, res) => {
    try {
        const verses = await readJsonFile(VERSES_FILE);
        const updatedVerses = verses.filter(v => v.id !== parseInt(req.params.id) || v.userId !== req.user.id);
        await writeJsonFile(VERSES_FILE, updatedVerses);
        res.status(200).json({ message: 'Verse deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete verse' });
    }
});

app.get('/api/sermon-notes', authenticateToken, async (req, res) => {
    try {
        const notes = await readJsonFile(SERMON_NOTES_FILE);
        const userNotes = notes.filter(n => n.userId === req.user.id);
        res.json(userNotes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sermon notes' });
    }
});

app.post('/api/sermon-notes', authenticateToken, async (req, res) => {
    try {
        const notes = await readJsonFile(SERMON_NOTES_FILE);
        const newNote = {
            ...req.body,
            id: Date.now(),
            userId: req.user.id,
            dateAdded: new Date().toISOString()
        };
        notes.push(newNote);
        await writeJsonFile(SERMON_NOTES_FILE, notes);
        res.status(201).json(newNote);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save sermon note' });
    }
});

app.delete('/api/sermon-notes/:id', authenticateToken, async (req, res) => {
    try {
        const notes = await readJsonFile(SERMON_NOTES_FILE);
        const updatedNotes = notes.filter(n => n.id !== parseInt(req.params.id) || n.userId !== req.user.id);
        await writeJsonFile(SERMON_NOTES_FILE, updatedNotes);
        res.status(200).json({ message: 'Sermon note deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete sermon note' });
    }
});

app.get('/api/quiet-time', authenticateToken, async (req, res) => {
    try {
        const entries = await readJsonFile(QUIET_TIME_FILE);
        const userEntries = entries.filter(e => e.userId === req.user.id);
        res.json(userEntries);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch quiet time entries' });
    }
});

app.post('/api/quiet-time', authenticateToken, async (req, res) => {
    try {
        const entries = await readJsonFile(QUIET_TIME_FILE);
        const newEntry = {
            ...req.body,
            id: Date.now(),
            userId: req.user.id,
            dateAdded: new Date().toISOString()
        };
        entries.push(newEntry);
        await writeJsonFile(QUIET_TIME_FILE, entries);
        res.status(201).json(newEntry);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save quiet time entry' });
    }
});

app.delete('/api/quiet-time/:id', authenticateToken, async (req, res) => {
    try {
        const entries = await readJsonFile(QUIET_TIME_FILE);
        const updatedEntries = entries.filter(e => e.id !== parseInt(req.params.id) || e.userId !== req.user.id);
        await writeJsonFile(QUIET_TIME_FILE, updatedEntries);
        res.status(200).json({ message: 'Quiet time entry deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete quiet time entry' });
    }
});

// Initialize data files and start server
initializeDataFiles().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
        console.log(`Data directory: ${DATA_DIR}`);
    });
});
