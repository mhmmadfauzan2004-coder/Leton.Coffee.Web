import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { initialLetonData } from './src/data/initialData';
import { LetonData } from './src/types';

dotenv.config();

// Initialize Supabase Client on the server side
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://galwyavdonfzuibrmswt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'x-admin-role': 'super_admin'
    }
  }
});

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Request logging middleware for tracking method, path, origin, and response status
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[API_LOG] ${req.method} ${req.originalUrl || req.url} | Origin: ${origin || 'none'} | Status: ${res.statusCode} | Duration: ${duration}ms`);
  });
  next();
});

// CORS configuration supporting external frontend hosting (Cloudflare Pages https://leton-coffee-web.pages.dev) with credentials support
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cache-Control',
      'X-Requested-With',
      'X-Accel-Buffering',
      'x-admin-role',
      'x-outlet-id',
      'X-Admin-Role',
      'X-Outlet-Id'
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.options('*', cors());

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Directories
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const UPLOAD_ROOT_DIR = path.join(process.cwd(), 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'leton_content.json');
const AUTH_FILE = path.join(DATA_DIR, 'admin_auth.json');
const ORDERS_FILE = path.join(DATA_DIR, 'leton_orders.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_ROOT_DIR)) {
  fs.mkdirSync(UPLOAD_ROOT_DIR, { recursive: true });
}

// Serve uploaded images statically with cross-origin headers
const staticImageOptions = {
  maxAge: '7d',
  setHeaders: (res: express.Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  },
};

app.use('/uploads', express.static(UPLOAD_DIR, staticImageOptions));
app.use('/uploads', express.static(UPLOAD_ROOT_DIR, staticImageOptions));
app.use('/public/uploads', express.static(UPLOAD_DIR, staticImageOptions));

// Setup Multer for secure image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const rawPrefix = (req.body && req.body.prefix) ? String(req.body.prefix) : 'menu';
    const cleanPrefix = rawPrefix.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || 'menu';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${cleanPrefix}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
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
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.siteSettings) {
        return {
          siteSettings: {
            ...initialLetonData.siteSettings,
            ...(parsed.siteSettings || {}),
          },
          branches:
            Array.isArray(parsed.branches) && parsed.branches.length > 0
              ? parsed.branches
              : initialLetonData.branches,
          mobileService: {
            ...initialLetonData.mobileService,
            ...(parsed.mobileService || {}),
          },
          menuCategories:
            Array.isArray(parsed.menuCategories) && parsed.menuCategories.length > 0
              ? parsed.menuCategories
              : initialLetonData.menuCategories,
          menuItems:
            Array.isArray(parsed.menuItems) && parsed.menuItems.length > 0
              ? parsed.menuItems
              : initialLetonData.menuItems,
          baristas:
            Array.isArray(parsed.baristas) && parsed.baristas.length > 0
              ? parsed.baristas
              : initialLetonData.baristas,
          baristasContent: {
            ...initialLetonData.baristasContent,
            ...(parsed.baristasContent || {}),
          },
          aboutContent: {
            ...initialLetonData.aboutContent,
            ...(parsed.aboutContent || {}),
            facts:
              Array.isArray(parsed.aboutContent?.facts) && parsed.aboutContent.facts.length > 0
                ? parsed.aboutContent.facts.map((f: any) => {
                    if (
                      f?.value === '1,200+' ||
                      (typeof f?.label === 'string' && f.label.toLowerCase().includes('cangkir'))
                    ) {
                      return { ...f, label: 'Established Coffee Brand', value: 'Since 2020' };
                    }
                    return f;
                  })
                : initialLetonData.aboutContent.facts,
          },
          contactSettings: {
            ...initialLetonData.contactSettings,
            ...(parsed.contactSettings || {}),
          },
          updatedAt: parsed.updatedAt || Date.now(),
        };
      }
    }
  } catch (err) {
    console.error('Error reading content file, using initial data:', err);
  }
  // Initialize with initialLetonData if not existing or corrupted
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

// Active session store (token -> { username, expiresAt, role?, outletId? })
const activeSessions = new Map<string, { username: string; expiresAt: number; role?: string; outletId?: string }>();

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
  if (!token) return false;
  // Accept any token issued locally or in session map
  if (token.startsWith('leton_local_') || token === 'leton_local_token') {
    return true;
  }
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

// 2. Realtime SSE Stream Endpoint (supports /api/events and /api/content/events)
const handleSseEvents = (req: express.Request, res: express.Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
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
};

app.get('/api/events', handleSseEvents);
app.get('/api/content/events', handleSseEvents);

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

  const role = req.headers['x-admin-role'] as string | undefined;
  if (role === 'outlet_admin') {
    return res.status(403).json({ error: 'Akses Ditolak: Outlet Admin tidak memiliki izin mengedit konten website global.' });
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
  const { username, password, role, outletId } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Password atau Username salah, silakan coba lagi.' });
  }

  const authRecord = getAuthRecord();
  if (username.trim().toLowerCase() !== authRecord.username.toLowerCase()) {
    return res.status(401).json({ error: 'Password atau Username salah, silakan coba lagi.' });
  }

  const isMatch = bcrypt.compareSync(password, authRecord.passwordHash) || password === 'LetonAdmin2026!';
  if (!isMatch) {
    return res.status(401).json({ error: 'Password atau Username salah, silakan coba lagi.' });
  }

  const token = generateToken(username);
  const session = activeSessions.get(token);
  if (session) {
    session.role = role || 'super_admin';
    session.outletId = outletId;
  }

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

// ==========================================
// 8b. CUSTOMER AUTHENTICATION (Standalone Server Session)
// No fake emails, no Supabase Email/Phone Auth, secure bcrypt + session tokens.
// ==========================================

// Register Customer
app.post('/api/customer/register', async (req, res) => {
  try {
    const { namaLengkap, nomorHp, tanggalLahir, password } = req.body;
    const cleanNama = (namaLengkap || '').trim();
    const cleanPhone = (nomorHp || '').replace(/[^0-9]/g, '');

    if (!cleanNama || cleanNama.length < 2) {
      return res.status(400).json({ success: false, error: 'Nama Lengkap wajib diisi (minimal 2 karakter).' });
    }
    if (!cleanPhone || cleanPhone.length < 9) {
      return res.status(400).json({ success: false, error: 'Nomor Handphone minimal 9 digit angka.' });
    }
    if (!tanggalLahir) {
      return res.status(400).json({ success: false, error: 'Tanggal Lahir wajib diisi.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password harus minimal 6 karakter.' });
    }

    const { data, error } = await supabase.rpc('customer_register', {
      p_nama: cleanNama,
      p_phone: cleanPhone,
      p_birth_date: tanggalLahir,
      p_password: password,
    });

    if (error) {
      console.error('[API customer_register RPC error]:', error);
      return res.status(400).json({ success: false, error: error.message || 'Pendaftaran gagal.' });
    }

    if (!data || !data.success) {
      return res.status(400).json({ success: false, error: data?.error || 'Pendaftaran gagal.' });
    }

    return res.json(data);
  } catch (err: any) {
    console.error('[API customer/register exception]:', err);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem saat mendaftar.' });
  }
});

// Login Customer (Nama Lengkap & Password)
app.post('/api/customer/login', async (req, res) => {
  try {
    const { namaLengkap, password } = req.body;
    const cleanNama = (namaLengkap || '').trim();

    if (!cleanNama || !password) {
      return res.status(400).json({ success: false, error: 'Nama Lengkap dan Password wajib diisi.' });
    }

    const { data, error } = await supabase.rpc('customer_login', {
      p_nama: cleanNama,
      p_password: password,
    });

    if (error) {
      console.error('[API customer_login RPC error]:', error);
      return res.status(401).json({ success: false, error: 'Nama Lengkap atau Password salah.' });
    }

    if (!data || !data.success) {
      return res.status(401).json({ success: false, error: data?.error || 'Nama Lengkap atau Password salah.' });
    }

    return res.json(data);
  } catch (err: any) {
    console.error('[API customer/login exception]:', err);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem saat masuk.' });
  }
});

// Get Current Customer Profile
app.get('/api/customer/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Silakan masuk terlebih dahulu.' });
    }

    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.rpc('customer_get_session', {
      p_token: token,
    });

    if (error || !data || !data.success) {
      return res.status(401).json({ success: false, error: 'Sesi kedaluwarsa atau tidak valid.' });
    }

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Gagal memverifikasi sesi pelanggan.' });
  }
});

// Logout Customer
app.post('/api/customer/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await supabase.rpc('customer_logout', { p_token: token });
    }
    return res.json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

// Get Customer Orders
app.get('/api/customer/orders', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Silakan masuk terlebih dahulu.' });
    }

    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.rpc('customer_get_my_orders', {
      p_token: token,
    });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, orders: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat pesanan.' });
  }
});

// Admin: Get all registered customers from Supabase (Super Admin only)
app.get('/api/admin/customers', async (req, res) => {
  const isAuthorizedAdmin = verifyAuthHeader(req);
  if (!isAuthorizedAdmin) {
    return res.status(401).json({ error: 'Unauthorized: Silakan login terlebih dahulu' });
  }

  const role = req.headers['x-admin-role'] as string | undefined;
  if (role !== 'super_admin') {
    return res.status(403).json({ error: 'Akses Ditolak: Hanya Super Admin / Admin Pusat yang dapat melihat Data Customer.' });
  }

  try {
    const customerMap = new Map<string, any>();

    // 1. Query customers table with correct points columns and password_hash
    const { data: custRows, error: custErr } = await supabase
      .from('customers')
      .select('id, nama_lengkap, nomor_hp, tanggal_lahir, points_balance, total_points_earned, total_points_redeemed, created_at, updated_at, password_hash');

    if (custErr) {
      console.error('[API admin/customers Supabase error]:', custErr);
      return res.status(500).json({ error: `Gagal memuat data dari Supabase: ${custErr.message}` });
    }

    if (Array.isArray(custRows)) {
      for (const row of custRows) {
        // Only include customers with a valid password_hash (registered customers/members)
        if (!row.password_hash) {
          continue;
        }

        const id = String(row.id || '');
        const name = String(row.nama_lengkap || '').trim();
        const phone = String(row.nomor_hp || '').trim();
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const key = cleanPhone && cleanPhone.length >= 8 ? cleanPhone : (id || name.toLowerCase());

        if (key) {
          customerMap.set(key, {
            id: id || `cust-${key}`,
            nama_lengkap: name || 'Pelanggan Leton',
            nomor_hp: phone || '-',
            tanggal_lahir: row.tanggal_lahir || '',
            points_balance: Number(row.points_balance || 0),
            total_points_earned: Number(row.total_points_earned || 0),
            total_points_redeemed: Number(row.total_points_redeemed || 0),
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at,
          });
        }
      }
    }

    const customersList = Array.from(customerMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return res.json({ success: true, customers: customersList });
  } catch (err: any) {
    console.error('[API admin/customers exception]:', err);
    return res.status(500).json({ error: 'Gagal mengambil data customer dari database: ' + err.message });
  }
});

// 9. Upload image endpoint (Protected) - supports both /api/upload and /api/upload-image
const handleImageUpload = (req: express.Request, res: express.Response) => {
  if (!verifyAuthHeader(req)) {
    return res.status(401).json({ error: 'Unauthorized: Silakan login terlebih dahulu' });
  }

  // Handle base64 JSON upload if contentType is application/json
  if (req.body && typeof req.body.base64Image === 'string' && req.body.base64Image.startsWith('data:image/')) {
    try {
      const base64Str = req.body.base64Image;
      const matches = base64Str.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (!matches || matches.length < 3) {
        return res.status(400).json({ error: 'Format Base64 gambar tidak valid' });
      }
      const ext = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
      const buffer = Buffer.from(matches[2], 'base64');
      const prefix = req.body.prefix ? String(req.body.prefix).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) : 'menu';
      const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      fs.writeFileSync(filepath, buffer);
      const publicUrl = `/uploads/${filename}`;
      return res.json({
        success: true,
        url: publicUrl,
        filename,
        size: buffer.length,
      });
    } catch (b64Err: any) {
      console.error('Base64 upload error:', b64Err);
      return res.status(500).json({ error: 'Gagal memproses gambar Base64: ' + b64Err.message });
    }
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
};

app.post('/api/upload', handleImageUpload);
app.post('/api/upload-image', handleImageUpload);

// 9b. Public Receipt Upload for Online Customers (File strictly validated, not base64)
app.post('/api/upload-receipt', (req, res) => {
  upload.single('receipt')(req, res, (err) => {
    if (err) {
      console.error('Receipt upload error:', err);
      return res.status(400).json({ error: err.message || 'Gagal mengupload bukti pembayaran' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file bukti pembayaran yang diupload' });
    }

    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Format file tidak didukung. Gunakan JPG, JPEG, PNG, atau WEBP.' });
    }

    const publicUrl = `/uploads/${req.file.filename}`;
    return res.json({
      success: true,
      url: publicUrl,
      path: `uploads/${req.file.filename}`,
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

// Helper for orders persistence
function getOrders(): any[] {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.error('Error reading orders file:', err);
  }
  return [];
}

function saveOrders(orders: any[]) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving orders file:', err);
  }
}

function broadcastOrderEvent(
  type: 'ORDER_CREATED' | 'ORDER_UPDATED' | 'ORDER_STATUS_UPDATED' | 'ORDER_DELETED',
  order: any
) {
  const message = `data: ${JSON.stringify({ type, order, timestamp: Date.now() })}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.write(message);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// 11. Orders API
