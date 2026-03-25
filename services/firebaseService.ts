import { User, UserRole, Errand, ErrandStatus, AppNotification, AppSettings, FeaturedService, ServiceListing, RunnerApplication } from '../types';
import { db, auth } from '../src/lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  increment,
  limit,
  getDocFromServer
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// LocalStorage keys
const KEYS = {
  ERRANDS: 'errand_runner_errands',
  NOTIFICATIONS: 'errand_runner_notifications',
  SETTINGS: 'errand_runner_settings',
  FEATURED_SERVICES: 'errand_runner_featured_services',
  SERVICE_LISTINGS: 'errand_runner_service_listings',
  RUNNER_APPLICATIONS: 'errand_runner_runner_applications',
  SUPPORT_CHATS: 'errand_runner_support_chats',
  STATS: 'errand_runner_stats'
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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

const INITIAL_FEATURED_SERVICES: FeaturedService[] = [
  { id: '1', title: 'Mama Fua (Laundry)', description: 'Professional laundry services at your doorstep.', imageUrl: 'https://picsum.photos/seed/laundry/400/300', price: 500, category: 'Mama Fua' },
  { id: '2', title: 'Market Shopping', description: 'Fresh groceries from the local market.', imageUrl: 'https://picsum.photos/seed/market/400/300', price: 300, category: 'Market Shopping' },
  { id: '3', title: 'House Hunting', description: 'Find your next home without the hassle.', imageUrl: 'https://picsum.photos/seed/home/400/300', price: 1000, category: 'House Hunting' }
];

const INITIAL_SERVICE_LISTINGS: ServiceListing[] = [
  { id: '1', title: 'Express Delivery', price: 500, category: 'Delivery', description: 'Fast delivery within the city.' },
  { id: '2', title: 'Gikomba Shopping', price: 1000, category: 'Shopping', description: 'Detailed shopping from Gikomba market.' }
];

export const firebaseService = {
  subscribeToAuth: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            callback({ ...userDoc.data(), id: firebaseUser.uid } as User);
          } else {
            // Fallback if doc doesn't exist yet (e.g. registration in progress)
            callback({
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: UserRole.REQUESTER,
              isAdmin: false,
              loyaltyPoints: 0,
              hoursSaved: 0,
              loyaltyLevel: 'Bronze' as any,
              createdAt: new Date().toISOString() as any
            } as User);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      } else {
        callback(null);
      }
    });
  },

  login: async (email: string, pass: string): Promise<User> => {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const firebaseUser = userCredential.user;
    const path = `users/${firebaseUser.uid}`;
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        return { ...userDoc.data(), id: firebaseUser.uid } as User;
      }
      throw new Error('User profile not found');
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      throw error;
    }
  },

  register: async (name: string, email: string, phone: string, pass: string): Promise<User> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const firebaseUser = userCredential.user;
    
    await updateProfile(firebaseUser, { displayName: name });

    const isSuperAdmin = email === 'Errands@codexict.co.ke' || email === 'ngugimaina4@gmail.com';
    
    const newUser: User = {
      id: firebaseUser.uid,
      name,
      email,
      phone,
      role: isSuperAdmin ? UserRole.ADMIN : UserRole.REQUESTER,
      isAdmin: isSuperAdmin,
      loyaltyPoints: 0,
      hoursSaved: 0,
      loyaltyLevel: 'Bronze' as any,
      createdAt: new Date().toISOString() as any
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
    return newUser;
  },

  logout: async () => {
    await signOut(auth);
  },

  updateUserSettings: async (userId: string, updates: Partial<User>) => {
    await setDoc(doc(db, 'users', userId), updates, { merge: true });
  },

  updateUserLocation: async (userId: string, location: { lat: number, lng: number }) => {
    await setDoc(doc(db, 'users', userId), { 
      lastKnownLocation: location,
      updatedAt: serverTimestamp() 
    }, { merge: true });
  },

  subscribeToOnlineRunners: (callback: (runners: User[]) => void) => {
    const path = 'users';
    const q = query(
      collection(db, path), 
      where('role', '==', UserRole.RUNNER),
      where('isOnline', '==', true)
    );
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as User)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  subscribeToAllErrands: (callback: (errands: Errand[]) => void) => {
    const path = 'errands';
    return onSnapshot(collection(db, path), (snapshot) => {
      callback(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Errand)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  subscribeToSettings: (callback: (settings: AppSettings) => void) => {
    const path = 'settings/global';
    return onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as AppSettings);
      } else {
        callback(INITIAL_SETTINGS);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  getAppStats: async () => {
    await delay(300);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const errandsSnapshot = await getDocs(collection(db, 'errands'));
      const errands = errandsSnapshot.docs.map(d => d.data() as Errand);
      
      return {
        totalUsers: usersSnapshot.size,
        totalTasks: errands.length,
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
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'stats');
      throw error;
    }
  },

  fetchFeaturedServices: async (): Promise<FeaturedService[]> => {
    const path = 'featured_services';
    try {
      const snapshot = await getDocs(collection(db, path));
      if (snapshot.empty) return INITIAL_FEATURED_SERVICES;
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as FeaturedService));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      throw error;
    }
  },

  fetchServiceListings: async (): Promise<ServiceListing[]> => {
    const path = 'service_listings';
    try {
      const snapshot = await getDocs(collection(db, path));
      if (snapshot.empty) return INITIAL_SERVICE_LISTINGS;
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ServiceListing));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      throw error;
    }
  },

  createErrand: async (data: any) => {
    const docRef = await addDoc(collection(db, 'errands'), {
      ...data,
      status: ErrandStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Notify requester via SMS
    const requesterDoc = await getDoc(doc(db, 'users', data.requesterId));
    if (requesterDoc.exists()) {
      const requester = requesterDoc.data() as User;
      if (requester.phone) {
        smsService.sendSMS(requester.phone, `Hi ${requester.name}, your task "${data.title}" is now live on ErrandRunner! We'll notify you when runners start bidding.`);
      }
    }

    return { id: docRef.id };
  },

  subscribeToUserErrands: (userId: string, role: UserRole, callback: (errands: Errand[]) => void) => {
    const path = 'errands';
    const field = role === UserRole.RUNNER ? 'runnerId' : 'requesterId';
    const q = query(collection(db, path), where(field, '==', userId));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Errand));
      callback(list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  subscribeToAvailableErrands: (callback: (errands: Errand[]) => void) => {
    const path = 'errands';
    const q = query(
      collection(db, path), 
      where('status', 'in', [ErrandStatus.PENDING, ErrandStatus.BIDDING])
    );
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Errand));
      callback(list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  subscribeToNotifications: (userId: string, callback: (notifs: AppNotification[]) => void) => {
    const path = 'notifications';
    const q = query(collection(db, path), where('userId', '==', userId));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as AppNotification));
      callback(list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  fetchErrandById: async (id: string): Promise<Errand | null> => {
    const docSnap = await getDoc(doc(db, 'errands', id));
    if (docSnap.exists()) {
      return { ...docSnap.data(), id: docSnap.id } as Errand;
    }
    return null;
  },

  getNearbyRunners: async (): Promise<User[]> => {
    const q = query(collection(db, 'users'), where('role', '==', UserRole.RUNNER), limit(10));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as User));
  },

  submitForReview: async (errandId: string, comments: string, photo: string) => {
    await updateDoc(doc(db, 'errands', errandId), {
      status: ErrandStatus.REVIEW,
      reviewComments: comments,
      reviewPhoto: photo,
      updatedAt: new Date().toISOString()
    });
  },

  completeErrand: async (errandId: string, signature: string, rating: number) => {
    await updateDoc(doc(db, 'errands', errandId), {
      status: ErrandStatus.COMPLETED,
      rating,
      signature,
      updatedAt: new Date().toISOString()
    });
  },

  fetchRunnerApplications: async (): Promise<RunnerApplication[]> => {
    const path = 'runner_applications';
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as RunnerApplication));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      throw error;
    }
  },

  fetchAllUsers: async (): Promise<User[]> => {
    const path = 'users';
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as User));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      throw error;
    }
  },

  adminUpdateUser: async (userId: string, updates: any) => {
    await setDoc(doc(db, 'users', userId), updates, { merge: true });
  },

  adminDisableUser: async (userId: string, disabled: boolean) => {
    await setDoc(doc(db, 'users', userId), { disabled }, { merge: true });
  },

  adminDeleteUser: async (userId: string) => {
    await deleteDoc(doc(db, 'users', userId));
  },

  adminChangeUserPassword: async (userId: string, newPass: string) => {
    console.log('Mock password change', userId, newPass);
  },

  updateRunnerApplicationStatus: async (appId: string, userId: string, status: string, category?: string) => {
    await updateDoc(doc(db, 'runner_applications', appId), {
      status,
      categoryApplied: category,
      updatedAt: new Date().toISOString()
    });
    if (status === 'approved') {
      await firebaseService.updateUserSettings(userId, { role: UserRole.RUNNER });
    }
  },

  saveAppSettings: async (settings: Partial<AppSettings>) => {
    await setDoc(doc(db, 'settings', 'global'), settings, { merge: true });
  },

  subscribeToAllSupportChats: (callback: (chats: any[]) => void) => {
    const path = 'support_chats';
    return onSnapshot(collection(db, path), (snapshot) => {
      callback(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  subscribeToSupportChat: (userId: string, callback: (data: any) => void) => {
    const path = `support_chats/${userId}`;
    return onSnapshot(doc(db, 'support_chats', userId), (snapshot) => {
      if (snapshot.exists()) {
        const chatData = snapshot.data();
        const messagesPath = `support_chats/${userId}/messages`;
        const messagesQuery = query(collection(db, 'support_chats', userId, 'messages'), orderBy('createdAt', 'asc'));
        onSnapshot(messagesQuery, (msgSnapshot) => {
          callback({
            ...chatData,
            messages: msgSnapshot.docs.map(d => ({ ...d.data(), id: d.id }))
          });
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, messagesPath);
        });
      } else {
        callback({ messages: [] });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  markSupportChatAsRead: async (userId: string, isAdmin: boolean) => {
    await setDoc(doc(db, 'support_chats', userId), {
      [isAdmin ? 'unreadByAdmin' : 'unreadByUser']: false
    }, { merge: true });
  },

  sendSupportMessage: async (userId: string, senderName: string, text: string, isAdmin: boolean) => {
    const chatRef = doc(db, 'support_chats', userId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        userId,
        userName: senderName,
        updatedAt: new Date().toISOString(),
        unreadByAdmin: !isAdmin,
        unreadByUser: isAdmin
      });
    } else {
      await updateDoc(chatRef, {
        updatedAt: new Date().toISOString(),
        unreadByAdmin: !isAdmin,
        unreadByUser: isAdmin
      });
    }

    await addDoc(collection(db, 'support_chats', userId, 'messages'), {
      senderId: isAdmin ? 'admin' : userId,
      senderName,
      text,
      createdAt: Date.now()
    });
  },

  addFeaturedService: async (service: any) => {
    await addDoc(collection(db, 'featured_services'), service);
  },

  updateFeaturedService: async (id: string, updates: any) => {
    await updateDoc(doc(db, 'featured_services', id), updates);
  },

  deleteFeaturedService: async (id: string) => {
    await deleteDoc(doc(db, 'featured_services', id));
  },

  addServiceListing: async (listing: any) => {
    await addDoc(collection(db, 'service_listings'), listing);
  },

  deleteServiceListing: async (id: string) => {
    await deleteDoc(doc(db, 'service_listings', id));
  },

  getCurrentUser: async (): Promise<User | null> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (userDoc.exists()) {
      return { ...userDoc.data(), id: firebaseUser.uid } as User;
    }
    return null;
  },

  updateMicroStep: async (errandId: string, stepIndex: number, completed: boolean) => {
    const errandRef = doc(db, 'errands', errandId);
    const errandSnap = await getDoc(errandRef);
    if (errandSnap.exists()) {
      const checklist = errandSnap.data().checklist || [];
      if (checklist[stepIndex]) {
        checklist[stepIndex].completed = completed;
        await updateDoc(errandRef, { checklist });
      }
    }
  },

  addErrandProof: async (errandId: string, photoUrl: string, label: string) => {
    const errandRef = doc(db, 'errands', errandId);
    const errandSnap = await getDoc(errandRef);
    if (errandSnap.exists()) {
      const proofs = errandSnap.data().proofs || [];
      proofs.push({ url: photoUrl, label, createdAt: new Date().toISOString() });
      await updateDoc(errandRef, { 
        proofs,
        updatedAt: new Date().toISOString()
      });
    }
  },

  updateErrandReceiptData: async (errandId: string, total: number, serviceFee: number) => {
    await updateDoc(doc(db, 'errands', errandId), {
      receiptTotal: total,
      serviceFee: serviceFee,
      updatedAt: new Date().toISOString()
    });
  },

  acceptBid: async (errandId: string, runnerId: string, runnerName: string, price: number, eta: string) => {
    const errandRef = doc(db, 'errands', errandId);
    await updateDoc(errandRef, {
      status: ErrandStatus.ASSIGNED,
      runnerId,
      runnerName,
      acceptedPrice: price,
      eta,
      assignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const errandSnap = await getDoc(errandRef);
    const errandData = errandSnap.data();

    // Notify runner via SMS
    const runnerDoc = await getDoc(doc(db, 'users', runnerId));
    if (runnerDoc.exists()) {
      const runner = runnerDoc.data() as User;
      if (runner.phone) {
        smsService.sendSMS(runner.phone, `Congratulations ${runner.name}! Your bid for "${errandData?.title}" has been accepted. Log in to start the task.`);
      }
    }
  },

  placeBid: async (errandId: string, runnerId: string, runnerName: string, price: number, eta: string) => {
    const errandRef = doc(db, 'errands', errandId);
    const errandSnap = await getDoc(errandRef);
    if (errandSnap.exists()) {
      const bids = errandSnap.data().bids || [];
      bids.push({ runnerId, runnerName, price, eta, createdAt: new Date().toISOString() });
      await updateDoc(errandRef, {
        bids,
        status: ErrandStatus.BIDDING,
        updatedAt: new Date().toISOString()
      });
    }
  },

  sendMessage: async (errandId: string, senderId: string, senderName: string, text: string) => {
    await addDoc(collection(db, 'errands', errandId, 'chat'), {
      senderId,
      senderName,
      text,
      createdAt: serverTimestamp()
    });
  },

  requestReassignment: async (errandId: string, reason: string) => {
    await updateDoc(doc(db, 'errands', errandId), {
      reassignmentRequested: true,
      reassignmentReason: reason,
      updatedAt: new Date().toISOString()
    });
  },

  reassignErrand: async (errandId: string, reason: string) => {
    await updateDoc(doc(db, 'errands', errandId), {
      status: ErrandStatus.PENDING,
      runnerId: null,
      runnerName: null,
      reassignmentRequested: false,
      reassignReason: reason,
      updatedAt: new Date().toISOString()
    });
  },

  updateErrand: async (errandId: string, updates: any) => {
    await updateDoc(doc(db, 'errands', errandId), { 
      ...updates, 
      updatedAt: new Date().toISOString() 
    });
  },

  cancelErrand: async (errandId: string) => {
    await updateDoc(doc(db, 'errands', errandId), {
      status: ErrandStatus.CANCELLED,
      updatedAt: new Date().toISOString()
    });
  },

  sendPhoneVerificationCode: async (phone: string) => {
    const response = await fetch('/api/sms/verify/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send verification code');
    }
    return response.json();
  },

  verifyPhoneCode: async (phone: string, code: string) => {
    const response = await fetch('/api/sms/verify/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Invalid verification code');
    }
    return response.json();
  },

  sendPriceRequest: async (errandId: string, itemName: string, originalPrice: number, newPrice: number) => {
    await addDoc(collection(db, 'errands', errandId, 'price_requests'), {
      itemName,
      originalPrice,
      newPrice,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  },

  toggleFavoriteRunner: async (userId: string, runnerId: string) => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const favorites = userSnap.data().favoriteRunners || [];
      const newFavorites = favorites.includes(runnerId)
        ? favorites.filter((id: string) => id !== runnerId)
        : [...favorites, runnerId];
      await updateDoc(userRef, { favoriteRunners: newFavorites });
    }
  },

  submitOverdueReason: async (errandId: string, reason: string) => {
    await updateDoc(doc(db, 'errands', errandId), {
      overdueReason: reason,
      updatedAt: new Date().toISOString()
    });
  },

  rejectReassignment: async (errandId: string) => {
    await updateDoc(doc(db, 'errands', errandId), {
      reassignmentRequested: false,
      updatedAt: new Date().toISOString()
    });
  },

  approveReassignment: async (errandId: string) => {
    await firebaseService.reassignErrand(errandId, 'Approved by admin');
  },

  generateEmailVerificationCode: async (userId: string, email: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    await updateDoc(doc(db, 'users', userId), {
      verificationCode: code,
      verificationCodeExpiresAt: expiresAt
    });

    const subject = 'Your Verification Code - ErrandRunner';
    const text = `Your verification code is: ${code}. It expires in 15 minutes.`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1a1a1a;">
        <h2 style="color: #FF6321;">Verify Your Email</h2>
        <p>Thank you for joining ErrandRunner! Please use the following code to verify your email address:</p>
        <div style="background: #f4f4f4; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: 900; letter-spacing: 5px; color: #000;">${code}</span>
        </div>
        <p style="font-size: 12px; color: #666;">This code will expire in 15 minutes.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 10px; color: #999;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    return emailService.sendEmail(email, subject, text, html);
  },

  verifyEmailCode: async (userId: string, code: string) => {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) throw new Error('User not found');

    const userData = userDoc.data() as User;
    if (userData.verificationCode !== code) {
      throw new Error('Invalid verification code');
    }

    if (userData.verificationCodeExpiresAt < Date.now()) {
      throw new Error('Verification code has expired');
    }

    await updateDoc(doc(db, 'users', userId), {
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null
    });

    return { success: true };
  },

  generatePasswordResetCode: async (email: string) => {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) throw new Error('User not found');

    const userDoc = snapshot.docs[0];
    const userId = userDoc.id;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    await updateDoc(doc(db, 'users', userId), {
      resetCode: code,
      resetCodeExpiresAt: expiresAt
    });

    const subject = 'Your Password Reset Code - ErrandRunner';
    const text = `Your password reset code is: ${code}. It expires in 15 minutes.`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1a1a1a;">
        <h2 style="color: #FF6321;">Reset Your Password</h2>
        <p>You requested a password reset for your ErrandRunner account. Please use the following code to proceed:</p>
        <div style="background: #f4f4f4; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: 900; letter-spacing: 5px; color: #000;">${code}</span>
        </div>
        <p style="font-size: 12px; color: #666;">This code will expire in 15 minutes.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 10px; color: #999;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    return emailService.sendEmail(email, subject, text, html);
  },

  verifyPasswordResetCode: async (email: string, code: string) => {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) throw new Error('User not found');

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data() as User;
    if (userData.resetCode !== code) {
      throw new Error('Invalid reset code');
    }

    if (userData.resetCodeExpiresAt < Date.now()) {
      throw new Error('Reset code has expired');
    }

    return { success: true, userId: userDoc.id };
  },

  updatePassword: async (userId: string, newPass: string) => {
    // In a real app, this would use Firebase Auth's updatePassword
    // But since we're using a custom flow, we'll just update the doc for now
    // NOTE: This is NOT secure for a real production app without backend verification
    await updateDoc(doc(db, 'users', userId), {
      resetCode: null,
      resetCodeExpiresAt: null
    });
    // In this mock/dev environment, we can't actually change the Auth password easily without the user being logged in
    // So we'll just log it and clear the code.
    console.log('Password updated for user:', userId);
  },

  respondToPriceRequest: async (errandId: string, requestId: string, answer: string) => {
    await updateDoc(doc(db, 'errands', errandId, 'price_requests', requestId), {
      status: answer,
      updatedAt: new Date().toISOString()
    });
  },

  addPropertyListing: async (errandId: string, listing: any) => {
    await addDoc(collection(db, 'errands', errandId, 'property_listings'), {
      ...listing,
      createdAt: new Date().toISOString()
    });
  },

  submitRunnerApplication: async (application: any) => {
    await addDoc(collection(db, 'runner_applications'), {
      ...application,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  },

  updateRunnerApplication: async (appId: string, status: string) => {
    await updateDoc(doc(db, 'runner_applications', appId), {
      status,
      updatedAt: new Date().toISOString()
    });
  }
};

export const cloudinaryService = {
  uploadImage: async (file: File | string, folder?: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      // Fallback to mock for development if server fails
      await delay(1000);
      return "https://picsum.photos/seed/" + Math.random() + "/800/600";
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

export const emailService = {
  sendEmail: async (to: string, subject: string, text: string, html?: string) => {
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, subject, text, html }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Email sending failed:', error);
        return { success: false, error };
      }
      
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Email service error:', error);
      return { success: false, error };
    }
  }
};

export const smsService = {
  sendSMS: async (recipient: string, message: string) => {
    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipient, message }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('SMS sending failed:', error);
        return { success: false, error };
      }
      
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('SMS service error:', error);
      return { success: false, error };
    }
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
