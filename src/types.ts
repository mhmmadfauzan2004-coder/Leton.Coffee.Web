export interface SiteSettings {
  brandName: string;
  tagline: string;
  logoUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroBgImage: string;
  heroCtaMenuText: string;
  heroCtaOrderText: string;
  qrisImage?: string;
}

export interface BranchItem {
  id: string;
  chapterNumber: string;
  chapterName: string;
  branchName: string;
  tagline: string;
  description: string;
  address: string;
  openingHours: string;
  mapsUrl: string;
  bgImage: string;
  buttonText: string;
  badge: string;
  bgOverlay?: number; // 0 - 100% overlay opacity, default 45%
  galleryImages?: string[]; // Horizontal swipe gallery photos
  accepting_orders?: boolean;
}

export interface MobileService {
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  locations?: string[]; // e.g. ["Parkiran MPP", "Ecopark"]
  openBoothTitle?: string;
  openBoothSubtitle?: string;
  openBoothDescription?: string;
  serviceInfo?: string;
  eventInfo?: string;
  serviceArea?: string;
  ctaText?: string;
  bgImage: string;
  bgOverlay?: number; // Background overlay darkness / brightness level (0 - 100, default 45)
  openBoothBgImage?: string; // Custom background image for LETON OPEN BOOTH
  openBoothBgOverlay?: number; // Background overlay darkness / brightness level for LETON OPEN BOOTH (0 - 100, default 45)
  truckImage: string;
  features: string[];
  galleryImages?: string[]; // Horizontal swipe card photos for Leton Open Booth
  letGoGalleryImages?: string[]; // Horizontal image carousel/slider for LET'GO
  accepting_orders?: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  order: number;
}

export interface ProductSizeOption {
  name: string; // e.g. 'Regular', 'Large'
  price: number; // e.g. 0, 5000
}

export interface CustomizationOption {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  order: number;
}

export interface CustomOptionItem {
  id: string;
  name: string;
  price: number;
  isActive?: boolean;
  order?: number;
}

export interface CustomizationGroup {
  id: string;
  name: string;
  options: CustomOptionItem[];
  order?: number;
}

export interface MenuItemCustomizationSetting {
  groupId: string;
  enabled: boolean;
  selectedOptionIds?: string[];
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  price: number; // Base Price
  description: string;
  image: string;
  isAvailable: boolean;
  outletAvailability?: Record<string, boolean>;
  outletStock?: Record<string, { isAvailable: boolean; stock?: number }>;
  badge?: string;
  order: number;

  // Customization Configuration
  hasSize?: boolean;
  sizes?: ProductSizeOption[];
  hasTopping?: boolean;
  availableToppingIds?: string[];
  hasSyrup?: boolean;
  availableSyrupIds?: string[];
  use_topping_donut?: boolean;
  use_topping_maincourse?: boolean;
  customizations?: MenuItemCustomizationSetting[];
}

export interface AboutFact {
  id: string;
  label: string;
  value: string;
}

export interface BaristaItem {
  id: string;
  name: string;
  role: string;
  favoriteCoffee: string;
  description: string;
  image: string;
  instagram?: string;
  order: number;
}

export interface BaristasSectionContent {
  title: string;
  subtitle: string;
  badge: string;
  description: string;
}

export interface AboutContent {
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  secondaryDescription: string;
  mainImage: string;
  sliderImages?: string[];
  secondaryImage: string;
  facts: AboutFact[];
}

export interface ContactSettings {
  title: string;
  subtitle: string;
  whatsapp: string;
  instagramUsername: string;
  instagramUrl: string;
  googleMapsUrl: string;
  address: string;
  openingHours: string;
  email: string;
  ctaWhatsappText: string;
  ctaInstagramText: string;
  ctaMapsText: string;
  footerText: string;
}

