export enum UserRole {
  REQUESTER = 'requester',
  RUNNER = 'runner',
  ADMIN = 'admin'
}

export enum ErrandStatus {
  PENDING = 'pending',
  BIDDING = 'bidding',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  ACCEPTED = 'accepted',
  VERIFYING = 'verifying',
  REVIEW = 'review',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

export enum ErrandCategory {
  GENERAL = 'General',
  MAMA_FUA = 'Mama Fua (Laundry)',
  MARKET_SHOPPING = 'Market Shopping',
  HOUSE_HUNTING = 'House Hunting',
  PACKAGE_DELIVERY = 'Package Delivery',
  TOWN_SERVICE = 'Town Service',
  GIKOMBA_STRAWS = 'Gikomba Straws',
  SHOPPING = 'Shopping'
}

export enum LoyaltyLevel {
  BRONZE = 'Bronze',
  SILVER = 'Silver',
  GOLD = 'Gold',
  PLATINUM = 'Platinum'
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isAdmin?: boolean;
  isSuspended?: boolean;
  suspensionReason?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  theme?: 'light' | 'dark';
  lastKnownLocation?: Coordinates;
  loyaltyPoints?: number;
  hoursSaved?: number;
  loyaltyLevel?: LoyaltyLevel;
  profilePhoto?: string;
  avatar?: string;
  biography?: string;
  balanceOnHold?: number;
  walletBalance?: number;
  cancellationRate?: number;
  lateCompletionRate?: number;
  rejectionRate?: number;
  suspensionExpiresAt?: any;
  isOnline?: boolean;
  isVerified?: boolean;
  verificationCode?: string;
  verificationCodeExpiresAt?: any;
  resetCode?: string;
  resetCodeExpiresAt?: any;
  disabled?: boolean;
  notificationSettings?: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  createdAt?: any;
  rating?: number;
  totalTasks?: number;
}

export interface Errand {
  id: string;
  title: string;
  description: string;
  category: ErrandCategory;
  status: ErrandStatus;
  budget: number;
  requesterId: string;
  requesterName: string;
  runnerId?: string;
  runnerName?: string;
  pickupLocation: string;
  pickupCoordinates: Coordinates;
  dropoffLocation?: string;
  dropoffCoordinates?: Coordinates;
  deadline?: string;
  createdAt: any;
  updatedAt: any;
  bids?: Bid[];
  isInHouse?: boolean;
  laundryBaskets?: number;
  pricePerBasket?: number;
  houseType?: string;
  moveInDate?: string;
  additionalRequirements?: string;
  urgency?: 'normal' | 'high' | 'urgent';
  packageDescription?: string;
  packageCost?: number;
  shoppingList?: string;
  marketSection?: string;
  maxShoppingBudget?: number;
  calculatedPrice?: number;
  voiceNoteUrl?: string;
  checklist?: string[];
  reviewPhoto?: string;
  reviewComments?: string;
  propertyListings?: PropertyListing[];
  priceRequests?: PriceRequest[];
  acceptedPrice?: number;
}

export interface Bid {
  id: string;
  runnerId: string;
  runnerName: string;
  amount: number;
  message: string;
  createdAt: any;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'message' | 'bid' | 'assignment' | 'completion' | 'payment';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: any;
  errandId?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: any;
  timestamp?: any;
}

export interface AppSettings {
  primaryColor: string;
  logoUrl?: string;
  iconUrl?: string;
  platformFee?: number;
  minErrandPrice?: number;
  maintenanceMode?: boolean;
  appName?: string;
}

export interface LocationSuggestion {
  name: string;
  coords: Coordinates;
}

export interface RunnerApplication {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  idPhoto?: string;
  selfiePhoto?: string;
  fullName?: string;
  phone?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  selfieUrl?: string;
  nationalId?: string;
  categoryApplied?: string;
  createdAt: any;
}

export interface FeaturedService {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  explanation?: string;
  paymentGuide?: string;
  category?: string;
}

export interface ServiceListing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
}

export interface PriceRequest {
  id: string;
  userId: string;
  itemDescription: string;
  itemName?: string;
  originalPrice?: number;
  newPrice?: number;
  status: 'pending' | 'answered';
  answer?: string;
  createdAt: any;
}

export interface PropertyListing {
  id: string;
  title: string;
  price: number;
  location: string;
  type: string;
  imageUrl: string;
  agentRating?: number;
  amenities?: string[];
  description?: string;
}
