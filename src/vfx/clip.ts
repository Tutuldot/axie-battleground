export type ClipEvent = {
  time: number;
  function: string;
  string?: string | null;
  float?: number | null;
};

export type VfxClip = {
  id: string;
  kind: 'skill' | 'buff';
  blend: 'additive';
  fps: number;
  frames: number;
  duration: number;
  clipDuration?: number;
  attackAnimation?: string | null;
  hitAnimation?: string | null;
  isRanged?: boolean;
  projectileTravel?: number | null;
  atlas: { file: string; cols: number; rows: number; frameW: number; frameH: number };
  crop: { x: number; y: number; w: number; h: number };
  anchor: { x: number; y: number; mapsTo: 'defender' | 'attacker' | 'target' };
  attackerInCrop: { x: number; y: number };
  captureAttacker: { x: number; y: number };
  captureDefender: { x: number; y: number };
  events: ClipEvent[];
  quality?: { reconstructionPsnrDb: number; reconstructionMse: number; clippedSamples: number };
  source: { width: number; height: number; fps: number; background: number[] };
  variantOf?: string;
};

export type CatalogItem = {
  id: string;
  kind: 'skill' | 'buff';
  frames: number;
  duration: number;
  mapsTo?: string;
  hasDefender?: boolean;
  variantOf?: string;
};

export type Catalog = {
  count: number;
  skills: number;
  buffs: number;
  items: CatalogItem[];
};

let cachedCatalog: Catalog | null = null;
const cachedClips: Map<string, VfxClip> = new Map();

export async function loadCatalog(): Promise<Catalog> {
  if (cachedCatalog) return cachedCatalog;
  const res = await fetch('/vfx/index.json');
  if (!res.ok) throw new Error('Failed to load VFX catalog');
  cachedCatalog = (await res.json()) as Catalog;
  return cachedCatalog;
}

export async function loadClip(id: string): Promise<VfxClip> {
  if (cachedClips.has(id)) return cachedClips.get(id)!;
  const res = await fetch(`/vfx/${encodeURIComponent(id)}/clip.json`);
  if (!res.ok) throw new Error(`Failed to load clip ${id}`);
  const clip = (await res.json()) as VfxClip;
  cachedClips.set(id, clip);
  return clip;
}

export function atlasUrl(clip: VfxClip): string {
  return `/vfx/${encodeURIComponent(clip.id)}/${clip.atlas.file}`;
}

export function frameAt(clip: VfxClip, time: number): number {
  return Math.min(clip.frames - 1, Math.max(0, Math.floor(time * clip.fps)));
}