export interface PromoBanner {
  id: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  linkUrl?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LetonData {
  siteSettings: SiteSettings;
  promoBanners?: PromoBanner[];
  branches: BranchItem[];
  mobileService: MobileService;
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  masterToppings?: CustomizationOption[];
  masterSyrups?: CustomizationOption[];
  masterSizes?: ProductSizeOption[];
  customizationGroups?: CustomizationGroup[];
  baristasContent?: BaristasSectionContent;
  baristas: BaristaItem[];
  aboutContent: AboutContent;
  contactSettings: ContactSettings;
  updatedAt?: number;
}

export type AdminRole = 'super_admin' | 'outlet_admin';

export interface AdminAccount {
  username: string;
  name: string;
  role: AdminRole;
  outletId?: string; // 'sudirman' | 'ratusima' | 'letgo-mpp'
  outletName?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  role?: AdminRole;
  outletId?: string;
  outletName?: string;
}

export interface OrderOutlet {
  id: string;
  name: string;
  shortName: string;
  address: string;
  hours: string;
  image?: string;
  badge?: string;
  whatsapp?: string;
  qrisImage?: string;
  accepting_orders?: boolean;
}

export type OrderType = 'DINE IN' | 'TAKE AWAY';
export type PaymentMethod = 'QRIS' | 'TUNAI';
export type PaymentStatus =
  | 'WAITING PAYMENT'
  | 'WAITING VERIFICATION'
  | 'WAITING_VERIFICATION'
  | 'PAY AT STORE'
  | 'PAID'
  | 'PAYMENT REJECTED'
  | 'REJECTED';
export type OrderStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export interface AddOnOption {
  id?: string;
  name: string;
  price: number;
}

export interface SelectedCustomOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number; // base menu price
  unitPrice?: number; // price with all customizations
  quantity: number;
  image?: string;
  note?: string;
  size?: AddOnOption;
  topping?: AddOnOption;
  syrup?: AddOnOption;
  customOptions?: SelectedCustomOption[];
}

export interface CustomerOrder {
  id: string;
  orderNumber: string; // e.g. "LTN-4892"
  outletId: string;
  outletName: string;
  customerName: string;
  customerPhone?: string;
  customerId?: string; // Links order to standalone customer (public.customers.id)
  userId?: string; // Links orders to auth.users.id (Admin / Outlet / Supabase Auth only)
  orderType: OrderType;
  tableNumber?: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReceiptUrl?: string;
  paymentReceiptPath?: string;
  paymentProofPath?: string;
  rejectionReason?: string;
  orderStatus: OrderStatus;
  customerNote?: string;
  pickupTime?: string; // e.g. "20:45 WIB" or "20:45"
  pickup_time?: string;
  createdAt: string; // ISO String
  updatedAt?: string;
}

export interface CustomerProfile {
  id: string;
  userId: string;
  namaLengkap: string;
  nomorHp: string;
  tanggalLahir: string;
  referralCode?: string;
  referredBy?: string | null;
  referralRewarded?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  id?: string;
  product: MenuItem;
  quantity: number;
  note?: string;
  size?: AddOnOption;
  topping?: AddOnOption;
  syrup?: AddOnOption;
  customOptions?: SelectedCustomOption[];
}

export interface MemberInactivitySettings {
  inactivityPeriodDays: number; // default 60
  gracePeriodDays: number; // default 7
  autoCleanupEnabled: boolean; // default true
  lastRunAt?: string | null;
  lastRunSummary?: MemberInactivitySummary | null;
}

export interface MemberInactivityCandidate {
  id: string;
  namaLengkap: string;
  nomorHp: string;
  createdAt: string;
  status: 'ACTIVE' | 'INACTIVE';
  inactiveAt?: string | null;
  lastValidOrderAt?: string | null;
  daysSinceLastValidOrder: number;
  daysSinceInactive?: number | null;
  validOrdersCount: number;
  totalSpent: number;
}

export interface MemberInactivitySummary {
  timestamp: string;
  totalActiveMembers: number;
  totalInactiveMembers: number;
  markedInactiveCount: number;
  deletedMembersCount: number;
  inactiveCandidatesCount: number;
  deletionCandidatesCount: number;
  details?: {
    markedInactive: Array<{ id: string; namaLengkap: string; nomorHp: string }>;
    deletedMembers: Array<{ id: string; namaLengkap: string; nomorHp: string }>;
  };
}
