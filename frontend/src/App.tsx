import { useState, useEffect, useRef } from 'react';
import { api } from './api';

interface DocumentType {
  id: string;
  name: string;
  cat: string;
  status: string;
  date: string;
  size: string;
  type: string;
  note: string;
  fileKey: string;
}

interface UserType {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  address?: string;
  role: string;
  status: string;
  joined: string;
  prog: number;
  valid: number;
  total: number;
  init: string;
  docs?: DocumentType[];
  profilePic?: string;
  knownDevices?: string;
}

interface CategoryType {
  id: string;
  name: string;
  formats: string;
  required: boolean;
  count?: number;
}

interface NotificationType {
  id: string;
  title: string;
  text: string;
  type: string;
  time: string;
  read: boolean;
}

interface AuditType {
  id: string;
  who: string;
  act: string;
  obj: string;
  time: string;
  tag: string;
}

function App() {
  // Navigation & Auth State
  const [route, setRoute] = useState<string>('landing'); // landing, login, register, u-dash, u-upload, u-history, u-profile, a-dash, a-users, a-user, a-docs, a-categories, a-audit, settings
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Form inputs
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [registerName, setRegisterName] = useState<string>('');
  const [registerEmail, setRegisterEmail] = useState<string>('');
  const [registerPassword, setRegisterPassword] = useState<string>('');
  const [registerIsAdmin, setRegisterIsAdmin] = useState<boolean>(false);
  const [registerAdminSecret, setRegisterAdminSecret] = useState<string>('');

  // Toast
  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);
  const toastTimeout = useRef<any>(null);

  // UI Dropdowns
  const [notifOpen, setNotifOpen] = useState<boolean>(false);
  const [profileMenu, setProfileMenu] = useState<boolean>(false);

  // New States (Remember Me, Cookies, Notifications)
  const [loginRemember, setLoginRemember] = useState<boolean>(true);
  const [cookieConsent, setCookieConsent] = useState<boolean>(() => {
    return localStorage.getItem('docflow_cookies_accepted') === 'true';
  });

  // User States
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);

  // Profile Form coordinates
  const [profName, setProfName] = useState<string>('');
  const [profEmail, setProfEmail] = useState<string>('');
  const [profPhone, setProfPhone] = useState<string>('');
  const [profAddress, setProfAddress] = useState<string>('');
  const [profCity, setProfCity] = useState<string>('');
  const [profEmailNotif, setProfEmailNotif] = useState<boolean>(true);

  // Admin States
  const [adminUsers, setAdminUsers] = useState<UserType[]>([]);
  const [adminDocs, setAdminDocs] = useState<any[]>([]);
  const [adminAudits, setAdminAudits] = useState<AuditType[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [userSearch, setUserSearch] = useState<string>('');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');
  const [docFilter, setDocFilter] = useState<string>('all');

  // Category Configuration inputs
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatFormats, setNewCatFormats] = useState<string>('PDF, JPG, PNG');
  const [newCatRequired, setNewCatRequired] = useState<boolean>(false);

  // Review Modal State
  const [reviewDoc, setReviewDoc] = useState<any>(null);
  const [reviewComment, setReviewComment] = useState<string>('');

  // Upload States
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadPct, setUploadPct] = useState<number>(0);
  const [uploadName, setUploadName] = useState<string>('');
  const [dragOver, setDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadCat, setActiveUploadCat] = useState<string>('');
  const [quickUploadCat, setQuickUploadCat] = useState<string>('');

  // Request notification permission
  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  // Show system notification
  const showBrowserNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.ico' });
      } catch (err) {
        console.error('Error displaying system notification:', err);
      }
    }
  };

  // Handle new notifications and compare with old ones to trigger alerts
  const handleNotificationsUpdate = (newNotifs: NotificationType[]) => {
    const oldIds = new Set(notifications.map(n => n.id));
    const newUnread = newNotifs.filter(n => !n.read && !oldIds.has(n.id));
    
    // Only show browser notifications if we already had notifications loaded (prevent spamming on first load)
    if (newUnread.length > 0 && notifications.length > 0) {
      newUnread.forEach(n => {
        showBrowserNotification(n.title, n.text);
      });
    }
    setNotifications(newNotifs);
  };

  // Request notifications permission when user signs in
  useEffect(() => {
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);

  // Load JWT token on mount
  useEffect(() => {
    const token = localStorage.getItem('docflow_token') || sessionStorage.getItem('docflow_token');
    if (token) {
      loadProfileAndData();
    }
  }, []);

  // Fetch initial profile & redirect
  const loadProfileAndData = async () => {
    try {
      setLoading(true);
      const profile = await api.getProfile();
      setUser(profile);
      
      // Load specific layout data
      if (profile.role === 'Administrateur') {
        setRoute('a-dash');
        loadAdminData();
      } else {
        setRoute('u-dash');
        loadUserData();
      }
    } catch (err: any) {
      logout();
      fireToast('refuse', err.message || 'Session expirée');
    } finally {
      setLoading(false);
    }
  };

  // Load User dashboard data
  const loadUserData = async () => {
    try {
      const [docs, cats, notifs] = await Promise.all([
        api.getDocuments(),
        api.getCategories(),
        api.getNotifications()
      ]);
      setDocuments(docs);
      setCategories(cats);
      handleNotificationsUpdate(notifs);

      // Pre-fill quick upload category default
      const pending = cats.find(c => !docs.some(d => d.cat === c.name));
      setQuickUploadCat(pending ? pending.name : (cats[0]?.name || 'Identité'));

      // Pre-fill profile settings
      const profile = await api.getProfile();
      setUser(profile);
      setProfName(profile.name || '');
      setProfEmail(profile.email || '');
      setProfPhone(profile.phone || '');
      setProfAddress(profile.address || '');
      setProfCity(profile.city || '');
      setProfEmailNotif(profile.emailNotifications !== false);
    } catch (err: any) {
      console.error('Error loading user data:', err);
    }
  };

  // Load Admin dashboard data
  const loadAdminData = async () => {
    try {
      const [usersList, cats, audits, notifs] = await Promise.all([
        api.getAdminUsers(userSearch, userStatusFilter),
        api.getCategories(),
        api.getAuditLogs(),
        api.getNotifications()
      ]);
      setAdminUsers(usersList);
      setCategories(cats);
      setAdminAudits(audits);
      handleNotificationsUpdate(notifs);

      // Fetch all user documents to review (status: attente)
      const allDocs: any[] = [];
      usersList.forEach((u: any) => {
        if (u.docs) {
          u.docs.forEach((d: any) => {
            allDocs.push({ ...d, userName: u.name, userInit: u.init, userColor: u.c });
          });
        } else {
          // Fallback if not populated
        }
      });
      // We can also extract reviewable documents by requesting details for all users or filtering the flat list
      setAdminDocs(allDocs);
    } catch (err: any) {
      console.error('Error loading admin data:', err);
    }
  };

  // Fetch admin user search/filter
  useEffect(() => {
    if (user && user.role === 'Administrateur') {
      api.getAdminUsers(userSearch, userStatusFilter).then(setAdminUsers).catch(console.error);
    }
  }, [userSearch, userStatusFilter]);

  const fireToast = (type: string, msg: string) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ type, msg });
    toastTimeout.current = setTimeout(() => setToast(null), 3400);
  };

  const navTo = (newRoute: string) => {
    setRoute(newRoute);
    setNotifOpen(false);
    setProfileMenu(false);
    setLoading(true);
    setTimeout(() => setLoading(false), 500);

    // Refresh data depending on role
    if (user) {
      if (user.role === 'Administrateur') {
        loadAdminData();
      } else {
        loadUserData();
      }
    }
  };

  // Auth Operations
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await api.login({ email: loginEmail, password: loginPassword });
      
      // Store token in localStorage or sessionStorage depending on checkbox
      if (loginRemember) {
        localStorage.setItem('docflow_token', res.token);
      } else {
        sessionStorage.setItem('docflow_token', res.token);
      }
      
      setUser(res.user);
      fireToast('valide', `Ravi de vous revoir, ${res.user.name} !`);
      
      if (res.user.role === 'Administrateur') {
        setRoute('a-dash');
        loadAdminData();
      } else {
        setRoute('u-dash');
        loadUserData();
      }
    } catch (err: any) {
      fireToast('refuse', err.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload: any = { name: registerName, email: registerEmail, password: registerPassword };
      if (registerIsAdmin) {
        payload.adminSecret = registerAdminSecret;
      }
      const res = await api.register(payload);
      
      // Default to localStorage for new registrations
      localStorage.setItem('docflow_token', res.token);
      
      setUser(res.user);
      fireToast('valide', 'Votre compte a été créé avec succès !');
      
      if (res.user.role === 'Administrateur') {
        setRoute('a-dash');
        loadAdminData();
      } else {
        setRoute('u-dash');
        loadUserData();
      }
    } catch (err: any) {
      fireToast('refuse', err.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };



  const logout = () => {
    localStorage.removeItem('docflow_token');
    sessionStorage.removeItem('docflow_token');
    setUser(null);
    setRoute('landing');
    setNotifOpen(false);
    setProfileMenu(false);
  };

  // User coordinate update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await api.updateProfile({
        name: profName,
        email: profEmail,
        phone: profPhone,
        address: profAddress,
        city: profCity,
        emailNotifications: profEmailNotif
      });
      setUser(updated);
      fireToast('valide', 'Votre profil a été mis à jour.');
    } catch (err: any) {
      fireToast('refuse', err.message || 'Erreur lors de la mise à jour du profil');
    }
  };

  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('profilePic', file);
      const res = await api.uploadProfilePic(formData);
      
      // Update state
      setUser({ ...user, profilePic: res.profilePic });
      fireToast('valide', 'Photo de profil mise à jour !');
    } catch (err: any) {
      fireToast('refuse', err.message || 'Erreur lors de la mise à jour de la photo');
    } finally {
      setLoading(false);
    }
  };

  // Notifications Operations
  const handleMarkAllRead = async () => {
    try {
      await api.markNotificationsRead();
      loadUserData();
      fireToast('info', 'Toutes les notifications sont marquées comme lues');
    } catch (err: any) {
      console.error(err);
    }
  };

  // File Upload Operations
  const triggerFileInput = (cat: string) => {
    setActiveUploadCat(cat);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadCat) return;
    uploadFileToServer(file, activeUploadCat);
  };

  const uploadFileToServer = async (file: File, catName: string) => {
    setUploading(true);
    setUploadPct(0);
    setUploadName(file.name);

    // Simulated visual progression bar
    const progressInterval = setInterval(() => {
      setUploadPct((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 120);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cat', catName);

      await api.uploadDocument(formData);
      clearInterval(progressInterval);
      setUploadPct(100);
      setTimeout(() => {
        setUploading(false);
        fireToast('valide', `${file.name} déposé dans la catégorie "${catName}" — en attente de validation`);
        loadUserData();
      }, 350);
    } catch (err: any) {
      clearInterval(progressInterval);
      setUploading(false);
      fireToast('refuse', err.message || 'Erreur de dépôt');
    }
  };

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => {
    setDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const cat = quickUploadCat || requiredSlots.find(s => s.todo)?.cat || (categories[0]?.name || 'Identité');
      uploadFileToServer(file, cat);
    }
  };

  // Document deletion
  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer ce document ?')) return;
    try {
      await api.deleteDocument(id);
      loadUserData();
      fireToast('info', 'Document supprimé avec succès.');
    } catch (err: any) {
      fireToast('refuse', err.message || 'Erreur lors de la suppression');
    }
  };

  // Admin User operations
  const handleOpenUserDetail = async (userId: string) => {
    try {
      setLoading(true);
      const details = await api.getAdminUserDetails(userId);
      setSelectedUser(details);
      setRoute('a-user');
    } catch (err: any) {
      fireToast('refuse', err.message || 'Erreur lors de la récupération des détails');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'bloque' ? 'incomplet' : 'bloque';
    try {
      await api.updateUserStatus(userId, nextStatus);
      fireToast('info', `Statut utilisateur mis à jour (${nextStatus === 'bloque' ? 'bloqué' : 'débloqué'})`);
      if (selectedUser && selectedUser.id === userId) {
        const details = await api.getAdminUserDetails(userId);
        setSelectedUser(details);
      }
      loadAdminData();
    } catch (err: any) {
      fireToast('refuse', err.message || 'Erreur de mise à jour du statut');
    }
  };

  // Admin Document review
  const handleOpenReview = (doc: any) => {
    setReviewDoc(doc);
    setReviewComment('');
  };

  const handleReviewAction = async (status: string) => {
    if (!reviewDoc) return;
    if (status === 'refuse' && !reviewComment) {
      fireToast('refuse', 'Un motif est obligatoire pour refuser un document');
      return;
    }

    try {
      await api.reviewDocument(reviewDoc.id, status, reviewComment);
      setReviewDoc(null);
      fireToast(status, `Le document a été ${status === 'valide' ? 'validé' : 'refusé'}.`);
      loadAdminData();
      if (selectedUser) {
        const details = await api.getAdminUserDetails(selectedUser.id);
        setSelectedUser(details);
      }
    } catch (err: any) {
      fireToast('refuse', err.message || 'Erreur de validation');
    }
  };

  // Admin Category Config operations
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName || !newCatFormats) {
      fireToast('refuse', 'Le nom et les formats acceptés sont requis.');
      return;
    }
    try {
      await api.createCategory({
        name: newCatName,
        formats: newCatFormats,
        required: newCatRequired
      });
      setNewCatName('');
      setNewCatRequired(false);
      loadAdminData();
      fireToast('valide', 'Catégorie de document créée.');
    } catch (err: any) {
      fireToast('refuse', err.message || 'Erreur lors de la création');
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm('Supprimer cette catégorie ? Les documents associés ne seront plus rattachés.')) return;
    try {
      await api.deleteCategory(catId);
      loadAdminData();
      fireToast('info', 'Catégorie supprimée.');
    } catch (err: any) {
      fireToast('refuse', err.message || 'Erreur lors de la suppression');
    }
  };

  // Helper styles / badges matching CSS variables
  const getBadgeStyle = (status: string) => {
    const m: any = {
      valide: { label: 'Validé', color: '#047857', background: '#ECFDF5', border: '1px solid #A7F3D0' },
      attente: { label: 'En attente', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A' },
      refuse: { label: 'Refusé', color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA' },
      actif: { label: 'Actif', color: '#047857', background: '#ECFDF5', border: '1px solid #A7F3D0' },
      incomplet: { label: 'Incomplet', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A' },
      bloque: { label: 'Bloqué', color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA' },
      info: { label: 'Info', color: '#0369A1', background: '#F0F9FF', border: '1px solid #BAE6FD' },
    };
    const b = m[status] || m.attente;
    return {
      label: b.label,
      dotStyle: { width: '6px', height: '6px', borderRadius: '50%', background: b.color, flex: 'none' },
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px 3px 8px',
        borderRadius: '999px',
        font: '600 11.5px/1 "Hanken Grotesk", sans-serif',
        color: b.color,
        background: b.background,
        border: b.border,
        whiteSpace: 'nowrap' as const
      }
    };
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'UT';
  };

  // Computed views metrics
  const requiredCategories = categories.filter(c => c.required);
  const requiredSlots = requiredCategories.map(cat => {
    const doc = documents.find(d => d.cat === cat.name);
    return {
      name: cat.name === 'Identité' ? "Pièce d'identité" : cat.name,
      cat: cat.name,
      done: doc?.status === 'valide',
      todo: !doc || doc.status !== 'valide',
      iconWrap: {
        width: '34px',
        height: '34px',
        borderRadius: '9px',
        background: doc?.status === 'valide' ? '#ECFDF5' : '#F1F5F9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none'
      }
    };
  });

  const getAvatarColor = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = ['#0EA5E9', '#6366F1', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#0891B2', '#DB2777'];
    return colors[hash % colors.length];
  };

  const isAuthPage = ['landing', 'login', 'register'].includes(route);
  const unreadNotifs = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept=".pdf,.jpg,.jpeg,.png,.docx"
      />

      {/* ================= AUTH ROUTING ================= */}
      {isAuthPage ? (
        <div style={{ minHeight: '100vh', display: 'flex', background: '#F8FAFC' }}>
          {/* Left brand rail */}
          <div style={{
            flex: 1.1,
            background: 'linear-gradient(160deg,#0B1220 0%,#0C2233 55%,#083344 100%)',
            backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(14,165,233,0.15) 0%, transparent 60%), linear-gradient(160deg,#0B1220 0%,#0C2233 55%,#083344 100%)',
            color: '#fff',
            padding: '56px 64px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            minWidth: 0
          }}>
            {/* Grid overlay pattern */}
            <div style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.08,
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}></div>
            <div style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(14,165,233,.4),transparent 70%)',
              filter: 'blur(30px)'
            }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', position: 'relative' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg,#0EA5E9,#0284C7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(14,165,233,.4)'
              }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <path d="M14 2v6h6"></path>
                  <path d="M9 15l2 2 4-4"></path>
                </svg>
              </div>
              <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-.3px' }}>DocFlow</span>
            </div>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                <div style={{ fontSize: '36px', lineHeight: 1.15, fontWeight: 800, letterSpacing: '-.9px', marginBottom: '16px', textWrap: 'balance' }}>
                  La collecte de documents administratifs, enfin fluide.
                </div>
                <p style={{ color: '#94A3B8', fontSize: '15.5px', lineHeight: 1.6, margin: 0, maxWidth: '440px' }}>
                  Dépôt sécurisé, suivi de statut en temps réel, validation par l’équipe. Une plateforme SaaS conçue pour évoluer.
                </p>
              </div>

              {/* Beautiful Interactive Mockup Card */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '24px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                maxWidth: '440px',
                animation: 'fadeUp 0.6s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#EF4444' }}></div>
                    <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#F59E0B' }}></div>
                    <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10B981' }}></div>
                  </div>
                  <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 700, letterSpacing: '0.8px' }}>DOCFLOW PREVIEW</span>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>Dossier #9042</div>
                  <div style={{ fontSize: '15.5px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>Vérification de complétude</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '12.5px', color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📄 Pièce d'identité
                    </span>
                    <span style={{ fontSize: '10.5px', background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>Validé</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '12.5px', color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🏠 Justificatif de domicile
                    </span>
                    <span style={{ fontSize: '10.5px', background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>Validé</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '12.5px', color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      💳 RIB bancaire
                    </span>
                    <span style={{ fontSize: '10.5px', background: 'rgba(245,158,11,0.15)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>À vérifier</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ position: 'relative', color: '#64748B', fontSize: '12.5px' }}>© 2026 DocFlow — Enterprise SaaS</div>
          </div>

          {/* Right form area */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', padding: '40px 24px', minWidth: 0 }}>
            <div style={{ width: '100%', maxWidth: '390px', animation: 'fadeUp .25s ease' }}>
              
              {/* ===== LANDING PAGE ===== */}
              {route === 'landing' && (
                <div>
                  <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-.6px', marginBottom: '8px', color: '#0F172A' }}>Rejoignez DocFlow</h2>
                  <p style={{ color: '#64748B', fontSize: '14.5px', marginBottom: '32px', lineHeight: '1.5' }}>
                    Connectez-vous pour déposer vos justificatifs ou valider les dossiers des membres de votre organisation.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button onClick={() => setRoute('login')} className="hover-brightness" style={{
                      padding: '13px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#0EA5E9,#2563EB)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37,99,235,0.2)', transition: 'transform 0.15s ease'
                    }}>
                      Se connecter à mon espace
                    </button>
                    <button onClick={() => setRoute('register')} className="hover-bg-slate" style={{
                      padding: '13px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'background-color 0.15s ease'
                    }}>
                      Créer un nouveau compte
                    </button>
                  </div>
                </div>
              )}

              {/* ===== LOGIN PAGE ===== */}
              {route === 'login' && (
                <form onSubmit={handleLogin}>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-.5px', marginBottom: '6px', color: '#0F172A' }}>Connexion</h2>
                  <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px' }}>
                    Accédez à votre espace sécurisé.
                  </p>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Adresse e-mail</label>
                    <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={{
                      width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none'
                    }} />
                  </div>

                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Mot de passe</label>
                      <a href="#" style={{ fontSize: '12px' }}>Mot de passe oublié ?</a>
                    </div>
                    <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} style={{
                      width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none'
                    }} />
                  </div>

                  {/* "Se souvenir de moi" Checkbox */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                    <input 
                      type="checkbox" 
                      id="rememberMe" 
                      checked={loginRemember} 
                      onChange={(e) => setLoginRemember(e.target.checked)} 
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="rememberMe" style={{ fontSize: '13px', color: '#475569', cursor: 'pointer', fontWeight: 500 }}>
                      Se souvenir de moi
                    </label>
                  </div>

                  <button type="submit" className="hover-brightness" style={{
                    width: '100%', padding: '11px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg,#0EA5E9,#0284C7)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', marginBottom: '16px'
                  }}>
                    Se connecter
                  </button>

                  <div style={{ textAlign: 'center', fontSize: '13.5px', color: '#64748B' }}>
                    Nouveau sur DocFlow ? <a href="#" onClick={(e) => { e.preventDefault(); setRoute('register'); }}>Créer un compte</a>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setRoute('landing'); }} style={{ fontSize: '13px' }}>← Retour à l'accueil</a>
                  </div>
                </form>
              )}

              {/* ===== REGISTER PAGE ===== */}
              {route === 'register' && (
                <form onSubmit={handleRegister}>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-.5px', marginBottom: '6px', color: '#0F172A' }}>Inscription</h2>
                  <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px' }}>
                    Commencez à utiliser la plateforme.
                  </p>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Nom complet</label>
                    <input type="text" required placeholder="Amélie Rousseau" value={registerName} onChange={(e) => setRegisterName(e.target.value)} style={{
                      width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none'
                    }} />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Adresse e-mail</label>
                    <input type="email" required placeholder="a.rousseau@mail.fr" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} style={{
                      width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none'
                    }} />
                  </div>

                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Mot de passe</label>
                    <input type="password" required placeholder="Minimum 6 caractères" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} style={{
                      width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none'
                    }} />
                  </div>

                  <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="registerIsAdmin"
                      checked={registerIsAdmin}
                      onChange={(e) => {
                        setRegisterIsAdmin(e.target.checked);
                        if (!e.target.checked) setRegisterAdminSecret('');
                      }}
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                    <label htmlFor="registerIsAdmin" style={{ fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      S'inscrire en tant qu'administrateur
                    </label>
                  </div>

                  {registerIsAdmin && (
                    <div style={{ marginBottom: '18px', animation: 'fadeUp 0.15s ease' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Code secret d'administration
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Saisissez le code d'activation"
                        value={registerAdminSecret}
                        onChange={(e) => setRegisterAdminSecret(e.target.value)}
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none'
                        }}
                      />
                    </div>
                  )}

                  <button type="submit" className="hover-brightness" style={{
                    width: '100%', padding: '11px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg,#0EA5E9,#0284C7)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', marginBottom: '16px'
                  }}>
                    Créer le compte
                  </button>

                  <div style={{ textAlign: 'center', fontSize: '13.5px', color: '#64748B' }}>
                    Déjà inscrit ? <a href="#" onClick={(e) => { e.preventDefault(); setRoute('login'); }}>Se connecter</a>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setRoute('landing'); }} style={{ fontSize: '13px' }}>← Retour à l'accueil</a>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      ) : (
        /* ================= APP MAIN INTERFACE ================= */
        <div style={{ minHeight: '100vh', display: 'flex', background: '#F1F5F9' }}>
          
          {/* Left Navigation Sidebar */}
          <aside style={{
            width: '240px',
            background: '#fff',
            borderRight: '1px solid #E2E8F0',
            padding: '24px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '6px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: 'linear-gradient(135deg,#0EA5E9,#0284C7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <path d="M14 2v6h6"></path>
                    <path d="M9 15l2 2 4-4"></path>
                  </svg>
                </div>
                <span style={{ fontWeight: 800, fontSize: '17px', letterSpacing: '-.3px', color: '#0F172A' }}>DocFlow</span>
              </div>

              {/* Navigation lists based on role */}
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {user && user.role === 'Administrateur' ? (
                  <>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#94A3B8', letterSpacing: '.4px', textTransform: 'uppercase', margin: '8px 0 6px 11px' }}>
                      Console Admin
                    </div>
                    <button onClick={() => navTo('a-dash')} className="hover-bg-slate" style={{
                      display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 11px', borderRadius: '9px',
                      font: (route === 'a-dash' ? '600' : '500') + ' 13.5px/1 "Hanken Grotesk",sans-serif', cursor: 'pointer',
                      color: route === 'a-dash' ? '#0369A1' : '#475569', background: route === 'a-dash' ? '#F0F9FF' : 'transparent',
                      border: 'none', width: '100%', textAlign: 'left'
                    }}>
                      Vue globale
                    </button>
                    <button onClick={() => navTo('a-users')} className="hover-bg-slate" style={{
                      display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 11px', borderRadius: '9px',
                      font: (route === 'a-users' || route === 'a-user' ? '600' : '500') + ' 13.5px/1 "Hanken Grotesk",sans-serif', cursor: 'pointer',
                      color: route === 'a-users' || route === 'a-user' ? '#0369A1' : '#475569', background: route === 'a-users' || route === 'a-user' ? '#F0F9FF' : 'transparent',
                      border: 'none', width: '100%', textAlign: 'left'
                    }}>
                      Utilisateurs
                    </button>
                    <button onClick={() => navTo('a-docs')} className="hover-bg-slate" style={{
                      display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 11px', borderRadius: '9px',
                      font: (route === 'a-docs' ? '600' : '500') + ' 13.5px/1 "Hanken Grotesk",sans-serif', cursor: 'pointer',
                      color: route === 'a-docs' ? '#0369A1' : '#475569', background: route === 'a-docs' ? '#F0F9FF' : 'transparent',
                      border: 'none', width: '100%', textAlign: 'left'
                    }}>
                      Documents
                    </button>
                    <button onClick={() => navTo('a-categories')} className="hover-bg-slate" style={{
                      display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 11px', borderRadius: '9px',
                      font: (route === 'a-categories' ? '600' : '500') + ' 13.5px/1 "Hanken Grotesk",sans-serif', cursor: 'pointer',
                      color: route === 'a-categories' ? '#0369A1' : '#475569', background: route === 'a-categories' ? '#F0F9FF' : 'transparent',
                      border: 'none', width: '100%', textAlign: 'left'
                    }}>
                      Catégories
                    </button>
                    <button onClick={() => navTo('a-audit')} className="hover-bg-slate" style={{
                      display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 11px', borderRadius: '9px',
                      font: (route === 'a-audit' ? '600' : '500') + ' 13.5px/1 "Hanken Grotesk",sans-serif', cursor: 'pointer',
                      color: route === 'a-audit' ? '#0369A1' : '#475569', background: route === 'a-audit' ? '#F0F9FF' : 'transparent',
                      border: 'none', width: '100%', textAlign: 'left'
                    }}>
                      Journal d'audit
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#94A3B8', letterSpacing: '.4px', textTransform: 'uppercase', margin: '8px 0 6px 11px' }}>
                      Espace Membre
                    </div>
                    <button onClick={() => navTo('u-dash')} className="hover-bg-slate" style={{
                      display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 11px', borderRadius: '9px',
                      font: (route === 'u-dash' ? '600' : '500') + ' 13.5px/1 "Hanken Grotesk",sans-serif', cursor: 'pointer',
                      color: route === 'u-dash' ? '#0369A1' : '#475569', background: route === 'u-dash' ? '#F0F9FF' : 'transparent',
                      border: 'none', width: '100%', textAlign: 'left'
                    }}>
                      Tableau de bord
                    </button>
                    <button onClick={() => navTo('u-upload')} className="hover-bg-slate" style={{
                      display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 11px', borderRadius: '9px',
                      font: (route === 'u-upload' ? '600' : '500') + ' 13.5px/1 "Hanken Grotesk",sans-serif', cursor: 'pointer',
                      color: route === 'u-upload' ? '#0369A1' : '#475569', background: route === 'u-upload' ? '#F0F9FF' : 'transparent',
                      border: 'none', width: '100%', textAlign: 'left'
                    }}>
                      Dépôt de fichiers
                    </button>
                    <button onClick={() => navTo('u-history')} className="hover-bg-slate" style={{
                      display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 11px', borderRadius: '9px',
                      font: (route === 'u-history' ? '600' : '500') + ' 13.5px/1 "Hanken Grotesk",sans-serif', cursor: 'pointer',
                      color: route === 'u-history' ? '#0369A1' : '#475569', background: route === 'u-history' ? '#F0F9FF' : 'transparent',
                      border: 'none', width: '100%', textAlign: 'left'
                    }}>
                      Historique
                    </button>
                    <button onClick={() => navTo('u-profile')} className="hover-bg-slate" style={{
                      display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 11px', borderRadius: '9px',
                      font: (route === 'u-profile' ? '600' : '500') + ' 13.5px/1 "Hanken Grotesk",sans-serif', cursor: 'pointer',
                      color: route === 'u-profile' ? '#0369A1' : '#475569', background: route === 'u-profile' ? '#F0F9FF' : 'transparent',
                      border: 'none', width: '100%', textAlign: 'left'
                    }}>
                      Mon profil
                    </button>
                  </>
                )}
              </nav>
            </div>

            {/* Bottom logout row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: user ? getAvatarColor(user.name) : '#0EA5E9',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '13px',
                  overflow: 'hidden'
                }}>
                  {user?.profilePic ? (
                    <img src={`${api.getBaseUrl()}/${user.profilePic}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user ? getInitials(user.name) : 'US'
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user?.name}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user?.role}
                  </div>
                </div>
              </div>
              <button onClick={logout} className="hover-bg-slate" style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px',
                border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"></path>
                </svg>
                Déconnexion
              </button>
            </div>
          </aside>

          {/* Right Main content and header */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            
            {/* Header toolbar */}
            <header style={{
              height: '58px',
              background: '#fff',
              borderBottom: '1px solid #E2E8F0',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              position: 'relative'
            }}>
              
              {/* Notification icon */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => { setNotifOpen(!notifOpen); setProfileMenu(false); }} className="hover-bg-slate" style={{
                  width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  {unreadNotifs > 0 && (
                    <span style={{
                      position: 'absolute', top: '-4px', right: '-4px', background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '999px'
                    }}>
                      {unreadNotifs}
                    </span>
                  )}
                </button>

                {/* Notifications dropdown panel */}
                {notifOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: '44px', width: '320px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0', zIndex: 110, padding: '12px', animation: 'toastIn .2s ease'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13.5px' }}>Notifications</span>
                      <button onClick={handleMarkAllRead} style={{ fontSize: '11px', border: 'none', background: 'transparent', color: '#0284C7', cursor: 'pointer', fontWeight: 600 }}>
                        Tout marquer lu
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '12px', padding: '16px' }}>Aucune notification</div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} style={{ display: 'flex', gap: '8px', padding: '6px', borderBottom: '1px solid #F8FAFC' }}>
                            <div style={{
                              width: '8px', height: '8px', borderRadius: '50%', background: n.read ? '#CBD5E1' : '#0EA5E9', marginTop: '4px', flexShrink: 0
                            }}></div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: n.read ? 500 : 700, fontSize: '12px', color: '#1E293B' }}>{n.title}</div>
                              <div style={{ fontSize: '11.5px', color: '#64748B', lineHeight: '1.3' }}>{n.text}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile options dropdown */}
               <div style={{ position: 'relative' }}>
                <button onClick={() => { setProfileMenu(!profileMenu); setNotifOpen(false); }} className="hover-bg-slate" style={{
                  height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', background: user ? getAvatarColor(user.name) : '#0EA5E9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700,
                    overflow: 'hidden'
                  }}>
                    {user?.profilePic ? (
                      <img src={`${api.getBaseUrl()}/${user.profilePic}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      user ? getInitials(user.name) : 'US'
                    )}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Mon compte</span>
                </button>

                {profileMenu && (
                  <div style={{
                    position: 'absolute', right: 0, top: '44px', width: '180px', background: '#fff', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0', zIndex: 110, padding: '6px', display: 'flex', flexDirection: 'column'
                  }}>
                    <button onClick={() => navTo(user?.role === 'Administrateur' ? 'a-dash' : 'u-dash')} className="hover-bg-slate" style={{
                      padding: '8px 10px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', color: '#334155'
                    }}>
                      Tableau de bord
                    </button>
                    <button onClick={() => navTo('u-profile')} className="hover-bg-slate" style={{
                      padding: '8px 10px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', color: '#334155'
                    }}>
                      Mon profil
                    </button>
                    <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }}></div>
                    <button onClick={logout} className="hover-bg-slate" style={{
                      padding: '8px 10px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', color: '#DC2626'
                    }}>
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* Main content body */}
            <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="sk" style={{ height: '40px', width: '200px' }}></div>
                  <div className="sk" style={{ height: '100px' }}></div>
                  <div className="sk" style={{ height: '240px' }}></div>
                </div>
              ) : (
                <>
                  {/* ================= USER DASHBOARD ================= */}
                  {route === 'u-dash' && (
                    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>Bonjour, {user?.name}</h1>
                          <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>Gérez vos documents administratifs et vérifiez leur conformité.</p>
                        </div>
                        {user?.status === 'incomplet' && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '9px', fontSize: '13px', color: '#B45309', fontWeight: 600 }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }}></span>
                            Dossier incomplet
                          </div>
                        )}
                        {user?.status === 'actif' && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '9px', fontSize: '13px', color: '#047857', fontWeight: 600 }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></span>
                            Dossier conforme
                          </div>
                        )}
                      </div>

                      {/* Summary Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '14px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>Complétude du dossier</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                              <span style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A' }}>
                                {documents.filter(d => d.status === 'valide').length}
                              </span>
                              <span style={{ fontSize: '16px', color: '#94A3B8' }}>/ {requiredCategories.length} requis valides</span>
                            </div>
                          </div>
                          <div style={{ marginTop: '16px' }}>
                            <div style={{ height: '8px', background: '#EEF2F6', borderRadius: '999px', overflow: 'hidden', marginBottom: '8px' }}>
                              <div style={{
                                height: '100%',
                                background: documents.filter(d => d.status === 'valide').length === requiredCategories.length ? '#10B981' : '#0EA5E9',
                                width: `${requiredCategories.length ? (documents.filter(d => d.status === 'valide').length / requiredCategories.length) * 100 : 0}%`,
                                transition: 'width .3s ease'
                              }}></div>
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>
                              Déposez tous les justificatifs obligatoires pour valider votre compte.
                            </div>
                          </div>
                        </div>

                        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px', borderRight: '1px solid #EEF2F6' }}>
                            <div style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 600 }}>En attente</div>
                            <div style={{ fontSize: '26px', fontWeight: 800, color: '#B45309', margin: '4px 0' }}>
                              {documents.filter(d => d.status === 'attente').length}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Fichiers à vérifier</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px' }}>
                            <div style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 600 }}>Refusés</div>
                            <div style={{ fontSize: '26px', fontWeight: 800, color: '#B91C1C', margin: '4px 0' }}>
                              {documents.filter(d => d.status === 'refuse').length}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Nécessite votre attention</div>
                          </div>
                        </div>
                      </div>

                      {/* Document Slots List */}
                      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>Pièces administratives requises</span>
                          <button onClick={() => navTo('u-upload')} style={{ border: 'none', background: 'transparent', color: '#0284C7', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                            Dépôt rapide →
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {requiredSlots.map((rs, idx) => {
                            const matchingDoc = documents.find(d => d.cat === rs.cat);
                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: idx < requiredSlots.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={rs.iconWrap}>
                                    {rs.done ? (
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                      </svg>
                                    ) : (
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                      </svg>
                                    )}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#1E293B' }}>{rs.name}</div>
                                    <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Catégorie · {rs.cat}</div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  {matchingDoc ? (
                                    <>
                                      <span style={getBadgeStyle(matchingDoc.status).style}>
                                        <span style={getBadgeStyle(matchingDoc.status).dotStyle}></span>
                                        {getBadgeStyle(matchingDoc.status).label}
                                      </span>
                                      {matchingDoc.status === 'refuse' && (
                                        <button onClick={() => triggerFileInput(rs.cat)} className="hover-brightness" style={{
                                          padding: '5px 12px', background: '#DC2626', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer'
                                        }}>
                                          Remplacer
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <button onClick={() => triggerFileInput(rs.cat)} className="hover-bg-slate" style={{
                                      padding: '5px 12px', background: '#fff', border: '1px solid #E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer'
                                    }}>
                                      Déposer
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ================= USER UPLOAD ================= */}
                  {route === 'u-upload' && (
                    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
                      <div style={{ marginBottom: '22px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '0 0 3px' }}>Dépôt de documents</h1>
                        <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>Formats acceptés : PDF, JPG, PNG, DOCX — 20 Mo maximum par fichier.</p>
                      </div>

                      {/* Dropzone container */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        style={{
                          border: '2px dashed ' + (dragOver ? '#0EA5E9' : '#CBD5E1'),
                          background: dragOver ? '#F0F9FF' : '#fff',
                          borderRadius: '16px',
                          padding: '42px 24px',
                          textAlign: 'center',
                          transition: 'border-color .15s, background .15s'
                        }}
                      >
                        <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                          </svg>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '12px' }}>Glissez-déposez vos fichiers ici</div>
                        
                        {/* Category selection for quick deposit */}
                        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Catégorie ciblée :</span>
                          <select 
                            value={quickUploadCat} 
                            onChange={(e) => setQuickUploadCat(e.target.value)}
                            style={{ 
                              padding: '5px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', 
                              fontSize: '12.5px', outline: 'none', background: '#fff', cursor: 'pointer',
                              color: '#334155', fontWeight: 600
                            }}
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        <button onClick={() => triggerFileInput(quickUploadCat || requiredSlots.find(s => s.todo)?.cat || 'Identité')} className="hover-brightness" style={{
                          padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#0EA5E9,#0284C7)', color: '#fff', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', boxShadow: '0 6px 16px rgba(14,165,233,.28)'
                        }}>
                          Parcourir les fichiers
                        </button>
                      </div>

                      {/* Progression bar */}
                      {uploading && (
                        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 18px', marginTop: '16px', animation: 'fadeUp .2s ease' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                              </svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{uploadName}</div>
                              <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Téléversement en cours… {Math.round(uploadPct)} %</div>
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0369A1' }}>{Math.round(uploadPct)} %</span>
                          </div>
                          <div style={{ height: '7px', background: '#EEF2F6', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${uploadPct}%`, height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg,#0EA5E9,#0284C7)', transition: 'width .2s ease'
                            }}></div>
                          </div>
                        </div>
                      )}

                      {/* Slots detailed listing */}
                      <div style={{ marginTop: '22px' }}>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px' }}>Sélectionnez une catégorie pour déposer</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {categories.map((cat) => {
                            const existing = documents.find(d => d.cat === cat.name);
                            const isValide = existing?.status === 'valide';
                            const isAttente = existing?.status === 'attente';
                            const isRefuse = existing?.status === 'refuse';
                            
                            return (
                              <div key={cat.id} style={{ 
                                background: existing ? '#F8FAFC' : '#fff', 
                                border: '1px solid #E2E8F0', 
                                borderRadius: '12px', 
                                padding: '14px 16px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '13px',
                                opacity: existing ? 0.75 : 1,
                                transition: 'all 0.2s ease'
                              }}>
                                <div style={{
                                  width: '34px', height: '34px', borderRadius: '9px', 
                                  background: isValide ? '#ECFDF5' : (isAttente ? '#FFFBEB' : (isRefuse ? '#FEF2F2' : '#F1F5F9')), 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                  {isValide ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.4">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  ) : (isAttente ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2">
                                      <circle cx="12" cy="12" r="10"></circle>
                                      <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                  ) : (isRefuse ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2">
                                      <circle cx="12" cy="12" r="10"></circle>
                                      <line x1="15" y1="9" x2="9" y2="15"></line>
                                      <line x1="9" y1="9" x2="15" y2="15"></line>
                                    </svg>
                                  ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                                      <line x1="12" y1="5" x2="12" y2="19"></line>
                                      <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                  )))}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: '13.5px', color: existing ? '#64748B' : '#0F172A' }}>{cat.name}</div>
                                  <div style={{ fontSize: '11px', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {existing ? `Soumis : ${existing.name}` : `Formats : ${cat.formats} (Max 20 Mo)`}
                                  </div>
                                </div>
                                {existing ? (
                                  <button onClick={() => handleDeleteDoc(existing.id)} className="hover-bg-red" style={{
                                    padding: '6px 10px', borderRadius: '8px', border: '1px solid #FECACA', background: '#FFF5F5', color: '#E11D48', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                  }} title="Supprimer pour remplacer">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <polyline points="3 6 5 6 21 6"></polyline>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                    Retirer
                                  </button>
                                ) : (
                                  <button onClick={() => triggerFileInput(cat.name)} className="hover-bg-slate" style={{
                                    padding: '6px 13px', borderRadius: '8px', border: '1px solid #0EA5E9', background: '#F0F9FF', color: '#0369A1', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                                  }}>
                                    Déposer
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ================= USER HISTORY ================= */}
                  {route === 'u-history' && (
                    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                      <div style={{ marginBottom: '20px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '0 0 3px' }}>Historique des dépôts</h1>
                        <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>Toutes vos actions et changements de statut.</p>
                      </div>

                      {/* Chip filters */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        {['all', 'valide', 'attente', 'refuse'].map(f => (
                          <button
                            key={f}
                            onClick={() => setDocFilter(f)}
                            style={{
                              padding: '7px 14px',
                              borderRadius: '9px',
                              border: '1px solid ' + (docFilter === f ? '#0EA5E9' : '#E7ECF1'),
                              background: docFilter === f ? '#F0F9FF' : '#fff',
                              color: docFilter === f ? '#0369A1' : '#475569',
                              font: '600 13px/1 "Hanken Grotesk",sans-serif',
                              cursor: 'pointer'
                            }}
                          >
                            {f === 'all' ? 'Tous' : f === 'valide' ? 'Validés' : f === 'attente' ? 'En attente' : 'Refusés'}
                          </button>
                        ))}
                      </div>

                      {/* Document list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                        {documents
                          .filter(d => docFilter === 'all' || d.status === docFilter)
                          .map((d) => (
                            <div key={d.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '15px 17px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '13px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                      <polyline points="14 2 14 8 20 8"></polyline>
                                    </svg>
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#1E293B' }}>{d.name}</div>
                                    <div style={{ fontSize: '11.5px', color: '#94A3B8', fontFamily: 'monospace' }}>
                                      ID: {d.id.substring(0, 8)} · Déposé le {new Date(d.date).toLocaleDateString('fr-FR')} · {d.size}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={getBadgeStyle(d.status).style}>
                                    <span style={getBadgeStyle(d.status).dotStyle}></span>
                                    {getBadgeStyle(d.status).label}
                                  </span>
                                  
                                  <button onClick={() => handleDeleteDoc(d.id)} className="hover-bg-red" style={{
                                    width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #FECACA', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }} title="Supprimer">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6"></polyline>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {d.status === 'refuse' && (
                                <div style={{ marginTop: '12px', padding: '11px 13px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                  </svg>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '12.5px', color: '#991B1B', lineHeight: 1.5 }}>
                                      <strong>Motif du refus :</strong> {d.note || 'Document non conforme.'}
                                    </div>
                                  </div>
                                  <button onClick={() => triggerFileInput(d.cat)} className="hover-brightness" style={{
                                    padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0
                                  }}>
                                    Remplacer
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* ================= USER PROFILE ================= */}
                  {route === 'u-profile' && (
                    <div style={{ maxWidth: '920px', margin: '0 auto' }}>
                      <div style={{ marginBottom: '20px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '0 0 3px' }}>Mon profil</h1>
                        <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>Complétez vos informations personnelles.</p>
                      </div>

                      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px 22px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ position: 'relative' }}>
                          <div style={{
                            width: '62px', height: '62px', borderRadius: '16px',
                            background: 'linear-gradient(135deg,#0EA5E9,#0369A1)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700,
                            overflow: 'hidden'
                          }}>
                            {user?.profilePic ? (
                              <img src={`${api.getBaseUrl()}/${user.profilePic}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              user ? getInitials(user.name) : 'AR'
                            )}
                          </div>
                          <label htmlFor="profilePicUpload" style={{
                            position: 'absolute', bottom: '-4px', right: '-4px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', border: '1px solid #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
                          }} title="Modifier la photo de profil">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                              <circle cx="12" cy="13" r="4"></circle>
                            </svg>
                          </label>
                          <input type="file" id="profilePicUpload" accept="image/*" onChange={handleProfilePicChange} style={{ display: 'none' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '17px' }}>{user?.name}</div>
                          <div style={{ color: '#64748B', fontSize: '13.5px' }}>
                            {user?.email} · Membre depuis {user?.joined && user.joined !== 'Invalid Date' ? new Date(user.joined).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '2026'}
                          </div>
                        </div>
                      </div>

                      <form onSubmit={handleUpdateProfile} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '22px' }}>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '16px' }}>Informations personnelles</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Nom complet</label>
                            <input value={profName} onChange={(e) => setProfName(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid #E2E8F0', fontSize: '14px', outline: 'none' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>E-mail</label>
                            <input value={profEmail} onChange={(e) => setProfEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid #E2E8F0', fontSize: '14px', outline: 'none' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Téléphone</label>
                            <input value={profPhone} onChange={(e) => setProfPhone(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid #E2E8F0', fontSize: '14px', outline: 'none' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Ville</label>
                            <input value={profCity} onChange={(e) => setProfCity(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid #E2E8F0', fontSize: '14px', outline: 'none' }} />
                          </div>
                          <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Adresse postale</label>
                            <input value={profAddress} onChange={(e) => setProfAddress(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid #E2E8F0', fontSize: '14px', outline: 'none' }} />
                          </div>
                          
                          <div style={{ gridColumn: 'span 2', marginTop: '8px' }}>
                            <div style={{ fontWeight: 700, fontSize: '14.5px', marginBottom: '10px', color: '#1E293B' }}>Paramètres de notification</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                              <input 
                                type="checkbox" 
                                id="profEmailNotif" 
                                checked={profEmailNotif} 
                                onChange={(e) => setProfEmailNotif(e.target.checked)} 
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                              <label htmlFor="profEmailNotif" style={{ fontSize: '13.5px', color: '#475569', cursor: 'pointer', fontWeight: 500 }}>
                                Recevoir les notifications par e-mail (validation ou refus de document)
                              </label>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '18px', borderTop: '1px solid #F1F5F9' }}>
                          <button type="submit" className="hover-brightness" style={{
                            padding: '9px 18px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg,#0EA5E9,#0284C7)', color: '#fff', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer'
                          }}>
                            Enregistrer
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* ================= ADMIN DASHBOARD ================= */}
                  {route === 'a-dash' && (
                    <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
                      <div style={{ marginBottom: '22px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '0 0 3px' }}>Tableau de bord admin</h1>
                        <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>Aperçu global de l'organisation et validation de dossiers.</p>
                      </div>

                      {/* Stats cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '16px' }}>
                        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 18px' }}>
                          <div style={{ color: '#64748B', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>Utilisateurs</div>
                          <div style={{ fontSize: '26px', fontWeight: 700 }}>{adminUsers.length}</div>
                          <div style={{ fontSize: '12px', color: '#047857', fontWeight: 600, marginTop: '4px' }}>Membres enregistrés</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 18px' }}>
                          <div style={{ color: '#64748B', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>En attente de revue</div>
                          <div style={{ fontSize: '26px', fontWeight: 700, color: '#B45309' }}>
                            {adminDocs.filter(d => d.status === 'attente').length}
                          </div>
                          <div style={{ fontSize: '12px', color: '#B45309', fontWeight: 600, marginTop: '4px' }}>Documents à traiter</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 18px' }}>
                          <div style={{ color: '#64748B', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>Validés</div>
                          <div style={{ fontSize: '26px', fontWeight: 700, color: '#047857' }}>
                            {adminDocs.filter(d => d.status === 'valide').length}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>Pièces validées</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 18px' }}>
                          <div style={{ color: '#64748B', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>Rapport d'activité</div>
                          <div style={{ fontSize: '26px', fontWeight: 700 }}>{adminAudits.length}</div>
                          <div style={{ fontSize: '12px', color: '#0EA5E9', fontWeight: 600, marginTop: '4px' }}>Logs enregistrés</div>
                        </div>
                      </div>

                      {/* Visual layouts */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '14px', marginBottom: '16px' }}>
                        
                        {/* Status split */}
                        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px' }}>
                          <div style={{ fontWeight: 700, fontSize: '14.5px', marginBottom: '14px' }}>Statut des dossiers</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '5px' }}>
                                <span style={{ color: '#475569', fontWeight: 600 }}>Actifs / Conformes</span>
                                <span style={{ fontWeight: 700, color: '#047857' }}>
                                  {adminUsers.length ? Math.round((adminUsers.filter(u => u.status === 'actif').length / adminUsers.length) * 100) : 0} %
                                </span>
                              </div>
                              <div style={{ height: '8px', background: '#EEF2F6', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${adminUsers.length ? (adminUsers.filter(u => u.status === 'actif').length / adminUsers.length) * 100 : 0}%`,
                                  height: '100%', background: '#10B981'
                                }}></div>
                              </div>
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '5px' }}>
                                <span style={{ color: '#475569', fontWeight: 600 }}>Incomplets</span>
                                <span style={{ fontWeight: 700, color: '#B45309' }}>
                                  {adminUsers.length ? Math.round((adminUsers.filter(u => u.status === 'incomplet').length / adminUsers.length) * 100) : 0} %
                                </span>
                              </div>
                              <div style={{ height: '8px', background: '#EEF2F6', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${adminUsers.length ? (adminUsers.filter(u => u.status === 'incomplet').length / adminUsers.length) * 100 : 0}%`,
                                  height: '100%', background: '#F59E0B'
                                }}></div>
                              </div>
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '5px' }}>
                                <span style={{ color: '#475569', fontWeight: 600 }}>Bloqués / Suspendus</span>
                                <span style={{ fontWeight: 700, color: '#B91C1C' }}>
                                  {adminUsers.length ? Math.round((adminUsers.filter(u => u.status === 'bloque').length / adminUsers.length) * 100) : 0} %
                                </span>
                              </div>
                              <div style={{ height: '8px', background: '#EEF2F6', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${adminUsers.length ? (adminUsers.filter(u => u.status === 'bloque').length / adminUsers.length) * 100 : 0}%`,
                                  height: '100%', background: '#EF4444'
                                }}></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Overview visual */}
                        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', marginBottom: '12px' }}>Dépôts administratifs conformes</div>
                          <div style={{
                            width: '100px', height: '100px', borderRadius: '50%',
                            border: '10px solid #10B981', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '18px', fontWeight: 800, color: '#0F172A'
                          }}>
                            {adminUsers.filter(u => u.status === 'actif').length}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '10px' }}>dossiers validés au total</div>
                        </div>
                      </div>

                      {/* Documents Review Table */}
                      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
                        <div style={{ padding: '15px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9' }}>
                          <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Dossiers à traiter en priorité</span>
                          <button onClick={() => navTo('a-docs')} style={{ border: 'none', background: 'transparent', color: '#0284C7', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer' }}>
                            Tout voir →
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {adminDocs.filter(d => d.status === 'attente').length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '24px' }}>Aucun document en attente de vérification</div>
                          ) : (
                            adminDocs
                              .filter(d => d.status === 'attente')
                              .slice(0, 4)
                              .map((d) => (
                                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: '1px solid #F5F7F9' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                      </svg>
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{d.name}</div>
                                      <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{d.cat} · Déposant : {d.userName}</div>
                                    </div>
                                  </div>
                                  <button onClick={() => handleOpenReview(d)} className="hover-brightness" style={{
                                    padding: '7px 15px', borderRadius: '9px', border: 'none', background: '#0EA5E9', color: '#fff', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer'
                                  }}>
                                    Examiner
                                  </button>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ================= ADMIN USERS LIST ================= */}
                  {route === 'a-users' && (
                    <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '0 0 3px' }}>Utilisateurs</h1>
                          <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>Gérez les dossiers documentaires des membres de l'organisation.</p>
                        </div>
                      </div>

                      {/* Filters row */}
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          </svg>
                          <input
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            placeholder="Rechercher par nom, e-mail, ID…"
                            style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#fff', fontSize: '13.5px', outline: 'none' }}
                          />
                        </div>

                        {/* Status filters */}
                        {['all', 'actif', 'incomplet', 'bloque'].map(f => (
                          <button
                            key={f}
                            onClick={() => setUserStatusFilter(f)}
                            style={{
                              padding: '7px 14px',
                              borderRadius: '9px',
                              border: '1px solid ' + (userStatusFilter === f ? '#0EA5E9' : '#E7ECF1'),
                              background: userStatusFilter === f ? '#F0F9FF' : '#fff',
                              color: userStatusFilter === f ? '#0369A1' : '#475569',
                              font: '600 13px/1 "Hanken Grotesk",sans-serif',
                              cursor: 'pointer'
                            }}
                          >
                            {f === 'all' ? 'Tous' : f === 'actif' ? 'Actifs' : f === 'incomplet' ? 'Incomplets' : 'Bloqués'}
                          </button>
                        ))}
                      </div>

                      {/* Users table */}
                      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr auto', padding: '11px 18px', fontSize: '11px', fontWeight: 700, color: '#94A3B8', borderBottom: '1px solid #F1F5F9', textTransform: 'uppercase' }}>
                          <span>Utilisateur</span>
                          <span>Rôle</span>
                          <span>Statut</span>
                          <span></span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {adminUsers.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '32px' }}>Aucun utilisateur trouvé</div>
                          ) : (
                            adminUsers.map((u) => (
                              <div
                                key={u.id}
                                onClick={() => handleOpenUserDetail(u.id)}
                                className="hover-bg-light"
                                style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr auto', padding: '12px 18px', alignItems: 'center', borderBottom: '1px solid #F5F7F9', cursor: 'pointer' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                                  <div style={{
                                    width: '34px', height: '34px', borderRadius: '9px', background: getAvatarColor(u.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0,
                                    overflow: 'hidden'
                                  }}>
                                    {u.profilePic ? (
                                      <img src={`${api.getBaseUrl()}/${u.profilePic}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      getInitials(u.name)
                                    )}
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                                    <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{u.email}</div>
                                  </div>
                                </div>
                                <span style={{ fontSize: '13px', color: '#475569' }}>{u.role}</span>
                                <span style={getBadgeStyle(u.status).style}>
                                  <span style={getBadgeStyle(u.status).dotStyle}></span>
                                  {getBadgeStyle(u.status).label}
                                </span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2">
                                  <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ================= ADMIN USER DETAIL ================= */}
                  {route === 'a-user' && selectedUser && (
                    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
                      <button onClick={() => navTo('a-users')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#0284C7', cursor: 'pointer', border: 'none', background: 'transparent', marginBottom: '16px' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <line x1="19" y1="12" x2="5" y2="12"></line>
                          <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                        Retour aux utilisateurs
                      </button>

                      {/* User title card */}
                      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '22px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
                        <div style={{
                          width: '62px', height: '62px', borderRadius: '16px', background: getAvatarColor(selectedUser.name), color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700,
                          overflow: 'hidden'
                        }}>
                          {selectedUser.profilePic ? (
                            <img src={`${api.getBaseUrl()}/${selectedUser.profilePic}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            getInitials(selectedUser.name)
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 700, fontSize: '19px' }}>{selectedUser.name}</span>
                            <span style={getBadgeStyle(selectedUser.status).style}>
                              <span style={getBadgeStyle(selectedUser.status).dotStyle}></span>
                              {getBadgeStyle(selectedUser.status).label}
                            </span>
                          </div>
                          <div style={{ color: '#64748B', fontSize: '13.5px', marginTop: '3px' }}>
                            {selectedUser.email} · ID: {selectedUser.id.substring(0, 8)} · Inscrit {selectedUser.joined && selectedUser.joined !== 'Invalid Date' ? new Date(selectedUser.joined).toLocaleDateString('fr-FR') : 'N/A'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '9px' }}>
                          <button onClick={() => handleToggleUserStatus(selectedUser.id, selectedUser.status)} className="hover-bg-red" style={{
                            padding: '8px 14px', borderRadius: '9px', border: '1px solid #FECACA', background: '#FEF2F2', fontSize: '13px', fontWeight: 600, color: '#DC2626', cursor: 'pointer'
                          }}>
                            {selectedUser.status === 'bloque' ? 'Débloquer' : 'Suspendre'}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                        {/* Contacts */}
                        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px', height: 'fit-content' }}>
                          <div style={{ fontWeight: 700, fontSize: '14.5px', marginBottom: '16px' }}>Coordonnées</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                              <div style={{ fontSize: '11.5px', color: '#94A3B8', fontWeight: 600, marginBottom: '2px' }}>Téléphone</div>
                              <div style={{ fontSize: '13.5px', color: '#334155' }}>{selectedUser.phone || 'N/A'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '11.5px', color: '#94A3B8', fontWeight: 600, marginBottom: '2px' }}>Ville</div>
                              <div style={{ fontSize: '13.5px', color: '#334155' }}>{selectedUser.city || 'N/A'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '11.5px', color: '#94A3B8', fontWeight: 600, marginBottom: '2px' }}>Rôle</div>
                              <div style={{ fontSize: '13.5px', color: '#334155' }}>{selectedUser.role}</div>
                            </div>
                          </div>
                        </div>

                        {/* User docs list */}
                        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
                          <div style={{ padding: '15px 18px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: '14.5px' }}>Documents déposés</div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {selectedUser.docs && (selectedUser.docs as any[]).length === 0 ? (
                              <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '32px' }}>Aucun document déposé</div>
                            ) : (
                              selectedUser.docs && (selectedUser.docs as any[]).map((d) => (
                                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '13px 18px', borderBottom: '1px solid #F5F7F9' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                      </svg>
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{d.name}</div>
                                      <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{d.cat} · {d.size}</div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={getBadgeStyle(d.status).style}>
                                      <span style={getBadgeStyle(d.status).dotStyle}></span>
                                      {getBadgeStyle(d.status).label}
                                    </span>
                                    <a href={api.downloadDocumentUrl(d.id)} download className="hover-bg-slate" style={{
                                      width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }} title="Télécharger">
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                      </svg>
                                    </a>
                                    {d.status === 'attente' && (
                                      <button onClick={() => handleOpenReview(d)} className="hover-brightness" style={{
                                        padding: '5px 12px', height: '30px', borderRadius: '8px', border: 'none', background: '#0EA5E9', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                                      }}>
                                        Examiner
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ================= ADMIN ALL DOCUMENTS ================= */}
                  {route === 'a-docs' && (
                    <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
                      <div style={{ marginBottom: '20px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '0 0 3px' }}>Documents</h1>
                        <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>Validez ou refusez les documents déposés par vos collaborateurs.</p>
                      </div>

                      {/* Docs list table */}
                      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 1.2fr 1.2fr auto', padding: '11px 18px', fontSize: '11px', fontWeight: 700, color: '#94A3B8', borderBottom: '1px solid #F1F5F9', textTransform: 'uppercase' }}>
                          <span>Document</span>
                          <span>Déposant</span>
                          <span>Date de dépôt</span>
                          <span>Statut</span>
                          <span>Actions</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {adminDocs.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '32px' }}>Aucun document déposé sur la plateforme</div>
                          ) : (
                            adminDocs.map((d) => (
                              <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 1.2fr 1.2fr auto', padding: '12px 18px', alignItems: 'center', borderBottom: '1px solid #F5F7F9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                      <polyline points="14 2 14 8 20 8"></polyline>
                                    </svg>
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                                    <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{d.cat} · {d.size}</div>
                                  </div>
                                </div>
                                <span style={{ fontSize: '13px', color: '#475569' }}>{d.userName || 'Utilisateur'}</span>
                                <span style={{ fontSize: '12.5px', color: '#64748B' }}>{new Date(d.date).toLocaleDateString('fr-FR')}</span>
                                <span style={getBadgeStyle(d.status).style}>
                                  <span style={getBadgeStyle(d.status).dotStyle}></span>
                                  {getBadgeStyle(d.status).label}
                                </span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <a href={api.downloadDocumentUrl(d.id)} download className="hover-bg-slate" style={{
                                    width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }} title="Télécharger">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                      <polyline points="7 10 12 15 17 10"></polyline>
                                      <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                  </a>
                                  {d.status === 'attente' && (
                                    <button onClick={() => handleOpenReview(d)} className="hover-brightness" style={{
                                      padding: '0 12px', height: '30px', borderRadius: '8px', border: 'none', background: '#0EA5E9', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                                    }}>
                                      Examiner
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ================= ADMIN CATEGORIES CONFIG ================= */}
                  {route === 'a-categories' && (
                    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
                        <div>
                          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '0 0 3px' }}>Catégories de documents</h1>
                          <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>Gérez le catalogue des catégories exigées pour la complétude.</p>
                        </div>
                      </div>

                      {/* Add new Category box */}
                      <form onSubmit={handleCreateCategory} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '14px', color: '#0F172A' }}>Ajouter une catégorie</div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div style={{ flex: 2, minWidth: '180px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Nom de la catégorie</label>
                            <input placeholder="Contrat, Certificat..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} style={{
                              width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', outline: 'none'
                            }} />
                          </div>
                          <div style={{ flex: 2, minWidth: '180px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Formats autorisés</label>
                            <input placeholder="PDF, JPG, PNG" value={newCatFormats} onChange={(e) => setNewCatFormats(e.target.value)} style={{
                              width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', outline: 'none'
                            }} />
                          </div>
                          <div style={{ flex: 1, minWidth: '100px', display: 'flex', alignItems: 'center', height: '36px', paddingBottom: '2px' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                              <input type="checkbox" checked={newCatRequired} onChange={(e) => setNewCatRequired(e.target.checked)} style={{ cursor: 'pointer' }} />
                              Requis
                            </label>
                          </div>
                          <button type="submit" className="hover-brightness" style={{
                            padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#0EA5E9,#0284C7)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                          }}>
                            Créer
                          </button>
                        </div>
                      </form>

                      {/* Categories list */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {categories.map((c) => (
                          <div key={c.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '13px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                              </svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 600, fontSize: '14px', color: '#1E293B' }}>{c.name}</span>
                                {c.required && (
                                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', padding: '1px 7px', borderRadius: '999px' }}>
                                    Obligatoire
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>
                                Formats : {c.formats}
                              </div>
                            </div>
                            
                            {/* Delete category */}
                            <button onClick={() => handleDeleteCategory(c.id)} className="hover-bg-red" style={{
                              width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #FECACA', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ================= ADMIN AUDIT LOGS ================= */}
                  {route === 'a-audit' && (
                    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
                      <div style={{ marginBottom: '20px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '0 0 3px' }}>Journal d’audit</h1>
                        <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>Traçabilité de toutes les actions sur la plateforme.</p>
                      </div>

                      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '6px 20px' }}>
                        {adminAudits.length === 0 ? (
                          <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '24px' }}>Aucun log enregistré</div>
                        ) : (
                          adminAudits.map((a) => (
                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '15px 0', borderBottom: '1px solid #F5F7F9' }}>
                              <div style={{
                                width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0,
                                background: a.tag === 'valide' ? '#10B981' : a.tag === 'refuse' ? '#EF4444' : '#0EA5E9'
                              }}></div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13.5px', color: '#334155' }}>
                                  <strong>{a.who}</strong> {a.act} <span style={{ color: '#0369A1', fontWeight: 600 }}>{a.obj}</span>
                                </div>
                              </div>
                              <span style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'monospace' }}>
                                {new Date(a.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                </>
              )}
            </main>
          </div>
        </div>
      )}

      {/* ================= REVIEW MODAL ================= */}
      {reviewDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(2px)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', animation: 'fadeUp .15s ease' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 24px 60px rgba(15,23,42,.3)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '16px', color: '#0F172A' }}>Examiner le document</span>
              <button onClick={() => setReviewDoc(null)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div style={{ padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '14px', background: '#F8FAFC', border: '1px solid #EEF2F6', borderRadius: '12px', marginBottom: '18px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reviewDoc.name}</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'monospace' }}>{reviewDoc.cat} · {reviewDoc.size}</div>
                </div>
              </div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Commentaire (obligatoire en cas de refus)
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Précisez le motif au demandeur…"
                style={{ width: '100%', minHeight: '84px', padding: '11px 13px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '13.5px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ padding: '16px 22px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => handleReviewAction('refuse')} className="hover-brightness" style={{
                padding: '10px 18px', borderRadius: '10px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px'
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                Refuser
              </button>
              <button onClick={() => handleReviewAction('valide')} className="hover-brightness" style={{
                padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#10B981', color: '#fff', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px'
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= COOKIES & TERMS CONSENT BANNER ================= */}
      {!cookieConsent && (
        <div style={{
          position: 'fixed', bottom: '20px', left: '20px', right: '20px',
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px',
          boxShadow: '0 10px 25px rgba(15,23,42,0.15)', zIndex: 999, display: 'flex', flexDirection: 'column', gap: '12px',
          animation: 'toastIn 0.3s ease', maxWidth: '420px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Respect de votre vie privée 🍪</div>
          <p style={{ fontSize: '12.5px', color: '#475569', margin: 0, lineHeight: '1.4' }}>
            Nous utilisons des cookies essentiels pour assurer le bon fonctionnement de la plateforme (connexion, sécurité). En poursuivant votre navigation, vous acceptez nos{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Conditions d'Utilisation :\n\nCette plateforme (DocFlow) est destinée au dépôt sécurisé de pièces justificatives.\n\nDonnées collectées : Vos documents d'identité et justificatifs sont chiffrés et stockés dans un serveur sécurisé. Ils sont visibles uniquement par vous et les administrateurs pour la validation de votre dossier.\n\nDroits : Conformément au RGPD, vous disposez d'un droit d'accès et de suppression de vos données, exerçable directement en supprimant vos documents ou votre compte."); }} style={{ color: '#0284C7', textDecoration: 'underline', fontWeight: 600 }}>
              conditions d'utilisation (RGPD)
            </a>.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button onClick={() => {
              localStorage.setItem('docflow_cookies_accepted', 'true');
              setCookieConsent(true);
            }} className="hover-brightness" style={{
              padding: '7px 15px', background: 'linear-gradient(135deg,#0EA5E9,#0284C7)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer'
            }}>
              Accepter & Fermer
            </button>
          </div>
        </div>
      )}

      {/* ================= TOAST PANEL ================= */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '26px', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', borderRadius: '12px',
          background: toast.type === 'valide' ? '#059669' : toast.type === 'refuse' ? '#DC2626' : '#0F172A',
          boxShadow: '0 14px 34px rgba(15,23,42,.28)', zIndex: 200, animation: 'toastIn .25s ease'
        }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {toast.type === 'valide' ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            )}
          </div>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>{toast.msg}</span>
        </div>
      )}
    </>
  );
}

export default App;
