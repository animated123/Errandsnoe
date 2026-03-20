import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged, updateProfile, signInWithCustomToken,
  sendPasswordResetEmail, confirmPasswordReset, sendEmailVerification
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, 
  query, where, orderBy, onSnapshot, Timestamp, addDoc, limit, serverTimestamp,
  increment, arrayUnion, arrayRemove, getDocFromServer, initializeFirestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  Errand, ErrandStatus, ErrandCategory, User, UserRole, Coordinates, Bid, 
  AppNotification, NotificationType, AppSettings, ChatMessage, RunnerApplication, 
  FeaturedService, ServiceListing, MicroStep, ErrandProof, PriceRequest, PropertyListing 
} from '../types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with named database if provided
const dbId = firebaseConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseConfig.firestoreDatabaseId;
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, dbId);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();

export const calculateDistance = (p1: Coordinates, p2: Coordinates) => {
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
};

export const formatFirebaseError = (error: any): string => {
  if (!error) return "An unexpected error occurred.";
  
  const message = typeof error === 'string' ? error : error.message;
  
  // Handle JSON error messages from server
  if (message) {
    try {
      const parsed = JSON.parse(message);
      if (parsed.error) return parsed.error;
    } catch (e) {}
  }

  // Handle common Firebase Auth error codes
  if (error.code) {
    switch (error.code) {
      case 'auth/user-not-found': return "No account found with this email.";
      case 'auth/wrong-password': return "Incorrect password. Please try again.";
      case 'auth/email-already-in-use': return "This email is already registered.";
      case 'auth/invalid-email': return "Please enter a valid email address.";
      case 'auth/weak-password': return "Password should be at least 6 characters.";
      case 'auth/network-request-failed': return "Network error. Please check your internet connection.";
      case 'auth/too-many-requests': return "Too many attempts. Please try again later.";
      case 'auth/internal-error': return "Authentication service error. Please try again later.";
      case 'auth/operation-not-allowed': return "Email/Password sign-in is not enabled. Please contact support.";
    }
  }

  // Handle Firestore permission errors
  if (message && message.toLowerCase().includes('permission denied')) {
    return "You don't have permission to perform this action.";
  }

  return message || "An unexpected error occurred.";
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

export const normalizePhone = (phone: string) => {
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('254')) {
    normalized = normalized.substring(3);
  }
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }
  return '254' + normalized;
};

export const formatPhoneDisplay = (phone: string | undefined) => {
  if (!phone) return 'No Phone';
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('254')) {
    return `+${normalized}`;
  }
  return phone;
};

class FirebaseService {
  // Auth
  subscribeToAuth(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as User;
            callback({
              ...data,
              id: fbUser.uid,
              emailVerified: fbUser.emailVerified,
              role: data.role || UserRole.REQUESTER,
              rating: data.rating || 5,
              name: data.name || 'User'
            });
          } else {
            callback(null);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  }

  async login(emailOrPhone: string, password: string): Promise<User> {
    try {
      let email = emailOrPhone;
      if (!emailOrPhone.includes('@')) {
        const normalized = normalizePhone(emailOrPhone);
        const publicUser = await this.fetchPublicUserByPhone(normalized);
        if (publicUser && publicUser.email) {
          email = publicUser.email;
        } else {
          throw new Error("No account found with this phone number.");
        }
      }
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (!userDoc.exists()) throw new Error("User data not found");
      const data = userDoc.data() as User;
      return {
        ...data,
        id: userCredential.user.uid,
        role: data.role || UserRole.REQUESTER,
        rating: data.rating || 5,
        name: data.name || 'User'
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('permission')) {
        handleFirestoreError(error, OperationType.GET, 'users');
      }
      throw error;
    }
  }

  async signInWithToken(token: string): Promise<User> {
    try {
      const userCredential = await signInWithCustomToken(auth, token);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (!userDoc.exists()) throw new Error("User data not found");
      const data = userDoc.data() as User;
      return {
        ...data,
        id: userCredential.user.uid,
        role: data.role || UserRole.REQUESTER,
        rating: data.rating || 5,
        name: data.name || 'User'
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('permission')) {
        handleFirestoreError(error, OperationType.GET, 'users');
      }
      throw error;
    }
  }

