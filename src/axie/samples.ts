import axiesLineupData from './axies-1-30.json';

export interface SampleAxie {
  id: string;
  name: string;
  class: string;
  genes: string;
  image?: string;
  description?: string;
  accessories?: Array<{
    key: string;
    name: string;
    placement: 'Air' | 'Cheek' | 'Ground' | 'Hip' | 'Neck';
  }>;
}

export const SAMPLE_AXIES: SampleAxie[] = axiesLineupData.map((item) => ({
  id: item.id,
  name: item.name,
  class: item.class || 'Aquatic',
  genes: item.genes,
  image: item.image,
  description: `Official Axie #${item.id} from Ronin lineup.`
}));

export const AVAILABLE_ACCESSORIES = [
  { key: "air1a", name: "Wind Feather", placement: "Air", collection: "Normal" },
  { key: "air2a", name: "Eyewyrm", placement: "Air", collection: "Nightmare" },
  { key: "cheek1a", name: "Rosy Cheeks", placement: "Cheek", collection: "Normal" },
  { key: "cheek2a", name: "Bloodmaw", placement: "Cheek", collection: "Nightmare" },
  { key: "ground1a", name: "Zen Pebble", placement: "Ground", collection: "Normal" },
  { key: "ground3a", name: "Daruma Shrine", placement: "Ground", collection: "Japanese" },
  { key: "hip1a", name: "Gilded Ring", placement: "Hip", collection: "Normal" },
  { key: "neck1a", name: "Emerald Scarf", placement: "Neck", collection: "Normal" }
];
