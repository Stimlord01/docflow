import { Router, Response } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Apply auth to all notification routes
router.use(authenticateToken);

// Get user notifications
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { time: 'desc' }
    });

    const formattedNotifications = notifications.map(n => {
      // Calculate human readable time difference
      const diffMs = Date.now() - new Date(n.time).getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      let timeStr = 'À l’instant';
      if (diffHrs >= 24) {
        const days = Math.floor(diffHrs / 24);
        timeStr = days === 1 ? 'Hier' : `${days} jours`;
      } else if (diffHrs > 0) {
        timeStr = `Il y a ${diffHrs} h`;
      } else if (diffMins > 0) {
        timeStr = `Il y a ${diffMins} min`;
      }

      return {
        id: n.id,
        title: n.title,
        text: n.text,
        type: n.type,
        read: n.read,
        time: timeStr
      };
    });

    res.json(formattedNotifications);
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des notifications' });
  }
});

// Mark all as read
router.put('/mark-all-read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
    });

    res.json({ message: 'Toutes les notifications sont lues' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Erreur lors de la modification des notifications' });
  }
});

export default router;
