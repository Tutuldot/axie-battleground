import { SAMPLE_AXIES, SampleAxie } from '../axie/samples';

export type TeamRole = 'Defense' | 'Offense' | 'Neutral';

export interface SquadMember {
  axie: SampleAxie;
  role: TeamRole;
}

export interface AxieTeam {
  id: string;
  name: string;
  isActive: boolean;
  squadMap: Map<string, TeamRole>;
}

export class TeamManager {
  private playerAxies: SampleAxie[] = [...SAMPLE_AXIES];
  private teams: AxieTeam[] = [];
  private activeTeamId: string = 'team-1';

  constructor() {
    this.initDefaultTeams();
  }

  private initDefaultTeams() {
    const team1Map = new Map<string, TeamRole>();
    const team2Map = new Map<string, TeamRole>();
    const team3Map = new Map<string, TeamRole>();

    this.playerAxies.forEach((axie, idx) => {
      // Default Team 1: Alpha Squad (5 Def, 5 Off, 5 Neu)
      if (idx < 5) team1Map.set(axie.id, 'Defense');
      else if (idx < 10) team1Map.set(axie.id, 'Offense');
      else if (idx < 15) team1Map.set(axie.id, 'Neutral');

      // Default Team 2: Defensive Fortress (7 Def, 4 Off, 4 Neu)
      if (idx < 7) team2Map.set(axie.id, 'Defense');
      else if (idx < 11) team2Map.set(axie.id, 'Offense');
      else if (idx < 15) team2Map.set(axie.id, 'Neutral');

      // Default Team 3: Rush Attack (3 Def, 8 Off, 4 Neu)
      if (idx < 3) team3Map.set(axie.id, 'Defense');
      else if (idx < 11) team3Map.set(axie.id, 'Offense');
      else if (idx < 15) team3Map.set(axie.id, 'Neutral');
    });

    this.teams = [
      { id: 'team-1', name: 'Alpha Squad #1', isActive: true, squadMap: team1Map },
      { id: 'team-2', name: 'Defensive Fortress #2', isActive: false, squadMap: team2Map },
      { id: 'team-3', name: 'Rush Attack #3', isActive: false, squadMap: team3Map },
    ];
  }

  public getPlayerAxies(): SampleAxie[] {
    return this.playerAxies;
  }

  public getTeams(): AxieTeam[] {
    return this.teams;
  }

  public getActiveTeam(): AxieTeam {
    return this.teams.find((t) => t.id === this.activeTeamId) || this.teams[0];
  }

  public setActiveTeam(teamId: string): void {
    this.activeTeamId = teamId;
    this.teams.forEach((t) => {
      t.isActive = t.id === teamId;
    });
  }

  public getAxieRole(axieId: string): TeamRole {
    const activeTeam = this.getActiveTeam();
    return activeTeam.squadMap.get(axieId) || 'Neutral';
  }

  public setAxieRole(axieId: string, role: TeamRole): void {
    const activeTeam = this.getActiveTeam();
    activeTeam.squadMap.set(axieId, role);
  }

  public saveTeam(teamId: string, name: string, squadMap: Map<string, TeamRole>): void {
    const existing = this.teams.find((t) => t.id === teamId);
    if (existing) {
      existing.name = name;
      existing.squadMap = new Map(squadMap);
    } else {
      const newTeam: AxieTeam = {
        id: teamId || `team-${Date.now()}`,
        name: name || `Custom Team #${this.teams.length + 1}`,
        isActive: false,
        squadMap: new Map(squadMap),
      };
      this.teams.push(newTeam);
    }
  }

  public createNewTeam(name: string, squadMap?: Map<string, TeamRole>): AxieTeam {
    const defaultMap = new Map<string, TeamRole>();
    if (squadMap) {
      squadMap.forEach((v, k) => defaultMap.set(k, v));
    } else {
      this.playerAxies.slice(0, 15).forEach((axie, idx) => {
        if (idx < 5) defaultMap.set(axie.id, 'Defense');
        else if (idx < 10) defaultMap.set(axie.id, 'Offense');
        else defaultMap.set(axie.id, 'Neutral');
      });
    }

    const newTeam: AxieTeam = {
      id: `team-${Date.now()}`,
      name: name || `Custom Team #${this.teams.length + 1}`,
      isActive: false,
      squadMap: defaultMap,
    };

    this.teams.push(newTeam);
    return newTeam;
  }

  public deleteTeam(teamId: string): void {
    if (this.teams.length <= 1) return;
    this.teams = this.teams.filter((t) => t.id !== teamId);
    if (this.activeTeamId === teamId) {
      this.activeTeamId = this.teams[0].id;
      this.teams[0].isActive = true;
    }
  }

  public getSquadByRole(role: TeamRole): SampleAxie[] {
    const activeTeam = this.getActiveTeam();
    return this.playerAxies.filter((axie) => activeTeam.squadMap.get(axie.id) === role);
  }

  public getSquadSummary() {
    const defense = this.getSquadByRole('Defense');
    const offense = this.getSquadByRole('Offense');
    const neutral = this.getSquadByRole('Neutral');

    return {
      defenseCount: defense.length,
      offenseCount: offense.length,
      neutralCount: neutral.length,
      totalAxies: defense.length + offense.length + neutral.length,
    };
  }
}