  async register(name: string, email: string, phone: string, password: string, isAdmin: boolean = false, phoneVerified: boolean = false): Promise<User> {
    const normalized = normalizePhone(phone);
    const existingUser = await this.fetchPublicUserByPhone(normalized);
    if (existingUser) {
      throw new Error("Phone number already registered. Please login.");
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const id = userCredential.user.uid;
    const newUser: User = {
      id, email, phone: normalized, name, role: UserRole.REQUESTER, isAdmin,
      isVerified: false, phoneVerified, rating: 5, ratingCount: 0, createdAt: Date.now(),
      walletBalance: 0, balanceOnHold: 0, balanceWithdrawn: 0,
      errandsCompleted: 0, isOnline: true,
      notificationSettings: { email: true, push: true, sms: false },
      theme: 'light', favoriteRunnerIds: [], loyaltyLevel: 'Bronze' as any, loyaltyPoints: 0, hoursSaved: 0
    };
    try {
      await setDoc(doc(db, 'users', id), newUser);
      await setDoc(doc(db, 'public_users', id), { 
        email, 
        phone: normalized, 
        name, 
        role: UserRole.REQUESTER, 
        isOnline: true, 
        rating: 5,
        loyaltyLevel: 'Bronze'
      });
      await updateProfile(userCredential.user, { displayName: name });
      return newUser;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${id}`);
      throw error;
    }
  }

  async logout(): Promise<void> {
    await signOut(auth);
  }

  async sendEmailVerification(): Promise<void> {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send reset email');
    } catch (error) {
      throw error;
    }
  }

  async confirmReset(token: string, newPassword: string): Promise<void> {
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset password');
    } catch (error) {
      throw error;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    const user = auth.currentUser;
    if (!user) return null;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) return null;
      const data = userDoc.data() as User;
      return {
        ...data,
        id: user.uid,
        emailVerified: user.emailVerified,
        role: data.role || UserRole.REQUESTER,
        rating: data.rating || 5,
        name: data.name || 'User'
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      throw error;
    }
  }

  // User Settings
  async updateUserSettings(userId: string, updates: Partial<User>): Promise<void> {
    try {
      if (updates.phone) {
        const normalized = normalizePhone(updates.phone);
        const existingUser = await this.fetchUserByPhone(normalized);
        if (existingUser && existingUser.id !== userId) {
          throw new Error("Phone number already in use by another account.");
        }
        updates.phone = normalized;
      }
      await updateDoc(doc(db, 'users', userId), updates);
      
      // Also update public_users if relevant fields changed
      const publicUpdates: any = {};
      if (updates.email) publicUpdates.email = updates.email;
      if (updates.phone) publicUpdates.phone = updates.phone;
      if (updates.name) publicUpdates.name = updates.name;
      if (updates.role) publicUpdates.role = updates.role;
      if (updates.isOnline !== undefined) publicUpdates.isOnline = updates.isOnline;
      if (updates.rating !== undefined) publicUpdates.rating = updates.rating;
      if (updates.loyaltyLevel) publicUpdates.loyaltyLevel = updates.loyaltyLevel;
      
      if (Object.keys(publicUpdates).length > 0) {
        await setDoc(doc(db, 'public_users', userId), publicUpdates, { merge: true });
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('permission')) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      }
      throw error;
    }
  }

  // Errands
  async createErrand(data: any): Promise<Errand> {
    const errandRef = doc(collection(db, 'errands'));
    const serviceFee = Math.ceil((data.budget || 0) * 0.1);
    const lockedAmount = (data.budget || 0) + serviceFee;
    
    const errand: Errand = {
      ...data,
      id: errandRef.id,
      status: ErrandStatus.PENDING,
      createdAt: Date.now(),
      bids: [],
      chat: [],
      runnerId: null,
      isFundsLocked: true,
      lockedAmount,
      serviceFee,
      microSteps: [
        { label: 'Task Posted', timestamp: Date.now(), completed: true },
        { label: 'Awaiting Bids', timestamp: Date.now(), completed: false },
        { label: 'Runner Assigned', timestamp: Date.now(), completed: false },
        { label: 'In Progress', timestamp: Date.now(), completed: false },
        { label: 'Reviewing', timestamp: Date.now(), completed: false },
        { label: 'Completed', timestamp: Date.now(), completed: false }
      ]
    };
    try {
      await setDoc(errandRef, errand);
      return errand;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `errands/${errandRef.id}`);
      throw error;
    }
  }

  async fetchErrandById(id: string): Promise<Errand | null> {
    try {
      const errandDoc = await getDoc(doc(db, 'errands', id));
      return errandDoc.exists() ? errandDoc.data() as Errand : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `errands/${id}`);
      throw error;
    }
  }

  async updateErrand(id: string, updates: Partial<Errand>): Promise<void> {
    try {
      await updateDoc(doc(db, 'errands', id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `errands/${id}`);
    }
  }

  async cancelErrand(id: string): Promise<void> {
    await this.updateErrand(id, { status: ErrandStatus.CANCELLED });
  }

  // Subscriptions
  subscribeToUserErrands(userId: string, role: UserRole, callback: (errands: Errand[]) => void) {
    if (!userId) {
      console.warn("subscribeToUserErrands called with undefined userId");
      return () => {};
    }
    const field = role === UserRole.RUNNER ? 'runnerId' : 'requesterId';
    // Removed orderBy to avoid index requirement
    const q = query(collection(db, 'errands'), where(field, '==', userId));
    return onSnapshot(q, (snapshot) => {
      const errands = snapshot.docs.map(d => d.data() as Errand);
      errands.sort((a, b) => b.createdAt - a.createdAt);
      callback(errands);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'errands'));
  }

  subscribeToAvailableErrands(callback: (errands: Errand[]) => void) {
    // Removed orderBy to avoid index requirement
    const q = query(collection(db, 'errands'), where('status', '==', ErrandStatus.PENDING));
    return onSnapshot(q, (snapshot) => {
      const errands = snapshot.docs.map(d => d.data() as Errand);
      errands.sort((a, b) => b.createdAt - a.createdAt);
      callback(errands);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'errands'));
  }

  subscribeToNotifications(userId: string, callback: (notifs: AppNotification[]) => void) {
    if (!userId) {
      console.warn("subscribeToNotifications called with undefined userId");
      return () => {};
    }
    // Removed orderBy and limit to avoid index requirement
    const q = query(collection(db, 'notifications'), where('userId', '==', userId));
    return onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(d => d.data() as AppNotification);
      notifs.sort((a, b) => b.timestamp - a.timestamp);
      callback(notifs.slice(0, 20));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));
  }

  // Bids
  async placeBid(errandId: string, runnerId: string, runnerName: string, price: number, eta: string): Promise<void> {
    const bid: Bid = {
      runnerId,
      runnerName,
      price,
      timestamp: Date.now(),
      runnerRating: 5,
      eta
    };
    try {
      await updateDoc(doc(db, 'errands', errandId), {
        bids: arrayUnion(bid)
      });

      // Notify requester about new bid
      const errand = await this.fetchErrandById(errandId);
      if (errand) {
        const requester = await this.fetchUserById(errand.requesterId);
        if (requester && requester.phone) {
          const message = `Dear ${requester.name}, a new bid of Ksh ${price} has been placed on your errand "${errand.title}" by ${runnerName}. Check the app to review.`;
          await fetch('/api/notifications/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient: requester.phone, message })
          }).catch(e => console.error("SMS failed", e));
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `errands/${errandId}`);
    }
  }

  async acceptBid(errandId: string, runnerId: string, runnerName: string, price: number, eta: string = 'ASAP'): Promise<void> {
    try {
      await updateDoc(doc(db, 'errands', errandId), {
        runnerId,
        acceptedPrice: price,
        status: ErrandStatus.ACCEPTED,
        jobStartedAt: Date.now()
      });

      const errand = await this.fetchErrandById(errandId);
      if (errand) {
        // Notify runner that their bid was approved
        const runner = await this.fetchUserById(runnerId);
        if (runner && runner.phone) {
          const message = `Dear ${runner.name}, your bid for errand "${errand.title}" has been approved! You can now start the task.`;
          await fetch('/api/notifications/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient: runner.phone, message })
          }).catch(e => console.error("SMS failed", e));
        }

        // Notify requester if they didn't do it themselves (e.g. auto-accept or admin action)
        if (errand.requesterId !== auth.currentUser?.uid) {
          const requester = await this.fetchUserById(errand.requesterId);
          if (requester && requester.phone) {
            const message = `Dear ${requester.name}, your errand "${errand.title}" is now active! Runner: ${runnerName}.`;
            await fetch('/api/notifications/sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ recipient: requester.phone, message })
            }).catch(e => console.error("SMS failed", e));
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `errands/${errandId}`);
    }
  }

  // Chat
  async sendMessage(errandId: string, senderId: string, senderName: string, text: string): Promise<void> {
    const message: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      senderId,
      senderName,
      text,
      timestamp: Date.now()
    };
    try {
      await updateDoc(doc(db, 'errands', errandId), {
        chat: arrayUnion(message)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `errands/${errandId}`);
    }
  }

  // Support Chat
  subscribeToSupportChat(userId: string, callback: (chat: any) => void) {
    if (!userId) {
      console.warn("subscribeToSupportChat called with undefined userId");
      return () => {};
    }
    return onSnapshot(doc(db, 'support_chats', userId), async (snapshot) => {
      if (snapshot.exists()) {
        const chatData = snapshot.data();
        const msgsSnap = await getDocs(query(collection(db, `support_chats/${userId}/messages`), orderBy('timestamp', 'asc')));
        callback({
          ...chatData,
          messages: msgsSnap.docs.map(d => d.data() as ChatMessage)
        });
      } else {
        callback({ messages: [] });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `support_chats/${userId}`));
  }

  async fetchNotifications(userId: string): Promise<AppNotification[]> {
    if (!userId) return [];
    try {
      // Removed orderBy and limit to avoid index requirement
      const q = query(collection(db, 'notifications'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const notifs = snapshot.docs.map(d => d.data() as AppNotification);
      notifs.sort((a, b) => b.timestamp - a.timestamp);
      return notifs.slice(0, 20);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
      throw error;
    }
  }

  async markNotificationsAsRead(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
      const snapshot = await getDocs(q);
      const batch = snapshot.docs.map(d => updateDoc(d.ref, { read: true }));
      await Promise.all(batch);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  }

  async reassignErrand(errandId: string, reason: string): Promise<void> {
    await this.updateErrand(errandId, { 
      runnerId: null, 
      status: ErrandStatus.PENDING, 
      reassignmentRequested: false,
      reassignReason: reason,
      reassignedAt: Date.now()
    });
  }

  async sendSupportMessage(userId: string, senderName: string, text: string, isAdmin: boolean = false): Promise<void> {
    const message: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      senderId: isAdmin ? 'admin' : userId,
      senderName,
      text,
      timestamp: Date.now()
    };
    try {
      await addDoc(collection(db, `support_chats/${userId}/messages`), message);
      await setDoc(doc(db, 'support_chats', userId), {
        lastMessage: text,
        lastTimestamp: Date.now(),
        userId,
        userName: senderName,
        unreadByAdmin: !isAdmin,
        unreadByUser: isAdmin
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `support_chats/${userId}/messages`);
    }
  }

  // Admin & Lookups
  async fetchPublicUserByEmail(email: string): Promise<{id: string, email: string, phone: string} | null> {
    try {
      const q = query(collection(db, 'public_users'), where('email', '==', email), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() } as any;
    } catch (error) {
      console.error("Public email lookup error:", error);
      return null;
    }
  }

  async fetchPublicUserByPhone(phone: string): Promise<{id: string, email: string, phone: string} | null> {
    try {
      const q = query(collection(db, 'public_users'), where('phone', '==', phone), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() } as any;
    } catch (error) {
      console.error("Public phone lookup error:", error);
      return null;
    }
  }

  async fetchUserByPhone(phone: string): Promise<User | null> {
    try {
      const q = query(collection(db, 'users'), where('phone', '==', phone), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() } as User;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
      return null;
    }
  }

  async fetchUserById(userId: string): Promise<User | null> {
    try {
      const docSnap = await getDoc(doc(db, 'users', userId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as User;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
      return null;
    }
  }

  async fetchAllUsers(): Promise<User[]> {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() as User }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
      throw error;
    }
  }

  async adminUpdateUser(userId: string, updates: Partial<User>): Promise<void> {
    await this.updateUserSettings(userId, updates);
  }

  async adminDeleteUser(userId: string): Promise<void> {
    try {
      const response = await fetch(`/api/admin/users/${userId}/delete`, { method: 'POST' });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  }

  async adminDisableUser(userId: string, disabled: boolean): Promise<void> {
    try {
      const response = await fetch(`/api/admin/users/${userId}/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disable user');
      }
    } catch (error) {
      console.error('Disable user error:', error);
      throw error;
    }
  }

