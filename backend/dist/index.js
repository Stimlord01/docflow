"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("./routes/auth"));
const documents_1 = __importDefault(require("./routes/documents"));
const admin_1 = __importDefault(require("./routes/admin"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const seed_1 = require("./seed");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)({
    origin: '*', // Allow all origins for local prototyping
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
// Serving uploaded files static directory
const UPLOAD_STATIC_DIR = process.env.RENDER === 'true'
    ? '/uploads'
    : path_1.default.join(__dirname, '../uploads');
app.use('/uploads', express_1.default.static(UPLOAD_STATIC_DIR));
// Routes API registration
app.use('/api/auth', auth_1.default);
app.use('/api/documents', documents_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/notifications', notifications_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date(), service: 'DocFlow Backend API' });
});
// Global error handler
app.use((err, req, res, next) => {
    console.error('[Global Error]:', err);
    res.status(err.status || 500).json({ error: err.message || 'Une erreur interne est survenue' });
});
// Start server
app.listen(PORT, async () => {
    console.log(`[DocFlow Backend] Server running on http://localhost:${PORT}`);
    // Seed initial data if database is fresh
    await (0, seed_1.seedDatabase)();
});
//# sourceMappingURL=index.js.map