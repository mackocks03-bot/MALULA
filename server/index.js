import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import depositsRouter from './routes/deposits.js';
import activationRouter from './routes/activation.js';
import { initFirebaseAdmin } from './services/firebaseAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

initFirebaseAdmin();

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'NEWHOPE-CHAT', version: '2.0.0' });
});

app.use('/api/deposits', depositsRouter);
app.use('/api/activation', activationRouter);

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
