import bcrypt from 'bcrypt';
import prisma from './db';

export async function seedDatabase() {
  try {
    // 0. Upgrade any legacy "Gestionnaire" users to "Administrateur"
    await prisma.user.updateMany({
      where: { role: 'Gestionnaire' },
      data: { role: 'Administrateur' }
    });

    // 1. Seed Categories if empty
    const categoryCount = await prisma.category.count();
    if (categoryCount === 0) {
      console.log('Seeding default document categories...');
      await prisma.category.createMany({
        data: [
          { id: 'C-01', name: 'Identité', formats: 'PDF, JPG, PNG', required: true },
          { id: 'C-02', name: 'Justificatif de domicile', formats: 'PDF, JPG', required: true },
          { id: 'C-03', name: 'Bancaire', formats: 'PDF', required: true },
          { id: 'C-04', name: 'Emploi', formats: 'PDF, DOCX', required: false },
          { id: 'C-05', name: 'Assurance', formats: 'PDF, JPG, PNG', required: false },
          { id: 'C-06', name: 'Fiscalité', formats: 'PDF', required: false }
        ]
      });
      console.log('Categories seeded.');
    }

    // 2. Seed Users if empty
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('Seeding default users...');
      const hashedPassword = await bcrypt.hash('motdepasse', 10);

      // Create primary test user: Amélie Rousseau (Utilisateur)
      const amelie = await prisma.user.create({
        data: {
          name: 'Amélie Rousseau',
          email: 'a.rousseau@mail.fr',
          password: hashedPassword,
          phone: '+33 6 12 44 88 20',
          city: 'Lyon',
          address: '14 rue de la République',
          role: 'Utilisateur',
          status: 'incomplet'
        }
      });

      // Create other mock users
      const karim = await prisma.user.create({
        data: {
          name: 'Karim Benali',
          email: 'k.benali@mail.fr',
          password: hashedPassword,
          phone: '+33 6 88 12 03 55',
          city: 'Marseille',
          role: 'Utilisateur',
          status: 'incomplet'
        }
      });

      const sophie = await prisma.user.create({
        data: {
          name: 'Sophie Martin',
          email: 's.martin@mail.fr',
          password: hashedPassword,
          phone: '+33 7 45 90 11 02',
          city: 'Paris',
          role: 'Utilisateur',
          status: 'incomplet'
        }
      });

      const thomas = await prisma.user.create({
        data: {
          name: 'Thomas Girard',
          email: 't.girard@mail.fr',
          password: hashedPassword,
          phone: '+33 6 33 21 77 40',
          city: 'Nantes',
          role: 'Administrateur',
          status: 'actif'
        }
      });

      const admin = await prisma.user.create({
        data: {
          name: 'M. Petit',
          email: 'm.petit@admin.fr',
          password: hashedPassword,
          role: 'Administrateur',
          status: 'actif'
        }
      });

      console.log('Users seeded.');

      // 3. Seed Documents for Amélie Rousseau
      console.log('Seeding default documents for Amélie Rousseau...');
      const doc1 = await prisma.document.create({
        data: {
          name: "Carte nationale d'identité.pdf",
          cat: 'Identité',
          status: 'valide',
          size: '1,2 Mo',
          type: 'PDF',
          fileKey: 'uploads/mock-cni.pdf',
          userId: amelie.id
        }
      });

      const doc2 = await prisma.document.create({
        data: {
          name: 'Justificatif de domicile.pdf',
          cat: 'Justificatif de domicile',
          status: 'attente',
          size: '840 Ko',
          type: 'PDF',
          fileKey: 'uploads/mock-domicile.pdf',
          userId: amelie.id
        }
      });

      const doc3 = await prisma.document.create({
        data: {
          name: 'Relevé d’identité bancaire.jpg',
          cat: 'Bancaire',
          status: 'refuse',
          size: '512 Ko',
          type: 'JPG',
          note: 'Document illisible — merci de re-scanner en couleur, recto complet.',
          fileKey: 'uploads/mock-rib.jpg',
          userId: amelie.id
        }
      });

      const doc4 = await prisma.document.create({
        data: {
          name: 'Contrat de travail.docx',
          cat: 'Emploi',
          status: 'valide',
          size: '2,1 Mo',
          type: 'DOCX',
          fileKey: 'uploads/mock-contrat.docx',
          userId: amelie.id
        }
      });

      const doc5 = await prisma.document.create({
        data: {
          name: 'Attestation d’assurance.pdf',
          cat: 'Assurance',
          status: 'attente',
          size: '333 Ko',
          type: 'PDF',
          fileKey: 'uploads/mock-assurance.pdf',
          userId: amelie.id
        }
      });

      console.log('Documents seeded.');

      // 4. Seed Notifications for Amélie Rousseau
      console.log('Seeding notifications...');
      await prisma.notification.createMany({
        data: [
          {
            title: 'Document validé',
            text: 'Votre « Contrat de travail » a été validé par l’administration.',
            type: 'valide',
            read: false,
            userId: amelie.id,
            time: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2h ago
          },
          {
            title: 'Document refusé',
            text: 'Votre « RIB » a été refusé : document illisible.',
            type: 'refuse',
            read: false,
            userId: amelie.id,
            time: new Date(Date.now() - 5 * 60 * 60 * 1000) // 5h ago
          },
          {
            title: 'Nouveau document requis',
            text: 'Une attestation d’assurance vous est désormais demandée.',
            type: 'info',
            read: true,
            userId: amelie.id,
            time: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
          },
          {
            title: 'Document validé',
            text: 'Votre « Carte d’identité » a été validée.',
            type: 'valide',
            read: true,
            userId: amelie.id,
            time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
          }
        ]
      });

      // 5. Seed Audit Logs
      console.log('Seeding audits...');
      await prisma.audit.createMany({
        data: [
          {
            who: `Admin · M. Petit`,
            act: 'a validé',
            obj: `${doc4.id} · Contrat de travail.docx`,
            tag: 'valide',
            userId: admin.id,
            time: new Date(Date.now() - 2 * 60 * 60 * 1000)
          },
          {
            who: `Admin · M. Petit`,
            act: 'a refusé',
            obj: `${doc3.id} · Relevé d’identité bancaire.jpg`,
            tag: 'refuse',
            userId: admin.id,
            time: new Date(Date.now() - 5 * 60 * 60 * 1000)
          },
          {
            who: 'Amélie Rousseau',
            act: 'a déposé',
            obj: `${doc5.id} · Attestation d’assurance.pdf`,
            tag: 'info',
            userId: amelie.id,
            time: new Date(Date.now() - 7 * 60 * 60 * 1000)
          },
          {
            who: `Admin · Thomas Girard`,
            act: 'a modifié la catégorie',
            obj: 'C-04 · Emploi',
            tag: 'info',
            userId: thomas.id,
            time: new Date(Date.now() - 30 * 60 * 60 * 1000)
          },
          {
            who: 'Karim Benali',
            act: 's’est connecté',
            obj: 'IP 90.44.12.87',
            tag: 'info',
            userId: karim.id,
            time: new Date(Date.now() - 32 * 60 * 60 * 1000)
          }
        ]
      });

      console.log('Audits seeded.');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
