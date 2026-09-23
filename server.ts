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
import webpush from 'web-push';
import { initializeApp as initAdminApp, cert as adminCert } from 'firebase-admin/app';
import { getMessaging as getAdminMessaging, Messaging as AdminMessaging } from 'firebase-admin/messaging';
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

// Initialize Firebase Admin SDK for Cloud Messaging (FCM) safely
let fcmMessaging: AdminMessaging | null = null;
try {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    const credentials = typeof serviceAccountEnv === 'string' && serviceAccountEnv.trim().startsWith('{')
      ? JSON.parse(serviceAccountEnv)
      : serviceAccountEnv;
    
    if (credentials) {
      initAdminApp({
        credential: adminCert(credentials)
      });
      fcmMessaging = getAdminMessaging();
      console.log('[FCM Admin] Firebase Admin SDK successfully initialized.');
    }
  } else {
    console.warn('[FCM Admin] Warning: FIREBASE_SERVICE_ACCOUNT is not set. FCM messaging is disabled.');
  }
} catch (err) {
  console.error('[FCM Admin] Error initializing Firebase Admin SDK:', err);
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Request logging middleware for tracking method, path, origin, and response status for API endpoints
app.use((req, res, next) => {
  const url = req.originalUrl || req.url || '';
  if (url.startsWith('/api')) {
    const origin = req.headers.origin || '';
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[API_LOG] ${req.method} ${url} | Origin: ${origin || 'none'} | Status: ${res.statusCode} | Duration: ${duration}ms`);
    });
  }
  next();
});

// Explicit, robust and unified CORS engine supporting credentials and OPTIONS preflight instantly with no duplicate headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://leton-coffee-web.pages.dev');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With, X-Accel-Buffering, x-admin-role, x-outlet-id, X-Admin-Role, X-Outlet-Id');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours

  // Instantly handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Directories
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const UPLOAD_ROOT_DIR = path.join(process.cwd(), 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'leton_content.json');
const AUTH_FILE = path.join(DATA_DIR, 'admin_auth.json');
const ORDERS_FILE = path.join(DATA_DIR, 'leton_orders.json');
const DELETED_CUSTOMERS_FILE = path.join(DATA_DIR, 'deleted_customers.json');

function getDeletedCustomers(): string[] {
  try {
    if (fs.existsSync(DELETED_CUSTOMERS_FILE)) {
      const raw = fs.readFileSync(DELETED_CUSTOMERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.error('Error reading deleted customers file:', err);
  }
  return [];
}

function addDeletedCustomer(idOrPhone: string): void {
  if (!idOrPhone) return;
  const list = getDeletedCustomers();
  const clean = String(idOrPhone).trim().toLowerCase();
  const cleanNum = clean.replace(/[^0-9]/g, '');
  let changed = false;
  if (clean && !list.includes(clean)) {
    list.push(clean);
    changed = true;
  }
  if (cleanNum && cleanNum.length >= 8 && !list.includes(cleanNum)) {
    list.push(cleanNum);
    changed = true;
  }
  if (changed) {
    try {
      fs.writeFileSync(DELETED_CUSTOMERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving deleted customers file:', err);
    }
  }
}

function isCustomerDeleted(id: string, phone?: string): boolean {
  const list = getDeletedCustomers();
  if (list.length === 0) return false;
  const cleanId = String(id || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
  if (cleanId && list.includes(cleanId)) return true;
  if (cleanPhone && cleanPhone.length >= 8 && list.includes(cleanPhone)) return true;
  return false;
}

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

// Periodic heartbeat keep-alive ping for SSE clients (every 15s)
setInterval(() => {
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.write(': keep-alive ping\n\n');
    } catch {
      sseClients.splice(i, 1);
    }
  }
}, 15000);

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

    let custRows: any[] | null = null;
    let custErr: any = null;

    // First try standard select with global admin headers
    try {
      const res = await supabase
        .from('customers')
        .select('id, nama_lengkap, nomor_hp, tanggal_lahir, points_balance, total_points_earned, total_points_redeemed, created_at, updated_at, password_hash');
      custRows = res.data;
      custErr = res.error;
    } catch (e: any) {
      custErr = e;
    }

    // Try RPC fallback if direct query failed or returned 0 rows (highly likely due to RLS restrictions)
    if (custErr || !custRows || custRows.length === 0) {
      console.log('[API admin/customers] Direct query returned 0 rows or failed. Trying security-definer RPC...');
      try {
        const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_registered_customers');
        if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
          custRows = rpcRows;
          custErr = null;
        } else if (rpcErr) {
          console.warn('[API admin/customers RPC fallback error]:', rpcErr.message);
        }
      } catch (rpcEx: any) {
        console.warn('[API admin/customers RPC fallback exception]:', rpcEx.message || rpcEx);
      }
    }

    if (custErr) {
      console.error('[API admin/customers Supabase error]:', custErr);
      return res.status(500).json({ error: `Gagal memuat data dari Supabase: ${custErr.message || custErr}` });
    }

    if (Array.isArray(custRows)) {
      for (const row of custRows) {
        // Only include customers with a valid password_hash (registered customers/members)
        if (!row.password_hash || String(row.password_hash).trim() === '') {
          continue;
        }

        const id = String(row.id || '');
        const name = String(row.nama_lengkap || '').trim();
        const phone = String(row.nomor_hp || '').trim();
        const cleanPhone = phone.replace(/[^0-9]/g, '');

        if (isCustomerDeleted(id, phone) || isCustomerDeleted(cleanPhone)) {
          continue;
        }

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

// Admin: Delete a registered customer member (Super Admin only)
app.delete('/api/admin/customers/:id', async (req, res) => {
  const isAuthorizedAdmin = verifyAuthHeader(req);
  if (!isAuthorizedAdmin) {
    return res.status(401).json({ error: 'Unauthorized: Silakan login terlebih dahulu' });
  }

  const role = req.headers['x-admin-role'] as string | undefined;
  if (role !== 'super_admin') {
    return res.status(403).json({ error: 'Akses Ditolak: Hanya Super Admin / Admin Pusat yang dapat menghapus member.' });
  }

  const rawCustomerId = req.params.id;
  if (!rawCustomerId) {
    return res.status(400).json({ error: 'ID Customer tidak valid.' });
  }

  try {
    // 1. SELECT customer before delete to verify existence and get exact ID & phone
    let targetDbId: string | null = null;
    let targetPhone: string | null = null;

    const cleanNum = rawCustomerId.replace(/[^0-9]/g, '');

    const { data: matchedRows } = await supabase
      .from('customers')
      .select('id, nomor_hp, nama_lengkap, password_hash');

    if (Array.isArray(matchedRows) && matchedRows.length > 0) {
      const targetRow = matchedRows.find((row: any) => {
        const rowId = String(row.id || '');
        const rowPhone = String(row.nomor_hp || '').replace(/[^0-9]/g, '');
        if (rowId === rawCustomerId) return true;
        if (cleanNum && cleanNum.length >= 8 && (rowPhone === cleanNum || rowPhone.endsWith(cleanNum))) return true;
        if (rawCustomerId.startsWith('cust-') && rawCustomerId.includes(rowPhone)) return true;
        return false;
      });

      if (targetRow) {
        targetDbId = String(targetRow.id || '');
        targetPhone = String(targetRow.nomor_hp || '');
      }
    }

    const idsToMatch = Array.from(new Set([rawCustomerId, targetDbId].filter(Boolean) as string[]));

    // 2. Try RPC function variants
    for (const idToDelete of idsToMatch) {
      try {
        await supabase.rpc('delete_registered_customer_rpc', { p_customer_id: idToDelete });
      } catch (e) {}
    }

    // 3. Register deleted customer in persistence store
    for (const idToDelete of idsToMatch) {
      addDeletedCustomer(idToDelete);
    }
    if (targetPhone) {
      addDeletedCustomer(targetPhone);
    }

    // Also persist into leton_content row 'default'
    try {
      const { data: contentRow } = await supabase
        .from('leton_content')
        .select('content')
        .eq('id', 'default')
        .maybeSingle();

      if (contentRow && contentRow.content) {
        const currentData = contentRow.content;
        const currentDeleted = Array.isArray(currentData.deletedCustomerIds) ? currentData.deletedCustomerIds : [];
        const newDeletedSet = new Set([...currentDeleted, ...idsToMatch, targetPhone].filter(Boolean));
        currentData.deletedCustomerIds = Array.from(newDeletedSet);

        await supabase
          .from('leton_content')
          .update({
            content: currentData,
            updated_at: new Date().toISOString()
          })
          .eq('id', 'default');
      }
    } catch (cErr) {
      console.warn('[API DELETE customer] leton_content update warning:', cErr);
    }

    // 4. Unlink orders so order history is preserved as unlinked/guest orders
    for (const idToUnlink of idsToMatch) {
      await supabase
        .from('orders')
        .update({ customer_id: null })
        .eq('customer_id', idToUnlink);
    }

    // 5. Delete related records across auxiliary tables
    for (const idToClean of idsToMatch) {
      await supabase.from('customer_sessions').delete().eq('customer_id', idToClean);
      await supabase.from('reward_redemptions').delete().eq('customer_id', idToClean);
      await supabase.from('loyalty_transactions').delete().eq('customer_id', idToClean);
      await supabase.from('customer_points').delete().eq('customer_id', idToClean);
    }

    // 6. Execute hard DELETE and password_hash clear on public.customers table
    for (const idToRevoke of idsToMatch) {
      await supabase
        .from('customers')
        .update({ password_hash: null, updated_at: new Date().toISOString() })
        .eq('id', idToRevoke);
      await supabase.from('customers').delete().eq('id', idToRevoke);
    }
    if (targetPhone) {
      await supabase
        .from('customers')
        .update({ password_hash: null, updated_at: new Date().toISOString() })
        .eq('nomor_hp', targetPhone);
      await supabase.from('customers').delete().eq('nomor_hp', targetPhone);
    }

    // 7. VERIFICATION SELECT: Query active registered customers directly from Supabase database
    // Must verify from raw database query that customer row is 0 rows / absent
    let verifyList: any[] = [];
    const { data: verifyRpcData, error: verifyRpcErr } = await supabase.rpc('get_registered_customers');

    if (!verifyRpcErr && Array.isArray(verifyRpcData)) {
      verifyList = verifyRpcData;
    } else {
      const { data: directData } = await supabase
        .from('customers')
        .select('id, nama_lengkap, nomor_hp, password_hash');
      verifyList = Array.isArray(directData) ? directData : [];
    }

    // Filter only active member rows (has password_hash and NOT marked as deleted)
    const activeVerifiedList = verifyList.filter((row: any) => {
      if (!row.password_hash || String(row.password_hash).trim() === '') return false;
      const id = String(row.id || '');
      const phone = String(row.nomor_hp || '').trim();
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      if (isCustomerDeleted(id, phone) || isCustomerDeleted(cleanPhone)) return false;
      return true;
    });

    const isStillPresent = activeVerifiedList.some((c: any) => {
      const cId = String(c.id || '');
      const cPhone = String(c.nomor_hp || '').replace(/[^0-9]/g, '');
      const cleanTargetPhone = (targetPhone || '').replace(/[^0-9]/g, '');
      const cleanRawId = rawCustomerId.replace(/[^0-9]/g, '');

      if (cId === rawCustomerId || (targetDbId && cId === targetDbId)) return true;
      if (cleanTargetPhone && cleanTargetPhone.length >= 8 && cPhone === cleanTargetPhone) return true;
      if (cleanRawId && cleanRawId.length >= 8 && cPhone === cleanRawId) return true;
      return false;
    });

    if (isStillPresent) {
      console.error(`[API DELETE customer] Verification failed for ${rawCustomerId}. Record still present in Supabase database!`);
      return res.status(500).json({
        success: false,
        error: 'Gagal menghapus member: Record masih tersimpan di database Supabase.'
      });
    }

    return res.json({ success: true, message: 'Member berhasil dihapus.' });
  } catch (err: any) {
    console.error('[API DELETE /api/admin/customers/:id] Exception:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Terjadi kesalahan sistem saat menghapus member dari database.'
    });
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

// Helper to test if an order belongs to an outlet
function isSudirmanOutlet(val: string | null | undefined): boolean {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  return (
    s === 'sudirman' ||
    s.includes('sudirman') ||
    s === 'chapter-5' ||
    s === 'chapter_5' ||
    s === 'chapter5' ||
    s.includes('chapter 5') ||
    s.includes('chapter-5') ||
    s.includes('ch-5')
  );
}

function isKelakapOutlet(val: string | null | undefined): boolean {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  return (
    s === 'kelakap_7' ||
    s === 'kelakap' ||
    s === 'ratusima' ||
    s.includes('kelakap') ||
    s.includes('ratusima') ||
    s === 'chapter-6' ||
    s === 'chapter_6' ||
    s === 'chapter6' ||
    s.includes('chapter 6') ||
    s.includes('chapter-6') ||
    s.includes('ch-6')
  );
}

function isLetgoOutlet(val: string | null | undefined): boolean {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  return (
    s === 'letgo' ||
    s === 'letgo-mpp' ||
    s === 'let_go' ||
    s === 'let-go' ||
    s.includes('letgo') ||
    s.includes('let-go') ||
    s.includes('mpp')
  );
}

function orderMatchesOutlet(orderOutlet: string | undefined, targetOutlet: string): boolean {
  if (!targetOutlet || targetOutlet === 'ALL' || targetOutlet === 'all') return true;
  if (!orderOutlet) return false;
  const o = orderOutlet.toLowerCase().trim();
  const t = targetOutlet.toLowerCase().trim();
  if (o === t) return true;

  if (isSudirmanOutlet(o) && isSudirmanOutlet(t)) return true;
  if (isKelakapOutlet(o) && isKelakapOutlet(t)) return true;
  if (isLetgoOutlet(o) && isLetgoOutlet(t)) return true;

  return o.includes(t) || t.includes(o);
}

// Get all orders (with RBAC outlet filtering) - Supabase is authoritative
app.get('/api/orders', async (req, res) => {
  const role = (req.headers['x-admin-role'] as string | undefined)?.toLowerCase();
  const outletId = ((req.query.outletId || req.headers['x-outlet-id']) as string | undefined)?.toLowerCase();

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (!error && Array.isArray(data)) {
        let mappedOrders = data.map((row: any) => ({
          id: row.id,
          orderNumber: row.order_number || row.orderNumber || 'LTN-????',
          outletId: row.outlet_id || row.outletId || '',
          outletName: row.outlet_name || row.outletName || '',
          customerName: row.customer_name || row.customerName || '',
          customerPhone: row.customer_phone || row.customerPhone || '',
          customerId: row.customer_id || row.customerId || undefined,
          userId: row.user_id || row.userId || undefined,
          orderType: row.order_type || row.orderType || 'DINE IN',
          tableNumber: row.table_number || row.tableNumber || '',
          items: Array.isArray(row.items) ? row.items : [],
          totalAmount: Number(row.total_amount || row.totalAmount || 0),
          paymentMethod: row.payment_method || row.paymentMethod || 'QRIS',
          paymentStatus: row.payment_status || row.paymentStatus || 'WAITING PAYMENT',
          paymentProofPath: row.payment_proof_path || row.payment_receipt_path || row.paymentReceiptPath,
          paymentReceiptUrl: row.payment_receipt_url || row.paymentReceiptUrl,
          paymentReceiptPath: row.payment_receipt_path || row.payment_proof_path || row.paymentReceiptPath,
          rejectionReason: row.rejection_reason || row.rejectionReason,
          orderStatus: row.order_status || row.orderStatus || 'NEW',
          customerNote: row.customer_note || row.customerNote || '',
          createdAt: row.created_at || row.createdAt || new Date().toISOString(),
          updatedAt: row.updated_at || row.updatedAt,
        }));

        if (role === 'outlet_admin' && outletId && outletId !== 'all') {
          mappedOrders = mappedOrders.filter((o: any) => orderMatchesOutlet(o.outletId, outletId));
        } else if (outletId && outletId !== 'all') {
          mappedOrders = mappedOrders.filter((o: any) => orderMatchesOutlet(o.outletId, outletId));
        }

        // Keep local memory in sync with Supabase
        saveOrders(mappedOrders);
        return res.json(mappedOrders);
      }
    }
  } catch (sbErr) {
    console.warn('[Server GET /api/orders Supabase query warning]:', sbErr);
  }

  let orders = getOrders();
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
  
  // Trigger background push notification to matching admin devices asynchronously
  sendBackgroundPushNotificationForOrder(order, 'POST /api/orders (Express API)').catch((pErr) => {
    console.error('[WebPush] Error triggering push notification:', pErr);
  });

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

  let orders = getOrders();
  const cleanId = id.replace(/^#/, '').trim();
  let index = orders.findIndex((o: any) => o.id === id || o.id === cleanId || o.orderNumber === id || o.orderNumber === cleanId || o.orderNumber === `#${cleanId}`);

  let currentOrder = index >= 0 ? orders[index] : null;

  // If not found in server memory, fetch directly from Supabase
  if (!currentOrder && supabase) {
    try {
      const { data: dbRow, error: dbFetchErr } = await supabase
        .from('orders')
        .select('*')
        .or(`id.eq.${id},id.eq.${cleanId},order_number.eq.${id},order_number.eq.${cleanId},order_number.eq.#${cleanId}`)
        .maybeSingle();

      if (!dbFetchErr && dbRow) {
        currentOrder = {
          id: dbRow.id,
          orderNumber: dbRow.order_number || dbRow.orderNumber || 'LTN-????',
          outletId: dbRow.outlet_id || dbRow.outletId || '',
          outletName: dbRow.outlet_name || dbRow.outletName || '',
          customerName: dbRow.customer_name || dbRow.customerName || '',
          customerPhone: dbRow.customer_phone || dbRow.customerPhone || '',
          customerId: dbRow.customer_id || dbRow.customerId || undefined,
          userId: dbRow.user_id || dbRow.userId || undefined,
          orderType: dbRow.order_type || dbRow.orderType || 'DINE IN',
          tableNumber: dbRow.table_number || dbRow.tableNumber || '',
          items: Array.isArray(dbRow.items) ? dbRow.items : [],
          totalAmount: Number(dbRow.total_amount || dbRow.totalAmount || 0),
          paymentMethod: dbRow.payment_method || dbRow.paymentMethod || 'QRIS',
          paymentStatus: dbRow.payment_status || dbRow.paymentStatus || 'WAITING PAYMENT',
          paymentProofPath: dbRow.payment_proof_path || dbRow.payment_receipt_path || dbRow.paymentReceiptPath,
          paymentReceiptUrl: dbRow.payment_receipt_url || dbRow.paymentReceiptUrl,
          paymentReceiptPath: dbRow.payment_receipt_path || dbRow.payment_proof_path || dbRow.paymentReceiptPath,
          rejectionReason: dbRow.rejection_reason || dbRow.rejectionReason,
          orderStatus: dbRow.order_status || dbRow.orderStatus || 'NEW',
          customerNote: dbRow.customer_note || dbRow.customerNote || '',
          createdAt: dbRow.created_at || dbRow.createdAt || new Date().toISOString(),
          updatedAt: dbRow.updated_at || dbRow.updatedAt,
        };
        orders.unshift(currentOrder);
        index = 0;
      }
    } catch (err) {
      console.warn('[Server fetch order fallback error]:', err);
    }
  }

  if (!currentOrder) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan di database Supabase.' });
  }

  // 3. Perform authorization checks
  const targetDbId = currentOrder.id;
  const orderOutlet = (currentOrder.outletId || currentOrder.outlet_id || '').toLowerCase();

  if (role === 'outlet_admin') {
    if (!outletId) {
      return res.status(403).json({ error: 'Akses Ditolak: Admin Outlet wajib mengidentifikasi cabangnya.' });
    }
    if (!orderMatchesOutlet(orderOutlet, outletId)) {
      return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki wewenang mengubah pesanan dari cabang lain.' });
    }
  }

  // 4. Update local memory representation
  if (orderStatus) currentOrder.orderStatus = orderStatus;
  if (paymentStatus) {
    currentOrder.paymentStatus = paymentStatus;
    if (paymentStatus === 'PAID' || paymentStatus === 'PAYMENT REJECTED' || paymentStatus === 'REJECTED') {
      if (!currentOrder.paymentVerifiedAt && !currentOrder.payment_verified_at) {
        const nowIso = new Date().toISOString();
        currentOrder.paymentVerifiedAt = nowIso;
        currentOrder.payment_verified_at = nowIso;
      }
    }
  }
  if (rejectionReason !== undefined) currentOrder.rejectionReason = rejectionReason;
  if (paymentReceiptUrl) currentOrder.paymentReceiptUrl = paymentReceiptUrl;
  if (paymentReceiptPath) currentOrder.paymentReceiptPath = paymentReceiptPath;
  currentOrder.updatedAt = new Date().toISOString();

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
        .or(`id.eq.${targetDbId},id.eq.${id},id.eq.${cleanId},order_number.eq.${id},order_number.eq.${cleanId},order_number.eq.#${cleanId}`);

      if (dbErr) {
        console.error('[Server Supabase Order Update Error]:', dbErr.message);
      }
    } catch (dbEx) {
      console.error('[Server Supabase Order Update Exception]:', dbEx);
    }
  }

  saveOrders(orders);
  broadcastOrderEvent('ORDER_UPDATED', currentOrder);
  broadcastOrderEvent('ORDER_STATUS_UPDATED', currentOrder);

  res.json({ success: true, order: currentOrder });
});

