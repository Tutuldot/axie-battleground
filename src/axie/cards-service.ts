import { AxieBodyStructure, AxiePartType } from '@axieinfinity/mixer';

export interface AxieCardAbility {
  id: string;
  partName: string;
  skillName: string;
  defaultAttack: number;
  defaultDefense: number;
  defaultEnergy: number;
  expectType: string; // 'melee' | 'ranged'
  iconId: string;
  triggerColor: string;
  triggerText: string;
  description: string;
  imageUrl: string;
  partType: AxiePartType;
}

const CARDS_JSON_URL = 'https://cdn.axieinfinity.com/game/cards/card-abilities.json';
const CARD_IMAGE_BASE_URL = 'https://cdn.axieinfinity.com/game/cards/base/';

let cardsCache: Record<string, any> | null = null;

export async function loadCardAbilitiesDatabase(): Promise<Record<string, any>> {
  if (cardsCache) return cardsCache;
  try {
    let rawData: any = null;
    try {
      const localRes = await fetch('/axie-classic-cards-and-triggers.json');
      if (localRes.ok) {
        const json = await localRes.json();
        rawData = json.cards || json;
      }
    } catch {}

    if (!rawData) {
      const res = await fetch(CARDS_JSON_URL);
      if (res.ok) {
        rawData = await res.json();
      }
    }

    if (Array.isArray(rawData)) {
      cardsCache = {};
      rawData.forEach((item: any) => {
        if (item && item.id) {
          cardsCache![item.id] = item;
        }
      });
    } else if (rawData && typeof rawData === 'object') {
      cardsCache = rawData;
    } else {
      cardsCache = {};
    }

    return cardsCache || {};
  } catch (err) {
    console.warn('Failed to load card abilities database:', err);
    cardsCache = {};
    return {};
  }
}

export function getAllCardAbilitiesDatabase(): Record<string, any> {
  return cardsCache || {};
}

export function getAxieCardsFromStructure(bodyStructure: AxieBodyStructure): AxieCardAbility[] {
  if (!cardsCache || !bodyStructure || !bodyStructure.parts) return [];

  const cardPartTypes: AxiePartType[] = [
    AxiePartType.Mouth,
    AxiePartType.Horn,
    AxiePartType.Back,
    AxiePartType.Tail,
  ];

  const result: AxieCardAbility[] = [];

  cardPartTypes.forEach((partType) => {
    const partData = bodyStructure.parts[partType];
    if (partData && partData.groups && partData.groups.length > 0) {
      const primaryGroup = partData.groups[0];
      const cls = primaryGroup.class.toLowerCase();
      const valStr = String(primaryGroup.value).padStart(2, '0');
      const cardId = `${cls}-${partType.toLowerCase()}-${valStr}`;

      const cardInfo = cardsCache![cardId];
      if (cardInfo) {
        result.push({
          ...cardInfo,
          imageUrl: `${CARD_IMAGE_BASE_URL}${cardId}.png`,
          partType: partType,
        });
      }
    }
  });

  return result;
}
