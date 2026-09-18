import { LetonData } from '../types';
import rawLetonContent from '../../data/leton_content.json';

// Authentic baseline source of truth loaded directly from leton_content.json
export const initialLetonData: LetonData = rawLetonContent as unknown as LetonData;
