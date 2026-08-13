import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Ensure uploads folder exists
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Extension de fichier non autorisée (PDF, JPG, PNG, DOCX acceptés)'));
    }
  }
});

// Helper: Format bytes to human readable format
const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';
  }
  return Math.round(bytes / 1024) + ' Ko';
};

// Upload a document
router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { cat } = req.body;
    const file = req.file;

    if (!cat) {
      res.status(400).json({ error: 'La catégorie du document est requise' });
      return;
    }

    if (!file) {
      res.status(400).json({ error: 'Aucun fichier fourni' });
      return;
    }

    const sizeStr = formatBytes(file.size);
    const extStr = path.extname(file.originalname).toUpperCase().replace('.', '');

    // Check if the user already has a document for this category. If yes, we can delete the old one or archive it.
    // In our context, replacing a rejected document is common. Let's delete the old record if it exists (or overwrite status).
    const existingDoc = await prisma.document.findFirst({
      where: { userId, cat }
    });

    if (existingDoc) {
      // Delete old file from disk
      const oldPath = path.resolve(existingDoc.fileKey);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
      // Delete old document db record
      await prisma.document.delete({ where: { id: existingDoc.id } });
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        name: file.originalname,
        cat,
        status: 'attente',
        size: sizeStr,
        type: extStr,
        fileKey: file.path,
        userId,
      }
    });

    // Update user status to 'incomplet' if they uploaded a document but might still have pending files.
    // If they have all 4 required categories uploaded and none are rejected or pending, they might become 'actif'.
    // Let's perform a user status recalculation.
    await recalculateUserStatus(userId);

    // Create user audit record
    const user = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.audit.create({
      data: {
        who: user?.name || 'Utilisateur',
        act: 'a déposé',
        obj: `${document.id} · ${document.name}`,
        tag: 'info',
        userId,
      }
    });

    res.status(211).json(document);
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Erreur lors du dépôt du document' });
  }
});

// Get user documents
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documents = await prisma.document.findMany({
      where: { userId },
      orderBy: { date: 'desc' }
    });
    res.json(documents);
  } catch (error: any) {
    console.error('Fetch documents error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des documents' });
  }
});

// Download a document file securely
router.get('/:id/download', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const docId = req.params.id as string;
    const document = await prisma.document.findUnique({ where: { id: docId } });

    if (!document) {
      res.status(404).json({ error: 'Document introuvable' });
      return;
    }

    // Admins and owners can download
    if (req.userRole !== 'Administrateur' && req.userRole !== 'Gestionnaire' && req.userId !== document.userId) {
      res.status(403).json({ error: 'Accès interdit à ce document' });
      return;
    }

    const filePath = path.resolve(document.fileKey);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Fichier physique introuvable sur le serveur' });
      return;
    }

    res.download(filePath, document.name);
  } catch (error: any) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement du fichier' });
  }
});

// Delete a document
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const docId = req.params.id as string;
    const document = await prisma.document.findUnique({ where: { id: docId } });

    if (!document) {
      res.status(404).json({ error: 'Document introuvable' });
      return;
    }

    // Owner can delete
    if (req.userId !== document.userId) {
      res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres documents' });
      return;
    }

    // Delete file from disk
    const filePath = path.resolve(document.fileKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.document.delete({ where: { id: docId } });

    // Recalculate status
    await recalculateUserStatus(document.userId);

    // Audit logs
    const user = await prisma.user.findUnique({ where: { id: document.userId } });
    await prisma.audit.create({
      data: {
        who: user?.name || 'Utilisateur',
        act: 'a supprimé',
        obj: `${document.id} · ${document.name}`,
        tag: 'info',
        userId: document.userId,
      }
    });

    res.json({ message: 'Document supprimé avec succès' });
  } catch (error: any) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du document' });
  }
});

// Helper logic to recalculate compliance and status
export async function recalculateUserStatus(userId: string): Promise<void> {
  const documents = await prisma.document.findMany({ where: { userId } });
  
  // Total required slots configured in categories BDD
  const requiredCategories = await prisma.category.findMany({ where: { required: true } });
  
  let validRequiredCount = 0;
  for (const cat of requiredCategories) {
    const hasValidDoc = documents.some(d => d.cat === cat.name && d.status === 'valide');
    if (hasValidDoc) {
      validRequiredCount++;
    }
  }

  // Determine user status
  let status = 'incomplet';
  
  // If user has blocked status, keep it, or compute based on requirements
  const currentUser = await prisma.user.findUnique({ where: { id: userId } });
  if (currentUser?.status === 'bloque') {
    return; // Keep locked
  }

  if (requiredCategories.length > 0 && validRequiredCount === requiredCategories.length) {
    status = 'actif';
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status }
  });
}

export default router;
