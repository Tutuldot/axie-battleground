import { SAMPLE_AXIES, SampleAxie } from '../axie/samples';

export type TeamRole = 'Defense' | 'Offense' | 'Neutral';

export interface SquadMember {
  axie: SampleAxie;
  role: TeamRole;
}

export class TeamManager {
  private playerAxies: SampleAxie[] = [...SAMPLE_AXIES];
  private squadMap: Map<string, TeamRole> = new Map();

  constructor() {
    this.initDefaultSquad();
  }

  private initDefaultSquad() {
    // Assign default roles for 15 Axies:
    // First 5 -> Defense (Green)
    // Next 5 -> Offense (Red)
    // Next 5 -> Neutral (Blue)
    this.playerAxies.forEach((axie, idx) => {
      if (idx < 5) {
        this.squadMap.set(axie.id, 'Defense');
      } else if (idx < 10) {
        this.squadMap.set(axie.id, 'Offense');
      } else {
        this.squadMap.set(axie.id, 'Neutral');
      }
    });
  }

  public getPlayerAxies(): SampleAxie[] {
    return this.playerAxies;
  }

  public getAxieRole(axieId: string): TeamRole {
    return this.squadMap.get(axieId) || 'Neutral';
  }

  public setAxieRole(axieId: string, role: TeamRole): void {
    this.squadMap.set(axieId, role);
  }

  public getSquadByRole(role: TeamRole): SampleAxie[] {
    return this.playerAxies.filter((axie) => this.squadMap.get(axie.id) === role);
  }

  public getSquadSummary() {
    const defense = this.getSquadByRole('Defense');
    const offense = this.getSquadByRole('Offense');
    const neutral = this.getSquadByRole('Neutral');

    return {
      defenseCount: defense.length,
      offenseCount: offense.length,
      neutralCount: neutral.length,
      totalAxies: this.playerAxies.length,
    };
  }

  public addCustomAxie(axie: SampleAxie): void {
    this.playerAxies.unshift(axie);
    this.squadMap.set(axie.id, 'Neutral');
  }
}
