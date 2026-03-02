import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  Auth
} from 'firebase/auth';
import { 
  getFirestore,
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  updateDoc, 
  arrayUnion, 
  addDoc, 
  orderBy, 
  limit, 
  increment, 
  onSnapshot, 
  Timestamp, 
  Firestore, 
  deleteField,
  deleteDoc
} from 'firebase/firestore';
import { Errand, ErrandStatus, ErrandCategory, User, UserRole, Coordinates, Bid, AppNotification, NotificationType, AppSettings, ChatMessage, RunnerApplication, FeaturedService, ServiceListing, MicroStep, ErrandProof, PriceRequest, PropertyListing } from '../types';

const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  return process.env[key];
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("AIzaSy")) {
  console.warn("Firebase API Key is using default or is missing. Login might fail if the default project is not configured correctly.");
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("CRITICAL: Firebase initialization failed:", error);
}

const sanitizeData = (data: any): any => {
  if (data === null || data === undefined) return data;
  if (data instanceof Timestamp) return data.toMillis();
  if (typeof data === 'object' && 'seconds' in data && 'nanoseconds' in data && typeof data.toMillis === 'function') return data.toMillis();
  if (Array.isArray(data)) return data.map(v => sanitizeData(v));
  if (typeof data === 'object') {
    if (data.constructor && data.constructor.name !== 'Object' && data.constructor.name !== 'Array') return null;
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizeData(data[key]);
      }
    }
    return sanitized;
  }
  return data;
};

export const calculateDistance = (p1: Coordinates, p2: Coordinates) => {
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
};

export const formatFirebaseError = (error: any): string => {
  const code = error.code || '';
  const message = error.message || '';
  
  if (code.includes('auth/user-not-found')) return "We couldn't find an account with that email.";
  if (code.includes('auth/wrong-password')) return "The password you entered is incorrect.";
  if (code.includes('auth/email-already-in-use')) return "An account with this email already exists.";
  if (code.includes('auth/weak-password')) return "Your password is too weak. Please use at least 6 characters.";
  if (code.includes('auth/invalid-email')) return "Please enter a valid email address.";
  if (code.includes('auth/network-request-failed')) return "Network error. Please check your connection.";
  if (code.includes('permission-denied')) return "You don't have permission to perform this action.";
  
  return message.replace(/Firebase: /g, '').replace(/\(auth\/.*\)\./g, '').trim() || "An unexpected error occurred. Please try again.";
};

class FirebaseService {
  private checkInitialization() {
    if (!db || !auth) throw new Error("Firestore or Auth service is not initialized.");
  }