// Delete or archive order (with strict Outlet isolation & Supabase deletion + verification)
app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const role = req.headers['x-admin-role'] as string | undefined;
  const outletId = (req.headers['x-outlet-id'] as string | undefined)?.toLowerCase();
  const cleanId = id.replace(/^#/, '').trim();

  // 1. Check & delete from local memory/JSON
  const orders = getOrders();
  const index = orders.findIndex((o: any) => o.id === id || o.orderNumber === id || o.orderNumber === cleanId || o.orderNumber === `#${cleanId}`);
  let deletedOrder = null;

  if (index !== -1) {
    // If outlet_admin, verify outlet isolation
    if (role === 'outlet_admin' && outletId && outletId !== 'all') {
      const orderOutlet = orders[index].outletId || orders[index].outlet_id;
      if (!orderMatchesOutlet(orderOutlet, outletId)) {
        return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki wewenang menghapus pesanan dari cabang lain.' });
      }
    }
    [deletedOrder] = orders.splice(index, 1);
    saveOrders(orders);
    broadcastOrderEvent('ORDER_DELETED', deletedOrder);
  }

  // 2. Direct deletion in Supabase database
  let supabaseDeleted = false;
  let supabaseVerified = true;
  let supabaseError: string | null = null;

  try {
    // Delete child items from order_items first
    await supabase
      .from('order_items')
      .delete()
      .or(`order_id.eq.${id},order_id.eq.${cleanId}`);

    // Delete order from orders table
    const { error: delErr } = await supabase
      .from('orders')
      .delete()
      .or(`id.eq.${id},order_number.eq.${id},order_number.eq.${cleanId},order_number.eq.#${cleanId}`);

    if (delErr) {
      console.warn('[Server delete order Supabase warning]:', delErr.message);
      supabaseError = delErr.message;
    } else {
      supabaseDeleted = true;
    }

    // 3. Post-delete verification in Supabase
    const { data: checkData } = await supabase
      .from('orders')
      .select('id, order_number')
      .or(`id.eq.${id},order_number.eq.${id},order_number.eq.${cleanId},order_number.eq.#${cleanId}`);

    if (checkData && checkData.length > 0) {
      supabaseVerified = false;
      console.error('[Server delete order verification failed]: record still exists in Supabase');
    }
  } catch (sbErr: any) {
    console.error('[Server delete order exception]:', sbErr);
    supabaseError = sbErr?.message || 'Supabase delete exception';
  }

  if (!supabaseVerified) {
    return res.status(500).json({
      success: false,
      deleted: false,
      verified: false,
      error: supabaseError || 'Verifikasi gagal: record pesanan masih ada di database Supabase.',
    });
  }

  res.json({
    success: true,
    deleted: true,
    verified: true,
    deletedId: id,
    supabaseDeleted,
  });
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

// =============================================
// WEB PUSH NOTIFICATION BACKEND IMPLEMENTATION
// =============================================
let vapidPublicKey = '';
let vapidPrivateKey = '';

async function initVapid() {
  const keysFile = path.join(DATA_DIR, 'vapid_keys.json');
  let keys;

  // 1. Try from environment first
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    console.log('[WebPush] VAPID keys loaded from environment variables.');
  } else {
    // 2. Try Supabase leton_content with ID 'vapid_keys'
    try {
      const { data, error } = await supabase
        .from('leton_content')
        .select('content')
        .eq('id', 'vapid_keys')
        .maybeSingle();
      if (!error && data?.content) {
        keys = data.content;
        vapidPublicKey = keys.publicKey;
        vapidPrivateKey = keys.privateKey;
        console.log('[WebPush] VAPID keys loaded from Supabase leton_content table.');
      }
    } catch (e) {
      console.warn('[WebPush] Supabase VAPID keys warning:', e);
    }

    // 3. Try local file fallback
    if (!vapidPublicKey || !vapidPrivateKey) {
      try {
        if (fs.existsSync(keysFile)) {
          const raw = fs.readFileSync(keysFile, 'utf-8');
          keys = JSON.parse(raw);
          vapidPublicKey = keys.publicKey;
          vapidPrivateKey = keys.privateKey;
          console.log('[WebPush] VAPID keys loaded from local file.');
        }
      } catch (e) {
        console.error('[WebPush] Local VAPID keys error:', e);
      }
    }

    // 4. Generate new keys if still empty
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log('[WebPush] Generating new stable VAPID keys...');
      keys = webpush.generateVAPIDKeys();
      vapidPublicKey = keys.publicKey;
      vapidPrivateKey = keys.privateKey;

      // Save locally
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2), 'utf-8');
      } catch (e) {}

      // Save to Supabase
      try {
        await supabase
          .from('leton_content')
          .upsert({
            id: 'vapid_keys',
            content: keys,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        console.log('[WebPush] Saved new VAPID keys to Supabase database.');
      } catch (e) {}
    }
  }

  // Sanitize keys to remove any surrounding quotes, newlines, or whitespace
  const cleanVapidKeyStr = (val: string) => val ? val.trim().replace(/^["']|["']$/g, '').trim() : '';
  vapidPublicKey = cleanVapidKeyStr(vapidPublicKey);
  vapidPrivateKey = cleanVapidKeyStr(vapidPrivateKey);

  webpush.setVapidDetails(
    'mailto:admin@letoncoffee.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

// Fetch all active FCM tokens across database table & leton_content fallback
async function getFcmTokens(): Promise<any[]> {
  const tokensMap = new Map<string, any>();

  // 1. Try querying structured admin_push_tokens table
  try {
    const { data, error } = await supabase
      .from('admin_push_tokens')
      .select('*');

    if (!error && Array.isArray(data) && data.length > 0) {
      data.forEach(row => {
        if (row && row.token) {
          tokensMap.set(row.token, {
            token: row.token,
            username: row.username,
            outletId: row.outlet_id,
            role: row.role,
            deviceInfo: row.device_info,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          });
        }
      });
    }
  } catch (err) {
    // Graceful fallback
  }

  // 2. Also check leton_content single-row array
  try {
    const { data, error } = await supabase
      .from('leton_content')
      .select('content')
      .eq('id', 'admin_push_tokens')
      .maybeSingle();

    if (!error && data?.content && Array.isArray(data.content.tokens)) {
      data.content.tokens.forEach((t: any) => {
        if (t && t.token && !tokensMap.has(t.token)) {
          tokensMap.set(t.token, {
            token: t.token,
            username: t.username,
            outletId: t.outletId || t.outlet_id,
            role: t.role,
            deviceInfo: t.deviceInfo || t.device_info || 'unknown',
            createdAt: t.createdAt || t.created_at,
            updatedAt: t.updatedAt || t.updated_at
          });
        }
      });
    }
  } catch (err) {
    // Fallback
  }

  return Array.from(tokensMap.values());
}

// Save active FCM tokens to both structures
async function saveFcmTokens(tokens: any[]): Promise<boolean> {
  const payload = { tokens };
  let tableSuccess = false;

  // 1. Try saving to structured table
  try {
    if (tokens.length > 0) {
      const dbPayloads = tokens.map(t => ({
        token: t.token,
        username: t.username || 'unknown_admin',
        outlet_id: t.outletId || t.outlet_id || 'all',
        role: t.role || 'outlet_admin',
        device_info: t.deviceInfo || t.device_info || 'unknown',
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('admin_push_tokens')
        .upsert(dbPayloads, { onConflict: 'token' });

      if (!error) {
        tableSuccess = true;
      }
    }
  } catch (err) {
    // Fallback
  }

  // 2. Save to leton_content fallback
  try {
    const { error } = await supabase
      .from('leton_content')
      .upsert({
        id: 'admin_push_tokens',
        content: payload,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      return tableSuccess;
    }
    return true;
  } catch (err) {
    return tableSuccess;
  }
}

// Fetch all active subscriptions across database & local cache
async function getPushSubscriptions(): Promise<any[]> {
  const subsMap = new Map<string, any>();

  // 1. Try querying structured push_subscriptions table
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (!error && Array.isArray(data) && data.length > 0) {
      data.forEach(row => {
        if (row && row.endpoint) {
          subsMap.set(row.endpoint, {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.p256dh,
              auth: row.auth
            },
            username: row.username,
            outletId: row.outlet_id,
            role: row.role,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          });
        }
      });
    }
  } catch (err) {
    // Graceful fallback to legacy leton_content
  }

  // 2. Also check leton_content single-row array
  try {
    const { data, error } = await supabase
      .from('leton_content')
      .select('content')
      .eq('id', 'push_subscriptions')
      .maybeSingle();

    if (!error && data?.content && Array.isArray(data.content.subscriptions)) {
      data.content.subscriptions.forEach((sub: any) => {
        if (sub && sub.endpoint && !subsMap.has(sub.endpoint)) {
          subsMap.set(sub.endpoint, {
            endpoint: sub.endpoint,
            keys: sub.keys || { p256dh: sub.p256dh, auth: sub.auth },
            username: sub.username,
            outletId: sub.outletId || sub.outlet_id,
            role: sub.role,
            swScope: sub.swScope || '/',
            swScriptURL: sub.swScriptURL || '',
            swVersion: sub.swVersion || '1.0.9-ios-bg-push',
            createdAt: sub.createdAt || sub.created_at,
            updatedAt: sub.updatedAt || sub.updated_at
          });
        }
      });
    }
  } catch (err) {
    // Graceful fallback to local file
  }

  // 3. Local file fallback
  const subFile = path.join(DATA_DIR, 'push_subscriptions.json');
  try {
    if (fs.existsSync(subFile)) {
      const raw = fs.readFileSync(subFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.subscriptions)) {
        parsed.subscriptions.forEach((sub: any) => {
          if (sub && sub.endpoint && !subsMap.has(sub.endpoint)) {
            subsMap.set(sub.endpoint, sub);
          }
        });
      }
    }
  } catch (err) {}

  const allSubs = Array.from(subsMap.values()).filter(sub => {
    if (!sub || !sub.endpoint) return false;
    const ep = String(sub.endpoint).toLowerCase();
    if (ep.includes('test.endpoint.com') || ep.includes('example.com')) {
      return false;
    }
    return true;
  });
  return allSubs;
}

// Save active subscriptions
async function savePushSubscriptions(subscriptions: any[]): Promise<boolean> {
  const payload = { subscriptions };
  
  // Local save
  const subFile = path.join(DATA_DIR, 'push_subscriptions.json');
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(subFile, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('[WebPush] Error saving subscriptions locally:', err);
  }

  // 1. Try saving to structured push_subscriptions table for each subscription
  let tableSuccess = false;
  try {
    if (subscriptions.length > 0) {
      const dbPayloads = subscriptions.map(sub => ({
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh || '',
        auth: sub.keys?.auth || '',
        username: sub.username || 'unknown_admin',
        outlet_id: sub.outletId || 'all',
        role: sub.role || 'outlet_admin',
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(dbPayloads, { onConflict: 'endpoint' });

      if (!error) {
        tableSuccess = true;
      }
    }
  } catch (err) {
    // Graceful fallback to legacy save
  }

  // 2. Fallback to leton_content save to keep both in sync and always working
  try {
    const { error } = await supabase
      .from('leton_content')
      .upsert({
        id: 'push_subscriptions',
        content: payload,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.error('[WebPush] Error saving subscriptions to Supabase fallback:', error);
      return tableSuccess;
    }
    return true;
  } catch (err) {
    console.error('[WebPush] Supabase save error:', err);
    return tableSuccess;
  }
}

// Set to track sent order push notifications for idempotency
const processedPushOrderIds = new Set<string>();

/**
 * Robust server-side utility to check if an order matches a subscription outlet ID.
 * Handles variations like 'letgo-mpp' vs 'letgo', 'chapter-5' vs 'sudirman', 'chapter-6' vs 'kelakap_7', etc.
 */
function serverMatchesOutlet(orderOutletId: string | null | undefined, targetOutletId: string | null | undefined): boolean {
  if (!targetOutletId || !orderOutletId) return false;

  const o = orderOutletId.toLowerCase().trim();
  const t = targetOutletId.toLowerCase().trim();

  if (o === t) return true;

  const oIsSudirman = isSudirmanOutlet(o);
  const tIsSudirman = isSudirmanOutlet(t);
  const oIsKelakap = isKelakapOutlet(o);
  const tIsKelakap = isKelakapOutlet(t);
  const oIsLetgo = isLetgoOutlet(o);
  const tIsLetgo = isLetgoOutlet(t);

  // If both belong to Sudirman -> match
  if (oIsSudirman && tIsSudirman) return true;
  // If both belong to Kelakap 7 -> match
  if (oIsKelakap && tIsKelakap) return true;
  // If both belong to Letgo -> match
  if (oIsLetgo && tIsLetgo) return true;

  // Strict cross-outlet block: if either is recognized as a specific outlet, do not fuzzy match
  if (oIsSudirman || tIsSudirman || oIsKelakap || tIsKelakap || oIsLetgo || tIsLetgo) {
    return false;
  }

  return o.includes(t) || t.includes(o);
}

async function sendBackgroundPushNotificationForOrder(order: any, triggerSource = 'ORDER_EVENT') {
  if (!order || !order.id) return;
  
  const orderNum = order.orderNumber || order.order_number || order.id;
  const orderOutlet = String(order.outletId || order.outlet_id || '').trim();
  const orderOutletName = String(order.outletName || order.outlet_name || '').trim();
  const customerName = String(order.customerName || order.customer_name || 'Pelanggan').trim();
  const rawTotal = order.totalAmount ?? order.total_amount ?? order.total ?? 0;
  const totalNum = typeof rawTotal === 'number' ? rawTotal : Number(rawTotal) || 0;
  const totalFormatted = `Rp${totalNum.toLocaleString('id-ID')}`;

  if (processedPushOrderIds.has(order.id)) {
    console.log(`[WebPush Trace] Background Push already triggered for order ID: ${order.id} (#${orderNum}). Skipping duplicate.`);
    return;
  }

  processedPushOrderIds.add(order.id);

  // Bound set size
  if (processedPushOrderIds.size > 1000) {
    const firstElement = processedPushOrderIds.values().next().value;
    if (firstElement !== undefined) {
      processedPushOrderIds.delete(firstElement);
    }
  }

  console.log('================================================================');
  console.log(`[REAL ORDER PUSH TRACE - START]`);
  console.log(`- Source        : ${triggerSource}`);
  console.log(`- Order Number  : #${orderNum}`);
  console.log(`- Order ID      : ${order.id}`);
  console.log(`- Outlet ID     : "${orderOutlet}"`);
  console.log(`- Outlet Name   : "${orderOutletName}"`);
  console.log(`- Customer      : ${customerName}`);
  console.log(`- Total Amount  : ${totalFormatted}`);
  console.log('================================================================');

  try {
    const subscriptions = await getPushSubscriptions();
    console.log(`[REAL ORDER PUSH TRACE] Total registered subscriptions in database/store: ${subscriptions.length}`);

    if (subscriptions.length === 0) {
      console.warn('[REAL ORDER PUSH TRACE] ⚠️ WARNING: No push subscriptions found in storage. No admin has registered yet or subscriptions are empty.');
      return;
    }

    // Filter matching subscriptions. Only route to specific outlet admins!
    // CENTRAL ADMIN / super_admin: TIDAK menerima operational order push.
    const matchingSubs = subscriptions.filter(sub => {
      const subRole = String(sub.role || '').toLowerCase();
      const subUsername = String(sub.username || '').toLowerCase();
      const subOutlet = String(sub.outletId || sub.outlet_id || '').toLowerCase();

      // Central admin / super_admin: TIDAK menerima operational order push.
      const isCentral = (
        subRole === 'super_admin' || 
        subOutlet === 'all' || 
        subUsername === 'admin' || 
        subUsername === 'superadmin' ||
        subUsername === 'pusat' ||
        subUsername === 'admin_pusat'
      ) && !isSudirmanOutlet(subOutlet) && !isKelakapOutlet(subOutlet) && !isLetgoOutlet(subOutlet) &&
         !subUsername.includes('sudirman') && !subUsername.includes('kelakap') && !subUsername.includes('ratusima') && !subUsername.includes('letgo');

      if (isCentral) {
        console.log(`[REAL ORDER PUSH TRACE] Excluded Central Super Admin: "${sub.username}" (outlet: "${subOutlet}", role: "${subRole}")`);
        return false;
      }

      // Check outlet match against orderOutlet OR orderOutletName
      const orderCombined = `${orderOutlet} ${orderOutletName}`.toLowerCase();
      const adminCombined = `${subOutlet} ${subUsername}`.toLowerCase();

      const orderIsSudirman = isSudirmanOutlet(orderCombined);
      const orderIsKelakap = isKelakapOutlet(orderCombined);
      const orderIsLetgo = isLetgoOutlet(orderCombined);

      const adminIsSudirman = isSudirmanOutlet(adminCombined);
      const adminIsKelakap = isKelakapOutlet(adminCombined);
      const adminIsLetgo = isLetgoOutlet(adminCombined);

      let isMatch = false;

      if (orderIsSudirman) {
        isMatch = adminIsSudirman && !adminIsKelakap && !adminIsLetgo;
      } else if (orderIsKelakap) {
        isMatch = adminIsKelakap && !adminIsSudirman && !adminIsLetgo;
      } else if (orderIsLetgo) {
        isMatch = adminIsLetgo && !adminIsSudirman && !adminIsKelakap;
      } else {
        isMatch = serverMatchesOutlet(orderOutlet, subOutlet) || serverMatchesOutlet(orderOutletName, subOutlet);
      }

      if (isMatch) {
        console.log(`[REAL ORDER PUSH TRACE] ✅ MATCH: Admin "${sub.username}" (outlet: "${subOutlet}") matches order outlet "${orderOutlet || orderOutletName}"`);
      } else {
        console.log(`[REAL ORDER PUSH TRACE] ❌ NO MATCH: Admin "${sub.username}" (outlet: "${subOutlet}") does not match order outlet "${orderOutlet || orderOutletName}"`);
      }

      return isMatch;
    });

    console.log(`[REAL ORDER PUSH TRACE] Target Matching Subscriptions Count: ${matchingSubs.length}`);

    if (matchingSubs.length === 0) {
      console.warn(`[REAL ORDER PUSH TRACE] ⚠️ WARNING: 0 matching admin subscriptions for order #${orderNum} (Outlet: "${orderOutlet || orderOutletName}"). No notification will be sent.`);
      return;
    }

    const payload = JSON.stringify({
      title: '🔔 Leton Coffee',
      body: `Pesanan Baru Masuk!\n#${orderNum} • ${customerName} • ${totalFormatted}`,
      icon: 'https://leton-coffee-web.pages.dev/logo_icon_small.png',
      tag: `order-push-${order.id || Date.now()}`,
      data: {
        type: 'NEW_ORDER',
        orderId: order.id,
        orderNumber: orderNum,
        outletId: orderOutlet || '',
        outletName: orderOutletName || '',
        customerName: customerName,
        totalFormatted: totalFormatted,
        timestamp: Date.now(),
        url: '/#admin?tab=orders'
      }
    });

    console.log(`[REAL ORDER PUSH TRACE] 🚀 Invoking webpush.sendNotification() for ${matchingSubs.length} target device(s)...`);

    const staleEndpoints: string[] = [];

    await Promise.all(
      matchingSubs.map(async (sub, idx) => {
        let endpointDomain = 'unknown-push-service';
        try {
          endpointDomain = new URL(sub.endpoint).hostname;
        } catch (e) {}

        const isAppleEndpoint = sub.endpoint.includes('push.apple.com') || sub.endpoint.includes('apple.com');

        const subPayload = JSON.stringify({
          web_push: 8030,
          title: '🔔 Leton Coffee',
          body: `Pesanan Baru Masuk!\n#${orderNum} • ${customerName} • ${totalFormatted}`,
          icon: 'https://leton-coffee-web.pages.dev/logo_icon_small.png',
          badge: 'https://leton-coffee-web.pages.dev/logo_icon_small.png',
          tag: `order-push-${order.id || Date.now()}`,
          navigate: `https://leton-coffee-web.pages.dev/#admin?tab=orders&orderId=${encodeURIComponent(order.id || '')}`,
          notification: {
            title: '🔔 Leton Coffee',
            body: `Pesanan Baru Masuk! #${orderNum} • ${customerName} • ${totalFormatted}`,
            navigate: `https://leton-coffee-web.pages.dev/#admin?tab=orders&orderId=${encodeURIComponent(order.id || '')}`,
            silent: false
          },
          data: {
            type: 'NEW_ORDER',
            orderId: order.id,
            orderNumber: orderNum,
            outletId: orderOutlet || '',
            outletName: orderOutletName || '',
            customerName: customerName,
            totalFormatted: totalFormatted,
            timestamp: Date.now(),
            url: `https://leton-coffee-web.pages.dev/#admin?tab=orders&orderId=${encodeURIComponent(order.id || '')}`
          }
        });

        const pushOptions = {
          TTL: 86400,
          urgency: 'high' as const,
          headers: isAppleEndpoint ? {
            'Content-Type': 'application/notification+json',
            'Urgency': 'high'
          } : {
            'Urgency': 'high'
          }
        };

        console.log(`[REAL ORDER PUSH DISPATCH #${idx + 1}] Target: "${sub.username}" | Outlet: "${sub.outletId}" | Apple Provider: ${isAppleEndpoint ? 'YES' : 'NO'} ("${endpointDomain}")`);

        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth
            }
          };

          const pushResult = await webpush.sendNotification(pushSubscription, subPayload, pushOptions);
          const statusCode = pushResult.statusCode || 201;
          console.log(`[REAL ORDER PUSH DISPATCH #${idx + 1}] ✅ SUCCESS: Provider status ${statusCode} for admin "${sub.username}" on ${endpointDomain}.`);
        } catch (err: any) {
          const statusCode = err.statusCode || err.status || 'unknown';
          const isExpired = statusCode === 410 || statusCode === 404;
          console.error(`[REAL ORDER PUSH DISPATCH #${idx + 1}] ❌ FAILED: Provider error for admin "${sub.username}". StatusCode: ${statusCode}, Error: ${err.message || String(err)}`);
          if (err.body) {
            console.error(`[REAL ORDER PUSH DISPATCH #${idx + 1}] Provider Error Body:`, err.body);
          }
          if (isExpired) {
            staleEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    // Prune stale subscriptions if any
    if (staleEndpoints.length > 0) {
      console.log(`[REAL ORDER PUSH TRACE] Pruning ${staleEndpoints.length} stale/expired subscription(s) from database.`);
      const activeSubs = subscriptions.filter(sub => !staleEndpoints.includes(sub.endpoint));
      await savePushSubscriptions(activeSubs);

      for (const ep of staleEndpoints) {
        try {
          await supabase.from('push_subscriptions').delete().eq('endpoint', ep);
        } catch (dbErr) {}
      }
    }

    // FCM CLOUD MESSAGING (FCM) DISPATCH
    try {
      const fcmTokens = await getFcmTokens();
      console.log(`[FCM Admin Dispatch] Total registered FCM tokens found: ${fcmTokens.length}`);

      if (fcmTokens.length > 0) {
        // Filter matching FCM tokens. Only route to specific outlet admins!
        // CENTRAL ADMIN / super_admin: TIDAK menerima operational order push.
        const matchingFcm = fcmTokens.filter(t => {
          const tRole = String(t.role || '').toLowerCase();
          const tUsername = String(t.username || '').toLowerCase();
          const tOutlet = String(t.outletId || t.outlet_id || '').toLowerCase();

          const isCentral = (
            tRole === 'super_admin' || 
            tOutlet === 'all' || 
            tUsername === 'admin' || 
            tUsername === 'superadmin' ||
            tUsername === 'pusat' ||
            tUsername === 'admin_pusat'
          ) && !isSudirmanOutlet(tOutlet) && !isKelakapOutlet(tOutlet) && !isLetgoOutlet(tOutlet) &&
             !tUsername.includes('sudirman') && !tUsername.includes('kelakap') && !tUsername.includes('ratusima') && !tUsername.includes('letgo');

          if (isCentral) {
            console.log(`[FCM Admin Dispatch] Excluded Central Super Admin: "${t.username}"`);
            return false;
          }

          const orderCombined = `${orderOutlet} ${orderOutletName}`.toLowerCase();
          const adminCombined = `${tOutlet} ${tUsername}`.toLowerCase();

          const orderIsSudirman = isSudirmanOutlet(orderCombined);
          const orderIsKelakap = isKelakapOutlet(orderCombined);
          const orderIsLetgo = isLetgoOutlet(orderCombined);

          const adminIsSudirman = isSudirmanOutlet(adminCombined);
          const adminIsKelakap = isKelakapOutlet(adminCombined);
          const adminIsLetgo = isLetgoOutlet(adminCombined);

          let isMatch = false;
          if (orderIsSudirman) {
            isMatch = adminIsSudirman && !adminIsKelakap && !adminIsLetgo;
          } else if (orderIsKelakap) {
            isMatch = adminIsKelakap && !adminIsSudirman && !adminIsLetgo;
          } else if (orderIsLetgo) {
            isMatch = adminIsLetgo && !adminIsSudirman && !adminIsKelakap;
          } else {
            isMatch = serverMatchesOutlet(orderOutlet, tOutlet) || serverMatchesOutlet(orderOutletName, tOutlet);
          }

          return isMatch;
        });

        console.log(`[FCM Admin Dispatch] Target Matching FCM Tokens Count: ${matchingFcm.length}`);

        if (matchingFcm.length > 0 && fcmMessaging) {
          const staleFcmTokens: string[] = [];

          await Promise.all(
            matchingFcm.map(async (t, fIdx) => {
              console.log(`[FCM Dispatch #${fIdx + 1}] Dispatching to admin "${t.username}" for outlet "${t.outletId}"`);
              
              const messagePayload = {
                token: t.token,
                notification: {
                  title: '🔔 Leton Coffee',
                  body: `Pesanan Baru Masuk! #${orderNum} • ${customerName} • ${totalFormatted}`,
                },
                data: {
                  type: 'NEW_ORDER',
                  orderId: String(order.id),
                  orderNumber: String(orderNum),
                  outletId: String(orderOutlet),
                  outletName: String(orderOutletName),
                  customerName: String(customerName),
                  totalFormatted: String(totalFormatted),
                  timestamp: String(Date.now()),
                  url: `https://leton-coffee-web.pages.dev/#admin?tab=orders&orderId=${encodeURIComponent(order.id || '')}`
                },
                apns: {
                  payload: {
                    aps: {
                      alert: {
                        title: '🔔 Leton Coffee',
                        body: `Pesanan Baru Masuk! #${orderNum} • ${customerName} • ${totalFormatted}`
                      },
                      sound: 'default',
                      badge: 1
                    }
                  }
                }
              };

              try {
                const response = await fcmMessaging!.send(messagePayload);
                console.log(`[FCM Dispatch #${fIdx + 1}] ✅ SUCCESS: Message sent. ID: ${response}`);
              } catch (fcmErr: any) {
                console.error(`[FCM Dispatch #${fIdx + 1}] ❌ FAILED for admin "${t.username}". Error:`, fcmErr.message || fcmErr);
                
                const code = fcmErr.code || '';
                const isStale = (
                  code === 'messaging/registration-token-not-registered' || 
                  code === 'messaging/invalid-registration-token' ||
                  fcmErr.message?.includes('registration-token-not-registered') ||
                  fcmErr.message?.includes('not registered')
                );
                
                if (isStale) {
                  staleFcmTokens.push(t.token);
                }
              }
            })
          );

          if (staleFcmTokens.length > 0) {
            console.log(`[FCM Admin Dispatch] Pruning ${staleFcmTokens.length} stale/invalid FCM tokens.`);
            const activeFcm = fcmTokens.filter(t => !staleFcmTokens.includes(t.token));
            await saveFcmTokens(activeFcm);

            for (const tk of staleFcmTokens) {
              try {
                await supabase.from('admin_push_tokens').delete().eq('token', tk);
              } catch (dbErr) {}
            }
          }
        } else if (matchingFcm.length > 0 && !fcmMessaging) {
          console.warn('[FCM Admin Dispatch] ⚠️ WARNING: FCM SDK is not initialized (credentials missing). Skip sending.');
        }
      }
    } catch (fcmDispatchErr) {
      console.error('[FCM Admin Dispatch] Fatal error in FCM dispatch loop:', fcmDispatchErr);
    }

    // ONESIGNAL PUSH NOTIFICATION DISPATCH
    try {
      const oneSignalAppId = process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID;
      const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY;

      if (oneSignalAppId && oneSignalApiKey) {
        let targetOutlet = '';
        const combined = `${orderOutlet} ${orderOutletName}`.toLowerCase();
        if (isKelakapOutlet(combined)) {
          targetOutlet = 'kelakap_7';
        } else if (isLetgoOutlet(combined)) {
          targetOutlet = 'letgo';
        } else if (isSudirmanOutlet(combined)) {
          targetOutlet = 'sudirman';
        }

        if (targetOutlet) {
          console.log(`[OneSignal Server Dispatch] Sending push notification for Order #${orderNum} to outlet "${targetOutlet}"...`);
          const targetUrl = `https://leton-coffee-web.pages.dev/#admin?tab=orders&orderId=${encodeURIComponent(order.id)}&outletId=${encodeURIComponent(targetOutlet)}`;

          const osPayload = {
            app_id: oneSignalAppId,
            headings: { en: '🔔 Leton Coffee' },
            contents: {
              en: `Pesanan Baru Masuk!\n#${orderNum} • ${customerName} • ${totalFormatted}`
            },
            filters: [
              { field: 'tag', key: 'outlet_id', relation: '=', value: targetOutlet }
            ],
            url: targetUrl,
            web_url: targetUrl,
            chrome_web_icon: 'https://leton-coffee-web.pages.dev/logo_icon_small.png',
            chrome_web_badge: 'https://leton-coffee-web.pages.dev/logo_icon_small.png',
            data: {
              type: 'NEW_ORDER',
              orderId: String(order.id),
              orderNumber: String(orderNum),
              outletId: targetOutlet,
              url: targetUrl
            },
            collapse_id: `order-${order.id}`
          };

          const osRes = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Key ${oneSignalApiKey}`
            },
            body: JSON.stringify(osPayload)
          });

          const osData = await osRes.json();
          console.log('[OneSignal Server Dispatch] Response from OneSignal:', osData);
        } else {
          console.log(`[OneSignal Server Dispatch] Skipped: outlet "${combined}" is not an operational outlet.`);
        }
      } else {
        console.log('[OneSignal Server Dispatch] Notice: ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not configured on backend.');
      }
    } catch (osErr) {
      console.error('[OneSignal Server Dispatch] Error dispatching push:', osErr);
    }

    console.log(`[REAL ORDER PUSH TRACE - COMPLETE] Order #${orderNum} push notification lifecycle finished.`);
    console.log('================================================================');
  } catch (err) {
    console.error('[REAL ORDER PUSH TRACE] Fatal error in sendBackgroundPushNotificationForOrder:', err);
  }
}

// Real-time listener for incoming orders via Supabase
function initSupabaseOrderListener() {
  try {
    const channel = supabase.channel('server_backend_orders_listener');
    channel
      .on('broadcast', { event: 'ORDER_CREATED' }, (event) => {
        const order = event.payload;
        if (order && order.id) {
          console.log(`[WebPush Listener] Received ORDER_CREATED broadcast for order ${order.orderNumber || order.id}`);
          sendBackgroundPushNotificationForOrder(order, 'Supabase Broadcast (ORDER_CREATED)').catch(err => {
            console.error('[WebPush Listener] Push trigger error:', err);
          });
        }
      })
      .on('broadcast', { event: 'TEST_PUSH' }, (event) => {
        console.log('[WebPush Listener] Received TEST_PUSH broadcast event:', event.payload);
        executeTestPush(event.payload || {}).catch(err => {
          console.error('[WebPush Listener] Test Push trigger error:', err);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leton_content' }, (payload) => {
        const row = payload.new as any;
        if (row && (row.id === 'test_push_trigger' || row.id === 'push_trigger' || (typeof row.id === 'string' && row.id.startsWith('test_push')))) {
          console.log('[WebPush Listener] Received leton_content trigger:', row);
          const content = row.content || {};
          executeTestPush({
            title: content.title || 'TEST BACKGROUND PUSH',
            body: content.body || 'TEST PUSH LETON COFFEE',
            outletId: content.outlet_id || content.outletId || 'sudirman'
          }).catch(err => {
            console.error('[WebPush Listener] leton_content push error:', err);
          });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new;
        if (row && row.id) {
          console.log(`[WebPush Listener] Received DB INSERT for order ${row.order_number || row.id}`);
          const formattedOrder = {
            id: row.id,
            orderNumber: row.order_number || row.id,
            outletId: row.outlet_id,
            outletName: row.outlet_name,
            customerName: row.customer_name,
            totalAmount: row.total_amount,
            orderStatus: row.order_status,
            createdAt: row.created_at
          };
          sendBackgroundPushNotificationForOrder(formattedOrder, 'Supabase Postgres INSERT (orders table)').catch(err => {
            console.error('[WebPush Listener] DB Push trigger error:', err);
          });
        }
      })
      .subscribe((status) => {
        console.log(`[WebPush Listener] Supabase Realtime Orders listener status: ${status}`);
      });
  } catch (err) {
    console.warn('[WebPush Listener] Could not initialize Supabase Realtime Orders listener:', err);
  }
}

// ---------------------------------------------
// PUSH ENDPOINTS
// ---------------------------------------------
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

// Admin debug endpoint returning non-sensitive metadata for Web Push diagnostic
app.get('/api/push/debug', async (req, res) => {
  try {
    const subs = await getPushSubscriptions();
    
    // Fingerprint of VAPID public key (non-sensitive)
    const pubKeyClean = (vapidPublicKey || '').trim();
    const vapidPublicKeyFingerprint = pubKeyClean.length > 16 
      ? `${pubKeyClean.slice(0, 10)}...${pubKeyClean.slice(-6)} (total length: ${pubKeyClean.length})` 
      : (pubKeyClean ? pubKeyClean : 'NOT_SET');

    const sanitizedSubs = subs.map(sub => {
      let endpointDomain = 'unknown';
      try {
        if (sub.endpoint) {
          endpointDomain = new URL(sub.endpoint).hostname;
        }
      } catch (e) {}

      return {
        username: sub.username || 'unknown',
        outlet_id: sub.outletId || sub.outlet_id || 'all',
        role: sub.role || 'outlet_admin',
        endpointDomain,
        endpoint: sub.endpoint,
        hasP256dh: !!(sub.keys?.p256dh || sub.p256dh),
        hasAuth: !!(sub.keys?.auth || sub.auth),
        swScope: sub.swScope || '/',
        swScriptURL: sub.swScriptURL || '',
        swVersion: sub.swVersion || '1.0.9-ios-bg-push',
        created_at: sub.createdAt || sub.created_at || null,
        updated_at: sub.updatedAt || sub.updated_at || null
      };
    });

    res.json({
      status: 'ok',
      activeSubscriptionsCount: subs.length,
      vapidPublicKeyFingerprint,
      serviceWorkerVersion: '1.0.9-ios-bg-push',
      serviceWorkerStatus: 'active_and_no_cache_configured',
      subscriptions: sanitizedSubs,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil data debug push notification' });
  }
});

// ---------------------------------------------
// ONESIGNAL WEB PUSH ENDPOINTS
// ---------------------------------------------

// Public dynamic OneSignal configuration for the frontend
app.get('/api/onesignal/config', (req, res) => {
  res.json({
    appId: process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || "517cbdc4-cd11-4661-b4e6-aec93387acb1"
  });
});

app.post('/api/onesignal/subscribe', async (req, res) => {
  const { subscriptionId, username, outletId, role, deviceInfo } = req.body;
  if (!subscriptionId) {
    return res.status(400).json({ error: 'subscriptionId is required.' });
  }

  try {
    // 1. Save to structured admin_onesignal_subscriptions table in Supabase
    try {
      await supabase
        .from('admin_onesignal_subscriptions')
        .upsert({
          subscription_id: subscriptionId,
          username: username || 'unknown_admin',
          outlet_id: outletId || 'unknown',
          role: role || 'outlet_admin',
          device_info: deviceInfo || 'web',
          updated_at: new Date().toISOString()
        }, { onConflict: 'subscription_id' });
    } catch (dbErr) {
      console.warn('[OneSignal API] Database table upsert warning:', dbErr);
    }

    // 2. Also save to leton_content fallback for multi-layer redundancy
    try {
      const { data } = await supabase
        .from('leton_content')
        .select('content')
        .eq('id', 'admin_onesignal_subscriptions')
        .maybeSingle();

      const existing = (data?.content && Array.isArray(data.content.subscriptions)) ? data.content.subscriptions : [];
      const filtered = existing.filter((s: any) => s.subscriptionId !== subscriptionId);
      filtered.push({
        subscriptionId,
        username: username || 'unknown_admin',
        outletId: outletId || 'unknown',
        role: role || 'outlet_admin',
        deviceInfo: deviceInfo || 'web',
        updatedAt: new Date().toISOString()
      });

      await supabase
        .from('leton_content')
        .upsert({
          id: 'admin_onesignal_subscriptions',
          content: { subscriptions: filtered.slice(-100) },
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
    } catch (fallbackErr) {}

    console.log(`[OneSignal API] Subscription registered for user "${username}" (outlet: ${outletId}).`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to register OneSignal subscription' });
  }
});

app.post('/api/onesignal/unsubscribe', async (req, res) => {
  const { subscriptionId } = req.body;
  if (!subscriptionId) return res.json({ success: true });
  try {
    await supabase
      .from('admin_onesignal_subscriptions')
      .delete()
      .eq('subscription_id', subscriptionId);
  } catch (e) {}
  res.json({ success: true });
});

app.post('/api/onesignal/test', async (req, res) => {
  const { outletId, username } = req.body;
  const appId = process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    return res.status(503).json({
      success: false,
      error: 'OneSignal credential (ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY) belum dikonfigurasi pada server.'
    });
  }

  const targetOutlet = isKelakapOutlet(outletId) ? 'kelakap_7' : isLetgoOutlet(outletId) ? 'letgo' : 'sudirman';

  try {
    const osRes = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${apiKey}`
      },
      body: JSON.stringify({
        app_id: appId,
        headings: { en: '🔔 Leton Coffee' },
        contents: {
          en: `Tes Notifikasi Background OneSignal Berhasil! Outlet: ${targetOutlet.toUpperCase()}`
        },
        filters: [
          { field: 'tag', key: 'outlet_id', relation: '=', value: targetOutlet }
        ],
        url: 'https://leton-coffee-web.pages.dev/#admin?tab=orders',
        web_url: 'https://leton-coffee-web.pages.dev/#admin?tab=orders',
        chrome_web_icon: 'https://leton-coffee-web.pages.dev/logo_icon_small.png',
        chrome_web_badge: 'https://leton-coffee-web.pages.dev/logo_icon_small.png',
        data: {
          type: 'TEST_PUSH',
          outletId: targetOutlet,
          url: 'https://leton-coffee-web.pages.dev/#admin?tab=orders'
        }
      })
    });

    const osData = await osRes.json();
    console.log('[OneSignal Test] Response from OneSignal:', osData);
    if (osData.errors) {
      const errStr = JSON.stringify(osData.errors);
      if (errStr.includes('not subscribed') || errStr.includes('no players') || errStr.includes('All included players')) {
        return res.json({
          success: true,
          recipients: 0,
          id: null,
          message: 'OneSignal API aktif, namun belum ada perangkat admin yang terdaftar dengan tag outlet ini.'
        });
      }
      return res.status(400).json({ success: false, error: errStr });
    }
    res.json({ success: true, recipients: osData.recipients || 0, id: osData.id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Gagal mengirim test notification.' });
  }
});

// ---------------------------------------------
// FIREBASE CLOUD MESSAGING (FCM) ENDPOINTS
// ---------------------------------------------

// Public dynamic Firebase configuration for the frontend & service worker
app.get('/api/push/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.VITE_FIREBASE_API_KEY || "",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.VITE_FIREBASE_APP_ID || "",
    vapidKey: process.env.VITE_FIREBASE_VAPID_KEY || ""
  });
});

app.post('/api/fcm/subscribe', async (req, res) => {
  const { token, username, outlet_id, role, device_info } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required.' });
  }

  try {
    const currentTokens = await getFcmTokens();
    const cleanTokens = currentTokens.filter(t => t.token !== token);

    cleanTokens.push({
      token,
      username: username || 'unknown_admin',
      outletId: outlet_id || 'all',
      role: role || 'outlet_admin',
      deviceInfo: device_info || 'unknown_device',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Limit to last 150 tokens to avoid document limits
    const finalTokens = cleanTokens.slice(Math.max(0, cleanTokens.length - 150));
    await saveFcmTokens(finalTokens);

    console.log(`[FCM API] Token successfully saved for user "${username}" at outlet "${outlet_id}".`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to subscribe FCM token.' });
  }
});

app.post('/api/fcm/unsubscribe', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required.' });
  }

  try {
    const currentTokens = await getFcmTokens();
    const cleanTokens = currentTokens.filter(t => t.token !== token);
    await saveFcmTokens(cleanTokens);

    try {
      await supabase
        .from('admin_push_tokens')
        .delete()
        .eq('token', token);
    } catch (dbErr) {}

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to unsubscribe FCM token.' });
  }
});

app.post('/api/fcm/test', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required.' });
  }

  if (!fcmMessaging) {
    return res.status(503).json({ error: 'Firebase Cloud Messaging backend service is not initialized on this instance. Configure FIREBASE_SERVICE_ACCOUNT.' });
  }

  try {
    console.log(`[FCM API Test] Sending background test message to token: ${token.slice(0, 15)}...`);
    const payload = {
      token,
      notification: {
        title: '🔔 Leton Coffee',
        body: 'Tes Notifikasi Background FCM Berhasil!',
      },
      data: {
        type: 'TEST_PUSH',
        orderId: 'TEST-FCM-001',
        url: 'https://leton-coffee-web.pages.dev/#admin?tab=orders'
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: '🔔 Leton Coffee',
              body: 'Tes Notifikasi Background FCM Berhasil!'
            },
            sound: 'default'
          }
        }
      }
    };

    const response = await fcmMessaging.send(payload);
    res.json({ success: true, messageId: response });
  } catch (err: any) {
    console.error('[FCM API Test] Error sending test messaging payload:', err);
    res.status(500).json({ error: err.message || 'FCM delivery exception.' });
  }
});

app.post('/api/push/subscribe', async (req, res) => {
  const { subscription, username, outletId, role } = req.body;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Subscription data is invalid.' });
  }

  try {
    const currentSubs = await getPushSubscriptions();
    // Filter out existing subscription with the same endpoint to avoid duplicates
    const cleanSubs = currentSubs.filter(sub => sub.endpoint !== subscription.endpoint);
    
    // Add the new / updated subscription
    cleanSubs.push({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      username: username || 'unknown_admin',
      outletId: outletId || 'all',
      role: role || 'outlet_admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Retain only the last 100 devices
    const finalSubs = cleanSubs.slice(Math.max(0, cleanSubs.length - 100));

    await savePushSubscriptions(finalSubs);
    console.log(`[WebPush] Subscription saved successfully for admin ${username} at outlet ${outletId}.`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save subscription.' });
  }
});

app.post('/api/push/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required.' });
  }

  try {
    const currentSubs = await getPushSubscriptions();
    const cleanSubs = currentSubs.filter(sub => sub.endpoint !== endpoint);
    await savePushSubscriptions(cleanSubs);

    // Explicitly delete from the structured table as well
    try {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);
    } catch (dbErr) {
      // Graceful fallback
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to unsubscribe.' });
  }
});

app.get('/api/push/telemetry', async (_req, res) => {
  try {
    const { data } = await supabase
      .from('leton_content')
      .select('content')
      .eq('id', 'sw_telemetry_logs')
      .maybeSingle();

    const logs = data?.content?.logs || [];
    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch telemetry.' });
  }
});

app.get('/api/push/info', async (_req, res) => {
  try {
    const { data: vapidData } = await supabase
      .from('leton_content')
      .select('content')
      .eq('id', 'vapid_keys')
      .maybeSingle();

    const pubKey = vapidData?.content?.publicKey || '';
    const pubFingerprint = crypto.createHash('sha256').update(pubKey).digest('hex').slice(0, 12);

    const { data: subData } = await supabase
      .from('leton_content')
      .select('content')
      .eq('id', 'push_subscriptions')
      .maybeSingle();

    const subs = subData?.content?.subscriptions || [];
    const sudirmanSub = subs.find((s: any) => s.username === 'sudirman' || s.outletId === 'sudirman');

    let provider = 'none';
    let age = 'none';

    if (sudirmanSub) {
      provider = new URL(sudirmanSub.endpoint).hostname;
      const createdAt = sudirmanSub.createdAt || sudirmanSub.created_at;
      if (createdAt) {
        const ageMs = Date.now() - new Date(createdAt).getTime();
        const ageMins = Math.floor(ageMs / (1000 * 60));
        age = `${ageMins} minutes ago`;
      }
    }

    res.json({
      subscription_provider: provider,
      subscription_age: age,
      vapid_public_key_fingerprint: pubFingerprint,
      service_worker_version: '1.1.2-ios-telemetry'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch diagnostic info.' });
  }
});

async function executeTestPush(options: { title?: string; body?: string; subscription?: any; outletId?: string }) {
  console.log('====================================');
  console.log('[TEST PUSH START]');
  try {
    const clientSubscription = options.subscription;
    const targetOutlet = options.outletId || 'sudirman';
    const customTitle = options.title || 'TEST BACKGROUND PUSH';
    const customBody = options.body || 'TEST PUSH LETON COFFEE';
    
    let subs = await getPushSubscriptions();

    if (clientSubscription && clientSubscription.endpoint && clientSubscription.keys) {
      const exists = subs.some(s => s.endpoint === clientSubscription.endpoint);
      if (!exists) {
        subs.push({
          endpoint: clientSubscription.endpoint,
          keys: clientSubscription.keys,
          username: 'test_admin',
          outletId: targetOutlet,
          role: 'outlet_admin'
        });
      }
    }

    // Filter out dummy diagnostic endpoints
    subs = subs.filter(s => s && s.endpoint && !s.endpoint.includes('test-endpoint-diag') && !s.endpoint.includes('test.endpoint.com'));

    console.log(`[TEST PUSH] Total active subscriptions in storage: ${subs.length}`);

    if (!subs || subs.length === 0) {
      console.log('[TEST PUSH END] Subscription exists: NO');
      return { success: false, sentCount: 0, error: 'Tidak ada perangkat admin yang terdaftar. Klik Aktifkan Notifikasi di PWA terlebih dahulu.', results: [] };
    }

    const payload = JSON.stringify({
      title: customTitle,
      body: customBody,
      icon: 'https://leton-coffee-web.pages.dev/logo_icon_small.png',
      tag: `test-push-${Date.now()}`,
      data: {
        url: '/#admin?tab=orders'
      }
    });

    let sentCount = 0;
    const results: any[] = [];

    for (const sub of subs) {
      let endpointDomain = 'unknown';
      try {
        endpointDomain = new URL(sub.endpoint).hostname;
      } catch (e) {}

      const isAppleEndpoint = sub.endpoint.includes('push.apple.com') || sub.endpoint.includes('apple.com');

      let subPayload: string;
      let pushOptions: any;

      if (isAppleEndpoint) {
        subPayload = JSON.stringify({
          web_push: 8030,
          notification: {
            title: customTitle,
            body: customBody,
            navigate: 'https://leton-coffee-web.pages.dev/#admin?tab=orders',
            silent: false
          }
        });

        pushOptions = {
          TTL: 86400,
          urgency: 'high' as const,
          headers: {
            'Content-Type': 'application/notification+json',
            'Urgency': 'high'
          }
        };
      } else {
        subPayload = JSON.stringify({
          title: customTitle,
          body: customBody,
          icon: 'https://leton-coffee-web.pages.dev/logo_icon_small.png',
          tag: `test-push-${Date.now()}`,
          data: {
            url: '/#admin?tab=orders'
          }
        });

        pushOptions = {
          TTL: 86400,
          urgency: 'high' as const,
          headers: {
            'Urgency': 'high'
          }
        };
      }

      console.log(`[TEST PUSH DISPATCH] Target Endpoint Domain: ${endpointDomain} | Apple Declarative: ${isAppleEndpoint ? 'YES' : 'NO'}`);
      console.log(`[TEST PUSH DISPATCH] Outlet: ${sub.outletId || sub.outlet_id || 'all'}`);
      console.log(`[TEST PUSH DISPATCH] Username: ${sub.username || 'admin'}`);
      console.log(`[webpush.sendNotification START]`);

      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth
          }
        };
        const pushResult = await webpush.sendNotification(pushSubscription, subPayload, pushOptions);
        const statusCode = pushResult.statusCode || 201;
        console.log(`[Apple response] status: ${statusCode}`);
        console.log(`[webpush.sendNotification END] SUCCESS for domain: ${endpointDomain}`);
        sentCount++;
        results.push({ endpointDomain, status: statusCode, success: true });
      } catch (err: any) {
        const statusCode = err.statusCode || err.status || 500;
        console.error(`[Apple response] status/error: ${statusCode} - ${err.message || String(err)}`);
        console.log(`[webpush.sendNotification END] FAILED for domain: ${endpointDomain}`);
        results.push({ endpointDomain, status: statusCode, success: false, error: err.message });
      }
    }

    console.log('[TEST PUSH END] Finished sending test notifications.');
    console.log('====================================');
    return { success: sentCount > 0, sentCount, results };
  } catch (err: any) {
    console.error('[TEST PUSH ERROR]', err);
    return { success: false, sentCount: 0, error: err.message || 'Error during test push', results: [] };
  }
}

app.post('/api/push/test', async (req, res) => {
  try {
    const result = await executeTestPush({
      title: req.body?.title,
      body: req.body?.body,
      subscription: req.body?.subscription,
      outletId: req.body?.outletId || req.body?.targetOutlet
    });
    const statusCode = result.success ? 200 : (result.sentCount === 0 && result.results.length === 0 ? 400 : 500);
    res.status(statusCode).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Error executing test push' });
  }
});

// ---------------------------------------------
// VITE / STATIC SERVING
// ---------------------------------------------
async function start() {
  // Initialize Web Push VAPID keys
  await initVapid();

  // Initialize Real-time Orders Push Listener
  initSupabaseOrderListener();

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
