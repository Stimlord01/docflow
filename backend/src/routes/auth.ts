import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { sendEmail } from '../utils/email';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'docflow-super-secret-key-2026';

// Multer setup for profile picture
const UPLOAD_DIR = process.env.RENDER === 'true'
  ? '/uploads'
  : path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Format d’image non autorisé (JPG, JPEG, PNG, WEBP, GIF uniquement)'));
  }
});

// Register a new user
router.post('/register', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, adminSecret } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Tous les champs sont obligatoires' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Cette adresse email est déjà utilisée' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine role: standard 'Utilisateur' unless they supply the correct admin secret key
    let role = 'Utilisateur';
    if (adminSecret) {
      const secret = process.env.ADMIN_SECRET_KEY || 'docflow-admin-secret-2026';
      if (adminSecret === secret) {
        role = 'Administrateur';
      } else {
        res.status(400).json({ error: "Le code secret d'administration est incorrect" });
        return;
      }
    }
    const status = role === 'Administrateur' ? 'actif' : 'incomplet';

    // Record the device key for the new account
    const deviceKey = `${req.ip || 'unknown'}_${req.headers['user-agent'] || 'unknown'}`;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        status,
        knownDevices: deviceKey,
      },
    });

    // Create a first default audit log
    await prisma.audit.create({
      data: {
        who: user.name,
        act: 'a créé son compte',
        obj: user.email,
        tag: 'info',
        userId: user.id,
      },
    });

    // Send welcome email
    await sendEmail({
      to: user.email,
      subject: 'Bienvenue sur DocFlow !',
      text: `Bonjour ${user.name},\n\nVotre compte DocFlow a été créé avec succès en tant que ${role}.\n\nVous pouvez désormais vous connecter et gérer vos justificatifs.\n\nCordialement,\nL'équipe DocFlow`
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(211).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        joined: user.joined,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

// Login
router.post('/login', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(400).json({ error: 'Identifiants de connexion incorrects' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ error: 'Identifiants de connexion incorrects' });
      return;
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // Detect first connection on a new device (IP + User-Agent combination)
    const deviceKey = `${req.ip || 'unknown'}_${req.headers['user-agent'] || 'unknown'}`;
    const known = user.knownDevices ? user.knownDevices.split(',') : [];
    if (!known.includes(deviceKey)) {
      // Send warning e-mail alert
      await sendEmail({
        to: user.email,
        subject: 'DocFlow - Nouvelle connexion détectée',
        text: `Bonjour ${user.name},\n\nUne nouvelle connexion à votre compte DocFlow a été détectée depuis un nouvel appareil.\n\nDate : ${new Date().toLocaleString('fr-FR')}\nAdresse IP : ${req.ip || 'Inconnue'}\nNavigateur : ${req.headers['user-agent'] || 'Inconnu'}\n\nSi vous êtes à l'origine de cette connexion, vous pouvez ignorer cet e-mail. Sinon, veuillez modifier immédiatement votre mot de passe.\n\nCordialement,\nL'équipe DocFlow`
      });

      // Append new device key to db
      known.push(deviceKey);
      await prisma.user.update({
        where: { id: user.id },
        data: { knownDevices: known.join(',') }
      });
    }

    // Log connection in audit
    await prisma.audit.create({
      data: {
        who: user.name,
        act: 's’est connecté',
        obj: `IP ${req.ip || 'locale'}`,
        tag: 'info',
        userId: user.id,
      },
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        joined: user.joined,
        profilePic: user.profilePic,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// Get user profile details
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        address: true,
        role: true,
        status: true,
        joined: true,
        profilePic: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }

    res.json(user);
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
});

// Update user profile coordinates
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name, email, phone, address, city, emailNotifications } = req.body;

    // Check if email already in use by another user
    if (email) {
      const emailUser = await prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
      });
      if (emailUser) {
        res.status(400).json({ error: 'Cette adresse email est déjà prise' });
        return;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        phone,
        address,
        city,
        emailNotifications: emailNotifications !== undefined ? !!emailNotifications : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        address: true,
        role: true,
        status: true,
        joined: true,
        profilePic: true,
        emailNotifications: true,
      },
    });

    // Audit logs
    await prisma.audit.create({
      data: {
        who: updatedUser.name,
        act: 'a mis à jour son profil',
        obj: updatedUser.email,
        tag: 'info',
        userId: updatedUser.id,
      },
    });

    res.json(updatedUser);
  } catch (error: any) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
});

// Upload profile picture
router.post('/profile-pic', authenticateToken, upload.single('profilePic'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Aucun fichier fourni' });
      return;
    }

    const relativePath = `uploads/${file.filename}`;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { profilePic: relativePath },
    });

    await prisma.audit.create({
      data: {
        who: user.name,
        act: 'a mis à jour sa photo de profil',
        obj: user.email,
        tag: 'info',
        userId: user.id,
      },
    });

    res.json({ profilePic: relativePath });
  } catch (error: any) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ error: error.message || 'Erreur lors du téléversement de la photo de profil' });
  }
});

// Send email verification code
router.post('/send-verification-code', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    
    // Generate 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiration

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationCode: code,
        emailVerificationExpires: expires
      }
    });

    // Send code via email
    await sendEmail({
      to: user.email,
      subject: 'DocFlow - Code de vérification e-mail',
      text: `Votre code de vérification pour les notifications par e-mail est : ${code}\nCe code expire dans 15 minutes.`,
      html: `<p>Bonjour ${user.name},</p><p>Votre code de vérification pour les notifications par e-mail est : <strong style="font-size: 18px; color: #0EA5E9; letter-spacing: 1px;">${code}</strong></p><p>Ce code expire dans 15 minutes.</p><p>Cordialement,<br/>L'équipe DocFlow</p>`
    });

    res.json({ message: 'Code de vérification envoyé avec succès' });
  } catch (error: any) {
    console.error('Send verification code error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du code de vérification' });
  }
});

// Verify email verification code
router.post('/verify-code', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Le code de vérification est requis' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }

    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
      res.status(400).json({ error: 'Aucun code de vérification en cours' });
      return;
    }

    if (new Date() > user.emailVerificationExpires) {
      res.status(400).json({ error: 'Le code de vérification a expiré' });
      return;
    }

    if (user.emailVerificationCode !== code) {
      res.status(400).json({ error: 'Code de vérification incorrect' });
      return;
    }

    // Success! Update user status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailNotifications: true,
        emailVerificationCode: null,
        emailVerificationExpires: null
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        address: true,
        role: true,
        status: true,
        joined: true,
        profilePic: true,
        emailNotifications: true,
        emailVerified: true
      }
    });

    res.json({ message: 'E-mail vérifié avec succès et notifications activées', user: updatedUser });
  } catch (error: any) {
    console.error('Verify code error:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du code' });
  }
});

export default router;
