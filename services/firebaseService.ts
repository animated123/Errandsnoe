import { User, UserRole, Errand, ErrandStatus, AppNotification, AppSettings, FeaturedService, ServiceListing, RunnerApplication } from '../types';

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// LocalStorage keys
const KEYS = {
  USERS: 'errand_runner_users',
  ERRANDS: 'errand_runner_errands',
  NOTIFICATIONS: 'errand_runner_notifications',
  SETTINGS: 'errand_runner_settings',
  FEATURED_SERVICES: 'errand_runner_featured_services',
  SERVICE_LISTINGS: 'errand_runner_service_listings',
  RUNNER_APPLICATIONS: 'errand_runner_runner_applications',
  SUPPORT_CHATS: 'errand_runner_support_chats',
  STATS: 'errand_runner_stats',
  CURRENT_USER: 'errand_runner_current_user'
};

// Initial Data
const INITIAL_SETTINGS: AppSettings = {
  appName: 'ErrandRunner',
  primaryColor: '#FF6321',
  logoUrl: '',
  iconUrl: '',
  platformFee: 10,
  minErrandPrice: 100,
  maintenanceMode: false
};

const INITIAL_FEATURED_SERVICES: FeaturedService[] = [
  { id: '1', title: 'Mama Fua (Laundry)', description: 'Professional laundry services at your doorstep.', imageUrl: 'https://picsum.photos/seed/laundry/400/300', price: 500, category: 'Mama Fua' },
  { id: '2', title: 'Market Shopping', description: 'Fresh groceries from the local market.', imageUrl: 'https://picsum.photos/seed/market/400/300', price: 300, category: 'Market Shopping' },
  { id: '3', title: 'House Hunting', description: 'Find your next home without the hassle.', imageUrl: 'https://picsum.photos/seed/home/400/300', price: 1000, category: 'House Hunting' }
];

const INITIAL_SERVICE_LISTINGS: ServiceListing[] = [
  { id: '1', title: 'Express Delivery', price: 500, category: 'Delivery', description: 'Fast delivery within the city.' },
  { id: '2', title: 'Gikomba Shopping', price: 1000, category: 'Shopping', description: 'Detailed shopping from Gikomba market.' }
];

// Helper to get data from localStorage
const getLocal = (key: string, fallback: any = []) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : fallback;
};

// Helper to save data to localStorage
const saveLocal = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Initialize data if not present
if (!localStorage.getItem(KEYS.SETTINGS)) saveLocal(KEYS.SETTINGS, INITIAL_SETTINGS);
if (!localStorage.getItem(KEYS.FEATURED_SERVICES)) saveLocal(KEYS.FEATURED_SERVICES, INITIAL_FEATURED_SERVICES);
if (!localStorage.getItem(KEYS.SERVICE_LISTINGS)) saveLocal(KEYS.SERVICE_LISTINGS, INITIAL_SERVICE_LISTINGS);