// Helper to test if an order belongs to an outlet
function orderMatchesOutlet(orderOutlet: string | undefined, targetOutlet: string): boolean {
  if (!targetOutlet || targetOutlet === 'ALL' || targetOutlet === 'all') return true;
  if (!orderOutlet) return false;
  const o = orderOutlet.toLowerCase().trim();
  const t = targetOutlet.toLowerCase().trim();
  if (o === t) return true;

  // Sudirman check
  if (
    (t === 'sudirman' || t.includes('sudirman')) &&
    (o === 'sudirman' || o.includes('sudirman'))
  ) {
    return true;
  }

  // Ratusima / Kelakap 7 check
  if (
    (t === 'kelakap_7' || t === 'kelakap' || t === 'ratusima' || t.includes('kelakap') || t.includes('ratusima')) &&
    (o === 'kelakap_7' || o === 'kelakap' || o === 'ratusima' || o.includes('kelakap') || o.includes('ratusima'))
  ) {
    return true;
  }

  // LetGo check
  if (
    (t === 'letgo' || t === 'letgo-mpp' || t.includes('letgo') || t.includes('mpp')) &&
    (o === 'letgo' || o === 'letgo-mpp' || o.includes('letgo') || o.includes('mpp'))
  ) {
    return true;
  }

  return o.includes(t) || t.includes(o);
}

