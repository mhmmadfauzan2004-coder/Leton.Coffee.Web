import { OrderOutlet } from '../types';
import { initialLetonData } from './initialData';

const chapter5 = initialLetonData.branches.find((b) => b.id === 'chapter-5') || initialLetonData.branches[0];
const chapter6 = initialLetonData.branches.find((b) => b.id === 'chapter-6') || initialLetonData.branches[1];

export const DEFAULT_OUTLETS: OrderOutlet[] = [
  {
    id: 'sudirman',
    name: 'Leton Coffee — Jalan Jendral Sudirman',
    shortName: 'Leton Sudirman',
    address: 'Jl. Jend. Sudirman No. 88, Dumai Kota, Riau',
    hours: '08:00 – 23:00 WIB',
    image: chapter5?.bgImage || '',
    badge: 'CHAPTER 5 • URBAN HUB',
    whatsapp: '6281234567890',
  },
  {
    id: 'ratusima',
    name: 'Leton Coffee — Ratusima / Kelakap 7',
    shortName: 'Leton Ratu Sima',
    address: 'Jl. Ratu Sima / Kelakap 7, Dumai Barat, Riau',
    hours: '09:00 – 23:30 WIB',
    image: chapter6?.bgImage || '',
    badge: 'CHAPTER 6 • OPEN AIR SPOT',
    whatsapp: '6281234567890',
  },
  {
    id: 'letgo-mpp',
    name: 'LetGo — depan MPP',
    shortName: 'LetGo MPP',
    address: 'Area Parkir Depan Mall Pelayanan Publik (MPP), Dumai',
    hours: '16:00 – 22:30 WIB',
    image: initialLetonData.mobileService?.bgImage || '',
    badge: 'MOBILE COFFEE BOOTH',
    whatsapp: '6281234567890',
  },
];