export const firebaseService = {
  subscribeToAuth: (callback: (user: User | null) => void) => {
    const checkAuth = () => {
      const user = getLocal(KEYS.CURRENT_USER, null);
      callback(user);
    };
    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  },

  login: async (email: string, pass: string): Promise<User> => {
    await delay(500);
    const users = getLocal(KEYS.USERS, []);
    const user = users.find((u: User) => u.email === email);
    if (user) {
      saveLocal(KEYS.CURRENT_USER, user);
      return user;
    }
    throw new Error('Invalid credentials');
  },

  register: async (name: string, email: string, phone: string, pass: string): Promise<User> => {
    await delay(500);
    const users = getLocal(KEYS.USERS, []);
    if (users.find((u: User) => u.email === email)) throw new Error('Email already in use');
    
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      email,
      phone,
      role: UserRole.REQUESTER,
      loyaltyPoints: 0,
      hoursSaved: 0,
      loyaltyLevel: 'Bronze' as any,
      createdAt: new Date().toISOString() as any
    };
    
    users.push(newUser);
    saveLocal(KEYS.USERS, users);
    saveLocal(KEYS.CURRENT_USER, newUser);
    return newUser;
  },

  logout: async () => {
    await delay(200);
    localStorage.removeItem(KEYS.CURRENT_USER);
    window.dispatchEvent(new Event('storage'));
  },

  updateUserSettings: async (userId: string, settings: Partial<User>) => {
    const users = getLocal(KEYS.USERS, []);
    const index = users.findIndex((u: User) => u.id === userId);
    if (index !== -1) {
      users[index] = { ...users[index], ...settings };
      saveLocal(KEYS.USERS, users);
      const currentUser = getLocal(KEYS.CURRENT_USER, null);
      if (currentUser && currentUser.id === userId) {
        saveLocal(KEYS.CURRENT_USER, users[index]);
      }
    }
  },

  subscribeToSettings: (callback: (settings: AppSettings) => void) => {
    const checkSettings = () => {
      callback(getLocal(KEYS.SETTINGS, INITIAL_SETTINGS));
    };
    checkSettings();
    window.addEventListener('storage', checkSettings);
    return () => window.removeEventListener('storage', checkSettings);
  },

  getAppStats: async () => {
    await delay(300);
    return getLocal(KEYS.STATS, {
      totalUsers: getLocal(KEYS.USERS, []).length,
      totalTasks: getLocal(KEYS.ERRANDS, []).length,
      onlineUsers: Math.floor(Math.random() * 10),
      avgDistance: 5.2,
      avgCompletionTime: 45,
      avgPenalty: 0,
      failedErrandsPercent: 2,
      revenuePerDay: [
        { date: '2024-03-18', amount: 1200 },
        { date: '2024-03-19', amount: 1500 },
        { date: '2024-03-20', amount: 1100 },
        { date: '2024-03-21', amount: 1800 },
        { date: '2024-03-22', amount: 2200 },
        { date: '2024-03-23', amount: 1900 },
        { date: '2024-03-24', amount: 2500 }
      ],
      categoryDistribution: [
        { name: 'Laundry', value: 400 },
        { name: 'Shopping', value: 300 },
        { name: 'Delivery', value: 300 },
        { name: 'House Hunting', value: 200 }
      ],
      topRunners: [],
      topRequesters: []
    });
  },

  fetchFeaturedServices: async (): Promise<FeaturedService[]> => {
    await delay(300);
    return getLocal(KEYS.FEATURED_SERVICES, INITIAL_FEATURED_SERVICES);
  },

  fetchServiceListings: async (): Promise<ServiceListing[]> => {
    await delay(300);
    return getLocal(KEYS.SERVICE_LISTINGS, INITIAL_SERVICE_LISTINGS);
  },

  createErrand: async (data: any) => {
    await delay(500);
    const errands = getLocal(KEYS.ERRANDS, []);
    const newErrand = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      status: ErrandStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    errands.push(newErrand);
    saveLocal(KEYS.ERRANDS, errands);
    return { id: newErrand.id };
  },

  subscribeToUserErrands: (userId: string, role: UserRole, callback: (errands: Errand[]) => void) => {
    const field = role === UserRole.RUNNER ? 'runnerId' : 'requesterId';
    const checkErrands = () => {
      const errands = getLocal(KEYS.ERRANDS, []);
      callback(errands.filter((e: any) => e[field] === userId).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)));
    };
    checkErrands();
    window.addEventListener('storage', checkErrands);
    return () => window.removeEventListener('storage', checkErrands);
  },

  subscribeToAvailableErrands: (callback: (errands: Errand[]) => void) => {
    const checkErrands = () => {
      const errands = getLocal(KEYS.ERRANDS, []);
      callback(errands.filter((e: any) => [ErrandStatus.PENDING, ErrandStatus.BIDDING].includes(e.status)).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)));
    };
    checkErrands();
    window.addEventListener('storage', checkErrands);
    return () => window.removeEventListener('storage', checkErrands);
  },

  subscribeToNotifications: (userId: string, callback: (notifs: AppNotification[]) => void) => {
    const checkNotifs = () => {
      const notifs = getLocal(KEYS.NOTIFICATIONS, []);
      callback(notifs.filter((n: any) => n.userId === userId).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)));
    };
    checkNotifs();
    window.addEventListener('storage', checkNotifs);
    return () => window.removeEventListener('storage', checkNotifs);
  },

  fetchErrandById: async (id: string): Promise<Errand | null> => {
    await delay(300);
    const errands = getLocal(KEYS.ERRANDS, []);
    return errands.find((e: any) => e.id === id) || null;
  },

  getNearbyRunners: async (): Promise<User[]> => {
    await delay(300);
    const users = getLocal(KEYS.USERS, []);
    return users.filter((u: User) => u.role === UserRole.RUNNER).slice(0, 10);
  },

  submitForReview: async (errandId: string, comments: string, photo: string) => {
    await delay(500);
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      errands[index] = {
        ...errands[index],
        status: ErrandStatus.REVIEW,
        reviewComments: comments,
        reviewPhoto: photo,
        updatedAt: new Date().toISOString()
      };
      saveLocal(KEYS.ERRANDS, errands);
    }
  },

  completeErrand: async (errandId: string, signature: string, rating: number) => {
    await delay(500);
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      errands[index] = {
        ...errands[index],
        status: ErrandStatus.COMPLETED,
        rating,
        signature,
        updatedAt: new Date().toISOString()
      };
      saveLocal(KEYS.ERRANDS, errands);
    }
  },

  fetchRunnerApplications: async (): Promise<RunnerApplication[]> => {
    await delay(300);
    return getLocal(KEYS.RUNNER_APPLICATIONS, []);
  },

  fetchAllUsers: async (): Promise<User[]> => {
    await delay(300);
    return getLocal(KEYS.USERS, []);
  },

  adminUpdateUser: async (userId: string, updates: any) => {
    await firebaseService.updateUserSettings(userId, updates);
  },

  adminDisableUser: async (userId: string, disabled: boolean) => {
    await firebaseService.updateUserSettings(userId, { disabled } as any);
  },

  adminDeleteUser: async (userId: string) => {
    const users = getLocal(KEYS.USERS, []);
    const newUsers = users.filter((u: User) => u.id !== userId);
    saveLocal(KEYS.USERS, newUsers);
  },

  adminChangeUserPassword: async (userId: string, newPass: string) => {
    console.log('Mock password change', userId, newPass);
  },

  updateRunnerApplicationStatus: async (appId: string, userId: string, status: string, category?: string) => {
    const apps = getLocal(KEYS.RUNNER_APPLICATIONS, []);
    const index = apps.findIndex((a: any) => a.id === appId);
    if (index !== -1) {
      apps[index] = { ...apps[index], status, categoryApplied: category };
      saveLocal(KEYS.RUNNER_APPLICATIONS, apps);
      if (status === 'approved') {
        await firebaseService.updateUserSettings(userId, { role: UserRole.RUNNER });
      }
    }
  },

  saveAppSettings: async (settings: Partial<AppSettings>) => {
    const current = getLocal(KEYS.SETTINGS, INITIAL_SETTINGS);
    saveLocal(KEYS.SETTINGS, { ...current, ...settings });
  },

  subscribeToAllSupportChats: (callback: (chats: any[]) => void) => {
    const checkChats = () => {
      callback(getLocal(KEYS.SUPPORT_CHATS, []));
    };
    checkChats();
    window.addEventListener('storage', checkChats);
    return () => window.removeEventListener('storage', checkChats);
  },

  subscribeToSupportChat: (userId: string, callback: (data: any) => void) => {
    const checkChat = () => {
      const chats = getLocal(KEYS.SUPPORT_CHATS, []);
      const chat = chats.find((c: any) => c.userId === userId);
      callback(chat || { messages: [] });
    };
    checkChat();
    window.addEventListener('storage', checkChat);
    return () => window.removeEventListener('storage', checkChat);
  },

  markSupportChatAsRead: async (userId: string, isAdmin: boolean) => {
    const chats = getLocal(KEYS.SUPPORT_CHATS, []);
    const index = chats.findIndex((c: any) => c.userId === userId);
    if (index !== -1) {
      chats[index] = {
        ...chats[index],
        [isAdmin ? 'unreadByAdmin' : 'unreadByUser']: false
      };
      saveLocal(KEYS.SUPPORT_CHATS, chats);
    }
  },

  sendSupportMessage: async (userId: string, senderName: string, text: string, isAdmin: boolean) => {
    const chats = getLocal(KEYS.SUPPORT_CHATS, []);
    const index = chats.findIndex((c: any) => c.userId === userId);
    const newMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: isAdmin ? 'admin' : userId,
      senderName,
      text,
      createdAt: new Date().toISOString()
    };
    if (index !== -1) {
      chats[index].messages.push(newMessage);
      chats[index].updatedAt = new Date().toISOString();
      chats[index].unreadByAdmin = !isAdmin;
      chats[index].unreadByUser = isAdmin;
    } else {
      chats.push({
        id: Math.random().toString(36).substr(2, 9),
        userId,
        userName: senderName,
        messages: [newMessage],
        updatedAt: new Date().toISOString(),
        unreadByAdmin: !isAdmin,
        unreadByUser: isAdmin
      });
    }
    saveLocal(KEYS.SUPPORT_CHATS, chats);
  },

  addFeaturedService: async (service: any) => {
    const services = getLocal(KEYS.FEATURED_SERVICES, INITIAL_FEATURED_SERVICES);
    services.push({ ...service, id: Math.random().toString(36).substr(2, 9) });
    saveLocal(KEYS.FEATURED_SERVICES, services);
  },

  deleteFeaturedService: async (id: string) => {
    const services = getLocal(KEYS.FEATURED_SERVICES, INITIAL_FEATURED_SERVICES);
    saveLocal(KEYS.FEATURED_SERVICES, services.filter((s: any) => s.id !== id));
  },

  addServiceListing: async (listing: any) => {
    const listings = getLocal(KEYS.SERVICE_LISTINGS, INITIAL_SERVICE_LISTINGS);
    listings.push({ ...listing, id: Math.random().toString(36).substr(2, 9) });
    saveLocal(KEYS.SERVICE_LISTINGS, listings);
  },

  deleteServiceListing: async (id: string) => {
    const listings = getLocal(KEYS.SERVICE_LISTINGS, INITIAL_SERVICE_LISTINGS);
    saveLocal(KEYS.SERVICE_LISTINGS, listings.filter((l: any) => l.id !== id));
  },

  getCurrentUser: async (): Promise<User | null> => {
    return getLocal(KEYS.CURRENT_USER, null);
  },

  updateMicroStep: async (errandId: string, stepIndex: number, completed: boolean) => {
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      const checklist = errands[index].checklist || [];
      if (checklist[stepIndex]) {
        checklist[stepIndex].completed = completed;
        errands[index].checklist = checklist;
        saveLocal(KEYS.ERRANDS, errands);
      }
    }
  },

  addErrandProof: async (errandId: string, photoUrl: string, label: string) => {
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      const proofs = errands[index].proofs || [];
      proofs.push({ url: photoUrl, label, createdAt: new Date().toISOString() });
      errands[index].proofs = proofs;
      errands[index].updatedAt = new Date().toISOString();
      saveLocal(KEYS.ERRANDS, errands);
    }
  },

  updateErrandReceiptData: async (errandId: string, total: number, serviceFee: number) => {
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      errands[index].receiptTotal = total;
      errands[index].serviceFee = serviceFee;
      errands[index].updatedAt = new Date().toISOString();
      saveLocal(KEYS.ERRANDS, errands);
    }
  },

  acceptBid: async (errandId: string, runnerId: string, runnerName: string, price: number, eta: string) => {
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      errands[index] = {
        ...errands[index],
        status: ErrandStatus.ASSIGNED,
        runnerId,
        runnerName,
        acceptedPrice: price,
        eta,
        assignedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveLocal(KEYS.ERRANDS, errands);
    }
  },

  placeBid: async (errandId: string, runnerId: string, runnerName: string, price: number, eta: string) => {
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      const bids = errands[index].bids || [];
      bids.push({ runnerId, runnerName, price, eta, createdAt: new Date().toISOString() });
      errands[index].bids = bids;
      errands[index].status = ErrandStatus.BIDDING;
      errands[index].updatedAt = new Date().toISOString();
      saveLocal(KEYS.ERRANDS, errands);
    }
  },

  sendMessage: async (errandId: string, senderId: string, senderName: string, text: string) => {
    // Errand chat is usually separate or embedded
    console.log('Mock send message', errandId, senderId, senderName, text);
  },

  requestReassignment: async (errandId: string, reason: string) => {
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      errands[index].reassignmentRequested = true;
      errands[index].reassignmentReason = reason;
      errands[index].updatedAt = new Date().toISOString();
      saveLocal(KEYS.ERRANDS, errands);
    }
  },

  reassignErrand: async (errandId: string, reason: string) => {
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      errands[index] = {
        ...errands[index],
        status: ErrandStatus.PENDING,
        runnerId: null,
        runnerName: null,
        reassignmentRequested: false,
        reassignReason: reason,
        updatedAt: new Date().toISOString()
      };
      saveLocal(KEYS.ERRANDS, errands);
    }
  },

  updateErrand: async (errandId: string, updates: any) => {
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      errands[index] = { ...errands[index], ...updates, updatedAt: new Date().toISOString() };
      saveLocal(KEYS.ERRANDS, errands);
    }
  },

  cancelErrand: async (errandId: string) => {
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      errands[index].status = ErrandStatus.CANCELLED;
      errands[index].updatedAt = new Date().toISOString();
      saveLocal(KEYS.ERRANDS, errands);
    }
  },

  sendPriceRequest: async (errandId: string, itemName: string, originalPrice: number, newPrice: number) => {
    console.log('Mock price request', errandId, itemName, originalPrice, newPrice);
  },

  toggleFavoriteRunner: async (userId: string, runnerId: string) => {
    const users = getLocal(KEYS.USERS, []);
    const index = users.findIndex((u: User) => u.id === userId);
    if (index !== -1) {
      const favorites = users[index].favoriteRunners || [];
      const newFavorites = favorites.includes(runnerId)
        ? favorites.filter((id: string) => id !== runnerId)
        : [...favorites, runnerId];
      users[index].favoriteRunners = newFavorites;
      saveLocal(KEYS.USERS, users);
      const currentUser = getLocal(KEYS.CURRENT_USER, null);
      if (currentUser && currentUser.id === userId) {
        saveLocal(KEYS.CURRENT_USER, users[index]);
      }
    }
  },

  submitOverdueReason: async (errandId: string, reason: string) => {
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      errands[index].overdueReason = reason;
      errands[index].updatedAt = new Date().toISOString();
      saveLocal(KEYS.ERRANDS, errands);
    }
  },

  rejectReassignment: async (errandId: string) => {
    const errands = getLocal(KEYS.ERRANDS, []);
    const index = errands.findIndex((e: any) => e.id === errandId);
    if (index !== -1) {
      errands[index].reassignmentRequested = false;
      errands[index].updatedAt = new Date().toISOString();
      saveLocal(KEYS.ERRANDS, errands);
    }
  },

  approveReassignment: async (errandId: string) => {
    await firebaseService.reassignErrand(errandId, 'Approved by admin');
  },

  respondToPriceRequest: async (errandId: string, requestId: string, answer: string) => {
    console.log('Mock respond to price request', errandId, requestId, answer);
  },

  addPropertyListing: async (errandId: string, listing: any) => {
    console.log('Mock add property listing', errandId, listing);
  },

  submitRunnerApplication: async (application: any) => {
    const apps = getLocal(KEYS.RUNNER_APPLICATIONS, []);
    apps.push({
      ...application,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    saveLocal(KEYS.RUNNER_APPLICATIONS, apps);
  },

  updateRunnerApplication: async (appId: string, status: string) => {
    const apps = getLocal(KEYS.RUNNER_APPLICATIONS, []);
    const index = apps.findIndex((a: any) => a.id === appId);
    if (index !== -1) {
      apps[index].status = status;
      apps[index].updatedAt = new Date().toISOString();
      saveLocal(KEYS.RUNNER_APPLICATIONS, apps);
    }
  }
};

export const cloudinaryService = {
  uploadImage: async (file: File | string, folder?: string, tags?: string): Promise<string> => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      console.warn('Cloudinary config missing, using mock');
      await delay(1000);
      return "https://picsum.photos/seed/" + Math.random() + "/800/600";
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    if (folder) formData.append('folder', folder);
    if (tags) formData.append('tags', tags);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to upload image to Cloudinary');
      }

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  },
  uploadFile: async (file: File | string, type?: string, folder?: string): Promise<string> => {
    return cloudinaryService.uploadImage(file, folder);
  }
};

export const geminiService = {
  parseErrandDescription: async (description: string) => {
    await delay(1000);
    return {
      title: description.slice(0, 20),
      category: "General",
      location: "Nairobi",
      budget: 500
    };
  },
  extractReceiptTotal: async (imageUrl: string): Promise<{ total: number } | null> => {
    await delay(1000);
    return { total: Math.floor(Math.random() * 2000) + 500 };
  }
};

export const calculateDistance = (p1: { lat: number, lng: number }, p2: { lat: number, lng: number }) => {
  const R = 6371; // km
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const formatFirebaseError = (err: any) => {
  return err.message || "An error occurred";
};

export const formatPhoneDisplay = (phone: string) => phone;
export const normalizePhone = (phone: string) => phone;
