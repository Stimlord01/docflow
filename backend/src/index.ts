import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRouter from './routes/auth';
import documentsRouter from './routes/documents';
import adminRouter from './routes/admin';
import notificationsRouter from './routes/notifications';
import { seedDatabase } from './seed';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for local prototyping
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serving uploaded files static directory (privately controlled by routes, but this route could serve as fallback if needed)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes API registration
app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notificationsRouter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date(), service: 'DocFlow Backend API' });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Global Error]:', err);
  res.status(err.status || 500).json({ error: err.message || 'Une erreur interne est survenue' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`[DocFlow Backend] Server running on http://localhost:${PORT}`);
  
  // Seed initial data if database is fresh
  await seedDatabase();
});
