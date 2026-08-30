import { getAxieBodyStructure512, CharacterClass, AxieBodyStructure } from '@axieinfinity/mixer';

export interface AxieClassicStats {
  hp: number;
  speed: number;
  skill: number;
  morale: number;
  total: number;
}

const BASE_CLASS_STATS: Record<string, AxieClassicStats> = {
  Aquatic: { hp: 39, speed: 39, skill: 35, morale: 27, total: 140 },
  Beast:   { hp: 31, speed: 31, skill: 35, morale: 43, total: 140 },
  Plant:   { hp: 43, speed: 31, skill: 31, morale: 35, total: 140 },
  Bird:    { hp: 27, speed: 43, skill: 35, morale: 35, total: 140 },
  Reptile: { hp: 39, speed: 35, skill: 31, morale: 35, total: 140 },
  Bug:     { hp: 35, speed: 31, skill: 35, morale: 39, total: 140 },
  Mech:    { hp: 31, speed: 39, skill: 43, morale: 27, total: 140 },
  Dawn:    { hp: 35, speed: 35, skill: 39, morale: 31, total: 140 },
  Dusk:    { hp: 43, speed: 39, skill: 27, morale: 31, total: 140 }
};

const PART_STAT_MODIFIERS: Record<string, Partial<AxieClassicStats>> = {
  Aquatic: { speed: 4, hp: 1 },
  Beast:   { morale: 3, speed: 1 },
  Plant:   { hp: 3, morale: 1 },
  Bird:    { speed: 3, morale: 1 },
  Reptile: { hp: 3, speed: 1 },
  Bug:     { morale: 3, hp: 1 },
  Mech:    { speed: 3, morale: 1 },
  Dawn:    { speed: 3, hp: 1 },
  Dusk:    { hp: 3, speed: 1 }
};

export function calculateAxieClassicStats(genesHex: string): AxieClassicStats {
  try {
    const cleanHex = genesHex.trim().startsWith('0x') ? genesHex.trim() : `0x${genesHex.trim()}`;
    const body: AxieBodyStructure = getAxieBodyStructure512(cleanHex);
    const axieClass = body.class || CharacterClass.Aquatic;

    const base = BASE_CLASS_STATS[axieClass] || BASE_CLASS_STATS.Aquatic;
    const stats: AxieClassicStats = { ...base };

    if (body.parts) {
      Object.values(body.parts).forEach((part) => {
        if (part && part.groups && part.groups.length > 0) {
          const partClass = part.groups[0].class;
          const mod = PART_STAT_MODIFIERS[partClass] || { hp: 1, speed: 1 };
          if (mod.hp) stats.hp += mod.hp;
          if (mod.speed) stats.speed += mod.speed;
          if (mod.skill) stats.skill += mod.skill;
          if (mod.morale) stats.morale += mod.morale;
        }
      });
    }

    stats.total = stats.hp + stats.speed + stats.skill + stats.morale;
    return stats;
  } catch (err) {
    console.warn('Failed to calculate stats from genes:', err);
    return { hp: 45, speed: 45, skill: 35, morale: 35, total: 160 };
  }
}
