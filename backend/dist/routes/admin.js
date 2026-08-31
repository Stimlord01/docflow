"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const documents_1 = require("./documents");
const email_1 = require("../utils/email");
const router = (0, express_1.Router)();
// Middleware to restrict access to Admins only
const requireAdmin = (req, res, next) => {
    // Allow all authenticated users to view categories list
    if (req.path === '/categories' && req.method === 'GET') {
        next();
        return;
    }
    if (req.userRole !== 'Administrateur') {
        res.status(403).json({ error: 'Accès réservé aux administrateurs' });
        return;
    }
    next();
};
// Apply authentication and role check to all admin routes
router.use(auth_1.authenticateToken);
router.use(requireAdmin);
// 1. Get all users (with search and status filters)
router.get('/users', async (req, res) => {
    try {
        const { search, status } = req.query;
        const whereClause = {};
        // Status filter
        if (status && status !== 'all') {
            whereClause.status = status;
        }
        // Text search (name, email, or ID)
        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { id: { contains: search, mode: 'insensitive' } }
            ];
        }
        const users = await db_1.default.user.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                joined: true,
                phone: true,
                city: true,
                documents: {
                    select: {
                        id: true,
                        name: true,
                        cat: true,
                        size: true,
                        date: true,
                        status: true
                    }
                }
            },
            orderBy: { joined: 'desc' }
        });
        const requiredCategoriesCount = await db_1.default.category.count({ where: { required: true } });
        // Format output with stats (valid counts, total required slots)
        const formattedUsers = users.map(user => {
            const validDocs = user.documents.filter(d => d.status === 'valide').length;
            const prog = requiredCategoriesCount === 0
                ? 100
                : Math.min(100, Math.round((validDocs / requiredCategoriesCount) * 100));
            const initials = user.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone || 'N/A',
                city: user.city || 'N/A',
                role: user.role,
                status: user.status,
                joined: user.joined.toISOString(),
                prog,
                valid: validDocs,
                total: requiredCategoriesCount,
                init: initials || 'UT',
                docs: user.documents
            };
        });
        res.json(formattedUsers);
    }
    catch (error) {
        console.error('Fetch users error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
});
// 2. Get detailed user info + documents
router.get('/users/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const user = await db_1.default.user.findUnique({
            where: { id },
            include: {
                documents: {
                    orderBy: { date: 'desc' }
                }
            }
        });
        if (!user) {
            res.status(404).json({ error: 'Utilisateur introuvable' });
            return;
        }
        const requiredCategoriesCount = await db_1.default.category.count({ where: { required: true } });
        const validDocs = user.documents.filter((d) => d.status === 'valide').length;
        const prog = requiredCategoriesCount === 0
            ? 100
            : Math.min(100, Math.round((validDocs / requiredCategoriesCount) * 100));
        const initials = user.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || 'N/A',
            city: user.city || 'N/A',
            address: user.address || 'N/A',
            role: user.role,
            status: user.status,
            joined: user.joined.toISOString(),
            prog,
            valid: validDocs,
            total: requiredCategoriesCount,
            init: initials,
            docs: user.documents
        });
    }
    catch (error) {
        console.error('Fetch user details error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des détails de l\'utilisateur' });
    }
});
// 3. Suspend / Unsuspend a user
router.put('/users/:id/status', async (req, res) => {
    try {
        const id = req.params.id;
        const { status } = req.body; // "actif", "incomplet", "bloque"
        if (!['actif', 'incomplet', 'bloque'].includes(status)) {
            res.status(400).json({ error: 'Statut invalide' });
            return;
        }
        const user = await db_1.default.user.update({
            where: { id },
            data: { status }
        });
        // Create Audit Log
        const admin = await db_1.default.user.findUnique({ where: { id: req.userId } });
        await db_1.default.audit.create({
            data: {
                who: `Admin · ${admin?.name || 'Admin'}`,
                act: status === 'bloque' ? 'a suspendu' : 'a activé',
                obj: `${user.id} · ${user.name}`,
                tag: status === 'bloque' ? 'refuse' : 'valide',
                userId: req.userId,
            }
        });
        // Send a notification to the user
        await db_1.default.notification.create({
            data: {
                title: status === 'bloque' ? 'Compte Suspendu' : 'Compte Activé',
                text: status === 'bloque'
                    ? 'Votre compte a été suspendu par l’administration.'
                    : 'Votre compte a été réactivé par l’administration.',
                type: status === 'bloque' ? 'refuse' : 'valide',
                userId: user.id
            }
        });
        res.json({ message: 'Statut de l\'utilisateur mis à jour avec succès', status: user.status });
    }
    catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
    }
});
// 4. Validate or Reject a document
router.post('/documents/:id/review', async (req, res) => {
    try {
        const id = req.params.id;
        const { status, note } = req.body; // status: "valide" or "refuse"
        if (!['valide', 'refuse'].includes(status)) {
            res.status(400).json({ error: 'Statut de validation invalide' });
            return;
        }
        if (status === 'refuse' && !note) {
            res.status(400).json({ error: 'Un commentaire est obligatoire en cas de refus' });
            return;
        }
        const document = await db_1.default.document.findUnique({ where: { id } });
        if (!document) {
            res.status(404).json({ error: 'Document introuvable' });
            return;
        }
        const updatedDoc = await db_1.default.document.update({
            where: { id },
            data: {
                status,
                note: status === 'refuse' ? note : ''
            }
        });
        // Recalculate compliance status for the user
        await (0, documents_1.recalculateUserStatus)(document.userId);
        // Create Audit Log
        const admin = await db_1.default.user.findUnique({ where: { id: req.userId } });
        await db_1.default.audit.create({
            data: {
                who: `Admin · ${admin?.name || 'Admin'}`,
                act: status === 'valide' ? 'a validé' : 'a refusé',
                obj: `${document.id} · ${document.name}`,
                tag: status,
                userId: req.userId,
            }
        });
        // Send a notification to the document owner
        const owner = await db_1.default.user.findUnique({ where: { id: document.userId } });
        const notifTitle = status === 'valide' ? 'Document validé' : 'Document refusé';
        const notifText = status === 'valide'
            ? `Votre document « ${document.name} » a été validé par l'administration.`
            : `Votre document « ${document.name} » a été refusé : ${note}`;
        await db_1.default.notification.create({
            data: {
                title: notifTitle,
                text: notifText,
                type: status,
                userId: document.userId
            }
        });
        if (owner && owner.emailNotifications) {
            const emailSubject = `DocFlow - ${notifTitle}`;
            const emailHtml = status === 'valide'
                ? `<p>Bonjour ${owner.name},</p><p>Votre document <strong>« ${document.name} »</strong> a été <strong>validé</strong> par l'administration.</p><p>Cordialement,<br/>L'équipe DocFlow</p>`
                : `<p>Bonjour ${owner.name},</p><p>Votre document <strong>« ${document.name} »</strong> a été <strong>refusé</strong>.</p><p>Motif : <em>${note}</em></p><p>Merci de vous connecter sur DocFlow pour remplacer ce document.</p><p>Cordialement,<br/>L'équipe DocFlow</p>`;
            (0, email_1.sendEmail)({
                to: owner.email,
                subject: emailSubject,
                text: notifText,
                html: emailHtml
            }).catch(console.error);
        }
        res.json(updatedDoc);
    }
    catch (error) {
        console.error('Review document error:', error);
        res.status(500).json({ error: 'Erreur lors de la validation du document' });
    }
});
// 5. Get all document categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await db_1.default.category.findMany({
            orderBy: { id: 'asc' }
        });
        // Count how many documents belong to each category
        const countData = await db_1.default.document.groupBy({
            by: ['cat'],
            _count: {
                id: true
            }
        });
        const countMap = {};
        countData.forEach(item => {
            countMap[item.cat] = item._count.id;
        });
        const enrichedCategories = categories.map(cat => ({
            ...cat,
            count: countMap[cat.name] || 0
        }));
        res.json(enrichedCategories);
    }
    catch (error) {
        console.error('Fetch categories error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
    }
});
// 6. Create a document category
router.post('/categories', async (req, res) => {
    try {
        const { name, formats, required } = req.body;
        if (!name || !formats) {
            res.status(400).json({ error: 'Le nom et les formats acceptés sont requis' });
            return;
        }
        const existingCat = await db_1.default.category.findUnique({ where: { name } });
        if (existingCat) {
            res.status(400).json({ error: 'Une catégorie avec ce nom existe déjà' });
            return;
        }
        // Auto-generate ID C-XX
        const count = await db_1.default.category.count();
        const nextId = `C-${String(count + 1).padStart(2, '0')}`;
        const newCategory = await db_1.default.category.create({
            data: {
                id: nextId,
                name,
                formats,
                required: !!required
            }
        });
        // Audit log
        const admin = await db_1.default.user.findUnique({ where: { id: req.userId } });
        await db_1.default.audit.create({
            data: {
                who: `Admin · ${admin?.name || 'Admin'}`,
                act: 'a créé la catégorie',
                obj: `${newCategory.id} · ${newCategory.name}`,
                tag: 'info',
                userId: req.userId,
            }
        });
        res.status(211).json(newCategory);
    }
    catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Erreur lors de la création de la catégorie' });
    }
});
// 7. Update document category
router.put('/categories/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { name, formats, required } = req.body;
        const updatedCategory = await db_1.default.category.update({
            where: { id },
            data: {
                name,
                formats,
                required: required !== undefined ? !!required : undefined
            }
        });
        // Audit log
        const admin = await db_1.default.user.findUnique({ where: { id: req.userId } });
        await db_1.default.audit.create({
            data: {
                who: `Admin · ${admin?.name || 'Admin'}`,
                act: 'a modifié la catégorie',
                obj: `${updatedCategory.id} · ${updatedCategory.name}`,
                tag: 'info',
                userId: req.userId,
            }
        });
        res.json(updatedCategory);
    }
    catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Erreur lors de la modification de la catégorie' });
    }
});
// 8. Delete a document category
router.delete('/categories/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const category = await db_1.default.category.findUnique({ where: { id } });
        if (!category) {
            res.status(404).json({ error: 'Catégorie introuvable' });
            return;
        }
        await db_1.default.category.delete({ where: { id } });
        // Audit log
        const admin = await db_1.default.user.findUnique({ where: { id: req.userId } });
        await db_1.default.audit.create({
            data: {
                who: `Admin · ${admin?.name || 'Admin'}`,
                act: 'a supprimé la catégorie',
                obj: `${category.id} · ${category.name}`,
                tag: 'refuse',
                userId: req.userId,
            }
        });
        res.json({ message: 'Catégorie supprimée avec succès' });
    }
    catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie' });
    }
});
// 9. Get Audit logs
router.get('/audit', async (req, res) => {
    try {
        const audits = await db_1.default.audit.findMany({
            orderBy: { time: 'desc' },
            take: 100 // Cap to latest 100 logs
        });
        const formattedAudits = audits.map(a => ({
            id: a.id,
            who: a.who,
            act: a.act,
            obj: a.obj,
            tag: a.tag,
            time: new Date(a.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        }));
        res.json(formattedAudits);
    }
    catch (error) {
        console.error('Fetch audit log error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du journal d\'audit' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map