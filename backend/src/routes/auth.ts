import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'docflow-super-secret-key-2026';

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

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        status,
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

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(211).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
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

    // Log connection
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
    const { name, email, phone, address, city } = req.body;

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

export default router;