  async fetchNotifications(userId: string): Promise<AppNotification[]> {
    try {
      this.checkInitialization();
      // Simplify query to avoid composite index requirement
      const q = query(
        collection(db, 'notifications'), 
        where('userId', '==', userId)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as AppNotification)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);
    } catch (e) { return []; }
  }

  async markNotificationsAsRead(userId: string): Promise<void> {
    try {
      this.checkInitialization();
      const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
      const snap = await getDocs(q);
      const promises = snap.docs.map(d => updateDoc(doc(db, 'notifications', d.id), { read: true }));
      await Promise.all(promises);
    } catch (e) {}
  }

  async createNotification(userId: string, type: NotificationType, title: string, message: string, errandId: string): Promise<void> {
    try {
      this.checkInitialization();
      await addDoc(collection(db, 'notifications'), {
        userId, type, title, message, errandId,
        read: false,
        timestamp: Date.now()
      });
    } catch (e) { console.error("Failed to create notification:", e); }
  }

  subscribeToNotifications(userId: string, callback: (notifications: AppNotification[]) => void) {
    this.checkInitialization();
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    this.checkInitialization();
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  }

  async sendMessage(errandId: string, senderId: string, senderName: string, text: string): Promise<void> {
    this.checkInitialization();
    const message: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      senderId,
      senderName,
      text,
      timestamp: Date.now()
    };
    await updateDoc(doc(db, 'errands', errandId), {
      chat: arrayUnion(message)
    });

    // Notify the other party
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (errandDoc.exists()) {
      const errand = errandDoc.data() as any;
      const recipientId = senderId === errand.requesterId ? errand.runnerId : errand.requesterId;
      if (recipientId) {
        await this.createNotification(recipientId, NotificationType.NEW_MESSAGE, "New Message", `${senderName}: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`, errandId);
      }
    }
  }

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      if (!auth || !db) { resolve(null); return; }
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        unsubscribe();
        if (fbUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
            if (userDoc.exists()) {
              resolve(sanitizeData({ id: fbUser.uid, ...(userDoc.data() as any) }) as User);
            } else { resolve(null); }
          } catch (e) { resolve(null); }
        } else { resolve(null); }
      });
    });
  }

  async login(identifier: string, password: string): Promise<User> {
    this.checkInitialization();
    let email = identifier;

    // Check if identifier is a phone number (doesn't contain @)
    if (!identifier.includes('@')) {
      // Normalize phone
      let normalizedPhone = identifier.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.substring(1);
      else if (normalizedPhone.startsWith('7') || normalizedPhone.startsWith('1')) normalizedPhone = '254' + normalizedPhone;

      const q = query(collection(db, 'users'), where('phone', '==', normalizedPhone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        email = (snap.docs[0].data() as any).email;
      }
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      let userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      
      // Auto-assign admin status for hardcoded admin account
      if (email === 'admin@codexict.co.ke') {
        if (!userDoc.exists() || !(userDoc.data() as any).isAdmin) {
          await setDoc(doc(db, 'users', cred.user.uid), { isAdmin: true }, { merge: true });
          userDoc = await getDoc(doc(db, 'users', cred.user.uid));
        }
      }

      if (!userDoc.exists()) throw new Error("User profile not found.");
      return sanitizeData({ id: cred.user.uid, ...(userDoc.data() as any) }) as User;
    } catch (e: any) {
      // Create admin account if it doesn't exist yet but credentials match
      const isAdminEmail = email === 'admin@codexict.co.ke';
      const isDefaultPassword = password === 'password1';
      const isNotFoundError = e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials';

      if (isAdminEmail && isDefaultPassword && isNotFoundError) {
        try {
          return await this.register('Admin User', email, '+25412345678', password, true);
        } catch (regErr) {
          // If registration fails (e.g. user already exists but password was wrong), throw original error
          throw e;
        }
      }
      throw e;
    }
  }

  async signInWithPhone(phone: string): Promise<User> {
    this.checkInitialization();
    // Normalize phone for lookup
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.substring(1);
    else if (normalizedPhone.startsWith('7') || normalizedPhone.startsWith('1')) normalizedPhone = '254' + normalizedPhone;

    const q = query(collection(db, 'users'), where('phone', '==', normalizedPhone));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      throw new Error('No account found with this phone number. Please register first.');
    }

    const userDoc = snap.docs[0];
    return sanitizeData({ id: userDoc.id, ...userDoc.data() }) as User;
  }

  async register(name: string, email: string, phone: string, password: string, isAdmin: boolean = false): Promise<User> {
    this.checkInitialization();
    
    if (!phone) throw new Error("Phone number is required for registration.");

    // Normalize phone
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.substring(1);
    else if (normalizedPhone.startsWith('7') || normalizedPhone.startsWith('1')) normalizedPhone = '254' + normalizedPhone;

    // Check if phone already exists
    const q = query(collection(db, 'users'), where('phone', '==', normalizedPhone));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error('An account with this phone number already exists.');
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const newUserProfile = {
      email, phone: normalizedPhone, name, role: UserRole.REQUESTER, isAdmin: isAdmin || email === 'admin@codexict.co.ke',
      isVerified: true,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
      createdAt: Date.now(),
      rating: 5, ratingCount: 0,
      isOnline: false,
      balanceOnHold: 0, balanceWithdrawn: 0,
      notificationSettings: { email: true, push: true, sms: false },
      theme: 'light',
      totalErrandsRequested: 0,
      totalErrandsAccepted: 0,
      cancellationsCount: 0,
      lateCompletionsCount: 0,
      rejectionsCount: 0,
      cancellationRate: 0,
      lateCompletionRate: 0,
      rejectionRate: 0,
      isSuspended: false
    };
    await setDoc(doc(db, 'users', cred.user.uid), newUserProfile);
    return sanitizeData({ id: cred.user.uid, ...newUserProfile }) as User;
  }

  async logout() { if (auth) await signOut(auth); }

  async checkAndAutoApproveOverdueReasons(errandId: string): Promise<void> {
    this.checkInitialization();
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (!errandDoc.exists()) return;
    const errand = errandDoc.data() as Errand;

    if (errand.overdueReasonStatus === 'pending' && errand.overdueReasonSubmittedAt) {
      const threshold = Date.now() - (14 * 60 * 60 * 1000);
      if (errand.overdueReasonSubmittedAt < threshold) {
        console.log(`Auto-approving overdue reason for errand ${errandId} (14 hours passed)`);
        await this.handleOverdueReason(errandId, 'approved', true);
      }
    }
  }

  private async updateUserPerformance(userId: string, type: 'cancellation' | 'late_completion' | 'rejection'): Promise<void> {
    this.checkInitialization();
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return;
    const user = userDoc.data() as User;

    const updates: any = {};
    if (type === 'cancellation') {
      updates.cancellationsCount = increment(1);
    } else if (type === 'late_completion') {
      updates.lateCompletionsCount = increment(1);
    } else if (type === 'rejection') {
      updates.rejectionsCount = increment(1);
    }

    await updateDoc(doc(db, 'users', userId), updates);

    // Recalculate rates
    const updatedUserDoc = await getDoc(doc(db, 'users', userId));
    const updatedUser = updatedUserDoc.data() as User;
    
    const totalRequested = updatedUser.totalErrandsRequested || 1;
    const totalAccepted = updatedUser.totalErrandsAccepted || 1;

    const cancellationRate = ((updatedUser.cancellationsCount || 0) / totalRequested) * 100;
    const lateCompletionRate = ((updatedUser.lateCompletionsCount || 0) / totalAccepted) * 100;
    const rejectionRate = ((updatedUser.rejectionsCount || 0) / totalRequested) * 100;

    const finalUpdates: any = {
      cancellationRate,
      lateCompletionRate,
      rejectionRate
    };

    // Check suspension threshold (30%)
    if (cancellationRate > 30 || lateCompletionRate > 30 || rejectionRate > 30) {
      finalUpdates.isSuspended = true;
      finalUpdates.suspensionReason = "Performance threshold exceeded (>30% failure rate)";
      finalUpdates.suspensionExpiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hour suspension
    }

    await updateDoc(doc(db, 'users', userId), finalUpdates);
  }

  async fetchUserErrands(userId: string, role: UserRole): Promise<Errand[]> {
    try {
      this.checkInitialization();
      const field = role === UserRole.REQUESTER ? 'requesterId' : 'runnerId';
      const q = query(collection(db, 'errands'), where(field, '==', userId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as Errand);
      
      // Check for auto-approvals
      for (const errand of list) {
        if (errand.overdueReasonStatus === 'pending') {
          await this.checkAndAutoApproveOverdueReasons(errand.id);
        }
      }

      if (role === UserRole.RUNNER) {
        const qPending = query(collection(db, 'errands'), where('status', '==', ErrandStatus.PENDING));
        const snapPending = await getDocs(qPending);
        const pending = snapPending.docs.map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as Errand).filter(e => e.bids?.some(b => b.runnerId === userId));
        const merged = [...list, ...pending];
        return merged.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      }
      return list;
    } catch (e) { return []; }
  }

  async fetchAvailableErrands(): Promise<Errand[]> {
    try {
      this.checkInitialization();
      const q = query(collection(db, 'errands'), where('status', '==', ErrandStatus.PENDING));
      const snap = await getDocs(q);
      return snap.docs.map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as Errand);
    } catch (e) { return []; }
  }

  async fetchErrandById(id: string): Promise<Errand | null> {
    try {
      this.checkInitialization();
      await this.checkAndAutoApproveOverdueReasons(id);
      const d = await getDoc(doc(db, 'errands', id));
      if (!d.exists()) return null;
      return sanitizeData({ id: d.id, ...(d.data() as any) }) as Errand;
    } catch (e) { return null; }
  }

  async getNearbyRunners(): Promise<User[]> {
    try {
      this.checkInitialization();
      const q = query(collection(db, 'users'), where('role', '==', UserRole.RUNNER), where('isOnline', '==', true));
      const snap = await getDocs(q);
      return snap.docs.map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as User);
    } catch (e) { return []; }
  }

  async calculateDistanceBackend(pickup: Coordinates, dropoff: Coordinates): Promise<{ distanceKm: number, polyline: string, pickup: Coordinates, dropoff: Coordinates }> {
    const response = await fetch('/api/errands/calculate-distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickup, dropoff })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to calculate distance');
    }
    return response.json();
  }

  async createErrand(data: any): Promise<Errand> {
    this.checkInitialization();
    
    // Check suspension
    const userDoc = await getDoc(doc(db, 'users', data.requesterId));
    if (userDoc.exists() && (userDoc.data() as User).isSuspended) {
      const expires = (userDoc.data() as User).suspensionExpiresAt;
      if (expires && expires > Date.now()) {
        throw new Error(`Your account is temporarily suspended due to poor performance. Expires: ${new Date(expires).toLocaleString()}`);
      } else {
        // Auto-lift suspension if expired
        await updateDoc(doc(db, 'users', data.requesterId), { isSuspended: false });
      }
    }
    
    // Backend Distance Validation
    let routePolyline = '';
    if (data.pickupCoordinates && data.dropoffCoordinates) {
      try {
        const result = await this.calculateDistanceBackend(data.pickupCoordinates, data.dropoffCoordinates);
        data.distanceKm = result.distanceKm;
        routePolyline = result.polyline;
        // Log coordinates to prevent manipulation
        data.pickupCoordinates = result.pickup;
        data.dropoffCoordinates = result.dropoff;
      } catch (e) {
        console.warn("Backend distance calculation failed, falling back to frontend calculation", e);
        data.distanceKm = calculateDistance(data.pickupCoordinates, data.dropoffCoordinates);
      }
    }

    const serviceFee = Math.ceil((data.budget || 0) * 0.1); // 10% service fee
    const lockedAmount = (data.budget || 0) + serviceFee;

    const newErrand = { 
      ...data, 
      routePolyline,
      status: ErrandStatus.PENDING, 
      runnerId: null, 
      createdAt: Date.now(), 
      bids: [], 
      chat: [], 
      requesterRating: 5,
      isFundsLocked: true,
      lockedAmount,
      serviceFee
    };
    const docRef = await addDoc(collection(db, 'errands'), newErrand);
    const errandId = docRef.id;

    // Increment total errands requested for requester
    await updateDoc(doc(db, 'users', data.requesterId), {
      totalErrandsRequested: increment(1)
    });

    // Notify relevant runners
    try {
      const runnersQuery = query(
        collection(db, 'users'), 
        where('role', '==', UserRole.RUNNER)
      );
      const runnersSnap = await getDocs(runnersQuery);
      const runners = runnersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      
      for (const runner of runners) {
        // Notify if category matches or if runner is general
        const categoryMatch = runner.runnerCategory === data.category || runner.runnerCategory === ErrandCategory.GENERAL;
        
        let locationMatch = true;
        if (data.pickupCoordinates && runner.lastKnownLocation) {
          const distance = calculateDistance(data.pickupCoordinates, runner.lastKnownLocation);
          locationMatch = distance <= 20; // Notify runners within 20km
        }

        if (categoryMatch && locationMatch) {
          await this.createNotification(
            runner.id,
            NotificationType.NEW_ERRAND,
            "New Errand Available!",
            `A new ${data.category} task "${data.title}" was posted near you.`,
            errandId
          );
        }
      }
    } catch (e) {
      console.error("Error notifying runners:", e);
    }

    return sanitizeData({ id: errandId, ...newErrand }) as Errand;
  }

  async updateErrand(errandId: string, updates: Partial<Errand>): Promise<void> {
    this.checkInitialization();
    await updateDoc(doc(db, 'errands', errandId), updates);
  }

  async cancelErrand(errandId: string): Promise<void> {
    this.checkInitialization();
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (!errandDoc.exists()) return;
    const errand = errandDoc.data() as any;
    
    if (errand.status !== ErrandStatus.PENDING) {
      throw new Error("Only pending errands can be cancelled.");
    }

    await updateDoc(doc(db, 'errands', errandId), { status: ErrandStatus.CANCELLED });

    // Track performance
    await this.updateUserPerformance(errand.requesterId, 'cancellation');

    // Notify all bidders
    if (errand.bids && Array.isArray(errand.bids)) {
      for (const bid of errand.bids) {
        await this.createNotification(
          bid.runnerId,
          NotificationType.NEW_MESSAGE,
          "Errand Cancelled",
          `The errand "${errand.title}" you bid on has been cancelled by the requester.`,
          errandId
        );
      }
    }
  }

  async acceptBid(errandId: string, runnerId: string, price: number): Promise<void> {
    console.log("acceptBid called", { errandId, runnerId, price });
    this.checkInitialization();
    
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (!errandDoc.exists()) return;
    const errand = errandDoc.data() as Errand;

    const runnerDoc = await getDoc(doc(db, 'users', runnerId));
    const runnerData = runnerDoc.exists() ? runnerDoc.data() as User : null;
    
    // Calculate deadline based on distance
    const distance = errand.distanceKm || 0;
    let hours = 2;
    if (distance > 7) {
      hours = 24;
    }
    const deadlineTimestamp = Date.now() + (hours * 60 * 60 * 1000);

    // Initialize micro-steps based on category
    let microSteps: MicroStep[] = [];
    if (errand.category === ErrandCategory.SHOPPING) {
      microSteps = [
        { label: 'Agent arrived at the market', timestamp: 0, completed: false },
        { label: 'Shopping completed', timestamp: 0, completed: false },
        { label: 'On the way to your house', timestamp: 0, completed: false }
      ];
    } else if (errand.category === ErrandCategory.MAMA_FUA) {
      microSteps = [
        { label: 'Agent arrived at your house', timestamp: 0, completed: false },
        { label: 'Cleaning in progress', timestamp: 0, completed: false },
        { label: 'Cleaning completed', timestamp: 0, completed: false }
      ];
    } else if (errand.category === ErrandCategory.HOUSE_HUNTING) {
      microSteps = [
        { label: 'Agent arrived at location', timestamp: 0, completed: false },
        { label: 'Viewing in progress', timestamp: 0, completed: false },
        { label: 'Report being prepared', timestamp: 0, completed: false }
      ];
    } else {
      microSteps = [
        { label: 'Agent arrived at pickup', timestamp: 0, completed: false },
        { label: 'Task in progress', timestamp: 0, completed: false },
        { label: 'On the way to drop-off', timestamp: 0, completed: false }
      ];
    }

    const runnerProfileSnapshot = runnerData ? {
      rating: runnerData.rating || 5,
      errandsCompleted: runnerData.errandsCompleted || 0,
      isVerified: runnerData.isVerified || false,
      avatar: runnerData.avatar
    } : undefined;

    await updateDoc(doc(db, 'errands', errandId), { 
      status: ErrandStatus.ACCEPTED, 
      runnerId, 
      acceptedPrice: price, 
      jobStartedAt: Date.now(),
      deadlineTimestamp,
      microSteps,
      runnerProfileSnapshot
    });
    console.log("Errand status updated to ACCEPTED with deadline and profile snapshot");
    
    // Notify runner
    await this.createNotification(runnerId, NotificationType.BID_ACCEPTED, "Bid Accepted!", `Your bid for "${errand.title}" was accepted.`, errandId);

    // Increment total errands accepted for runner
    await updateDoc(doc(db, 'users', runnerId), {
      totalErrandsAccepted: increment(1)
    });
  }

  async updateMicroStep(errandId: string, stepIndex: number, completed: boolean): Promise<void> {
    this.checkInitialization();
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (!errandDoc.exists()) return;
    const errand = errandDoc.data() as Errand;
    
    if (errand.microSteps && errand.microSteps[stepIndex]) {
      const newSteps = [...errand.microSteps];
      newSteps[stepIndex] = {
        ...newSteps[stepIndex],
        completed,
        timestamp: completed ? Date.now() : 0
      };
      await updateDoc(doc(db, 'errands', errandId), { microSteps: newSteps });
      
      // Notify requester
      const statusText = completed ? "completed" : "updated";
      await this.createNotification(
        errand.requesterId, 
        NotificationType.NEW_MESSAGE, 
        "Task Progress", 
        `Runner ${statusText}: ${newSteps[stepIndex].label}`, 
        errandId
      );
    }
  }

  async toggleFavoriteRunner(userId: string, runnerId: string): Promise<void> {
    this.checkInitialization();
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return;
    const user = userDoc.data() as User;
    const favorites = user.favoriteRunnerIds || [];
    const isFavorite = favorites.includes(runnerId);
    
    await updateDoc(doc(db, 'users', userId), {
      favoriteRunnerIds: isFavorite 
        ? favorites.filter(id => id !== runnerId)
        : arrayUnion(runnerId)
    });
  }

  async updateErrandReceiptData(errandId: string, receiptTotal: number, serviceFee: number): Promise<void> {
    this.checkInitialization();
    await updateDoc(doc(db, 'errands', errandId), {
      receiptTotal,
      serviceFee,
      actualShoppingTotal: receiptTotal
    });
  }

  async sendPriceRequest(errandId: string, itemName: string, originalPrice: number, newPrice: number): Promise<void> {
    this.checkInitialization();
    const request: PriceRequest = {
      id: Math.random().toString(36).substring(7),
      itemName,
      originalPrice,
      newPrice,
      status: 'pending',
      timestamp: Date.now()
    };
    await updateDoc(doc(db, 'errands', errandId), {
      priceRequests: arrayUnion(request)
    });

    // Notify requester
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (errandDoc.exists()) {
      const errand = errandDoc.data() as any;
      await this.createNotification(
        errand.requesterId,
        NotificationType.PRICE_REQUEST,
        "Price Adjustment Request",
        `${itemName} is Ksh ${newPrice}, not ${originalPrice}. Accept?`,
        errandId
      );
    }
  }

  async respondToPriceRequest(errandId: string, requestId: string, status: 'approved' | 'rejected'): Promise<void> {
    this.checkInitialization();
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (!errandDoc.exists()) return;
    const errand = errandDoc.data() as Errand;
    
    if (errand.priceRequests) {
      const newRequests = errand.priceRequests.map(r => 
        r.id === requestId ? { ...r, status } : r
      );
      
      await updateDoc(doc(db, 'errands', errandId), { priceRequests: newRequests });

      // Notify runner
      if (errand.runnerId) {
        const req = errand.priceRequests.find(r => r.id === requestId);
        await this.createNotification(
          errand.runnerId,
          NotificationType.NEW_MESSAGE,
          `Price Request ${status.toUpperCase()}`,
          `The requester has ${status} your price adjustment for ${req?.itemName}.`,
          errandId
        );
      }
    }
  }

  async addPropertyListing(errandId: string, listing: Omit<PropertyListing, 'id' | 'timestamp'>): Promise<void> {
    this.checkInitialization();
    const newListing: PropertyListing = {
      ...listing,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now()
    };
    await updateDoc(doc(db, 'errands', errandId), {
      propertyListings: arrayUnion(newListing)
    });

    // Notify requester
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (errandDoc.exists()) {
      const errand = errandDoc.data() as any;
      await this.createNotification(
        errand.requesterId,
        NotificationType.NEW_MESSAGE,
        "New Property Found!",
        `The agent has added a new property: ${listing.title}`,
        errandId
      );
    }
  }

  async addErrandProof(errandId: string, url: string, label: string): Promise<void> {
    this.checkInitialization();
    const proof: ErrandProof = {
      url,
      label,
      timestamp: Date.now()
    };
    await updateDoc(doc(db, 'errands', errandId), {
      proofs: arrayUnion(proof)
    });
  }

  async submitOverdueReason(errandId: string, reason: string): Promise<void> {
    this.checkInitialization();
    await updateDoc(doc(db, 'errands', errandId), {
      overdueReason: reason,
      overdueReasonSubmittedAt: Date.now(),
      overdueReasonStatus: 'pending'
    });
  }

  async handleOverdueReason(errandId: string, status: 'approved' | 'rejected', isAutoApproved: boolean = false): Promise<void> {
    this.checkInitialization();
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (!errandDoc.exists()) return;
    const errand = errandDoc.data() as Errand;

    if (status === 'approved') {
      const newDeadline = Date.now() + (2 * 60 * 60 * 1000);
      await updateDoc(doc(db, 'errands', errandId), {
        overdueReasonStatus: 'approved',
        overdueReasonAutoApproved: isAutoApproved,
        deadlineTimestamp: newDeadline
      });
      if (errand.runnerId) {
        await this.createNotification(errand.runnerId, NotificationType.BID_ACCEPTED, "Reason Approved", isAutoApproved ? "Your delay reason was auto-approved by the system." : "Your delay reason was approved. You have 2 more hours.", errandId);
      }
    } else {
      await updateDoc(doc(db, 'errands', errandId), {
        overdueReasonStatus: 'rejected'
      });
      
      // Track performance for runner
      if (errand.runnerId) {
        await this.updateUserPerformance(errand.runnerId, 'rejection');
        await this.createNotification(errand.runnerId, NotificationType.BID_ACCEPTED, "Reason Rejected", "Your delay reason was rejected. Please complete the task immediately.", errandId);
      }
    }
  }

  async requestReassignment(errandId: string, reason: string): Promise<void> {
    this.checkInitialization();
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (!errandDoc.exists()) return;
    const errand = errandDoc.data() as any;
    
    await updateDoc(doc(db, 'errands', errandId), { 
      reassignmentRequested: true, 
      reassignReason: reason 
    });

    if (errand.runnerId) {
      await this.createNotification(
        errand.runnerId, 
        NotificationType.NEW_MESSAGE, 
        "Reassignment Requested", 
        `The requester has requested to reassign "${errand.title}". Please review and approve.`, 
        errandId
      );
    }
  }

  async approveReassignment(errandId: string): Promise<void> {
    this.checkInitialization();
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (!errandDoc.exists()) return;
    const errand = errandDoc.data() as any;
    const reason = errand.reassignReason || "Runner approved reassignment";

    await updateDoc(doc(db, 'errands', errandId), { 
      status: ErrandStatus.PENDING, 
      runnerId: null, 
      acceptedPrice: deleteField(), 
      reassignReason: reason, 
      reassignedAt: Date.now(),
      reassignmentRequested: deleteField()
    });
    
    await this.createNotification(
      errand.requesterId, 
      NotificationType.JOB_COMPLETED, 
      "Reassignment Approved", 
      `The runner has approved the reassignment of "${errand.title}". The errand is now back to pending.`, 
      errandId
    );
  }

  async rejectReassignment(errandId: string): Promise<void> {
    this.checkInitialization();
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (!errandDoc.exists()) return;
    const errand = errandDoc.data() as any;

    await updateDoc(doc(db, 'errands', errandId), { 
      reassignmentRequested: deleteField(),
      reassignReason: deleteField()
    });

    await this.createNotification(
      errand.requesterId, 
      NotificationType.NEW_MESSAGE, 
      "Reassignment Rejected", 
      `The runner has rejected the reassignment request for "${errand.title}".`, 
      errandId
    );
  }

  async reassignErrand(errandId: string, reason: string): Promise<void> {
    this.checkInitialization();
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    let oldRunnerId = null;
    if (errandDoc.exists()) oldRunnerId = (errandDoc.data() as any).runnerId;

    await updateDoc(doc(db, 'errands', errandId), { status: ErrandStatus.PENDING, runnerId: null, acceptedPrice: deleteField(), reassignReason: reason, reassignedAt: Date.now() });
    
    if (oldRunnerId) {
      await this.createNotification(oldRunnerId, NotificationType.JOB_COMPLETED, "Errand Reassigned", `You have been removed from the errand "${(errandDoc.data() as any).title}".`, errandId);
    }
  }

  async submitForReview(errandId: string, comments: string, photo?: string): Promise<void> {
    this.checkInitialization();
    const updateData: any = { 
      status: ErrandStatus.VERIFYING, 
      runnerComments: comments,
      submittedForReviewAt: Date.now()
    };
    if (photo) updateData.completionPhoto = photo;
    await updateDoc(doc(db, 'errands', errandId), updateData);

    // Notify requester
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (errandDoc.exists()) {
      const errand = errandDoc.data() as any;
      await this.createNotification(errand.requesterId, NotificationType.JOB_SUBMITTED, "Job Submitted", `The runner has completed "${errand.title}" and is waiting for your review.`, errandId);
    }
  }

  async completeErrand(errandId: string, signature: string, rating: number): Promise<void> {
    this.checkInitialization();
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (!errandDoc.exists()) return;
    const errand = errandDoc.data() as Errand;
    
    // Calculate penalty
    let penalty = 0;
    if (errand.submittedForReviewAt) {
      const delayMs = Date.now() - errand.submittedForReviewAt;
      const delayHours = Math.floor(delayMs / (1000 * 60 * 60));
      if (delayHours > 12) {
        penalty = (delayHours - 12) * 10;
      }
    }

    await updateDoc(doc(db, 'errands', errandId), { 
      status: ErrandStatus.COMPLETED, 
      signature, 
      completedAt: Date.now(), 
      runnerRatingGiven: rating,
      approvalPenalty: penalty
    });

    if (penalty > 0) {
      await updateDoc(doc(db, 'users', errand.requesterId), { 
        walletBalance: increment(-penalty) 
      });
    }

    if (errand && errand.runnerId) {
      const acceptedPrice = errand.acceptedPrice || errand.budget;
      const netEarnings = acceptedPrice * 0.95;
      
      // Track performance (late completion)
      if (errand.deadlineTimestamp && Date.now() > errand.deadlineTimestamp) {
        await this.updateUserPerformance(errand.runnerId, 'late_completion');
      }

      await updateDoc(doc(db, 'users', errand.runnerId), { 
        balanceOnHold: increment(netEarnings), 
        ratingCount: increment(1),
        errandsCompleted: increment(1)
      });
      
      // Notify runner
      await this.createNotification(errand.runnerId, NotificationType.JOB_COMPLETED, "Payment Released", `The requester approved your work for "${errand.title}". Ksh ${netEarnings.toFixed(0)} added to balance.`, errandId);
    }
  }

  async placeBid(errandId: string, runnerId: string, runnerName: string, price: number, eta?: string): Promise<void> {
    this.checkInitialization();
    const bid: Bid = { runnerId, runnerName, price, timestamp: Date.now(), runnerRating: 5, eta };
    await updateDoc(doc(db, 'errands', errandId), { bids: arrayUnion(bid) });

    // Notify requester
    const errandDoc = await getDoc(doc(db, 'errands', errandId));
    if (errandDoc.exists()) {
      const errand = errandDoc.data() as any;
      await this.createNotification(errand.requesterId, NotificationType.NEW_BID, "New Proposal", `${runnerName} sent a proposal for "${errand.title}".`, errandId);
    }
  }

  async saveAppSettings(settings: Partial<AppSettings>): Promise<void> {
    this.checkInitialization();
    await setDoc(doc(db, 'settings', 'app'), settings, { merge: true });
  }

  async getAppStats(): Promise<any> {
    try {
      this.checkInitialization();
      const usersSnap = await getDocs(collection(db, 'users'));
      const tasksSnap = await getDocs(collection(db, 'errands'));
      const onlineSnap = await getDocs(query(collection(db, 'users'), where('isOnline', '==', true)));
      
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));
      const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Errand));

      // Avg Distance
      const tasksWithDistance = tasks.filter(t => t.distanceKm !== undefined);
      const avgDistance = tasksWithDistance.length > 0 
        ? tasksWithDistance.reduce((acc, t) => acc + (t.distanceKm || 0), 0) / tasksWithDistance.length 
        : 0;

      // Avg Completion Time (in minutes)
      const completedTasks = tasks.filter(t => t.status === ErrandStatus.COMPLETED && t.completedAt && t.createdAt);
      const avgCompletionTime = completedTasks.length > 0
        ? completedTasks.reduce((acc, t) => acc + ((t.completedAt! - t.createdAt) / (1000 * 60)), 0) / completedTasks.length
        : 0;

      // Avg Penalty
      const tasksWithPenalty = tasks.filter(t => t.approvalPenalty !== undefined);
      const avgPenalty = tasksWithPenalty.length > 0
        ? tasksWithPenalty.reduce((acc, t) => acc + (t.approvalPenalty || 0), 0) / tasksWithPenalty.length
        : 0;

      // Top Runners
      const topRunners = users
        .filter(u => u.role === UserRole.RUNNER)
        .sort((a, b) => (b.errandsCompleted || 0) - (a.errandsCompleted || 0))
        .slice(0, 5);

      // Top Requesters
      const topRequesters = users
        .filter(u => u.role === UserRole.REQUESTER)
        .map(u => ({
          ...u,
          tasksCount: tasks.filter(t => t.requesterId === u.id).length
        }))
        .sort((a, b) => b.tasksCount - a.tasksCount)
        .slice(0, 5);

      // Revenue per day (last 7 days)
      const revenuePerDay: { [key: string]: number } = {};
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      
      completedTasks.forEach(t => {
        if (t.completedAt && t.completedAt > sevenDaysAgo) {
          const date = new Date(t.completedAt).toLocaleDateString();
          const revenue = (t.acceptedPrice || t.budget) * 0.1; // Assuming 10% service fee
          revenuePerDay[date] = (revenuePerDay[date] || 0) + revenue;
        }
      });

      // Failed errands %
      const failedTasks = tasks.filter(t => t.status === ErrandStatus.CANCELLED);
      const failedErrandsPercent = tasks.length > 0 ? (failedTasks.length / tasks.length) * 100 : 0;

      return {
        totalUsers: usersSnap.size,
        totalTasks: tasksSnap.size,
        onlineUsers: onlineSnap.size,
        avgDistance,
        avgCompletionTime,
        avgPenalty,
        topRunners,
        topRequesters,
        revenuePerDay: Object.entries(revenuePerDay).map(([date, amount]) => ({ date, amount })),
        failedErrandsPercent
      };
    } catch (e) {
      console.error("Stats fetch failed:", e);
      return { totalUsers: 0, totalTasks: 0, onlineUsers: 0 };
    }
  }

  async updateUserSettings(userId: string, updates: Partial<User>): Promise<void> {
    this.checkInitialization();
    await updateDoc(doc(db, 'users', userId), updates);
  }

  async updateUserAvatar(userId: string, avatarUrl: string): Promise<void> {
    this.checkInitialization();
    await updateDoc(doc(db, 'users', userId), { avatar: avatarUrl });
  }

  async sendSupportMessage(userId: string, userName: string, text: string, isAdmin: boolean = false): Promise<void> {
    this.checkInitialization();
    const chatRef = doc(db, 'support_chats', userId);
    const chatDoc = await getDoc(chatRef);
    
    const message: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      senderId: isAdmin ? 'admin' : userId,
      senderName: isAdmin ? 'Support Admin' : userName,
      text,
      timestamp: Date.now()
    };

    if (chatDoc.exists()) {
      await updateDoc(chatRef, { 
        messages: arrayUnion(message),
        lastMessageAt: Date.now(),
        userName: chatDoc.data().userName || userName,
        unreadByAdmin: isAdmin ? false : true,
        unreadByUser: isAdmin ? true : false
      });
    } else {
      await setDoc(chatRef, {
        userId,
        userName,
        messages: [message],
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        unreadByAdmin: isAdmin ? false : true,
        unreadByUser: isAdmin ? true : false
      });
    }

    // If user is sending, notify admins
    if (!isAdmin) {
      const adminsSnap = await getDocs(query(collection(db, 'users'), where('isAdmin', '==', true)));
      for (const adminDoc of adminsSnap.docs) {
        await this.createNotification(adminDoc.id, NotificationType.NEW_MESSAGE, "New Support Request", `${userName}: ${text.substring(0, 30)}`, 'support');
      }
    } else {
      // Notify user
      await this.createNotification(userId, NotificationType.NEW_MESSAGE, "Support Response", `Admin: ${text.substring(0, 30)}`, 'support');
    }
  }

  subscribeToSupportChat(userId: string, callback: (chat: any) => void) {
    this.checkInitialization();
    return onSnapshot(doc(db, 'support_chats', userId), (snap) => {
      if (snap.exists()) {
        callback(sanitizeData(snap.data()));
      } else {
        callback(null);
      }
    });
  }

  subscribeToAllSupportChats(callback: (chats: any[]) => void) {
    this.checkInitialization();
    const q = query(collection(db, 'support_chats'), orderBy('lastMessageAt', 'desc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => sanitizeData({ id: d.id, ...d.data() })));
    });
  }

  async markSupportChatAsRead(userId: string, isAdmin: boolean): Promise<void> {
    this.checkInitialization();
    const chatRef = doc(db, 'support_chats', userId);
    if (isAdmin) {
      await updateDoc(chatRef, { unreadByAdmin: false });
    } else {
      await updateDoc(chatRef, { unreadByUser: false });
    }
  }

  subscribeToSettings(callback: (settings: AppSettings) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, 'settings', 'app'), 
      (snap) => {
        if (snap.exists()) callback(sanitizeData(snap.data() as any) as AppSettings);
      },
      (error) => console.warn("Settings subscription error:", error)
    );
  }

  subscribeToUserErrands(userId: string, role: UserRole, callback: (errands: Errand[]) => void) {
    this.checkInitialization();
    const field = role === UserRole.REQUESTER ? 'requesterId' : 'runnerId';
    const q = query(collection(db, 'errands'), where(field, '==', userId));
    
    return onSnapshot(q, 
      async (snap) => {
        const list = snap.docs.map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as Errand);
        
        if (role === UserRole.RUNNER) {
          // Also include errands where the runner has bid
          const qPending = query(collection(db, 'errands'), where('status', '==', ErrandStatus.PENDING));
          const snapPending = await getDocs(qPending);
          const pending = snapPending.docs
            .map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as Errand)
            .filter(e => e.bids?.some(b => b.runnerId === userId));
          
          const merged = [...list, ...pending];
          const unique = merged.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
          callback(unique);
        } else {
          callback(list);
        }
      },
      (error) => console.warn("User errands subscription error:", error)
    );
  }

  subscribeToAvailableErrands(callback: (errands: Errand[]) => void) {
    this.checkInitialization();
    const q = query(collection(db, 'errands'), where('status', '==', ErrandStatus.PENDING));
    return onSnapshot(q, 
      (snap) => {
        callback(snap.docs.map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as Errand));
      },
      (error) => console.warn("Available errands subscription error:", error)
    );
  }

  async fetchStaleErrands(beforeTimestamp?: number): Promise<Errand[]> {
    this.checkInitialization();
    const threshold = beforeTimestamp || (Date.now() - (24 * 60 * 60 * 1000));
    // Simplify query to avoid composite index requirement
    const q = query(
      collection(db, 'errands'), 
      where('status', '==', ErrandStatus.PENDING)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as Errand)
      .filter(e => e.createdAt <= threshold);
  }

  async submitRunnerApplication(data: Omit<RunnerApplication, 'id' | 'status' | 'createdAt'>): Promise<void> {
    this.checkInitialization();
    await addDoc(collection(db, 'runner_applications'), {
      ...data,
      status: 'pending',
      createdAt: Date.now()
    });
  }

  async fetchRunnerApplications(): Promise<RunnerApplication[]> {
    this.checkInitialization();
    const q = query(collection(db, 'runner_applications'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as RunnerApplication);
  }

  async updateRunnerApplicationStatus(applicationId: string, userId: string, status: 'approved' | 'rejected', category?: ErrandCategory): Promise<void> {
    this.checkInitialization();
    await updateDoc(doc(db, 'runner_applications', applicationId), { status });
    if (status === 'approved') {
      await updateDoc(doc(db, 'users', userId), { 
        role: UserRole.RUNNER,
        runnerCategory: category || ErrandCategory.GENERAL,
        isVerified: true
      });
    }
  }

  async fetchFeaturedServices(): Promise<FeaturedService[]> {
    this.checkInitialization();
    const q = query(collection(db, 'featured_services'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as FeaturedService);
  }

  async addFeaturedService(data: Omit<FeaturedService, 'id' | 'createdAt'>): Promise<void> {
    this.checkInitialization();
    await addDoc(collection(db, 'featured_services'), {
      ...data,
      createdAt: Date.now()
    });
  }

  async deleteFeaturedService(id: string): Promise<void> {
    this.checkInitialization();
    await deleteDoc(doc(db, 'featured_services', id));
  }

  async fetchServiceListings(): Promise<ServiceListing[]> {
    this.checkInitialization();
    const q = query(collection(db, 'service_listings'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as ServiceListing);
  }

  async addServiceListing(data: Omit<ServiceListing, 'id' | 'createdAt'>): Promise<void> {
    this.checkInitialization();
    await addDoc(collection(db, 'service_listings'), {
      ...data,
      createdAt: Date.now()
    });
  }

  async deleteServiceListing(id: string): Promise<void> {
    this.checkInitialization();
    await deleteDoc(doc(db, 'service_listings', id));
  }

  async fetchAllUsers(): Promise<User[]> {
    this.checkInitialization();
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => sanitizeData({ id: d.id, ...(d.data() as any) }) as User);
  }

  async adminUpdateUser(userId: string, updates: Partial<User>): Promise<void> {
    this.checkInitialization();
    await updateDoc(doc(db, 'users', userId), updates);
  }

  async adminDeleteUser(userId: string): Promise<void> {
    console.log(`Attempting to delete user: ${userId}`);
    this.checkInitialization();
    try {
      await deleteDoc(doc(db, 'users', userId));
      console.log(`Successfully deleted user document: ${userId}`);
    } catch (e) {
      console.error(`Failed to delete user document: ${userId}`, e);
      throw e;
    }
  }
}

export const firebaseService = new FirebaseService();