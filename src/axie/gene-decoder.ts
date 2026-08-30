import { getAxieBodyStructure512, CharacterClass, AxiePartType, AxieBodyStructure } from '@axieinfinity/mixer';

export interface DecodedGeneInfo {
  class: string;
  bodySkin: number;
  parts: Array<{
    type: string;
    stage: number;
    stageCap: number;
    skin: number;
    class: string;
  }>;
  primaryColors: number[];
  secondaryColors: number[];
  isValid: boolean;
  error?: string;
}

export function decodeAxieGenes(geneHex: string): DecodedGeneInfo {
  try {
    if (!geneHex || typeof geneHex !== 'string') {
      throw new Error('Invalid gene string');
    }

    const cleanHex = geneHex.trim().startsWith('0x') ? geneHex.trim() : `0x${geneHex.trim()}`;
    const bodyStructure: AxieBodyStructure = getAxieBodyStructure512(cleanHex);

    const partsList: DecodedGeneInfo['parts'] = [];

    const partKeys: AxiePartType[] = [
      AxiePartType.Eyes,
      AxiePartType.Mouth,
      AxiePartType.Ears,
      AxiePartType.Horn,
      AxiePartType.Back,
      AxiePartType.Tail
    ];

    partKeys.forEach((partType) => {
      const partData = bodyStructure.parts[partType];
      if (partData) {
        const primaryGroup = partData.groups && partData.groups[0];
        partsList.push({
          type: partType,
          stage: partData.stage ?? 0,
          stageCap: partData.stageCap ?? 0,
          skin: partData.skin ?? 0,
          class: primaryGroup ? primaryGroup.class : CharacterClass.Any
        });
      }
    });

    return {
      class: bodyStructure.class || 'Aquatic',
      bodySkin: bodyStructure.bodySkin ?? 0,
      parts: partsList,
      primaryColors: bodyStructure.primaryColors || [0],
      secondaryColors: bodyStructure.secondaryColors || [0],
      isValid: true
    };
  } catch (err: any) {
    return {
      class: 'Unknown',
      bodySkin: 0,
      parts: [],
      primaryColors: [],
      secondaryColors: [],
      isValid: false,
      error: err?.message || 'Failed to decode gene string'
    };
  }
}
