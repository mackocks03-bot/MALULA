import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import depositsRouter from './routes/deposits.js';
import activationRouter from './routes/activation.js';
import { initFirebaseAdmin } from './services/firebaseAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// Trust proxy if running behind a trusted reverse proxy (like Vercel, Heroku, Nginx)
app.set('trust proxy', 1);

// Standard API Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' }
});

// Strict Rate Limiter for payments and sensitive actions
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // limit each IP to 15 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many payment attempts, please try again later.' }
});

initFirebaseAdmin();

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'NEWHOPE-CHAT', version: '2.0.0' });
});

// Apply general limit to all API routes
app.use('/api', apiLimiter);

// Apply strict limit to payment/financial routes
app.use('/api/deposits', strictLimiter, depositsRouter);
app.use('/api/activation', strictLimiter, activationRouter);

if (isProd) {
    const clientDist = path.join(__dirname, '../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
    });
} else {
    app.get('/', (_req, res) => {
        res.json({
            message: 'NEWHOPE-CHAT API server running',
            client: 'Run npm run dev in client folder (port 5173)'
        });
    });
}

app.listen(PORT, () => {
    console.log(`NEWHOPE-CHAT server running on http://localhost:${PORT}`);
});
