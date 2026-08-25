import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { initialLetonData } from './src/data/initialData';
import { LetonData } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Directories
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'leton_content.json');
const AUTH_FILE = path.join(DATA_DIR, 'admin_auth.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Serve uploaded images statically
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/public/uploads', express.static(UPLOAD_DIR));

// Setup Multer for secure image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `leton-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
});

// Helper to get or initialize Leton content
function getContent(): LetonData {
  try {
    if (fs.existsSync(CONTENT_FILE)) {
      const raw = fs.readFileSync(CONTENT_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading content file, using initial data:', err);
  }
  // Initialize with initialLetonData
  saveContent(initialLetonData);
  return initialLetonData;
}

function saveContent(data: LetonData): void {
  try {
    data.updatedAt = Date.now();
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing content file:', err);
    throw err;
  }
}

// Helper to get or initialize Admin credentials
interface AuthRecord {
  username: string;
  passwordHash: string;
}

function getAuthRecord(): AuthRecord {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading auth file:', err);
  }
  // Default: admin / LetonAdmin2026!
  const defaultSalt = bcrypt.genSaltSync(10);
  const defaultHash = bcrypt.hashSync('LetonAdmin2026!', defaultSalt);
  const defaultAuth: AuthRecord = {
    username: 'admin',
    passwordHash: defaultHash,
  };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(defaultAuth, null, 2), 'utf-8');
  return defaultAuth;
}

function saveAuthRecord(record: AuthRecord): void {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(record, null, 2), 'utf-8');
}

// Active session store (token -> { username, expiresAt })
const activeSessions = new Map<string, { username: string; expiresAt: number }>();

function generateToken(username: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, {
    username,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  return token;
}

function verifyAuthHeader(req: express.Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.split(' ')[1];
  const session = activeSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

// Realtime SSE broadcast clients
const sseClients: express.Response[] = [];

function broadcastUpdate(data: LetonData) {
  const message = `data: ${JSON.stringify({ type: 'CONTENT_UPDATE', updatedAt: Date.now(), data })}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.write(message);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// ---------------------------------------------
// API ROUTES
// ---------------------------------------------

// 1. Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 2. Realtime SSE Stream Endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial ping and current content
  const currentContent = getContent();
  res.write(`data: ${JSON.stringify({ type: 'INITIAL_SYNC', data: currentContent })}\n\n`);

  sseClients.push(res);

  req.on('close', () => {
    const index = sseClients.indexOf(res);
    if (index !== -1) {
      sseClients.splice(index, 1);
    }
  });
});

// 3. Get Public Content
app.get('/api/content', (_req, res) => {
  const data = getContent();
  res.json(data);
});

// 4. Update Content (Protected)
app.post('/api/content', (req, res) => {
  if (!verifyAuthHeader(req)) {
    return res.status(401).json({ error: 'Unauthorized: Silakan login terlebih dahulu' });
  }

  try {
    const updatedData: LetonData = req.body;
    if (!updatedData || !updatedData.siteSettings) {
      return res.status(400).json({ error: 'Invalid content format' });
    }

    saveContent(updatedData);
    broadcastUpdate(updatedData);

    return res.json({ success: true, message: 'Changes saved successfully', data: updatedData });
  } catch (err: any) {
    console.error('Error saving content:', err);
    return res.status(500).json({ error: 'Failed to save changes. Please try again.' });
  }
});

// 5. Auth: Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const authRecord = getAuthRecord();
  if (username !== authRecord.username) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  const isMatch = bcrypt.compareSync(password, authRecord.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  const token = generateToken(username);
  return res.json({
    success: true,
    token,
    username,
    message: 'Login successful',
  });
});

// 6. Auth: Verify Session
app.get('/api/auth/verify', (req, res) => {
  if (!verifyAuthHeader(req)) {
    return res.status(401).json({ isAuthenticated: false });
  }
  const token = (req.headers.authorization || '').split(' ')[1];
  const session = activeSessions.get(token);
  return res.json({
    isAuthenticated: true,
    username: session?.username || 'admin',
  });
});

// 7. Auth: Change Credentials (Protected)
app.post('/api/auth/change-credentials', (req, res) => {
  if (!verifyAuthHeader(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { currentPassword, newUsername, newPassword } = req.body;
  if (!currentPassword) {
    return res.status(400).json({ error: 'Password saat ini diperlukan untuk konfirmasi' });
  }

  const authRecord = getAuthRecord();
  const isMatch = bcrypt.compareSync(currentPassword, authRecord.passwordHash);
  if (!isMatch) {
    return res.status(400).json({ error: 'Password saat ini tidak cocok' });
  }

  if (newUsername && newUsername.trim().length >= 3) {
    authRecord.username = newUsername.trim();
  }

  if (newPassword && newPassword.trim().length >= 6) {
    const salt = bcrypt.genSaltSync(10);
    authRecord.passwordHash = bcrypt.hashSync(newPassword.trim(), salt);
  }

  saveAuthRecord(authRecord);

  // Issue new session token
  const token = generateToken(authRecord.username);
  return res.json({
    success: true,
    message: 'Kredensial admin berhasil diperbarui',
    username: authRecord.username,
    token,
  });
});

// 8. Auth: Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

// 9. Upload image endpoint (Protected)
app.post('/api/upload', (req, res) => {
  if (!verifyAuthHeader(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: err.message || 'Gagal mengupload gambar' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file gambar yang diupload' });
    }

    const publicUrl = `/uploads/${req.file.filename}`;
    return res.json({
      success: true,
      url: publicUrl,
      filename: req.file.filename,
      size: req.file.size,
    });
  });
});

// 10. Reset content to defaults (Protected)
app.post('/api/reset-defaults', (req, res) => {
  if (!verifyAuthHeader(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  saveContent(initialLetonData);
  broadcastUpdate(initialLetonData);
  res.json({ success: true, message: 'Data berhasil direset ke default', data: initialLetonData });
});

// ---------------------------------------------
// VITE / STATIC SERVING
// ---------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Leton Coffee server running on http://localhost:${PORT}`);
  });
}

start();