  async adminChangeUserPassword(userId: string, password: string): Promise<void> {
    try {
      const response = await fetch(`/api/admin/users/${userId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  // Settings
  subscribeToSettings(callback: (settings: AppSettings) => void) {
    return onSnapshot(doc(db, 'settings', 'app'), (snapshot) => {
      if (snapshot.exists()) callback(snapshot.data() as AppSettings);
    });
  }

  async saveAppSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      await setDoc(doc(db, 'settings', 'app'), settings, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/app');
    }
  }

  // Featured Services & Listings
  async fetchFeaturedServices(): Promise<FeaturedService[]> {
    try {
      const snapshot = await getDocs(collection(db, 'featured_services'));
      return snapshot.docs.map(d => d.data() as FeaturedService);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'featured_services');
      throw error;
    }
  }

  async fetchServiceListings(): Promise<ServiceListing[]> {
    try {
      const snapshot = await getDocs(collection(db, 'service_listings'));
      return snapshot.docs.map(d => d.data() as ServiceListing);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'service_listings');
      throw error;
    }
  }

  // Runner Applications
  async submitRunnerApplication(app: any): Promise<void> {
    try {
      await addDoc(collection(db, 'runner_applications'), { ...app, createdAt: Date.now(), status: 'pending' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'runner_applications');
    }
  }

  async fetchRunnerApplications(): Promise<RunnerApplication[]> {
    try {
      const snapshot = await getDocs(collection(db, 'runner_applications'));
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as RunnerApplication));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'runner_applications');
      throw error;
    }
  }

  // Stats
  async getAppStats(): Promise<any> {
    try {
      const users = await getDocs(collection(db, 'public_users'));
      const errands = await getDocs(collection(db, 'errands'));
      return {
        totalUsers: users.size,
        totalErrands: errands.size,
        completedErrands: errands.docs.filter(d => d.data().status === ErrandStatus.COMPLETED).length
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'stats');
      throw error;
    }
  }

  // Nearby Runners
  async getNearbyRunners(): Promise<User[]> {
    try {
      const q = query(collection(db, 'public_users'), where('role', '==', UserRole.RUNNER), where('isOnline', '==', true));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() as User }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'public_users');
      throw error;
    }
  }

  async respondToPriceRequest(errandId: string, requestId: string, status: 'approved' | 'rejected'): Promise<void> {
    const errand = await this.fetchErrandById(errandId);
    if (errand && errand.priceRequests) {
      const updatedRequests = errand.priceRequests.map(r => r.id === requestId ? { ...r, status } : r);
      await this.updateErrand(errandId, { priceRequests: updatedRequests });
    }
  }

  async addPropertyListing(errandId: string, listing: PropertyListing): Promise<void> {
    await updateDoc(doc(db, 'errands', errandId), {
      propertyListings: arrayUnion({ ...listing, id: Math.random().toString(36).substring(7), createdAt: Date.now() })
    });
  }

  async submitOverdueReason(errandId: string, reason: string): Promise<void> {
    await this.updateErrand(errandId, { overdueReason: reason, overdueReasonStatus: 'pending', overdueReasonSubmittedAt: Date.now() });
  }

  async sendPriceRequest(errandId: string, itemName: string, originalPrice: number, newPrice: number): Promise<void> {
    const request: PriceRequest = {
      id: Math.random().toString(36).substring(7),
      itemName, originalPrice, newPrice,
      status: 'pending',
      timestamp: Date.now()
    };
    await updateDoc(doc(db, 'errands', errandId), {
      priceRequests: arrayUnion(request)
    });
  }

  async addErrandProof(errandId: string, url: string, label: string): Promise<void> {
    const proof: ErrandProof = { url, label, timestamp: Date.now() };
    await updateDoc(doc(db, 'errands', errandId), {
      proofs: arrayUnion(proof)
    });
  }

  async updateErrandReceiptData(errandId: string, total: number, serviceFee: number): Promise<void> {
    await this.updateErrand(errandId, { receiptTotal: total, receiptServiceFee: serviceFee });
  }

  async updateMicroStep(errandId: string, idx: number, completed: boolean): Promise<void> {
    const errand = await this.fetchErrandById(errandId);
    if (errand && errand.microSteps) {
      const updated = [...errand.microSteps];
      updated[idx] = { ...updated[idx], completed, timestamp: Date.now() };
      await this.updateErrand(errandId, { microSteps: updated });
    }
  }

  async submitForReview(errandId: string, comments: string, photo: string): Promise<void> {
    try {
      await this.updateErrand(errandId, {
        status: ErrandStatus.VERIFYING,
        runnerComments: comments,
        completionPhoto: photo,
        submittedForReviewAt: Date.now()
      });

      // Notify requester
      const errand = await this.fetchErrandById(errandId);
      if (errand && errand.requesterId) {
        const requester = await this.fetchUserById(errand.requesterId);
        if (requester && requester.phone) {
          const message = `Dear ${requester.name}, the runner has submitted errand "${errand.title}" for your review. Please check and complete the task.`;
          await fetch('/api/notifications/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient: requester.phone, message })
          }).catch(e => console.error("SMS failed", e));
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `errands/${errandId}`);
    }
  }

  async completeErrand(errandId: string, signature: string, rating: number): Promise<void> {
    try {
      const response = await fetch('/api/errands/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errandId, signature, rating })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete errand');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `errands/${errandId}`);
    }
  }

  async toggleFavoriteRunner(userId: string, runnerId: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (user) {
      const isFav = user.favoriteRunnerIds?.includes(runnerId);
      await updateDoc(doc(db, 'users', userId), {
        favoriteRunnerIds: isFav ? arrayRemove(runnerId) : arrayUnion(runnerId)
      });
    }
  }

  async requestReassignment(errandId: string, reason: string): Promise<void> {
    await this.updateErrand(errandId, { reassignmentRequested: true, reassignReason: reason });
  }

  async approveReassignment(errandId: string): Promise<void> {
    await this.updateErrand(errandId, { 
      runnerId: null, 
      status: ErrandStatus.PENDING, 
      reassignmentRequested: false,
      reassignedAt: Date.now()
    });
  }

  async rejectReassignment(errandId: string): Promise<void> {
    await this.updateErrand(errandId, { reassignmentRequested: false });
  }

  async markSupportChatAsRead(userId: string, isAdmin: boolean): Promise<void> {
    await updateDoc(doc(db, 'support_chats', userId), {
      [isAdmin ? 'unreadByAdmin' : 'unreadByUser']: false
    });
  }

  subscribeToAllSupportChats(callback: (chats: any[]) => void) {
    const q = query(collection(db, 'support_chats'), orderBy('lastTimestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => d.data()));
    });
  }

  async updateRunnerApplicationStatus(appId: string, userId: string, status: 'approved' | 'rejected', category?: ErrandCategory): Promise<void> {
    await updateDoc(doc(db, 'runner_applications', appId), { status });
    if (status === 'approved' && category) {
      await this.adminUpdateUser(userId, { role: UserRole.RUNNER, runnerCategory: category, isVerified: true });
    }
  }

  async addFeaturedService(service: any): Promise<void> {
    await addDoc(collection(db, 'featured_services'), { ...service, createdAt: Date.now() });
  }

  async deleteFeaturedService(id: string): Promise<void> {
    await deleteDoc(doc(db, 'featured_services', id));
  }

  async addServiceListing(listing: any): Promise<void> {
    await addDoc(collection(db, 'service_listings'), { ...listing, createdAt: Date.now() });
  }

  async deleteServiceListing(id: string): Promise<void> {
    await deleteDoc(doc(db, 'service_listings', id));
  }

  async fetchStaleErrands(beforeTimestamp: number): Promise<Errand[]> {
    const q = query(collection(db, 'errands'), where('status', '==', ErrandStatus.PENDING), where('createdAt', '<', beforeTimestamp));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as Errand);
  }

  async testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. ");
      }
    }
  }
}

export const firebaseService = new FirebaseService();
firebaseService.testConnection();
