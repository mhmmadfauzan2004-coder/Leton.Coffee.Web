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
  whatsapp: string;
  mapsUrl: string;
  bgImage: string;
  buttonText: string;
  badge: string;
}

export interface MobileService {
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  serviceInfo: string;
  eventInfo: string;
  serviceArea: string;
  whatsapp: string;
  whatsappMessage: string;
  ctaText: string;
  bgImage: string;
  truckImage: string;
  features: string[];
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
  aboutContent: AboutContent;
  contactSettings: ContactSettings;
  updatedAt?: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
}
