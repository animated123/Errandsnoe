export enum UserRole {
  REQUESTER = 'requester',
  RUNNER = 'runner',
  ADMIN = 'admin',
  TESTER = 'tester'
}

export enum ErrandStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  VERIFYING = 'verifying', // Runner has submitted for review
  COMPLETED = 'completed', // Requester has signed off
  CANCELLED = 'cancelled'
}

export enum ErrandCategory {
  GENERAL = 'General',
  HOUSE_HUNTING = 'House Hunting',
  MAMA_FUA = 'Mama Fua',
  SHOPPING = 'Shopping',
  GIKOMBA_STRAWS = 'Gikomba straws',
  TOWN_SERVICE = 'Town Service',
  PACKAGE_DELIVERY = 'Package Delivery'
}

export enum NotificationType {
  NEW_BID = 'new_bid',
  BID_ACCEPTED = 'bid_accepted',
  JOB_SUBMITTED = 'job_submitted',
  JOB_COMPLETED = 'job_completed',
  NEW_MESSAGE = 'new_message',
  NEW_ERRAND = 'new_errand',
  PRICE_REQUEST = 'price_request'
}

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  errandId: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationSuggestion {
  name: string;
  coords: Coordinates;
  area?: string;
  description?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface Bid {
  runnerId: string;
  runnerName: string;
  price: number;
  timestamp: number;
  runnerRating: number;
  eta?: string;
}

export interface MicroStep {
  label: string;
  timestamp: number;
  completed: boolean;
}

export interface ErrandProof {
  url: string;
  label: string;
  timestamp: number;
}

export interface PriceRequest {
  id: string;
  itemName: string;
  originalPrice: number;
  newPrice: number;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

export interface PropertyListing {
  id: string;
  title: string;
  price: number;
  location: string;
  imageUrl: string;
  amenities: {
    water: boolean;
    wifi: boolean;
    security: boolean;
    parking: boolean;
  };
  agentRating: number; // 1-5
  description: string;
  timestamp: number;
}

export interface Errand {
  id: string;
  category: ErrandCategory;
  title: string;
  description: string;
  budget: number;
  acceptedPrice?: number;
  deadline: string;
  requesterId: string;
  requesterName: string;
  runnerId: string | null;
  status: ErrandStatus;
  createdAt: number;
  pickupLocation: string;
  pickupCoordinates: Coordinates;
  dropoffLocation: string;
  dropoffCoordinates: Coordinates;
  bids: Bid[];
  chat: ChatMessage[];
  distanceKm?: number;
  routePolyline?: string;
  requesterRating: number;
  calculatedPrice?: number;
  imageUrls?: string[];
  
  // Mama Fua specific
  laundryBaskets?: number;
  laundryInHouseLocation?: string;
  preferredDate?: string;
  isInHouse?: boolean;
  
  // House Hunting specific
  minBudget?: number;
  maxBudget?: number;
  houseType?: string;
  moveInDate?: string;
  additionalRequirements?: string;
  
  // Verification
  runnerComments?: string;
  completionPhoto?: string;
  signature?: string;
  completedAt?: number;
  submittedForReviewAt?: number;
  approvalPenalty?: number;
  
  // Reassignment
  reassignmentRequested?: boolean;
  reassignReason?: string;
  
  // Overdue handling
  deadlineTimestamp?: number;
  overdueReason?: string;
  overdueReasonSubmittedAt?: number;
  overdueReasonStatus?: 'pending' | 'approved' | 'rejected';
  overdueReasonAutoApproved?: boolean;
  
  // Voice Notes & Checklists
  voiceNoteUrl?: string;
  checklist?: { item: string, checked: boolean }[];

  // Trust & Transparency
  microSteps?: MicroStep[];
  runnerProfileSnapshot?: {
    rating: number;
    errandsCompleted: number;
    isVerified: boolean;
    avatar?: string;
  };
  proofs?: ErrandProof[];
  preferredRunnerId?: string;
  receiptTotal?: number;
  serviceFee?: number;
  isFundsLocked?: boolean;
  lockedAmount?: number;
  jobStartedAt?: number;
  reassignedAt?: number;
  runnerRatingGiven?: number;
  receiptServiceFee?: number;
  
  // Financial
  maxShoppingBudget?: number;
  actualShoppingTotal?: number;
  priceRequests?: PriceRequest[];
  
  // House Hunting
  propertyListings?: PropertyListing[];

  // Town Service specific
  urgency?: 'normal' | 'urgent' | 'immediate';
  
  // Package Delivery specific
  packageDescription?: string;
  packageCost?: number;

  // Shopping specific
  shoppingList?: string;
  
  // Gikomba Straws specific
  marketSection?: string;
}

export enum LoyaltyLevel {
  BRONZE = 'Bronze',
  SILVER = 'Silver',
  GOLD = 'Gold',
  PLATINUM = 'Platinum'
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  runnerCategory?: ErrandCategory;
  isAdmin?: boolean;
  isVerified: boolean;
  rating: number;
  ratingCount: number;
  createdAt: number;
  avatar?: string;
  biography?: string;
  isOnline?: boolean;
  lastKnownLocation?: Coordinates;
  balanceOnHold?: number;
  balanceWithdrawn?: number;
  walletBalance?: number;
  errandsCompleted?: number;
  notificationSettings?: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  theme?: 'light' | 'dark';
  favoriteRunnerIds?: string[];
  loyaltyLevel?: LoyaltyLevel;
  loyaltyPoints?: number;
  hoursSaved?: number;

  // Performance Tracking
  totalErrandsRequested?: number;
  totalErrandsAccepted?: number;
  cancellationsCount?: number;
  lateCompletionsCount?: number;
  rejectionsCount?: number;
  
  cancellationRate?: number; // 0-100
  lateCompletionRate?: number; // 0-100
  rejectionRate?: number; // 0-100

  // Suspension
  isSuspended?: boolean;
  suspensionReason?: string;
  suspensionExpiresAt?: number;
}

export interface AppSettings {
  primaryColor: string;
  logoUrl?: string;
  iconUrl?: string;
}

export interface RunnerApplication {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  nationalId: string;
  idFrontUrl: string;
  idBackUrl: string;
  categoryApplied: ErrandCategory;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface FeaturedService {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  category: ErrandCategory;
  explanation?: string;
  paymentGuide?: string;
  createdAt: number;
}

export interface ServiceListing {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  category: ErrandCategory;
  scope?: string;
  explanation?: string;
  paymentGuide?: string;
  createdAt: number;
}
