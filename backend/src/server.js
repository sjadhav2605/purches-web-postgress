import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';

import { config } from './config/env.config.js';
import pool from './config/db.js';
import { initDatabase } from './database/bootstrap.js';
import { cacheService } from './services/cache.service.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { verifyJwt } from './middlewares/auth.middleware.js';
import { requireRoles } from './middlewares/role.middleware.js';
import { ROLES } from './constants/roles.js';

// Route imports
import authRoutes from './modules/auth/auth.routes.js';
import requisitionRoutes from './modules/requisitions/requisition.routes.js';
import purchaseOrderRoutes from './modules/purchaseOrders/po.routes.js';
import masterRoutes from './modules/masters/masters.routes.js';
import deliveryRoutes from './modules/deliveries/delivery.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import rfqRoutes from './modules/rfqs/rfq.routes.js';
import auditRoutes from './modules/auditLogs/audit.routes.js';
import userRoutes from './modules/users/user.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import vendorBilledChallanRoutes from './modules/vendorBilledChallans/vendorBilledChallan.routes.js';

const app = express();
const PORT = config.port;

// Reverse proxy client IP handling (Render / Cloud / Nginx)
app.set('trust proxy', 1);

// ============================================================================
// Security & Utility Middlewares
// ============================================================================

// 1. Helmet: Secure HTTP headers
app.use(helmet());

// 2. Compression: Gzip compress all responses for fast loading
app.use(compression());

// 3. CORS: Cross-Origin Resource Sharing
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.trim().replace(/\/+$/, '');

    if (config.allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    if (
      cleanOrigin.endsWith('.netlify.app') ||
      cleanOrigin.endsWith('.vercel.app') ||
      cleanOrigin.endsWith('.onrender.com')
    ) {
      return callback(null, true);
    }

    console.warn(`⚠️ [CORS Blocked] Origin: "${origin}". Allowed origins:`, config.allowedOrigins);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-active-role',
    'X-Active-Role',
    'x-active-user-id',
    'X-Active-User-Id',
    'x-active-user-name',
    'X-Active-User-Name',
    'Accept',
    'Origin',
    'X-Requested-With'
  ],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 4. Rate Limiter: Generous limit for internal ERP operations (5000 req / 15 min)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
app.use('/api', apiLimiter);

// 5. Request Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory (for documents & KYC attachments)
app.use('/uploads', express.static(path.resolve('uploads'), {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// 6. HTTP Request Logger (Dev mode)
if (config.isDev) {
  app.use(morgan('dev'));
}

// ============================================================================
// API Endpoints
// ============================================================================

// Health check endpoint with Cache Status
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'DDPL Procurement API',
    uptime: process.uptime(),
    cache: cacheService.getStatus()
  });
});

// Mount modular routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/requisitions', requisitionRoutes);
app.use('/api/v1/rfqs', rfqRoutes);
app.use('/api/v1/orders', purchaseOrderRoutes);
app.use('/api/v1/deliveries', deliveryRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/vendor-billed-challans', vendorBilledChallanRoutes);
app.use('/api/v1', masterRoutes);

// Database Diagnostics Endpoint (authenticated, admin only)
app.get('/api/v1/diag', verifyJwt, requireRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const [tables] = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
    );
    let usersCount = 0;
    try {
      const [u] = await pool.query('SELECT count(*) as c FROM users');
      usersCount = Number(u[0]?.c || 0);
    } catch (e) {
      usersCount = e.message;
    }
    return res.status(200).json({
      status: 'ok',
      totalTables: tables.length,
      tables: tables.map((t) => t.table_name),
      usersCount
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// Error Handling
// ============================================================================

// 404 Route Not Found
app.use(notFoundHandler);

// Centralized Global Error Handler
app.use(errorHandler);

// ============================================================================
// Server Startup & DB Initialization
// ============================================================================

const startServer = async () => {
  try {
    // 1. Centralized Database validation & schema bootstrap
    await initDatabase();

    // 2. Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 DDPL Procurement Backend running on: http://localhost:${PORT}`);
      console.log(`📡 Environment: ${config.env}`);
      console.log(`🔗 API Base: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

export default app;
