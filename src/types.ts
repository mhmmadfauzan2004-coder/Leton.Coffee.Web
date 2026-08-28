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
}

export interface MenuCategory {
  id: string;
  name: string;
  order: number;
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  description: string;
  image: string;
  isAvailable: boolean;
  badge?: string;
  order: number;
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

export interface LetonData {
  siteSettings: SiteSettings;
  branches: BranchItem[];
  mobileService: MobileService;
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  baristasContent?: BaristasSectionContent;
  baristas: BaristaItem[];
  aboutContent: AboutContent;
  contactSettings: ContactSettings;
  updatedAt?: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
}