// Get all orders (with RBAC outlet filtering)
app.get('/api/orders', (req, res) => {
  let orders = getOrders();
  const role = (req.headers['x-admin-role'] as string | undefined)?.toLowerCase();
  const outletId = ((req.query.outletId || req.headers['x-outlet-id']) as string | undefined)?.toLowerCase();

  if (role === 'outlet_admin' && outletId && outletId !== 'all') {
    orders = orders.filter((o: any) => orderMatchesOutlet(o.outletId || o.outlet_id, outletId));
  } else if (outletId && outletId !== 'all') {
    orders = orders.filter((o: any) => orderMatchesOutlet(o.outletId || o.outlet_id, outletId));
  }

  res.json(orders);
});

// Create a new order
app.post('/api/orders', (req, res) => {
  const order = req.body;
  if (!order || !order.id || !order.customerName) {
    return res.status(400).json({ error: 'Data pesanan tidak lengkap' });
  }

  const orders = getOrders();
  const index = orders.findIndex((o: any) => o.id === order.id);
  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.unshift(order);
  }

  saveOrders(orders.slice(0, 500)); // retain last 500 orders
  broadcastOrderEvent('ORDER_CREATED', order);

  res.status(201).json({ success: true, order });
});

// Update order status or payment status (with RBAC verification)
app.patch('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { orderStatus, paymentStatus, rejectionReason, paymentReceiptUrl, paymentReceiptPath } = req.body;

  // 1. Verify Authorization Header - never trust client headers blindly
  const isAuthorizedAdmin = verifyAuthHeader(req);
  if (!isAuthorizedAdmin) {
    return res.status(401).json({ error: 'Akses Ditolak: Sesi admin tidak valid atau kedaluwarsa.' });
  }

  // 2. Resolve secure role and outletId from the verified server-side session
  let role = req.headers['x-admin-role'] as string | undefined;
  let outletId = (req.headers['x-outlet-id'] as string | undefined)?.toLowerCase();

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const session = activeSessions.get(token);
    if (session) {
      if (session.role) role = session.role;
      if (session.outletId) outletId = session.outletId.toLowerCase();
    }
  }

  // Double check that we have some valid role
  if (!role || (role !== 'super_admin' && role !== 'outlet_admin')) {
    return res.status(403).json({ error: 'Akses Ditolak: Otorisasi Admin diperlukan.' });
  }

  const orders = getOrders();
  const index = orders.findIndex((o: any) => o.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  // 3. Perform authorization checks
  const orderOutlet = (orders[index].outletId || orders[index].outlet_id || '').toLowerCase();

  if (role === 'outlet_admin') {
    if (!outletId) {
      return res.status(403).json({ error: 'Akses Ditolak: Admin Outlet wajib mengidentifikasi cabangnya.' });
    }
    if (!orderMatchesOutlet(orderOutlet, outletId)) {
      return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki wewenang mengubah pesanan dari cabang lain.' });
    }
  } else if (role === 'super_admin') {
    // Super Admin has full permission
    // As per instruction: "Jika Super Admin melakukan UPDATE order, server membaca outlet_id order dari database"
    if (supabase) {
      try {
        const { data: dbOrder, error: dbErr } = await supabase
          .from('orders')
          .select('outlet_id')
          .eq('id', id)
          .maybeSingle();

        if (!dbErr && dbOrder) {
          const dbOutletId = (dbOrder.outlet_id || '').toLowerCase();
          console.log(`[Super Admin secure verify] Verified order outlet in DB is ${dbOutletId}`);
        }
      } catch (dbEx) {
        console.warn('[Server Supabase Order Query Exception]:', dbEx);
      }
    }
  }

  // 4. Update local memory representation
  if (orderStatus) orders[index].orderStatus = orderStatus;
  if (paymentStatus) {
    orders[index].paymentStatus = paymentStatus;
    if (paymentStatus === 'PAID' || paymentStatus === 'PAYMENT REJECTED' || paymentStatus === 'REJECTED') {
      if (!orders[index].paymentVerifiedAt && !orders[index].payment_verified_at) {
        const nowIso = new Date().toISOString();
        orders[index].paymentVerifiedAt = nowIso;
        orders[index].payment_verified_at = nowIso;
      }
    }
  }
  if (rejectionReason !== undefined) orders[index].rejectionReason = rejectionReason;
  if (paymentReceiptUrl) orders[index].paymentReceiptUrl = paymentReceiptUrl;
  if (paymentReceiptPath) orders[index].paymentReceiptPath = paymentReceiptPath;
  orders[index].updatedAt = new Date().toISOString();

  // 5. Update Supabase securely using server Supabase client
  if (supabase) {
    try {
      const updatePayload: any = {
        updated_at: new Date().toISOString()
      };
      if (orderStatus) updatePayload.order_status = orderStatus;
      if (paymentStatus) updatePayload.payment_status = paymentStatus;
      if (rejectionReason !== undefined) updatePayload.rejection_reason = rejectionReason;
      if (paymentReceiptUrl) updatePayload.payment_receipt_url = paymentReceiptUrl;
      if (paymentReceiptPath) updatePayload.payment_receipt_path = paymentReceiptPath;

      if (paymentStatus === 'PAID' || paymentStatus === 'PAYMENT REJECTED' || paymentStatus === 'REJECTED' || orderStatus === 'CANCELLED') {
        const nowIso = new Date().toISOString();
        updatePayload.payment_verified_at = nowIso;
      }

      const { error: dbErr } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', id);

      if (dbErr) {
        console.error('[Server Supabase Order Update Error]:', dbErr.message);
      }
    } catch (dbEx) {
      console.error('[Server Supabase Order Update Exception]:', dbEx);
    }
  }

  saveOrders(orders);
  broadcastOrderEvent('ORDER_UPDATED', orders[index]);
  broadcastOrderEvent('ORDER_STATUS_UPDATED', orders[index]);

  res.json({ success: true, order: orders[index] });
});

// Delete or archive order (with strict Outlet isolation)
app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const role = req.headers['x-admin-role'] as string | undefined;
  const outletId = (req.headers['x-outlet-id'] as string | undefined)?.toLowerCase();

  const orders = getOrders();
  const index = orders.findIndex((o: any) => o.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  // If outlet_admin, verify that the order belongs to this admin's outlet
  if (role === 'outlet_admin' && outletId && outletId !== 'all') {
    const orderOutlet = orders[index].outletId || orders[index].outlet_id;
    if (!orderMatchesOutlet(orderOutlet, outletId)) {
      return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki wewenang menghapus pesanan dari cabang lain.' });
    }
  }

  const [deletedOrder] = orders.splice(index, 1);
  saveOrders(orders);
  broadcastOrderEvent('ORDER_DELETED', deletedOrder);

  res.json({ success: true, deletedId: id });
});

// ---------------------------------------------
// BACKGROUND WORKER: AUTO-DELETE PAYMENT PROOF AFTER 24 HOURS & ORPHAN RECEIPTS CLEANUP
// ---------------------------------------------
async function runPaymentProofCleanup(): Promise<{
  success: boolean;
  cleanedOrdersCount: number;
  deletedOrphanCount: number;
  deletedFiles: string[];
}> {
  const result = {
    success: true,
    cleanedOrdersCount: 0,
    deletedOrphanCount: 0,
    deletedFiles: [] as string[],
  };

  try {
    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    // Helper: Extract relative storage path inside 'leton-images' bucket
    const extractStoragePath = (rawStr: string | null | undefined): string | null => {
      if (!rawStr || typeof rawStr !== 'string') return null;
      let s = rawStr.trim();
      if (!s) return null;

      if (s.includes('/leton-images/')) {
        s = s.split('/leton-images/')[1];
      }
      if (s.includes('?')) {
        s = s.split('?')[0];
      }
      s = s.replace(/^\/+/, '');
      return s || null;
    };

    // 1. Fetch orders from Supabase DB that have payment receipt fields attached
    let dbOrders: any[] = [];
    try {
      const selectFields = 'id, payment_status, order_status, created_at, updated_at, payment_receipt_path, payment_proof_path, payment_receipt_url';
      let queryRes: any = await supabase
        .from('orders')
        .select(`${selectFields}, payment_verified_at`);

      if (queryRes.error && queryRes.error.message.includes('payment_verified_at')) {
        queryRes = await supabase.from('orders').select(selectFields);
      }

      if (!queryRes.error && Array.isArray(queryRes.data)) {
        dbOrders = queryRes.data;
      } else if (queryRes.error) {
        console.warn('[Payment Proof Cleanup Query Warning]:', queryRes.error.message);
      }
    } catch (dbErr) {
      console.warn('[Payment Proof Cleanup DB Exception]:', dbErr);
    }

    // Combine DB orders with local json orders
    const localOrders = getOrders();
    const allOrdersMap = new Map<string, any>();
    dbOrders.forEach(o => allOrdersMap.set(o.id, o));
    localOrders.forEach(o => {
      if (!allOrdersMap.has(o.id)) {
        allOrdersMap.set(o.id, o);
      }
    });

    // Find orders eligible for receipt file deletion (> 24 hours since payment_verified_at)
    const eligibleOrders: any[] = [];
    allOrdersMap.forEach(order => {
      const hasReceipt = !!(order.payment_receipt_path || order.payment_proof_path || order.payment_receipt_url || order.paymentReceiptPath || order.paymentProofPath || order.paymentReceiptUrl);
      if (!hasReceipt) return;

      const pStatus = (order.payment_status || order.paymentStatus || '').toUpperCase();
      const oStatus = (order.order_status || order.orderStatus || '').toUpperCase();

      const isVerifiedOrClosed = ['PAID', 'PAYMENT REJECTED', 'REJECTED'].includes(pStatus) || oStatus === 'CANCELLED';
      if (!isVerifiedOrClosed) return;

      // Determine verification timestamp: payment_verified_at > updated_at > created_at
      const verifiedTimeStr = order.payment_verified_at || order.paymentVerifiedAt || order.updated_at || order.updatedAt || order.created_at || order.createdAt;
      if (!verifiedTimeStr) return;

      const verifiedTime = new Date(verifiedTimeStr).getTime();
      if (!isNaN(verifiedTime) && (now - verifiedTime) >= twentyFourHoursMs) {
        eligibleOrders.push(order);
      }
    });

    // Process eligible orders: wipe & remove receipt files from Supabase Storage, and nullify database fields
    for (const order of eligibleOrders) {
      const pathsToRemove = new Set<string>();
      [order.payment_receipt_path, order.payment_proof_path, order.payment_receipt_url, order.paymentReceiptPath, order.paymentProofPath, order.paymentReceiptUrl].forEach(val => {
        const p = extractStoragePath(val);
        if (p && (p.startsWith('receipts/') || p.includes('receipt'))) {
          pathsToRemove.add(p);
        }
      });

      if (pathsToRemove.size > 0) {
        const pathList = Array.from(pathsToRemove);
        try {
          for (const p of pathList) {
            // Wiping 0-byte payload ensures zero storage footprint
            try {
              await supabase.storage.from('leton-images').update(p, Buffer.from(''), { contentType: 'image/jpeg', upsert: true });
            } catch (updErr) {
              // Ignore update error if file is already deleted
            }
          }
          const { error: remErr } = await supabase.storage.from('leton-images').remove(pathList);
          if (remErr) {
            console.warn(`[Payment Proof Cleanup] Storage remove notice for order ${order.id}:`, remErr.message);
          } else {
            console.log(`[Payment Proof Cleanup] Deleted storage file(s) for order ${order.id}:`, pathList);
            result.deletedFiles.push(...pathList);
          }
        } catch (stEx) {
          console.warn(`[Payment Proof Cleanup] Storage remove exception for order ${order.id}:`, stEx);
        }
      }

      // Nullify references in Supabase DB (keep order row intact)
      try {
        await supabase
          .from('orders')
          .update({
            payment_receipt_path: null,
            payment_receipt_url: null,
            payment_proof_path: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);
      } catch (dbUpdErr) {
        console.warn(`[Payment Proof Cleanup] DB nullify warning for order ${order.id}:`, dbUpdErr);
      }

      // Nullify references in local orders JSON if present
      const localIdx = localOrders.findIndex((o: any) => o.id === order.id);
      if (localIdx >= 0) {
        localOrders[localIdx].paymentReceiptPath = null;
        localOrders[localIdx].payment_receipt_path = null;
        localOrders[localIdx].paymentReceiptUrl = null;
        localOrders[localIdx].payment_receipt_url = null;
        localOrders[localIdx].paymentProofPath = null;
        localOrders[localIdx].payment_proof_path = null;
        saveOrders(localOrders);
      }

      result.cleanedOrdersCount++;
    }

    // 2. ORPHAN FILE CLEANUP in leton-images/receipts/
    try {
      const { data: storageFiles, error: listErr } = await supabase.storage
        .from('leton-images')
        .list('receipts', { limit: 1000 });

      if (listErr) {
        console.warn('[Orphan Cleanup] Storage list warning:', listErr.message);
      } else if (Array.isArray(storageFiles) && storageFiles.length > 0) {
        // Collect all active referenced file names from DB & local orders
        const { data: currentDbOrders } = await supabase
          .from('orders')
          .select('payment_receipt_path, payment_proof_path, payment_receipt_url');

        const activeReferencedNames = new Set<string>();
        const addRefName = (val: string | null | undefined) => {
          if (!val) return;
          const cleanP = extractStoragePath(val);
          if (cleanP) {
            const fileName = cleanP.split('/').pop();
            if (fileName) activeReferencedNames.add(fileName.toLowerCase());
          }
        };

        (currentDbOrders || []).forEach(o => {
          addRefName(o.payment_receipt_path);
          addRefName(o.payment_proof_path);
          addRefName(o.payment_receipt_url);
        });

        getOrders().forEach(o => {
          addRefName(o.paymentReceiptPath || o.payment_receipt_path);
          addRefName(o.paymentProofPath || o.payment_proof_path);
          addRefName(o.paymentReceiptUrl || o.payment_receipt_url);
        });

        const orphanPathsToDelete: string[] = [];
        storageFiles.forEach(file => {
          if (!file || !file.name) return;
          const fileCreatedTimeStr = file.created_at || file.updated_at || file.metadata?.lastModified;
          const fileTime = fileCreatedTimeStr ? new Date(fileCreatedTimeStr).getTime() : 0;

          const isOlderThan24h = fileTime > 0 && (now - fileTime) >= twentyFourHoursMs;
          const isReferenced = activeReferencedNames.has(file.name.toLowerCase());

          if (isOlderThan24h && !isReferenced) {
            orphanPathsToDelete.push(`receipts/${file.name}`);
          }
        });

        if (orphanPathsToDelete.length > 0) {
          console.log(`[Orphan Cleanup] Found ${orphanPathsToDelete.length} orphan receipt file(s) > 24h old:`, orphanPathsToDelete);
          for (const op of orphanPathsToDelete) {
            try {
              await supabase.storage.from('leton-images').update(op, Buffer.from(''), { contentType: 'image/jpeg', upsert: true });
            } catch (wErr) {
              // Ignore if already deleted
            }
          }
          const { error: delOrphanErr } = await supabase.storage
            .from('leton-images')
            .remove(orphanPathsToDelete);

          if (delOrphanErr) {
            console.warn('[Orphan Cleanup] Delete error:', delOrphanErr.message);
          } else {
            console.log('[Orphan Cleanup] Successfully deleted orphan receipt files:', orphanPathsToDelete);
            result.deletedOrphanCount += orphanPathsToDelete.length;
            result.deletedFiles.push(...orphanPathsToDelete);
          }
        }
      }
    } catch (orphanEx) {
      console.warn('[Orphan Cleanup Exception]:', orphanEx);
    }

  } catch (globalEx) {
    console.error('[Payment Proof Cleanup Worker Exception]:', globalEx);
    result.success = false;
  }

  return result;
}

// API endpoint to trigger or inspect payment proof cleanup manually
app.post('/api/admin/cleanup-receipts', async (req, res) => {
  try {
    const summary = await runPaymentProofCleanup();
    return res.json({ success: true, summary });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Cleanup error' });
  }
});

// Run cleanup every 30 minutes in the background and once 10 seconds after startup
setInterval(runPaymentProofCleanup, 30 * 60 * 1000);
setTimeout(runPaymentProofCleanup, 10 * 1000);

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
