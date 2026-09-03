import './index.css';
import { AxieMixerEngine, AccessoryItem } from './axie/axie-mixer-engine';
import { SAMPLE_AXIES, SampleAxie, AVAILABLE_ACCESSORIES } from './axie/samples';
import { decodeAxieGenes } from './axie/gene-decoder';
import {
  loadCardAbilitiesDatabase,
  getAxieCardsFromStructure,
  getAllCardAbilitiesDatabase,
  AxieCardAbility,
} from './axie/cards-service';
import { calculateAxieClassicStats } from './axie/stats-calculator';
import { TeamManager, TeamRole, AxieTeam } from './game/team-manager';
import { getAxieBodyStructure512 } from '@axieinfinity/mixer';
import { audioManager, MusicTrack } from './audio/audio-manager';
import { loadCatalog, loadClip, CatalogItem, VfxClip } from './vfx/clip';
import {
  AdditiveAtlas,
  playOnCanvas,
  loadSkillVfxDatabase,
  getVfxForAbility,
  PlayHandle,
} from './vfx/vfx-player';

export interface TacticalAxieUnit {
  id: string;
  name: string;
  class: string;
  team: 'red' | 'blue';
  initialRow: number;
  initialCol: number;
  row: number;
  col: number;
  hpStat: number;
  speed: number;
  morale: number;
  maxHp: number;
  currentHp: number;
  currentShield: number;
  genes: string;
  cards: AxieCardAbility[];
  cardIndex: number;
  lockedTargetId: string | null;
  isActing: boolean;
  nextActionTime: number;
  spineEngine?: AxieMixerEngine;
  domElement?: HTMLElement;
  isDefeated: boolean;
}

class AxieBattleGroundApp {
  private teamManager: TeamManager = new TeamManager();
  private inspectorEngine?: AxieMixerEngine;
  private studioEngine?: AxieMixerEngine;
  private portraitEngine?: AxieMixerEngine;
  private portraitCache: Map<string, string> = new Map();
  private currentInspectedAxie?: SampleAxie;
  private currentSampleIndex: number = 0;
  private equippedAccessoriesMap: Map<string, AccessoryItem> = new Map();
  private currentAxieCards: AxieCardAbility[] = [];
  private jsonTabMode: 'selected' | 'all' = 'selected';
  private tempSquadMap: Map<string, TeamRole> = new Map();
  private editingTeamId: string = 'team-1';

  // Origins Battle VFX & Audio State
  private studioVfxCanvas?: HTMLCanvasElement;
  private studioVfxCtx?: CanvasRenderingContext2D;
  private arenaVfxCanvas?: HTMLCanvasElement;
  private arenaVfxCtx?: CanvasRenderingContext2D;
  private activeStudioVfxHandle: PlayHandle | null = null;
  private vfxCatalog: { skills: CatalogItem[]; buffs: CatalogItem[] } = { skills: [], buffs: [] };
  private vfxLabMode: 'skill' | 'buff' = 'skill';

  // Dedicated Edit Team Page State (NO LIGHTBOX)
  private editMobileActiveTab: 'squad' | 'inventory' = 'squad';
  private editMobileRoleFilter: string = 'all';
  private editInvCurrentPage: number = 1;
  private editInvPageSize: number = 8;
  private editInvClassFilter: string = 'all';

  // Friends & Combat Hub State
  private friendsFilter: string = 'all';
  private friendsList = [
    { id: 'f1', name: 'Jihoz_Axie', status: 'Online', rank: 'Challenger (2,450 MMR)', trophies: '🏆 2,450', winRate: '68%', wins: 520, favoriteAxie: 'SMG Token' },
    { id: 'f2', name: 'Axie_Master_99', status: 'In Battle', rank: 'Grandmaster II (2,100 MMR)', trophies: '🏆 2,100', winRate: '64%', wins: 410, favoriteAxie: 'Tetrad' },
    { id: 'f3', name: 'Ronin_Knight', status: 'Online', rank: 'Master I (1,920 MMR)', trophies: '🏆 1,920', winRate: '59%', wins: 345, favoriteAxie: 'BitQueen' },
    { id: 'f4', name: 'Lunacia_Explorer', status: 'Offline', rank: 'Diamond II (1,650 MMR)', trophies: '🏆 1,650', winRate: '52%', wins: 215, favoriteAxie: 'Peaceful' },
  ];
  private battleLogsList = [
    { mode: 'Ranked Arena', opponent: 'Jihoz_Axie', result: 'VICTORY (+32 MMR)', time: '10 mins ago', isWin: true },
    { mode: 'Ranked Arena', opponent: 'Ronin_Knight', result: 'VICTORY (+28 MMR)', time: '42 mins ago', isWin: true },
    { mode: 'Casual Practice', opponent: 'AI Commander', result: 'VICTORY', time: '2 hours ago', isWin: true },
    { mode: 'Ranked Arena', opponent: 'Axie_Master_99', result: 'DEFEAT (-18 MMR)', time: '5 hours ago', isWin: false },
    { mode: 'World Boss Raid', opponent: 'Chimera Behemoth', result: 'DEALT 45,000 DMG', time: '1 day ago', isWin: true },
  ];

  constructor() {
    this.init();
  }

  private async init() {
    // Pre-load card database & Origins skill VFX database
    await Promise.all([
      loadCardAbilitiesDatabase(),
      loadSkillVfxDatabase(),
    ]);

    this.setupAudioControllers();
    this.setupNavigation();
    this.setupEditTeamPage();
    this.setupTrainingGround();
    this.setupBattleHub();
    this.setupFriendsTab();
    this.setupSettingsTab();
    this.renderSamplesList();
    this.renderAccessoriesList();
    this.renderAxiesDirectory();
    this.renderTeamBuilder();
    this.renderBattleHub();
    this.renderFriendsList();
    this.renderBattleLogs();

    // Preload portraits in the background so they are instantly ready for modal and squad cards
    this.preloadAllAxiePortraits();
  }

  private async preloadAllAxiePortraits() {
    const axies = this.teamManager.getPlayerAxies();
    for (const axie of axies) {
      if (!this.portraitCache.has(axie.id)) {
        await this.getOrCreateAxiePortrait(axie);
      }
    }
  }

  private showPageView(viewId: 'landing' | 'dashboard' | 'studio' | 'edit-team' | 'training-ground') {
    const pageLanding = document.getElementById('page-landing');
    const pageDashboard = document.getElementById('page-dashboard');
    const pageStudio = document.getElementById('page-mixer-studio');
    const pageEditTeam = document.getElementById('page-edit-team');
    const pageTrainingGround = document.getElementById('page-training-ground');

    if (pageLanding) pageLanding.style.display = viewId === 'landing' ? 'flex' : 'none';
    if (pageDashboard) pageDashboard.style.display = viewId === 'dashboard' ? 'flex' : 'none';
    if (pageStudio) pageStudio.style.display = viewId === 'studio' ? 'flex' : 'none';
    if (pageEditTeam) pageEditTeam.style.display = viewId === 'edit-team' ? 'flex' : 'none';
    if (pageTrainingGround) pageTrainingGround.style.display = viewId === 'training-ground' ? 'flex' : 'none';

    // BGM Context Transition
    if (viewId === 'training-ground') {
      audioManager.playBgm(this.isTacticalBattleRunning ? 'pve_1' : 'pvp');
      setTimeout(() => this.resizeArenaVfxCanvas(), 100);
    } else if (viewId === 'dashboard' || viewId === 'studio' || viewId === 'edit-team') {
      audioManager.playBgm('home');
    }
  }

  private setupNavigation() {
    // Landing Screen -> Start Game
    const btnStartGame = document.getElementById('btn-start-game');
    btnStartGame?.addEventListener('click', () => {
      audioManager.playUiClick();
      audioManager.playBgm('home');
      this.showPageView('dashboard');
    });

    // Landing Screen -> Mixer Studio
    const btnLandingMixer = document.getElementById('btn-landing-mixer');
    btnLandingMixer?.addEventListener('click', async () => {
      audioManager.playUiClick();
      audioManager.playBgm('home');
      this.showPageView('studio');
      await this.initStudioMode();
    });

    // Dashboard Header -> Mixer Studio
    const btnOpenMixerStudio = document.getElementById('btn-open-mixer-studio');
    btnOpenMixerStudio?.addEventListener('click', async () => {
      audioManager.playUiClick();
      this.showPageView('studio');
      await this.initStudioMode();
    });

    // Studio Header -> Back to Game
    const btnBackToGame = document.getElementById('btn-back-to-game');
    btnBackToGame?.addEventListener('click', () => {
      audioManager.playUiClick();
      this.showPageView('dashboard');
    });

    // Top Navigation Tabs
    const navButtons = [
      { id: 'tab-btn-axies', contentId: 'tab-content-axies' },
      { id: 'tab-btn-team', contentId: 'tab-content-team' },
      { id: 'tab-btn-battle', contentId: 'tab-content-battle' },
      { id: 'tab-btn-friends', contentId: 'tab-content-friends' },
      { id: 'tab-btn-settings', contentId: 'tab-content-settings' },
    ];

    navButtons.forEach(({ id, contentId }) => {
      const btn = document.getElementById(id);
      btn?.addEventListener('click', () => {
        document.querySelectorAll('.dash-tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
        const targetPane = document.getElementById(contentId);
        if (targetPane) targetPane.classList.add('active');

        if (contentId === 'tab-content-team') {
          this.renderTeamBuilder();
        } else if (contentId === 'tab-content-battle') {
          this.renderBattleHub();
        } else if (contentId === 'tab-content-friends') {
          this.renderFriendsList();
        }
      });
    });

    // LIGHTBOX INSPECTOR X CLOSE BUTTON
    const btnCloseInspector = document.getElementById('btn-close-inspector');
    const inspectorModal = document.getElementById('axie-inspector-modal');

    if (btnCloseInspector && inspectorModal) {
      btnCloseInspector.onclick = (e) => {
        e.stopPropagation();
        inspectorModal.style.display = 'none';
      };

      inspectorModal.onclick = (e) => {
        if (e.target === inspectorModal) {
          inspectorModal.style.display = 'none';
        }
      };
    }

    // Escape Key Listener to close all modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (inspectorModal) inspectorModal.style.display = 'none';
        const cardModal = document.getElementById('card-modal');
        if (cardModal) cardModal.style.display = 'none';
        const jsonModal = document.getElementById('json-modal');
        if (jsonModal) jsonModal.style.display = 'none';
        const battleLogsModal = document.getElementById('battle-logs-modal');
        if (battleLogsModal) battleLogsModal.style.display = 'none';
      }
    });

    this.setupStudioEventListeners();
  }

  /* ==========================================================================
     PAGE 4: DEDICATED FULL-SCREEN TEAM BUILDER & SQUAD EDITOR (NOT A LIGHTBOX)
     ========================================================================== */
  private setupEditTeamPage() {
    const btnBack = document.getElementById('btn-back-from-edit-team');
    const btnSave = document.getElementById('btn-save-edit-page');
    const btnCreateTeam = document.getElementById('btn-create-team');

    btnCreateTeam?.addEventListener('click', () => {
      const newTeam = this.teamManager.createNewTeam(`Custom Squad #${this.teamManager.getTeams().length + 1}`);
      this.openEditTeamPage(newTeam);
    });

    btnBack?.addEventListener('click', () => {
      this.showPageView('dashboard');
      this.renderTeamBuilder();
    });

    btnSave?.addEventListener('click', () => {
      const inputTeamName = document.getElementById('edit-page-team-name') as HTMLInputElement;
      const teamName = inputTeamName ? inputTeamName.value.trim() : 'Custom Squad';

      if (this.tempSquadMap.size === 0) {
        alert('⚠️ Please add at least 1 Axie to your squad before saving!');
        return;
      }

      this.teamManager.saveTeam(this.editingTeamId, teamName || 'Custom Squad', this.tempSquadMap);
      this.teamManager.setActiveTeam(this.editingTeamId);

      this.showPageView('dashboard');
      this.renderTeamBuilder();
      alert(`⚔️ Squad "${teamName}" saved and set as active team!`);
    });

    // Mobile tabs switcher (Squad Formation vs Inventory Roster)
    const tabSquad = document.getElementById('edit-tab-btn-squad');
    const tabInv = document.getElementById('edit-tab-btn-inventory');
    const btnMobileGotoInv = document.getElementById('btn-edit-mobile-goto-inv');

    const switchEditTab = (tab: 'squad' | 'inventory') => {
      this.editMobileActiveTab = tab;
      const panelSquad = document.getElementById('edit-squad-panel');
      const panelInv = document.getElementById('edit-inventory-panel');

      if (tab === 'squad') {
        tabSquad?.classList.add('active');
        tabInv?.classList.remove('active');
        if (panelSquad) panelSquad.style.display = 'flex';
        if (panelInv) panelInv.style.display = window.innerWidth <= 900 ? 'none' : 'flex';
      } else {
        tabInv?.classList.add('active');
        tabSquad?.classList.remove('active');
        if (panelSquad) panelSquad.style.display = window.innerWidth <= 900 ? 'none' : 'flex';
        if (panelInv) panelInv.style.display = 'flex';
      }
    };

    tabSquad?.addEventListener('click', () => switchEditTab('squad'));
    tabInv?.addEventListener('click', () => switchEditTab('inventory'));
    btnMobileGotoInv?.addEventListener('click', () => switchEditTab('inventory'));

    window.addEventListener('resize', () => {
      const panelSquad = document.getElementById('edit-squad-panel');
      const panelInv = document.getElementById('edit-inventory-panel');
      if (window.innerWidth > 900) {
        if (panelSquad) panelSquad.style.display = 'flex';
        if (panelInv) panelInv.style.display = 'flex';
      } else {
        switchEditTab(this.editMobileActiveTab);
      }
    });

    // Mobile role filter chips
    const roleChips = document.querySelectorAll('.edit-role-filter-chip');
    roleChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        roleChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.editMobileRoleFilter = (chip as HTMLElement).dataset.role || 'all';
        this.applyEditMobileRoleFilter();
      });
    });

    // Inventory pagination buttons
    const btnPrev = document.getElementById('edit-btn-inv-prev');
    const btnNext = document.getElementById('edit-btn-inv-next');

    btnPrev?.addEventListener('click', () => {
      if (this.editInvCurrentPage > 1) {
        this.editInvCurrentPage--;
        this.renderEditInventoryGrid();
      }
    });

    btnNext?.addEventListener('click', () => {
      this.editInvCurrentPage++;
      this.renderEditInventoryGrid();
    });

    // Inventory class filter chips
    const classChips = document.querySelectorAll('.class-filter-chip');
    classChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        classChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.editInvClassFilter = (chip as HTMLElement).dataset.class || 'all';
        this.editInvCurrentPage = 1;
        this.renderEditInventoryGrid();
      });
    });

    const searchInput = document.getElementById('edit-inv-search') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.editInvCurrentPage = 1;
      this.renderEditInventoryGrid();
    });
  }

  public openEditTeamPage(team: AxieTeam) {
    this.editingTeamId = team.id;
    this.editMobileActiveTab = 'squad';
    this.editMobileRoleFilter = 'all';
    this.editInvCurrentPage = 1;
    this.editInvClassFilter = 'all';

    const pageTitle = document.getElementById('edit-page-title');
    const inputTeamName = document.getElementById('edit-page-team-name') as HTMLInputElement;

    if (pageTitle) pageTitle.textContent = `⚔️ Edit Squad: ${team.name}`;
    if (inputTeamName) inputTeamName.value = team.name;

    // Reset mobile role buttons
    document.querySelectorAll('.edit-role-filter-chip').forEach((c, idx) => {
      if (idx === 0) c.classList.add('active');
      else c.classList.remove('active');
    });

    // Reset class chips
    document.querySelectorAll('.class-filter-chip').forEach((c, idx) => {
      if (idx === 0) c.classList.add('active');
      else c.classList.remove('active');
    });

    // Load squad map into working temp map
    this.tempSquadMap.clear();
    team.squadMap.forEach((role, axieId) => {
      this.tempSquadMap.set(axieId, role);
    });

    // Reset view panels
    const tabSquad = document.getElementById('edit-tab-btn-squad');
    const tabInv = document.getElementById('edit-tab-btn-inventory');
    const panelSquad = document.getElementById('edit-squad-panel');
    const panelInv = document.getElementById('edit-inventory-panel');

    tabSquad?.classList.add('active');
    tabInv?.classList.remove('active');

    if (window.innerWidth <= 900) {
      if (panelSquad) panelSquad.style.display = 'flex';
      if (panelInv) panelInv.style.display = 'none';
    } else {
      if (panelSquad) panelSquad.style.display = 'flex';
      if (panelInv) panelInv.style.display = 'flex';
    }

    this.showPageView('edit-team');
    this.renderEditTeamPageState();
  }

  private applyEditMobileRoleFilter() {
    const cols = document.querySelectorAll('.edit-role-col');
    cols.forEach((col) => {
      const el = col as HTMLElement;
      const role = el.dataset.role;
      if (this.editMobileRoleFilter === 'all' || this.editMobileRoleFilter === role) {
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
      }
    });
  }

  private renderEditTeamPageState() {
    const totalCount = this.tempSquadMap.size;
    const counterBadge = document.getElementById('edit-page-counter-badge');
    const mobSquadCount = document.getElementById('edit-mob-squad-count');
    const mobInvCount = document.getElementById('edit-mob-inv-count');

    if (mobSquadCount) mobSquadCount.textContent = String(totalCount);
    if (counterBadge) {
      counterBadge.textContent = `Squad: ${totalCount} / 15`;
      if (totalCount >= 15) {
        counterBadge.style.background = 'rgba(255, 82, 82, 0.25)';
        counterBadge.style.color = '#ff5252';
      } else {
        counterBadge.style.background = 'rgba(0, 240, 255, 0.15)';
        counterBadge.style.color = 'var(--accent-cyan)';
      }
    }

    const defContainer = document.getElementById('edit-list-defense');
    const offContainer = document.getElementById('edit-list-offense');
    const neuContainer = document.getElementById('edit-list-neutral');

    const defCountBadge = document.getElementById('edit-count-def');
    const offCountBadge = document.getElementById('edit-count-off');
    const neuCountBadge = document.getElementById('edit-count-neu');

    const badgeDef = document.getElementById('edit-badge-def');
    const badgeOff = document.getElementById('edit-badge-off');
    const badgeNeu = document.getElementById('edit-badge-neu');

    if (!defContainer || !offContainer || !neuContainer) return;

    defContainer.innerHTML = '';
    offContainer.innerHTML = '';
    neuContainer.innerHTML = '';

    let defCount = 0;
    let offCount = 0;
    let neuCount = 0;

    const axies = this.teamManager.getPlayerAxies();
    if (mobInvCount) mobInvCount.textContent = String(axies.length);

    // Render assigned Axies in the 3 tactical formation columns WITH AXIE LOOKS
    axies.forEach((axie) => {
      const role = this.tempSquadMap.get(axie.id);
      if (!role) return;

      const portraitUrl = this.portraitCache.get(axie.id) || '';
      const classTagClass = `tag-${axie.class.toLowerCase()}`;

      const item = document.createElement('div');
      item.className = 'edit-squad-item';

      item.innerHTML = `
        <div class="edit-item-thumb">
          <img src="${portraitUrl}" alt="${axie.name}" style="${portraitUrl ? '' : 'display: none;'}" />
          ${!portraitUrl ? `<span style="font-size: 0.8rem;">🐾</span>` : ''}
        </div>
        <div class="edit-item-info">
          <span class="edit-item-name" title="${axie.name}">${axie.name}</span>
          <span class="sample-class-tag ${classTagClass}" style="font-size: 0.65rem; padding: 0.05rem 0.35rem;">${axie.class}</span>
        </div>
        <button class="btn-remove-role-chip" data-id="${axie.id}" title="Remove Axie from squad">✕</button>
      `;

      // Remove button handler
      const btnRemove = item.querySelector('.btn-remove-role-chip');
      btnRemove?.addEventListener('click', () => {
        this.tempSquadMap.delete(axie.id);
        this.renderEditTeamPageState();
      });

      if (role === 'Defense') {
        defCount++;
        defContainer.appendChild(item);
      } else if (role === 'Offense') {
        offCount++;
        offContainer.appendChild(item);
      } else {
        neuCount++;
        neuContainer.appendChild(item);
      }
    });

    // Add empty placeholder slots if squad has room
    const appendSlot = (container: HTMLElement, roleName: TeamRole) => {
      const emptySlot = document.createElement('div');
      emptySlot.className = 'edit-squad-empty-slot';
      emptySlot.innerHTML = `<span>➕ Add Axie to ${roleName}</span>`;
      emptySlot.addEventListener('click', () => {
        // Switch to inventory
        const tabInv = document.getElementById('edit-tab-btn-inventory');
        tabInv?.click();
      });
      container.appendChild(emptySlot);
    };

    if (defCount === 0) appendSlot(defContainer, 'Defense');
    if (offCount === 0) appendSlot(offContainer, 'Offense');
    if (neuCount === 0) appendSlot(neuContainer, 'Neutral');

    if (defCountBadge) defCountBadge.textContent = String(defCount);
    if (offCountBadge) offCountBadge.textContent = String(offCount);
    if (neuCountBadge) neuCountBadge.textContent = String(neuCount);

    if (badgeDef) badgeDef.textContent = `🟢 ${defCount} Def`;
    if (badgeOff) badgeOff.textContent = `🔴 ${offCount} Off`;
    if (badgeNeu) badgeNeu.textContent = `🔵 ${neuCount} Neu`;

    this.applyEditMobileRoleFilter();
    this.renderEditInventoryGrid();
  }

  private renderEditInventoryGrid() {
    const container = document.getElementById('edit-inventory-grid');
    const searchInput = document.getElementById('edit-inv-search') as HTMLInputElement;
    if (!container) return;

    container.innerHTML = '';

    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const axies = this.teamManager.getPlayerAxies();

    let filteredAxies = axies;

    // Class filter
    if (this.editInvClassFilter !== 'all') {
      filteredAxies = filteredAxies.filter((a) => a.class.toLowerCase() === this.editInvClassFilter.toLowerCase());
    }

    // Search filter
    if (searchTerm) {
      filteredAxies = filteredAxies.filter(
        (a) =>
          a.name.toLowerCase().includes(searchTerm) ||
          a.class.toLowerCase().includes(searchTerm) ||
          a.id.toLowerCase().includes(searchTerm)
      );
    }

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredAxies.length / this.editInvPageSize));
    if (this.editInvCurrentPage > totalPages) this.editInvCurrentPage = totalPages;
    if (this.editInvCurrentPage < 1) this.editInvCurrentPage = 1;

    const pageLabel = document.getElementById('edit-inv-page-label');
    if (pageLabel) pageLabel.textContent = `${this.editInvCurrentPage}/${totalPages}`;

    const btnPrev = document.getElementById('edit-btn-inv-prev') as HTMLButtonElement;
    const btnNext = document.getElementById('edit-btn-inv-next') as HTMLButtonElement;
    if (btnPrev) btnPrev.disabled = this.editInvCurrentPage <= 1;
    if (btnNext) btnNext.disabled = this.editInvCurrentPage >= totalPages;

    const startIndex = (this.editInvCurrentPage - 1) * this.editInvPageSize;
    const pageAxies = filteredAxies.slice(startIndex, startIndex + this.editInvPageSize);

    const totalSelected = this.tempSquadMap.size;

    if (pageAxies.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; grid-column: span 2; text-align: center; padding: 2rem 0;">No Axies found matching filter.</div>';
      return;
    }

    pageAxies.forEach((axie) => {
      const currentRole = this.tempSquadMap.get(axie.id);
      const isAssigned = !!currentRole;
      const portraitUrl = this.portraitCache.get(axie.id) || '';
      const stats = calculateAxieClassicStats(axie.genes);
      const classTagClass = `tag-${axie.class.toLowerCase()}`;

      const card = document.createElement('div');
      card.className = `edit-picker-card ${isAssigned ? 'assigned' : ''}`;

      card.innerHTML = `
        <div class="edit-picker-thumb">
          <img src="${portraitUrl}" alt="${axie.name}" style="${portraitUrl ? '' : 'display: none;'}" />
          ${!portraitUrl ? `<span style="font-size: 0.8rem;">🐾</span>` : ''}
        </div>

        <div class="edit-picker-info">
          <div style="display: flex; align-items: center; gap: 0.3rem;">
            <span class="edit-picker-name" title="${axie.name}">${axie.name}</span>
            <span class="sample-class-tag ${classTagClass}" style="font-size: 0.65rem; padding: 0.05rem 0.3rem;">${axie.class}</span>
          </div>
          <span class="edit-picker-stats">❤️ HP ${stats.hp} | ⚡ Spd ${stats.speed}</span>
        </div>

        <div class="edit-picker-actions">
          ${
            isAssigned
              ? `
            <span class="role-assigned-indicator role-${currentRole.toLowerCase()}">${
                  currentRole === 'Defense' ? '🟢 Def' : currentRole === 'Offense' ? '🔴 Off' : '🔵 Neu'
                }</span>
            <button class="btn-picker-remove btn-rem-${axie.id}" title="Remove from squad">✕</button>
          `
              : `
            <div class="picker-add-btns">
              <button class="btn-add-opt opt-def btn-add-def-${axie.id}" title="Add to Defense" ${totalSelected >= 15 ? 'disabled' : ''}>+Def</button>
              <button class="btn-add-opt opt-off btn-add-off-${axie.id}" title="Add to Offense" ${totalSelected >= 15 ? 'disabled' : ''}>+Off</button>
              <button class="btn-add-opt opt-neu btn-add-neu-${axie.id}" title="Add to Neutral" ${totalSelected >= 15 ? 'disabled' : ''}>+Neu</button>
            </div>
          `
          }
        </div>
      `;

      if (isAssigned) {
        const btnRem = card.querySelector(`.btn-rem-${axie.id}`);
        btnRem?.addEventListener('click', () => {
          this.tempSquadMap.delete(axie.id);
          this.renderEditTeamPageState();
        });
      } else {
        const btnDef = card.querySelector(`.btn-add-def-${axie.id}`);
        const btnOff = card.querySelector(`.btn-add-off-${axie.id}`);
        const btnNeu = card.querySelector(`.btn-add-neu-${axie.id}`);

        const addRole = (role: TeamRole) => {
          if (this.tempSquadMap.size >= 15) {
            alert('⚠️ Squad is full! Maximum 15 Axies allowed per team.');
            return;
          }
          this.tempSquadMap.set(axie.id, role);
          this.renderEditTeamPageState();
        };

        btnDef?.addEventListener('click', () => addRole('Defense'));
        btnOff?.addEventListener('click', () => addRole('Offense'));
        btnNeu?.addEventListener('click', () => addRole('Neutral'));
      }

      container.appendChild(card);
    });
  }

  /* ==========================================================================
     AUTHENTIC AXIE CLASSIC CARD RENDERER (MATCHING REFERENCE PHOTO)
     ========================================================================== */
  private renderClassicCardHTML(card: AxieCardAbility): string {
    const cardClass = card.partType ? card.partType.toLowerCase() : 'aquatic';

    return `
      <div class="classic-card-wrapper">
        <div class="classic-card-header-part">
          <span>⚔️</span>
          <span>${(card.partName || card.skillName).toUpperCase()}</span>
        </div>

        <div class="classic-card-frame card-class-${cardClass}">
          <div class="card-top-section">
            <div class="card-energy-orb">${card.defaultEnergy}</div>
            <div class="card-skill-banner">${card.skillName}</div>
          </div>

          <div class="card-art-box">
            <img class="card-art-img" src="${card.imageUrl}" alt="${card.skillName}" loading="lazy" />
            <div class="card-left-badges">
              <div class="card-badge-hex badge-attack" title="Attack">${card.defaultAttack}</div>
              <div class="card-badge-hex badge-defense" title="Defense">${card.defaultDefense}</div>
            </div>
          </div>

          <div class="card-bottom-effect-box">
            <div class="card-trigger-icon">⭐</div>
            <div class="card-description-text">${card.description}</div>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================================
     AXIE MIXER STUDIO ENGINE & CONTROLS (ORIGINAL DESIGN)
     ========================================================================== */
  private async initStudioMode() {
    const canvas = document.getElementById('pixi-canvas') as HTMLCanvasElement;
    if (canvas && !this.studioEngine) {
      this.studioEngine = new AxieMixerEngine(canvas);
      await this.studioEngine.initialize();

      window.addEventListener('resize', () => {
        this.studioEngine?.resize();
      });

      await this.loadSampleAxie(0);
      await this.setupStudioVfxLab();
    }
  }

  private setupAudioControllers() {
    const bgmSelects = [
      document.getElementById('select-global-bgm') as HTMLSelectElement,
      document.getElementById('select-studio-bgm') as HTMLSelectElement,
    ];
    const playBtns = [
      document.getElementById('btn-global-bgm-play'),
      document.getElementById('btn-studio-bgm-play'),
    ];
    const muteBtns = [
      document.getElementById('btn-global-bgm-mute'),
      document.getElementById('btn-studio-bgm-mute'),
    ];
    const sliders = [
      document.getElementById('slider-global-bgm') as HTMLInputElement,
      document.getElementById('slider-studio-bgm') as HTMLInputElement,
    ];

    const updatePlayBtns = (isPlaying: boolean) => {
      playBtns.forEach((btn) => {
        if (btn) btn.textContent = isPlaying ? '⏸️' : '▶️';
      });
    };

    const updateMuteBtns = (isMuted: boolean) => {
      muteBtns.forEach((btn) => {
        if (btn) btn.textContent = isMuted ? '🔇' : '🔊';
      });
    };

    const updateTrackSelects = (track: MusicTrack | null) => {
      if (!track) return;
      bgmSelects.forEach((sel) => {
        if (sel && sel.value !== track) sel.value = track;
      });
    };

    audioManager.onTrackChange((track, isPlaying) => {
      updatePlayBtns(isPlaying);
      updateTrackSelects(track);
      updateMuteBtns(audioManager.isBgmSilenced());
    });

    bgmSelects.forEach((sel) => {
      sel?.addEventListener('change', () => {
        const track = sel.value as MusicTrack;
        audioManager.playBgm(track);
      });
    });

    playBtns.forEach((btn) => {
      btn?.addEventListener('click', () => {
        const current = audioManager.getCurrentTrack();
        if (current) {
          audioManager.toggleBgmMute();
        } else {
          audioManager.playBgm('home');
        }
      });
    });

    muteBtns.forEach((btn) => {
      btn?.addEventListener('click', () => {
        const isMuted = audioManager.toggleBgmMute();
        updateMuteBtns(isMuted);
      });
    });

    sliders.forEach((sli) => {
      if (sli) sli.value = audioManager.getBgmVolume().toString();
      sli?.addEventListener('input', () => {
        const vol = parseFloat(sli.value);
        audioManager.setBgmVolume(vol);
        sliders.forEach((s) => {
          if (s && s !== sli) s.value = sli.value;
        });
      });
    });
  }

  private async setupStudioVfxLab() {
    this.studioVfxCanvas = document.getElementById('studio-vfx-canvas') as HTMLCanvasElement;
    if (this.studioVfxCanvas) {
      this.studioVfxCtx = this.studioVfxCanvas.getContext('2d') || undefined;
      const resizeCanvas = () => {
        if (this.studioVfxCanvas && this.studioVfxCanvas.parentElement) {
          this.studioVfxCanvas.width = this.studioVfxCanvas.parentElement.clientWidth;
          this.studioVfxCanvas.height = this.studioVfxCanvas.parentElement.clientHeight;
        }
      };
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
    }

    try {
      const catalog = await loadCatalog();
      this.vfxCatalog = {
        skills: catalog.items.filter((i) => i.kind === 'skill'),
        buffs: catalog.items.filter((i) => i.kind === 'buff'),
      };
    } catch (e) {
      console.warn('Failed to load VFX catalog for studio lab:', e);
    }

    const tabSkills = document.getElementById('tab-vfx-skills');
    const tabBuffs = document.getElementById('tab-vfx-buffs');
    const selectClip = document.getElementById('select-vfx-clip') as HTMLSelectElement;
    const btnPlay = document.getElementById('btn-play-vfx');
    const btnStop = document.getElementById('btn-stop-vfx');
    const infoPill = document.getElementById('vfx-info-pill');

    const updateVfxOptions = () => {
      if (!selectClip) return;
      selectClip.innerHTML = '';
      const list = this.vfxLabMode === 'skill' ? this.vfxCatalog.skills : this.vfxCatalog.buffs;
      list.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item.id;
        const dur = (item.duration || 0).toFixed(2);
        opt.textContent = `${item.id} (${dur}s)`;
        selectClip.appendChild(opt);
      });
      updateClipInfo();
    };

    const updateClipInfo = async () => {
      if (!selectClip || !infoPill) return;
      const clipId = selectClip.value;
      if (!clipId) return;
      try {
        const clip = await loadClip(clipId);
        const eventsList = clip.events.map((e) => e.function).join(', ') || 'None';
        infoPill.innerHTML = `<strong>${clip.id}</strong> • ${clip.frames} frames • ${clip.duration.toFixed(2)}s<br/><span style="opacity:0.8;">Events: ${eventsList}</span>`;
      } catch {}
    };

    selectClip?.addEventListener('change', updateClipInfo);

    tabSkills?.addEventListener('click', () => {
      this.vfxLabMode = 'skill';
      tabSkills.classList.add('active');
      tabBuffs?.classList.remove('active');
      updateVfxOptions();
    });

    tabBuffs?.addEventListener('click', () => {
      this.vfxLabMode = 'buff';
      tabBuffs.classList.add('active');
      tabSkills?.classList.remove('active');
      updateVfxOptions();
    });

    btnPlay?.addEventListener('click', async () => {
      if (!selectClip || !this.studioVfxCanvas || !this.studioVfxCtx) return;
      const clipId = selectClip.value;
      if (!clipId) return;

      if (this.activeStudioVfxHandle) {
        this.activeStudioVfxHandle.stop();
        this.activeStudioVfxHandle = null;
      }

      try {
        const clip = await loadClip(clipId);
        const atlas = await AdditiveAtlas.load(clip);
        const w = this.studioVfxCanvas.width;
        const h = this.studioVfxCanvas.height;
        const axieAnchor = { x: w / 2, y: h * 0.65 };

        // Trigger corresponding Spine mixer animation on current studio Axie
        if (clip.attackAnimation) {
          this.studioEngine?.setAnimation(clip.attackAnimation, false);
        } else if (clip.kind === 'skill') {
          this.studioEngine?.setAnimation(clip.isRanged ? 'attack/ranged/cast-fly' : 'attack/melee/horn-gore', false);
        } else if (clip.kind === 'buff') {
          this.studioEngine?.setAnimation('battle/get-buff', false);
        }

        this.activeStudioVfxHandle = playOnCanvas(
          atlas,
          this.studioVfxCtx,
          () => ({
            attacker: axieAnchor,
            defender: { x: axieAnchor.x + 80, y: axieAnchor.y },
            fieldWidth: w,
          }),
          {
            loop: false,
            playAudio: true,
            onEvent: (evt) => {
              if (evt.function === 'OnAttack' && clip.attackAnimation) {
                this.studioEngine?.setAnimation(clip.attackAnimation, false);
              } else if (evt.function === 'OnHit' && clip.hitAnimation) {
                this.studioEngine?.setAnimation(clip.hitAnimation, false);
              }
            },
            onDone: () => {
              this.activeStudioVfxHandle = null;
              this.studioEngine?.setAnimation('action/idle/normal', true);
            },
          }
        );
      } catch (err) {
        console.error('Failed to play studio VFX:', err);
      }
    });

    btnStop?.addEventListener('click', () => {
      if (this.activeStudioVfxHandle) {
        this.activeStudioVfxHandle.stop();
        this.activeStudioVfxHandle = null;
      }
      this.studioEngine?.setAnimation('action/idle/normal', true);
    });

    // Test SFX Buttons
    document.getElementById('btn-test-sfx-attack')?.addEventListener('click', () => {
      const clipId = selectClip?.value || 'aquatic_slash';
      audioManager.playSkillSfx(clipId, 'attack');
    });
    document.getElementById('btn-test-sfx-fly')?.addEventListener('click', () => {
      const clipId = selectClip?.value || 'bird_projectile';
      audioManager.playSkillSfx(clipId, 'fly');
    });
    document.getElementById('btn-test-sfx-hit')?.addEventListener('click', () => {
      const clipId = selectClip?.value || 'beast_gore';
      audioManager.playSkillSfx(clipId, 'hit');
    });

    updateVfxOptions();
  }

  private setupStudioEventListeners() {
    const btnFetch = document.getElementById('btn-fetch-id');
    const inputAxieId = document.getElementById('input-axie-id') as HTMLInputElement;

    const handleFetchById = async () => {
      const idStr = inputAxieId.value.trim();
      if (!idStr) return;

      this.showLoading(true, `Fetching Axie #${idStr}...`);
      try {
        const data = await AxieMixerEngine.fetchGenesByAxieId(idStr);
        const inputGenes = document.getElementById('input-genes') as HTMLInputElement;
        if (inputGenes) inputGenes.value = data.genes;

        await this.loadAxieByGenes(data.genes);
      } catch (err: any) {
        alert(`Error: ${err.message || 'Could not fetch Axie by ID'}`);
      } finally {
        this.showLoading(false);
      }
    };

    btnFetch?.addEventListener('click', handleFetchById);
    inputAxieId?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleFetchById();
    });

    const btnLoadGenes = document.getElementById('btn-load-genes');
    const inputGenes = document.getElementById('input-genes') as HTMLInputElement;

    const handleLoadGenes = async () => {
      const genesStr = inputGenes.value.trim();
      if (!genesStr) return;

      await this.loadAxieByGenes(genesStr);
    };

    btnLoadGenes?.addEventListener('click', handleLoadGenes);

    const sliderZoom = document.getElementById('slider-zoom') as HTMLInputElement;
    sliderZoom?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.studioEngine?.setZoomScale(val);
    });

    const sliderSpeed = document.getElementById('slider-speed') as HTMLInputElement;
    const speedLabel = document.getElementById('speed-label');
    sliderSpeed?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.studioEngine?.setPlaybackSpeed(val);
      if (speedLabel) speedLabel.textContent = `${val.toFixed(1)}x`;
    });

    const btnFlip = document.getElementById('btn-flip');
    btnFlip?.addEventListener('click', () => {
      this.studioEngine?.toggleFlip();
    });

    const selectBg = document.getElementById('select-bg') as HTMLSelectElement;
    selectBg?.addEventListener('change', (e) => {
      const colorHex = parseInt((e.target as HTMLSelectElement).value, 16);
      this.studioEngine?.setBackgroundColor(colorHex);
    });

    const btnExport = document.getElementById('btn-export-snapshot');
    btnExport?.addEventListener('click', () => {
      if (!this.studioEngine) return;
      const dataUrl = this.studioEngine.exportCanvasSnapshot();
      const link = document.createElement('a');
      link.download = `axie-snapshot-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    });

    const btnCopyGenes = document.getElementById('btn-copy-genes');
    btnCopyGenes?.addEventListener('click', () => {
      const inputGenes = document.getElementById('input-genes') as HTMLInputElement;
      if (inputGenes && inputGenes.value) {
        navigator.clipboard.writeText(inputGenes.value);
        alert('Axie genes string copied to clipboard!');
      }
    });

    const chkLoop = document.getElementById('chk-loop') as HTMLInputElement;
    chkLoop?.addEventListener('change', () => {
      if (!this.studioEngine) return;
      const currentAnim = this.studioEngine.getCurrentAnimation();
      this.studioEngine.setAnimation(currentAnim, chkLoop.checked);
    });

    const btnCloseModal = document.getElementById('btn-close-modal');
    const cardModal = document.getElementById('card-modal');
    btnCloseModal?.addEventListener('click', () => {
      if (cardModal) cardModal.style.display = 'none';
    });
    cardModal?.addEventListener('click', (e) => {
      if (e.target === cardModal) cardModal.style.display = 'none';
    });

    const btnViewRawJson = document.getElementById('btn-view-raw-json');
    const btnInspectCardsJson = document.getElementById('btn-inspect-cards-json');
    const jsonModal = document.getElementById('json-modal');
    const btnCloseJsonModal = document.getElementById('btn-close-json-modal');

    btnViewRawJson?.addEventListener('click', () => this.openJsonModal());
    btnInspectCardsJson?.addEventListener('click', () => this.openJsonModal());

    btnCloseJsonModal?.addEventListener('click', () => {
      if (jsonModal) jsonModal.style.display = 'none';
    });
    jsonModal?.addEventListener('click', (e) => {
      if (e.target === jsonModal) jsonModal.style.display = 'none';
    });

    const tabSelected = document.getElementById('tab-json-selected');
    const tabAll = document.getElementById('tab-json-all');

    tabSelected?.addEventListener('click', () => {
      this.jsonTabMode = 'selected';
      tabSelected.classList.add('active');
      tabAll?.classList.remove('active');
      this.renderRawJsonContent();
    });

    tabAll?.addEventListener('click', () => {
      this.jsonTabMode = 'all';
      tabAll.classList.add('active');
      tabSelected?.classList.remove('active');
      this.renderRawJsonContent();
    });

    const jsonSearchInput = document.getElementById('json-search-input') as HTMLInputElement;
    jsonSearchInput?.addEventListener('input', () => {
      this.renderRawJsonContent();
    });

    const btnCopyJson = document.getElementById('btn-copy-json');
    btnCopyJson?.addEventListener('click', () => {
      const codeBlock = document.getElementById('json-code-block');
      if (codeBlock) {
        navigator.clipboard.writeText(codeBlock.innerText);
        alert('Raw skill JSON copied to clipboard!');
      }
    });
  }

  private renderSamplesList() {
    const container = document.getElementById('samples-list');
    if (!container) return;

    container.innerHTML = '';

    SAMPLE_AXIES.forEach((sample, idx) => {
      const item = document.createElement('div');
      item.className = `sample-item ${idx === this.currentSampleIndex ? 'active' : ''}`;
      const classClass = `tag-${sample.class.toLowerCase()}`;

      item.innerHTML = `
        <span class="sample-name">${sample.name}</span>
        <span class="sample-class-tag ${classClass}">${sample.class}</span>
      `;

      item.addEventListener('click', () => {
        document.querySelectorAll('.sample-item').forEach((el) => el.classList.remove('active'));
        item.classList.add('active');
        this.loadSampleAxie(idx);
      });

      container.appendChild(item);
    });
  }

  private renderAccessoriesList() {
    const container = document.getElementById('accessories-container');
    if (!container) return;

    container.innerHTML = '';

    AVAILABLE_ACCESSORIES.forEach((acc) => {
      const label = document.createElement('label');
      label.className = 'accessory-checkbox';

      label.innerHTML = `
        <span>${acc.name} (${acc.placement})</span>
        <input type="checkbox" id="acc-${acc.key}" data-key="${acc.key}" data-name="${acc.name}" data-placement="${acc.placement}" />
      `;

      const input = label.querySelector('input') as HTMLInputElement;
      input.addEventListener('change', () => {
        if (input.checked) {
          this.equippedAccessoriesMap.set(acc.placement, {
            key: acc.key,
            name: acc.name,
            placement: acc.placement as any,
          });
        } else {
          this.equippedAccessoriesMap.delete(acc.placement);
        }
        this.reloadCurrentAxieWithAccessories();
      });

      container.appendChild(label);
    });
  }

  private async loadSampleAxie(index: number) {
    if (index < 0 || index >= SAMPLE_AXIES.length) return;

    this.currentSampleIndex = index;
    const sample = SAMPLE_AXIES[index];

    const inputGenes = document.getElementById('input-genes') as HTMLInputElement;
    if (inputGenes) inputGenes.value = sample.genes;

    this.equippedAccessoriesMap.clear();
    if (sample.accessories) {
      sample.accessories.forEach((acc) => {
        this.equippedAccessoriesMap.set(acc.placement, acc);
      });
    }

    AVAILABLE_ACCESSORIES.forEach((acc) => {
      const chk = document.getElementById(`acc-${acc.key}`) as HTMLInputElement;
      if (chk) {
        chk.checked =
          this.equippedAccessoriesMap.has(acc.placement) &&
          this.equippedAccessoriesMap.get(acc.placement)?.key === acc.key;
      }
    });

    await this.loadAxieByGenes(sample.genes);
  }

  private async reloadCurrentAxieWithAccessories() {
    const inputGenes = document.getElementById('input-genes') as HTMLInputElement;
    if (inputGenes && inputGenes.value) {
      await this.loadAxieByGenes(inputGenes.value);
    }
  }

  private async loadAxieByGenes(genesHex: string) {
    this.showLoading(true, 'Building Axie Spine Assets...');

    try {
      const accessoriesList = Array.from(this.equippedAccessoriesMap.values());
      if (this.studioEngine) {
        await this.studioEngine.loadAxieFromGenes(genesHex, accessoriesList);
        this.updateAnimationsList();
        this.updateGeneDecoderUI(genesHex);
      }
    } catch (err: any) {
      console.error('Failed to load Axie Spine:', err);
      alert(`Could not load Axie Spine: ${err.message || 'Unknown error'}`);
    } finally {
      this.showLoading(false);
    }
  }

  private updateAnimationsList() {
    const container = document.getElementById('animations-grid');
    if (!container || !this.studioEngine) return;

    container.innerHTML = '';
    const anims = this.studioEngine.getAvailableAnimations();
    const currentAnim = this.studioEngine.getCurrentAnimation();
    const chkLoop = document.getElementById('chk-loop') as HTMLInputElement;

    anims.forEach((animName) => {
      const btn = document.createElement('button');
      btn.className = `anim-btn ${animName === currentAnim ? 'active' : ''}`;
      const shortName = animName.replace('action/', '').replace('attack/', 'atk/').replace('defense/', 'def/');
      btn.textContent = shortName;
      btn.title = animName;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.anim-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const loop = chkLoop ? chkLoop.checked : true;
        this.studioEngine?.setAnimation(animName, loop);
      });

      container.appendChild(btn);
    });
  }

  private updateGeneDecoderUI(genesHex: string) {
    const decoded = decodeAxieGenes(genesHex);

    const classBadge = document.getElementById('class-badge');
    if (classBadge) {
      classBadge.textContent = decoded.class;
      classBadge.className = `sample-class-tag tag-${decoded.class.toLowerCase()}`;
    }

    const container = document.getElementById('decoded-parts-list');
    if (container) {
      container.innerHTML = '';

      if (!decoded.isValid) {
        container.innerHTML = `<div style="color: #ff6b6b; font-size: 0.8rem;">${decoded.error || 'Invalid gene string'}</div>`;
      } else {
        decoded.parts.forEach((part) => {
          const row = document.createElement('div');
          row.className = 'part-row';
          const classTagClass = `tag-${part.class.toLowerCase()}`;

          row.innerHTML = `
            <span class="part-type">${part.type}</span>
            <div class="part-meta">
              <span class="badge">Lv.${part.stage}</span>
              <span class="sample-class-tag ${classTagClass}">${part.class}</span>
            </div>
          `;

          container.appendChild(row);
        });
      }
    }

    this.renderAxieClassicStats(genesHex);
    this.renderAxieCards(genesHex);
  }

  private renderAxieClassicStats(genesHex: string) {
    const stats = calculateAxieClassicStats(genesHex);

    const elHp = document.getElementById('stat-val-hp');
    const elSpeed = document.getElementById('stat-val-speed');
    const elSkill = document.getElementById('stat-val-skill');
    const elMorale = document.getElementById('stat-val-morale');
    const elTotal = document.getElementById('total-stats-badge');

    const barHp = document.getElementById('stat-bar-hp');
    const barSpeed = document.getElementById('stat-bar-speed');
    const barSkill = document.getElementById('stat-bar-skill');
    const barMorale = document.getElementById('stat-bar-morale');

    if (elHp) elHp.textContent = String(stats.hp);
    if (elSpeed) elSpeed.textContent = String(stats.speed);
    if (elSkill) elSkill.textContent = String(stats.skill);
    if (elMorale) elMorale.textContent = String(stats.morale);
    if (elTotal) elTotal.textContent = `${stats.total} Total`;

    if (barHp) barHp.style.width = `${Math.min(100, (stats.hp / 65) * 100)}%`;
    if (barSpeed) barSpeed.style.width = `${Math.min(100, (stats.speed / 65) * 100)}%`;
    if (barSkill) barSkill.style.width = `${Math.min(100, (stats.skill / 65) * 100)}%`;
    if (barMorale) barMorale.style.width = `${Math.min(100, (stats.morale / 65) * 100)}%`;
  }

  private renderAxieCards(genesHex: string) {
    const cardsGrid = document.getElementById('cards-grid');
    if (!cardsGrid) return;

    cardsGrid.innerHTML = '';

    try {
      const cleanGenes = genesHex.trim().startsWith('0x') ? genesHex.trim() : `0x${genesHex.trim()}`;
      const bodyStructure = getAxieBodyStructure512(cleanGenes);
      this.currentAxieCards = getAxieCardsFromStructure(bodyStructure);

      if (this.currentAxieCards.length === 0) {
        cardsGrid.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; grid-column: span 2;">No Classic cards found for this gene structure.</div>';
        return;
      }

      this.currentAxieCards.forEach((card) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = this.renderClassicCardHTML(card);
        const cardEl = wrapper.firstElementChild as HTMLElement;

        cardEl.addEventListener('click', () => {
          this.openCardModal(card);
        });

        cardsGrid.appendChild(cardEl);
      });
    } catch (err) {
      console.warn('Could not decode cards:', err);
      cardsGrid.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; grid-column: span 2;">Cards unavailable for this Axie.</div>';
    }
  }

  private openCardModal(card: AxieCardAbility) {
    const modal = document.getElementById('card-modal');
    const modalImg = document.getElementById('modal-card-img') as HTMLImageElement;
    const modalSkill = document.getElementById('modal-card-skill');
    const modalPart = document.getElementById('modal-card-part');
    const modalDesc = document.getElementById('modal-card-desc');

    if (modalImg) modalImg.src = card.imageUrl;
    if (modalSkill) modalSkill.textContent = `${card.skillName} (Energy: ${card.defaultEnergy})`;
    if (modalPart) modalPart.textContent = `Part: ${card.partName} (${card.partType}) | Atk: ${card.defaultAttack} | Def: ${card.defaultDefense})`;
    if (modalDesc) modalDesc.textContent = card.description;

    if (modal) modal.style.display = 'flex';
  }

  private openJsonModal() {
    const jsonModal = document.getElementById('json-modal');
    if (jsonModal) {
      jsonModal.style.display = 'flex';
      this.renderRawJsonContent();
    }
  }

  private renderRawJsonContent() {
    const codeBlock = document.getElementById('json-code-block');
    const searchInput = document.getElementById('json-search-input') as HTMLInputElement;
    if (!codeBlock) return;

    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let dataToDisplay: any;

    if (this.jsonTabMode === 'selected') {
      dataToDisplay = this.currentAxieCards;
      if (searchTerm) {
        dataToDisplay = this.currentAxieCards.filter((card) =>
          JSON.stringify(card).toLowerCase().includes(searchTerm)
        );
      }
    } else {
      const allDatabase = getAllCardAbilitiesDatabase();
      if (searchTerm) {
        const filteredObj: Record<string, any> = {};
        Object.entries(allDatabase).forEach(([key, val]) => {
          if (key.toLowerCase().includes(searchTerm) || JSON.stringify(val).toLowerCase().includes(searchTerm)) {
            filteredObj[key] = val;
          }
        });
        dataToDisplay = filteredObj;
      } else {
        dataToDisplay = allDatabase;
      }
    }

    const rawJsonStr = JSON.stringify(dataToDisplay, null, 2);
    codeBlock.innerHTML = this.highlightJsonSyntax(rawJsonStr);
  }

  private highlightJsonSyntax(jsonStr: string): string {
    if (!jsonStr) return '';
    const escaped = jsonStr
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }

  /* ==========================================================================
     SEQUENTIAL AXIE PORTRAIT GENERATOR (PREVENTS RACE CONDITIONS)
     ========================================================================== */
  private async getOrCreateAxiePortrait(axie: SampleAxie): Promise<string> {
    if (this.portraitCache.has(axie.id)) {
      return this.portraitCache.get(axie.id)!;
    }

    let offscreenCanvas = document.getElementById('portrait-offscreen-canvas') as HTMLCanvasElement;
    if (!offscreenCanvas) {
      offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.id = 'portrait-offscreen-canvas';
      offscreenCanvas.width = 300;
      offscreenCanvas.height = 240;
      offscreenCanvas.style.display = 'none';
      document.body.appendChild(offscreenCanvas);
    }

    if (!this.portraitEngine) {
      this.portraitEngine = new AxieMixerEngine(offscreenCanvas);
      await this.portraitEngine.initialize();
    }

    try {
      await this.portraitEngine.loadAxieFromGenes(axie.genes, axie.accessories || []);
      this.portraitEngine.setZoomScale(0.32);
      this.portraitEngine.setAnimation('action/idle/normal', false);

      const dataUrl = this.portraitEngine.exportCanvasSnapshot();
      this.portraitCache.set(axie.id, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn('Could not generate static portrait for Axie:', axie.id, err);
      return '';
    }
  }

  /* ==========================================================================
     AXIE DIRECTORY REAL AXIES & LIGHTBOX MODAL
     ========================================================================== */
  private async renderAxiesDirectory(filterTerm: string = '') {
    const container = document.getElementById('axies-directory-grid');
    if (!container) return;

    container.innerHTML = '';

    const axies = this.teamManager.getPlayerAxies();
    const filteredAxies = filterTerm
      ? axies.filter(
          (a) =>
            a.name.toLowerCase().includes(filterTerm) ||
            a.class.toLowerCase().includes(filterTerm) ||
            a.id.toLowerCase().includes(filterTerm)
        )
      : axies;

    // Build DOM cards synchronously first
    filteredAxies.forEach((axie) => {
      const stats = calculateAxieClassicStats(axie.genes);
      const role = this.teamManager.getAxieRole(axie.id);
      const classTagClass = `tag-${axie.class.toLowerCase()}`;

      const cardEl = document.createElement('div');
      cardEl.className = 'axie-directory-card';

      cardEl.innerHTML = `
        <div class="axie-portrait-container">
          <img id="portrait-img-${axie.id}" class="axie-portrait-img" src="" alt="${axie.name}" style="opacity: 0; transition: opacity 0.3s;" />
          <div id="portrait-spinner-${axie.id}" class="spinner" style="width: 24px; height: 24px; border-width: 2px;"></div>
        </div>

        <div class="axie-card-header">
          <span class="axie-card-name">${axie.name}</span>
          <span class="sample-class-tag ${classTagClass}">${axie.class}</span>
        </div>

        <div class="axie-stats-preview">
          <span>❤️ HP: ${stats.hp}</span>
          <span>⚡ Spd: ${stats.speed}</span>
          <span>🎯 Skl: ${stats.skill}</span>
          <span>🔥 Mor: ${stats.morale}</span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem;">
          <span style="color: var(--text-muted);">Role: <strong>${role}</strong></span>
          <span style="color: var(--accent-cyan); font-weight: 700;">Inspect Lightbox 🔍</span>
        </div>
      `;

      cardEl.addEventListener('click', () => {
        this.openAxieInspector(axie);
      });

      container.appendChild(cardEl);
    });

    // Sequentially render Spine snapshots ONE BY ONE to guarantee exact match with Lightbox
    for (const axie of filteredAxies) {
      const portraitDataUrl = await this.getOrCreateAxiePortrait(axie);
      const img = document.getElementById(`portrait-img-${axie.id}`) as HTMLImageElement;
      const spinner = document.getElementById(`portrait-spinner-${axie.id}`);
      if (img && portraitDataUrl) {
        img.src = portraitDataUrl;
        img.style.opacity = '1';
        if (spinner) spinner.style.display = 'none';
      }
    }
  }

  private async openAxieInspector(axie: SampleAxie) {
    this.currentInspectedAxie = axie;
    const modal = document.getElementById('axie-inspector-modal');
    const title = document.getElementById('inspector-title');
    const classTag = document.getElementById('inspector-class-tag');

    if (title) title.textContent = axie.name;
    if (classTag) {
      classTag.textContent = axie.class;
      classTag.className = `sample-class-tag tag-${axie.class.toLowerCase()}`;
    }

    const stats = calculateAxieClassicStats(axie.genes);
    const elHp = document.getElementById('insp-hp');
    const elSpd = document.getElementById('insp-speed');
    const elSkl = document.getElementById('insp-skill');
    const elMor = document.getElementById('insp-morale');

    if (elHp) elHp.textContent = String(stats.hp);
    if (elSpd) elSpd.textContent = String(stats.speed);
    if (elSkl) elSkl.textContent = String(stats.skill);
    if (elMor) elMor.textContent = String(stats.morale);

    const cardsList = document.getElementById('inspector-cards-list');
    if (cardsList) {
      cardsList.innerHTML = '';
      cardsList.className = 'inspector-cards-list-grid';

      const bodyStructure = getAxieBodyStructure512(axie.genes);
      const cards = getAxieCardsFromStructure(bodyStructure);

      cards.forEach((card) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = this.renderClassicCardHTML(card);
        const cardEl = wrapper.firstElementChild as HTMLElement;

        cardEl.addEventListener('click', () => {
          this.openCardModal(card);
        });

        cardsList.appendChild(cardEl);
      });
    }

    if (modal) modal.style.display = 'flex';

    // Live Spine 2D basic movement animation inside Lightbox
    const canvas = document.getElementById('inspector-spine-canvas') as HTMLCanvasElement;
    if (canvas) {
      if (!this.inspectorEngine) {
        this.inspectorEngine = new AxieMixerEngine(canvas);
        await this.inspectorEngine.initialize();
      }

      await this.inspectorEngine.loadAxieFromGenes(axie.genes, axie.accessories || []);
      this.inspectorEngine.setZoomScale(0.32);
      this.inspectorEngine.setAnimation('action/idle/normal', true);

      const animSelect = document.getElementById('inspector-anim-select') as HTMLSelectElement;
      if (animSelect) {
        animSelect.innerHTML = '';
        const anims = this.inspectorEngine.getAvailableAnimations();
        anims.forEach((a) => {
          const opt = document.createElement('option');
          opt.value = a;
          opt.textContent = a.replace('action/', '').replace('attack/', 'atk/').replace('defense/', 'def/');
          animSelect.appendChild(opt);
        });

        animSelect.onchange = () => {
          this.inspectorEngine?.setAnimation(animSelect.value, true);
        };
      }
    }
  }

  /* ==========================================================================
     TAB 2: TEAM BUILDER (STRICT UNIFORM CARDS & MULTIPLE SQUAD PRESETS)
     ========================================================================== */
  private async renderTeamBuilder() {
    const teamsBar = document.getElementById('created-teams-bar');
    const defContainer = document.getElementById('defense-squad-list');
    const offContainer = document.getElementById('offense-squad-list');
    const neuContainer = document.getElementById('neutral-squad-list');
    const summaryBadge = document.getElementById('team-summary-badge');
    const colCountDef = document.getElementById('col-count-def');
    const colCountOff = document.getElementById('col-count-off');
    const colCountNeu = document.getElementById('col-count-neu');

    if (!defContainer || !offContainer || !neuContainer) return;

    // Render Created Teams Selection Bar
    if (teamsBar) {
      teamsBar.innerHTML = '';
      const teams = this.teamManager.getTeams();

      teams.forEach((team) => {
        const pill = document.createElement('div');
        pill.className = `created-team-card-pill ${team.isActive ? 'active' : ''}`;

        pill.innerHTML = `
          <span class="created-team-title">⚔️ ${team.name}</span>
          ${team.isActive ? '<span class="created-team-badge">ACTIVE SQUAD</span>' : ''}
          <button class="btn-edit-team-pill" title="Edit squad team">✏️ Edit</button>
        `;

        pill.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('btn-edit-team-pill')) {
            e.stopPropagation();
            this.openEditTeamPage(team);
          } else {
            this.teamManager.setActiveTeam(team.id);
            this.renderTeamBuilder();
          }
        });

        teamsBar.appendChild(pill);
      });
    }

    defContainer.innerHTML = '';
    offContainer.innerHTML = '';
    neuContainer.innerHTML = '';

    const summary = this.teamManager.getSquadSummary();
    if (summaryBadge) {
      summaryBadge.innerHTML = `<span>🟢 ${summary.defenseCount} Defense</span> | <span>🔴 ${summary.offenseCount} Offense</span> | <span>🔵 ${summary.neutralCount} Neutral</span>`;
    }

    if (colCountDef) colCountDef.textContent = String(summary.defenseCount);
    if (colCountOff) colCountOff.textContent = String(summary.offenseCount);
    if (colCountNeu) colCountNeu.textContent = String(summary.neutralCount);

    const activeTeam = this.teamManager.getActiveTeam();
    const axies = this.teamManager.getPlayerAxies();

    let defCount = 0;
    let offCount = 0;
    let neuCount = 0;

    // Render strictly uniform squad cards for active team squad
    axies.forEach((axie) => {
      const role = activeTeam.squadMap.get(axie.id);
      if (!role) return; // Only display Axies assigned in active team squad

      if (role === 'Defense') defCount++;
      else if (role === 'Offense') offCount++;
      else neuCount++;

      const stats = calculateAxieClassicStats(axie.genes);
      const classTagClass = `tag-${axie.class.toLowerCase()}`;
      const portraitDataUrl = this.portraitCache.get(axie.id) || '';

      const item = document.createElement('div');
      item.className = 'squad-axie-card';

      item.innerHTML = `
        <div class="squad-portrait-box" id="squad-portrait-box-${axie.id}">
          <img id="squad-img-${axie.id}" class="squad-portrait-img" src="${portraitDataUrl}" alt="${axie.name}" style="${portraitDataUrl ? 'opacity: 1;' : 'opacity: 0;'}" />
          <div id="squad-spinner-${axie.id}" class="spinner" style="width: 16px; height: 16px; border-width: 2px; ${portraitDataUrl ? 'display: none;' : ''}"></div>
        </div>

        <div class="squad-info">
          <span class="squad-axie-name" title="${axie.name}">${axie.name}</span>
          <div class="squad-meta-row">
            <span class="sample-class-tag ${classTagClass}" style="font-size: 0.65rem; padding: 0.05rem 0.35rem;">${axie.class}</span>
            <span style="color: var(--text-muted);">❤️ ${stats.hp} | ⚡ ${stats.speed}</span>
          </div>
        </div>

        <div class="squad-card-actions">
          <select class="role-assign-select" data-id="${axie.id}">
            <option value="Defense" ${role === 'Defense' ? 'selected' : ''}>🟢 Def</option>
            <option value="Offense" ${role === 'Offense' ? 'selected' : ''}>🔴 Off</option>
            <option value="Neutral" ${role === 'Neutral' ? 'selected' : ''}>🔵 Neu</option>
          </select>

          <button class="btn-inspect-squad btn-inspect-${axie.id}" title="Inspect Axie & Cards">
            🔍
          </button>

          <button class="btn-remove-squad btn-remove-${axie.id}" title="Remove Axie from squad">
            ✕
          </button>
        </div>
      `;

      // Role switcher dropdown
      const select = item.querySelector('select') as HTMLSelectElement;
      select.addEventListener('change', (e) => {
        const newRole = (e.target as HTMLSelectElement).value as TeamRole;
        this.teamManager.setAxieRole(axie.id, newRole);
        this.renderTeamBuilder();
      });

      // Inspect Lightbox button
      const btnInspect = item.querySelector(`.btn-inspect-${axie.id}`);
      btnInspect?.addEventListener('click', () => {
        this.openAxieInspector(axie);
      });

      const portraitBox = item.querySelector(`#squad-portrait-box-${axie.id}`);
      portraitBox?.addEventListener('click', () => {
        this.openAxieInspector(axie);
      });

      // Quick remove button directly from squad card
      const btnRemove = item.querySelector(`.btn-remove-${axie.id}`);
      btnRemove?.addEventListener('click', () => {
        activeTeam.squadMap.delete(axie.id);
        this.renderTeamBuilder();
      });

      if (role === 'Defense') defContainer.appendChild(item);
      else if (role === 'Offense') offContainer.appendChild(item);
      else neuContainer.appendChild(item);
    });

    // Add empty placeholder slots if squad has room
    const totalSquad = defCount + offCount + neuCount;
    if (totalSquad < 15) {
      const appendPlaceholder = (container: HTMLElement, roleName: TeamRole) => {
        const emptySlot = document.createElement('div');
        emptySlot.className = 'squad-empty-slot';
        emptySlot.innerHTML = `<span>➕ Add Axie to ${roleName}</span>`;
        emptySlot.addEventListener('click', () => {
          this.openEditTeamPage(activeTeam);
        });
        container.appendChild(emptySlot);
      };

      if (defCount < 5) appendPlaceholder(defContainer, 'Defense');
      if (offCount < 5) appendPlaceholder(offContainer, 'Offense');
      if (neuCount < 5) appendPlaceholder(neuContainer, 'Neutral');
    }

    // Ensure portraits are generated if any weren't cached yet
    for (const axie of axies) {
      if (activeTeam.squadMap.has(axie.id) && !this.portraitCache.has(axie.id)) {
        const portraitDataUrl = await this.getOrCreateAxiePortrait(axie);
        const img = document.getElementById(`squad-img-${axie.id}`) as HTMLImageElement;
        const spinner = document.getElementById(`squad-spinner-${axie.id}`);
        if (img && portraitDataUrl) {
          img.src = portraitDataUrl;
          img.style.opacity = '1';
          if (spinner) spinner.style.display = 'none';
        }
      }
    }
  }

  /* ==========================================================================
     TAB 3: BATTLE HUB & TACTICAL AUTO-COMBAT
     ========================================================================== */
  private setupBattleHub() {
    const btnEditSquad = document.getElementById('btn-battle-edit-squad');
    btnEditSquad?.addEventListener('click', () => {
      const activeTeam = this.teamManager.getActiveTeam();
      this.openEditTeamPage(activeTeam);
    });

    const btnRanked = document.getElementById('btn-queue-ranked');
    const btnCasual = document.getElementById('btn-queue-casual');
    const btnRaid = document.getElementById('btn-queue-raid');

    btnRanked?.addEventListener('click', () => {
      this.openMatchmakingModal('Competitive Ranked PVP (15v15)', true);
    });

    btnCasual?.addEventListener('click', () => {
      this.openTrainingGround();
    });

    btnRaid?.addEventListener('click', () => {
      this.openMatchmakingModal('Chimera Behemoth World Boss Raid (Lv. 60)', false);
    });

    const btnCloseMatchmaking = document.getElementById('btn-close-matchmaking');
    const btnCancelQueue = document.getElementById('btn-cancel-queue');
    const modalMatchmaking = document.getElementById('matchmaking-modal');

    const closeQueue = () => {
      if (modalMatchmaking) modalMatchmaking.style.display = 'none';
    };

    btnCloseMatchmaking?.addEventListener('click', closeQueue);
    btnCancelQueue?.addEventListener('click', closeQueue);

    const btnStartBattle = document.getElementById('btn-start-arena-battle');
    btnStartBattle?.addEventListener('click', () => {
      closeQueue();

      // Record a victory in logs
      this.battleLogsList.unshift({
        mode: 'Ranked Arena (15v15)',
        opponent: 'RoninKnight_X',
        result: 'VICTORY (+32 MMR)',
        time: 'Just now',
        isWin: true,
      });

      this.renderBattleLogs();
      this.renderBattleHub();

      // Launch Side-Scrolling Forest Arena!
      this.openTrainingGround();
    });

    const btnOpenFullLogs = document.getElementById('btn-open-battle-logs');
    const modalLogs = document.getElementById('battle-logs-modal');
    const btnCloseLogs = document.getElementById('btn-close-battle-logs');

    btnOpenFullLogs?.addEventListener('click', () => {
      if (modalLogs) modalLogs.style.display = 'flex';
      this.renderBattleLogs();
    });

    btnCloseLogs?.addEventListener('click', () => {
      if (modalLogs) modalLogs.style.display = 'none';
    });
  }

  private openMatchmakingModal(modeTitle: string, isRanked: boolean) {
    const modal = document.getElementById('matchmaking-modal');
    const searchPhase = document.getElementById('match-search-phase');
    const foundPhase = document.getElementById('match-found-phase');
    const titleText = document.getElementById('matchmaking-status-text');
    const subText = document.getElementById('matchmaking-subtext');
    const oppName = document.getElementById('opponent-vs-name');
    const oppMmr = document.getElementById('opponent-vs-mmr');

    if (!modal || !searchPhase || !foundPhase) return;

    searchPhase.style.display = 'flex';
    foundPhase.style.display = 'none';

    if (titleText) titleText.textContent = isRanked ? 'Searching for Ranked Opponent...' : 'Searching for Arena Match...';
    if (subText) subText.textContent = `Mode: ${modeTitle} • Scanning 1,800 - 1,900 MMR Commanders`;

    modal.style.display = 'flex';

    // Simulate match finding after 1.8s
    setTimeout(() => {
      if (modal.style.display !== 'none') {
        searchPhase.style.display = 'none';
        foundPhase.style.display = 'flex';

        const sampleOpponents = [
          { name: 'RoninKnight_X', mmr: 1865 },
          { name: 'Jihoz_Challenger', mmr: 1890 },
          { name: 'AxieStorm_99', mmr: 1840 },
          { name: 'LunaciaLegend', mmr: 1875 },
        ];
        const randomOpp = sampleOpponents[Math.floor(Math.random() * sampleOpponents.length)];

        if (oppName) oppName.textContent = randomOpp.name;
        if (oppMmr) oppMmr.textContent = `${randomOpp.mmr} MMR`;
      }
    }, 1800);
  }

  private renderBattleHub() {
    const activeTeam = this.teamManager.getActiveTeam();
    const teamNameBadge = document.getElementById('battle-active-team-name');
    const heroTitle = document.getElementById('hero-squad-title');
    const heroStats = document.getElementById('hero-squad-stats');
    const heroPortraits = document.getElementById('hero-squad-portraits');

    if (teamNameBadge) teamNameBadge.textContent = activeTeam.name;
    if (heroTitle) heroTitle.textContent = activeTeam.name;

    const summary = this.teamManager.getSquadSummary();
    if (heroStats) {
      heroStats.innerHTML = `
        <span class="badge badge-def">🟢 ${summary.defenseCount} Defense (Tanks)</span>
        <span class="badge badge-off">🔴 ${summary.offenseCount} Offense (DPS)</span>
        <span class="badge badge-neu">🔵 ${summary.neutralCount} Neutral (Support)</span>
      `;
    }

    // Render up to 5 mini visual portraits of the active squad
    if (heroPortraits) {
      heroPortraits.innerHTML = '';
      const axies = this.teamManager.getPlayerAxies();
      const squadAxies = axies.filter((a) => activeTeam.squadMap.has(a.id)).slice(0, 5);

      squadAxies.forEach((axie) => {
        const portraitUrl = this.portraitCache.get(axie.id) || '';
        const miniEl = document.createElement('div');
        miniEl.className = 'hero-mini-portrait';
        miniEl.title = `${axie.name} (${axie.class})`;

        miniEl.innerHTML = `
          <img src="${portraitUrl}" alt="${axie.name}" style="${portraitUrl ? '' : 'display: none;'}" />
          ${!portraitUrl ? `<span style="font-size: 0.85rem;">🐾</span>` : ''}
        `;

        heroPortraits.appendChild(miniEl);
      });
    }

    // Render Recent Combat History list
    const logsList = document.getElementById('battle-recent-logs-list');
    if (logsList) {
      logsList.innerHTML = '';
      const recent3 = this.battleLogsList.slice(0, 3);

      recent3.forEach((log) => {
        const row = document.createElement('div');
        row.className = 'recent-log-card';

        row.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.2rem;">
            <span class="log-mode-name">⚔️ ${log.mode} vs <strong>${log.opponent}</strong></span>
            <span class="log-meta-sub">${log.time}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="log-tag ${log.isWin ? 'win' : 'loss'}">${log.result}</span>
            <button class="btn btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.72rem; border-color: var(--accent-cyan); color: var(--accent-cyan);" title="Watch Battle Replay">🎬 Replay</button>
          </div>
        `;

        const btnReplay = row.querySelector('button');
        btnReplay?.addEventListener('click', () => {
          alert(`🎬 Loading Replay against ${log.opponent} in Lunacia Arena...`);
        });

        logsList.appendChild(row);
      });
    }
  }

  /* ==========================================================================
     TAB 4: FRIENDS & GUILD COMMAND
     ========================================================================== */
  private setupFriendsTab() {
    const filterBtns = document.querySelectorAll('.friends-filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.friendsFilter = (btn as HTMLElement).dataset.filter || 'all';
        this.renderFriendsList();
      });
    });

    const searchInput = document.getElementById('input-friends-search') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.renderFriendsList();
    });

    const btnOpenAddFriend = document.getElementById('btn-add-friend-modal');
    const modalAddFriend = document.getElementById('add-friend-modal');
    const btnCloseAddFriend = document.getElementById('btn-close-add-friend');
    const btnSubmitAddFriend = document.getElementById('btn-submit-add-friend');

    btnOpenAddFriend?.addEventListener('click', () => {
      if (modalAddFriend) modalAddFriend.style.display = 'flex';
    });

    btnCloseAddFriend?.addEventListener('click', () => {
      if (modalAddFriend) modalAddFriend.style.display = 'none';
    });

    btnSubmitAddFriend?.addEventListener('click', () => {
      const input = document.getElementById('input-new-friend-name') as HTMLInputElement;
      const name = input ? input.value.trim() : '';
      if (!name) {
        alert('Please enter a valid friend username or Ronin address.');
        return;
      }

      this.friendsList.unshift({
        id: `f-${Date.now()}`,
        name: name,
        status: 'Online',
        rank: 'Gold I (1,450 MMR)',
        trophies: '🏆 1,450',
        winRate: '54%',
        wins: 120,
        favoriteAxie: 'SMG Token',
      });

      if (input) input.value = '';
      if (modalAddFriend) modalAddFriend.style.display = 'none';
      this.renderFriendsList();
      alert(`🎉 Friend request sent to "${name}"!`);
    });
  }

  private renderFriendsList() {
    const container = document.getElementById('friends-list-container');
    const searchInput = document.getElementById('input-friends-search') as HTMLInputElement;
    if (!container) return;

    container.innerHTML = '';

    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let filtered = this.friendsList;

    if (this.friendsFilter !== 'all') {
      filtered = filtered.filter((f) => f.status.toLowerCase() === this.friendsFilter.toLowerCase());
    }

    if (searchTerm) {
      filtered = filtered.filter((f) => f.name.toLowerCase().includes(searchTerm));
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; grid-column: 1 / -1; text-align: center; padding: 2rem 0;">No friends found matching criteria.</div>';
      return;
    }

    filtered.forEach((friend) => {
      const card = document.createElement('div');
      card.className = 'friend-enhanced-card';

      const statusDotClass =
        friend.status === 'Online'
          ? 'status-online'
          : friend.status === 'In Battle'
          ? 'status-battle'
          : 'status-offline';

      card.innerHTML = `
        <div class="friend-card-top">
          <div class="friend-avatar-wrap">
            <span>🛡️</span>
            <span class="friend-status-dot ${statusDotClass}"></span>
          </div>

          <div class="friend-info-col">
            <span class="friend-name" title="${friend.name}">${friend.name}</span>
            <span class="friend-status-text">${friend.status} • ${friend.rank}</span>
          </div>
        </div>

        <div class="friend-stats-bar">
          <span style="color: var(--text-muted);">Win Rate: <strong style="color: var(--accent-cyan);">${friend.winRate}</strong></span>
          <span style="color: var(--text-muted);">Trophies: <strong style="color: var(--accent-gold);">${friend.trophies}</strong></span>
        </div>

        <div class="friend-actions-row">
          <button class="btn btn-sm btn-challenge-${friend.id}" style="flex: 1; border-color: var(--accent-cyan); color: var(--accent-cyan); font-weight: 700;">
            ⚔️ Duel (15v15)
          </button>
          ${
            friend.status === 'In Battle'
              ? `<button class="btn btn-sm btn-spectate-${friend.id}" style="border-color: var(--accent-gold); color: var(--accent-gold);">👀 Spectate</button>`
              : `<button class="btn btn-sm btn-msg-${friend.id}" style="border-color: var(--border-color); color: var(--text-secondary);">💬 Chat</button>`
          }
        </div>
      `;

      const btnDuel = card.querySelector(`.btn-challenge-${friend.id}`);
      btnDuel?.addEventListener('click', () => {
        alert(`⚔️ 15v15 Tactical Duel challenge sent to ${friend.name}! Waiting for their response...`);
      });

      const btnSpectate = card.querySelector(`.btn-spectate-${friend.id}`);
      btnSpectate?.addEventListener('click', () => {
        alert(`👀 Spectating ${friend.name}'s active 15v15 Arena match!`);
      });

      const btnMsg = card.querySelector(`.btn-msg-${friend.id}`);
      btnMsg?.addEventListener('click', () => {
        const msg = prompt(`Send direct message to ${friend.name}:`);
        if (msg) alert(`📨 Message sent to ${friend.name}: "${msg}"`);
      });

      container.appendChild(card);
    });
  }

  /* ==========================================================================
     TAB 5: GAME SETTINGS & PREFERENCES
     ========================================================================== */
  private setupSettingsTab() {
    // Sliders live readout & Audio Manager binding
    const bindSlider = (sliderId: string, badgeId: string, onUpdate?: (val: number) => void) => {
      const slider = document.getElementById(sliderId) as HTMLInputElement;
      const badge = document.getElementById(badgeId);
      slider?.addEventListener('input', () => {
        const num = parseInt(slider.value, 10);
        if (badge) badge.textContent = `${slider.value}%`;
        onUpdate?.(num);
      });
    };

    bindSlider('slider-audio-master', 'val-audio-master', (val) => {
      audioManager.setBgmVolume((val / 100) * 0.4);
      audioManager.setSfxVolume(val / 100);
    });
    bindSlider('slider-audio-bgm', 'val-audio-bgm', (val) => {
      audioManager.setBgmVolume(val / 100);
    });
    bindSlider('slider-audio-sfx', 'val-audio-sfx', (val) => {
      audioManager.setSfxVolume(val / 100);
      audioManager.playSkillSfx('aquatic_slash', 'attack');
    });

    // Resolution pill selector
    const resPills = document.querySelectorAll('#group-resolution .setting-pill');
    resPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        resPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
      });
    });

    // Battle speed selector
    const speedPills = document.querySelectorAll('#group-battle-speed .setting-pill');
    speedPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        speedPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
      });
    });

    // Save settings button
    const btnSave = document.getElementById('btn-save-settings');
    btnSave?.addEventListener('click', () => {
      alert('💾 Game settings, audio acoustics, and Spine 2D graphics preferences saved successfully!');
    });

    // Clear cache button
    const btnClearCache = document.getElementById('btn-clear-cache');
    btnClearCache?.addEventListener('click', () => {
      this.portraitCache.clear();
      alert('🧹 Asset texture and Spine 2D portrait cache cleared!');
    });

    // Reset data button
    const btnResetData = document.getElementById('btn-reset-data');
    btnResetData?.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all squads to default lineups?')) {
        localStorage.clear();
        this.teamManager = new TeamManager();
        this.renderTeamBuilder();
        this.renderBattleHub();
        alert('🔄 Squad lineups have been reset to initial factory presets.');
      }
    });
  }

  /* ==========================================================================
     PAGE 5: TACTICAL CELL-BASED BATTLE GROUND (4 ROWS X 8 COLS = 32 CELLS)
     ========================================================================== */
  private selectedCellId: string | null = null;
  private boardSpineEngines: Map<string, AxieMixerEngine> = new Map();
  private tacticalUnits: TacticalAxieUnit[] = [];
  private isTacticalBattleRunning: boolean = false;
  private currentTacticalRound: number = 1;

  // Calibrated Grid Perspective Geometry for Grounded 8x8 Arena (8 Rows x 8 Columns = 64 Cells)
  private readonly ARENA_GRID_Y_LINES = [
    180, // Row 0 top
    214, // Row 1 top / Row 0 bot
    250, // Row 2 top / Row 1 bot
    288, // Row 3 top / Row 2 bot
    328, // Row 4 top / Row 3 bot
    370, // Row 5 top / Row 4 bot
    414, // Row 6 top / Row 5 bot
    460, // Row 7 top / Row 6 bot
    508  // Row 7 bot
  ];

  private readonly ARENA_GRID_V_LINES = [
    { top: 245, bottom: 110 },  // Col 0 left
    { top: 314, bottom: 211 },  // Col 1 left / Col 0 right
    { top: 383, bottom: 312 },  // Col 2 left / Col 1 right (End Red Zone)
    { top: 451, bottom: 412 },  // Col 3 left / Col 2 right
    { top: 520, bottom: 513 },  // Col 4 left / Col 3 right (Center line)
    { top: 589, bottom: 613 },  // Col 5 left / Col 4 right
    { top: 657, bottom: 714 },  // Col 6 left / Col 5 right (Start Blue Zone)
    { top: 726, bottom: 814 },  // Col 7 left / Col 6 right
    { top: 795, bottom: 915 }   // Col 7 right
  ];

  // 8 Tactical Demo Axies starting from ID 300 on 8x8 Grid
  private readonly BOARD_AXIES_LINEUP = [
    // --- RED TEAM (4 AXIES) ---
    {
      id: '300',
      name: 'Axie #300',
      class: 'Plant',
      team: 'red' as const,
      row: 2, // Row 3
      col: 1, // Col 2 (Frontline Red)
      genes: '0x180000000000030001c08050410800000003000c104081040001000008404402000200800800c0040001000810a08002000100041060c0060001000c18a0c206'
    },
    {
      id: '301',
      name: 'Axie #301',
      class: 'Plant',
      team: 'red' as const,
      row: 5, // Row 6
      col: 1, // Col 2 (Frontline Red)
      genes: '0x180000000000030003810020c400000000000084080045040001001410404502000100041840c5020001000c18a044040001000c0860c5040001000808a0c406'
    },
    {
      id: '302',
      name: 'Axie #302',
      class: 'Bird',
      team: 'red' as const,
      row: 1, // Row 2
      col: 0, // Col 1 (Top Backline Red)
      genes: '0x100000000000030001014051020800000001000810204204000100001040840400010008108080040001000408604406000100041020c5060001000818604006'
    },
    {
      id: '306',
      name: 'Axie #306',
      class: 'Beast',
      team: 'red' as const,
      row: 6, // Row 7
      col: 0, // Col 1 (Bottom Backline Red)
      genes: '0x30000010001000c0000000100001000820400010004104080020001000008a0c302000100001020c2040001000c08a043060001000410208006'
    },

    // --- BLUE TEAM (4 AXIES) ---
    {
      id: '303',
      name: 'Axie #303',
      class: 'Aquatic',
      team: 'blue' as const,
      row: 2, // Row 3
      col: 6, // Col 7 (Frontline Blue)
      genes: '0x200000000000030001804050c210000000030010108045040001001410a080020003001008804204000300101880830200030004182045020003001018804506'
    },
    {
      id: '304',
      name: 'Axie #304',
      class: 'Reptile',
      team: 'blue' as const,
      row: 5, // Row 6
      col: 6, // Col 7 (Frontline Blue)
      genes: '0x200000000000030001408080020c000000010014084040040001001008004202000100101020c302000000880860840600010010080083040001000010008302'
    },
    {
      id: '305',
      name: 'Axie #305',
      class: 'Beast',
      team: 'blue' as const,
      row: 1, // Row 2
      col: 7, // Col 8 (Top Backline Blue)
      genes: '0x30000010001000c0000000100001000820400010004104080020001000008a0c302000100001020c2040001000c08a043060001000410208006'
    },
    {
      id: '307',
      name: 'Axie #307',
      class: 'Aquatic',
      team: 'blue' as const,
      row: 6, // Row 7
      col: 7, // Col 8 (Bottom Backline Blue)
      genes: '0x200000000000030001408080020c000000010014084040040001001008004202000100101020c302000000880860840600010010080083040001000010008302'
    }
  ];

  private setupTrainingGround() {
    const btnExit = document.getElementById('btn-exit-training-ground');
    btnExit?.addEventListener('click', () => {
      this.isTacticalBattleRunning = false;
      audioManager.playUiClick();
      this.showPageView('dashboard');
      const tabBattle = document.getElementById('tab-btn-battle');
      tabBattle?.click();
    });

    const btnStart = document.getElementById('btn-start-tactical-battle');
    btnStart?.addEventListener('click', () => {
      audioManager.playUiClick();
      if (this.isTacticalBattleRunning) {
        this.isTacticalBattleRunning = false;
        if (btnStart) {
          btnStart.textContent = '⚔️ RESUME';
          btnStart.classList.remove('is-fighting');
        }
      } else {
        this.startTacticalBattle();
      }
    });

    const btnReset = document.getElementById('btn-reset-tactical-battle');
    btnReset?.addEventListener('click', () => {
      audioManager.playUiClick();
      this.resetTacticalBattle();
    });

    const aspectBox = document.querySelector('.arena-board-aspect-box');
    this.arenaVfxCanvas = document.getElementById('arena-vfx-canvas') as HTMLCanvasElement;
    if (this.arenaVfxCanvas && aspectBox) {
      this.arenaVfxCtx = this.arenaVfxCanvas.getContext('2d') || undefined;
      this.resizeArenaVfxCanvas();
      window.addEventListener('resize', () => this.resizeArenaVfxCanvas());
    }

    this.renderTacticalBattleGrid();
    this.renderBoardSpineAxies();
  }

  private resizeArenaVfxCanvas() {
    const aspectBox = document.querySelector('.arena-board-aspect-box');
    if (this.arenaVfxCanvas && aspectBox) {
      this.arenaVfxCanvas.width = aspectBox.clientWidth;
      this.arenaVfxCanvas.height = aspectBox.clientHeight;
    }
  }

  public openTrainingGround() {
    this.showPageView('training-ground');
    this.renderTacticalBattleGrid();
    this.renderBoardSpineAxies();
    this.resizeArenaVfxCanvas();
  }

  private getGridCellCenter(row: number, col: number): { cx: number; cy: number; leftPct: number; topPct: number } {
    const yLines = this.ARENA_GRID_Y_LINES;
    const vLines = this.ARENA_GRID_V_LINES;
    const topY0 = yLines[0];
    const botY8 = yLines[8];

    const yTop = yLines[row];
    const yBot = yLines[row + 1];

    // Ground perspective center inside the cell quad (58% down towards wider bottom edge)
    const cy = yTop + (yBot - yTop) * 0.58;
    const t = (cy - topY0) / (botY8 - topY0);

    const xLeft = vLines[col].top + (vLines[col].bottom - vLines[col].top) * t;
    const xRight = vLines[col + 1].top + (vLines[col + 1].bottom - vLines[col + 1].top) * t;
    const cx = (xLeft + xRight) / 2;

    const leftPct = (cx / 1024) * 100;
    const topPct = (cy / 576) * 100;

    return { cx, cy, leftPct, topPct };
  }

  private renderTacticalBattleGrid() {
    const cellsGroup = document.getElementById('arena-cells-group');
    const readout = document.getElementById('arena-hover-cell-readout');

    if (!cellsGroup) return;

    cellsGroup.innerHTML = '';

    const yLines = this.ARENA_GRID_Y_LINES;
    const vLines = this.ARENA_GRID_V_LINES;
    const topY0 = yLines[0];
    const botY8 = yLines[8];

    // Build 9x9 vertex matrix (8 rows x 8 columns)
    const gridVertices: Array<Array<{ x: number; y: number }>> = [];

    for (let r = 0; r < yLines.length; r++) {
      const y = yLines[r];
      const t = (y - topY0) / (botY8 - topY0);
      const row: Array<{ x: number; y: number }> = [];

      for (let c = 0; c < vLines.length; c++) {
        const x = vLines[c].top + (vLines[c].bottom - vLines[c].top) * t;
        row.push({ x, y });
      }
      gridVertices.push(row);
    }

    // Generate 64 Cells (8 Rows x 8 Columns) without text labels
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cellId = `R${r + 1}-C${c + 1}`;
        const p0 = gridVertices[r][c];
        const p1 = gridVertices[r][c + 1];
        const p2 = gridVertices[r + 1][c + 1];
        const p3 = gridVertices[r + 1][c];

        // Determine Zone in 8x8 Grid:
        // Leftmost 16 cells (Cols 0 & 1 -> c < 2): Red Zone
        // Rightmost 16 cells (Cols 6 & 7 -> c >= 6): Blue Zone
        // Center 32 cells (Cols 2..5): Neutral Zone
        const isRedZone = c < 2;
        const isBlueZone = c >= 6;
        const zoneClass = isRedZone ? 'cell-red' : isBlueZone ? 'cell-blue' : 'cell-neutral';
        const zoneName = isRedZone ? 'Red Placement Zone' : isBlueZone ? 'Blue Placement Zone' : 'Combat Movement Arena';
        const zoneEmoji = isRedZone ? '🔴' : isBlueZone ? '🔵' : '⚔️';

        // Polygon element
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const pointsStr = `${p0.x.toFixed(1)},${p0.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p3.x.toFixed(1)},${p3.y.toFixed(1)}`;
        polygon.setAttribute('points', pointsStr);
        polygon.setAttribute('class', `arena-cell-polygon ${zoneClass}`);
        polygon.setAttribute('data-cell-id', cellId);
        polygon.setAttribute('data-zone', isRedZone ? 'red' : isBlueZone ? 'blue' : 'neutral');
        polygon.setAttribute('data-row', String(r + 1));
        polygon.setAttribute('data-col', String(c + 1));

        // Hover events
        polygon.addEventListener('mouseenter', () => {
          if (readout && !this.isTacticalBattleRunning) {
            readout.textContent = `${zoneEmoji} ${zoneName}: [${cellId}]`;
          }
        });

        polygon.addEventListener('mouseleave', () => {
          if (readout && !this.isTacticalBattleRunning) {
            if (this.selectedCellId) {
              const selectedEl = document.querySelector(`[data-cell-id="${this.selectedCellId}"]`);
              const selZone = selectedEl?.getAttribute('data-zone');
              const selEmoji = selZone === 'red' ? '🔴' : selZone === 'blue' ? '🔵' : '⚔️';
              readout.textContent = `Selected: ${selEmoji} [${this.selectedCellId}]`;
            } else {
              readout.textContent = 'Click START BATTLE to begin!';
            }
          }
        });

        // Click selection
        polygon.addEventListener('click', () => {
          if (this.isTacticalBattleRunning) return;
          document.querySelectorAll('.arena-cell-polygon').forEach((el) => el.classList.remove('is-selected'));
          if (this.selectedCellId === cellId) {
            this.selectedCellId = null;
            if (readout) readout.textContent = 'Click START BATTLE to begin!';
          } else {
            this.selectedCellId = cellId;
            polygon.classList.add('is-selected');
            if (readout) {
              readout.textContent = `Selected: ${zoneEmoji} [${cellId}] (${zoneName})`;
            }
          }
        });

        cellsGroup.appendChild(polygon);
      }
    }
  }

  private async renderBoardSpineAxies() {
    // Clean up previous Spine engines
    this.boardSpineEngines.forEach((engine) => {
      try {
        engine.destroy();
      } catch {}
    });
    this.boardSpineEngines.clear();
    this.tacticalUnits = [];

    const unitsContainer = document.getElementById('arena-units-container');
    const readout = document.getElementById('arena-hover-cell-readout');
    if (!unitsContainer) return;

    unitsContainer.innerHTML = '';

    // Load Card Database if not loaded
    await loadCardAbilitiesDatabase();

    // Render 8 Demo Axies
    this.BOARD_AXIES_LINEUP.forEach((axie) => {
      const { leftPct, topPct } = this.getGridCellCenter(axie.row, axie.col);
      const isRed = axie.team === 'red';
      const cellId = `R${axie.row + 1}-C${axie.col + 1}`;

      // Calculate HP Stat: HP value = HP stat of axie * 300
      const stats = calculateAxieClassicStats(axie.genes);
      const maxHp = stats.hp * 300;
      const currentHp = maxHp;
      const currentShield = 0;

      // Extract Cards from Body Structure
      const bodyStructure = getAxieBodyStructure512(axie.genes);
      let cards = getAxieCardsFromStructure(bodyStructure);

      // Fallback cards if none decoded
      if (!cards || cards.length === 0) {
        cards = [
          {
            id: `${axie.class.toLowerCase()}-mouth-01`,
            partName: 'Mouth',
            skillName: `${axie.class} Strike`,
            defaultAttack: 100,
            defaultDefense: 40,
            defaultEnergy: 1,
            expectType: 'melee',
            iconId: 'strike',
            triggerColor: '#ff5252',
            triggerText: 'Attack',
            description: 'Deals melee damage',
            imageUrl: '',
            partType: 1 as any
          },
          {
            id: `${axie.class.toLowerCase()}-horn-01`,
            partName: 'Horn',
            skillName: `${axie.class} Beam`,
            defaultAttack: 110,
            defaultDefense: 30,
            defaultEnergy: 1,
            expectType: 'ranged',
            iconId: 'beam',
            triggerColor: '#38bdf8',
            triggerText: 'Ranged',
            description: 'Deals ranged damage up to 3 cells',
            imageUrl: '',
            partType: 3 as any
          },
          {
            id: `${axie.class.toLowerCase()}-back-01`,
            partName: 'Back',
            skillName: `${axie.class} Shield Guard`,
            defaultAttack: 0,
            defaultDefense: 110,
            defaultEnergy: 1,
            expectType: 'melee',
            iconId: 'shield',
            triggerColor: '#00e5ff',
            triggerText: 'Defense',
            description: 'Grants high armor shield',
            imageUrl: '',
            partType: 4 as any
          }
        ];
      }

      const unitEl = document.createElement('div');
      unitEl.className = `arena-board-axie team-${axie.team}`;
      unitEl.style.left = `${leftPct.toFixed(2)}%`;
      unitEl.style.top = `${topPct.toFixed(2)}%`;
      unitEl.style.zIndex = `${15 + axie.row * 10}`;

      unitEl.innerHTML = `
        <div class="board-axie-hud">
          <div class="board-axie-bars-row">
            <div class="board-axie-hp-bar">
              <div class="board-axie-hp-fill ${isRed ? 'red-hp' : 'blue-hp'}" style="width: 100%;"></div>
            </div>
            <div class="board-axie-shield-bar" style="display: none;">
              <div class="board-axie-shield-fill" style="width: 0%;"></div>
            </div>
          </div>
        </div>
        <canvas class="board-axie-canvas" width="180" height="150"></canvas>
      `;

      unitEl.addEventListener('mouseenter', () => {
        if (readout && !this.isTacticalBattleRunning) {
          readout.textContent = `${isRed ? '🔴 Red Team' : '🔵 Blue Team'} Unit #${axie.id} (${axie.class}) | HP: ${maxHp.toLocaleString()} | Spd: ${stats.speed} at [${cellId}]`;
        }
      });

      unitEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isTacticalBattleRunning) return;
        document.querySelectorAll('.arena-board-axie').forEach((el) => el.classList.remove('is-selected'));
        unitEl.classList.add('is-selected');
        if (readout) {
          const priority = this.getAggressionPriorityTargets(axie.class).join(', ');
          readout.textContent = `🎯 Selected #${axie.id} (${axie.class}) | Target Priority: [${priority}] | Cards: ${cards.map(c => c.skillName).join(', ')}`;
        }
      });

      unitsContainer.appendChild(unitEl);

      // Initialize 2D Spine Engine
      const canvas = unitEl.querySelector('canvas') as HTMLCanvasElement;
      let spineEngine: AxieMixerEngine | undefined;
      if (canvas && axie.genes) {
        const zoomScale = 0.080 + axie.row * 0.003;

        spineEngine = new AxieMixerEngine(canvas, {
          backgroundAlpha: 0,
          zoomScale: zoomScale,
          spineOriginY: 96,
          isFlipped: isRed, // Red faces right (flipped), Blue faces left
          defaultAnimation: 'action/idle/normal',
          autoResize: false,
        });

        this.boardSpineEngines.set(`axie-${axie.id}`, spineEngine);

        spineEngine.loadAxieFromGenes(axie.genes).catch((err) => {
          console.warn(`Failed to render Spine for Axie #${axie.id}:`, err);
        });
      }

      // Add to tactical units list
      this.tacticalUnits.push({
        id: axie.id,
        name: axie.name,
        class: axie.class,
        team: axie.team,
        initialRow: axie.row,
        initialCol: axie.col,
        row: axie.row,
        col: axie.col,
        hpStat: stats.hp,
        speed: stats.speed,
        morale: stats.morale,
        maxHp: maxHp,
        currentHp: currentHp,
        currentShield: currentShield,
        genes: axie.genes,
        cards: cards,
        cardIndex: 0,
        lockedTargetId: null,
        isActing: false,
        nextActionTime: 0,
        spineEngine: spineEngine,
        domElement: unitEl,
        isDefeated: false,
      });
    });
  }

  /* ==========================================================================
     INDEPENDENT AUTO-CHESS COMBAT ENGINE
     ========================================================================== */

  /**
   * Aggression Settings:
   * 1. Bird, Aqua, Dawn prioritize Bug, Mech, and Beast as targets
   * 2. Bug, Mech, and Beast prioritize Dusk, Plant, and Reptile as targets
   * 3. Dusk, Plant, and Reptile prioritize Bird, Dawn, and Aqua as targets
   */
  private getAggressionPriorityTargets(attackerClass: string): string[] {
    const c = attackerClass.toLowerCase();
    if (c === 'bird' || c === 'aquatic' || c === 'aqua' || c === 'dawn') {
      return ['Bug', 'Mech', 'Beast'];
    }
    if (c === 'bug' || c === 'mech' || c === 'beast') {
      return ['Dusk', 'Plant', 'Reptile'];
    }
    if (c === 'dusk' || c === 'plant' || c === 'reptile') {
      return ['Bird', 'Dawn', 'Aquatic'];
    }
    return [];
  }

  /**
   * Selects target based on Aggression Settings and grid proximity
   */
  private selectTacticalTarget(attacker: TacticalAxieUnit): TacticalAxieUnit | null {
    const aliveEnemies = this.tacticalUnits.filter(
      (u: TacticalAxieUnit) => u.team !== attacker.team && !u.isDefeated && u.currentHp > 0
    );
    if (aliveEnemies.length === 0) return null;

    const priorityClasses = this.getAggressionPriorityTargets(attacker.class).map((s) => s.toLowerCase());
    const priorityEnemies = aliveEnemies.filter((u: TacticalAxieUnit) => priorityClasses.includes(u.class.toLowerCase()));

    const candidatePool = priorityEnemies.length > 0 ? priorityEnemies : aliveEnemies;

    let bestTarget: TacticalAxieUnit | null = null;
    let bestDist = Infinity;

    for (const candidate of candidatePool) {
      const dist = Math.abs(attacker.row - candidate.row) + Math.abs(attacker.col - candidate.col);
      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = candidate;
      }
    }

    return bestTarget;
  }

  /**
   * Target Locking: Keeps attacking/chasing current target until it dies
   */
  private getOrAcquireLockedTarget(attacker: TacticalAxieUnit): TacticalAxieUnit | null {
    if (attacker.lockedTargetId) {
      const existing = this.tacticalUnits.find(
        (u) => u.id === attacker.lockedTargetId && u.team !== attacker.team && !u.isDefeated && u.currentHp > 0
      );
      if (existing) {
        return existing;
      }
      // Target died! Clear lock
      attacker.lockedTargetId = null;
    }

    const newTarget = this.selectTacticalTarget(attacker);
    if (newTarget) {
      attacker.lockedTargetId = newTarget.id;
    }
    return newTarget;
  }

  /**
   * Checks if an attacker can attack a target with a given card
   * - Melee attack: MUST be side-by-side on the SAME ROW (row == target.row and |col - target.col| == 1)
   * - Ranged attack: can attack up to 3 cells away
   */
  private isCardInRange(
    attacker: TacticalAxieUnit,
    target: TacticalAxieUnit,
    card: AxieCardAbility
  ): boolean {
    const isRanged = card.expectType === 'ranged';
    if (isRanged) {
      // Ranged can hit up to 3 cells away
      const dRow = Math.abs(attacker.row - target.row);
      const dCol = Math.abs(attacker.col - target.col);
      return dRow <= 1 && dCol <= 3;
    } else {
      // Melee MUST be side-by-side on the same row!
      return attacker.row === target.row && Math.abs(attacker.col - target.col) === 1;
    }
  }

  /**
   * Calculates the best next step cell towards target
   */
  private calculateNextStep(
    unit: TacticalAxieUnit,
    target: TacticalAxieUnit,
    reservedCells: Set<string>
  ): { r: number; c: number } | null {
    const dRow = target.row - unit.row;
    const dCol = target.col - unit.col;

    const candidateSteps: Array<{ r: number; c: number }> = [];

    // If on different rows, prioritize shifting row to align with target for melee
    if (dRow !== 0) {
      candidateSteps.push({ r: unit.row + Math.sign(dRow), c: unit.col });
    }

    // Move horizontally towards target
    if (dCol !== 0) {
      // If moving horizontally, ensure not stepping onto target's cell
      const nextCol = unit.col + Math.sign(dCol);
      if (!(unit.row === target.row && nextCol === target.col)) {
        candidateSteps.push({ r: unit.row, c: nextCol });
      }
    }

    // Check occupied or reserved cells in 8x8 grid
    for (const step of candidateSteps) {
      if (
        step.r >= 0 &&
        step.r < 8 &&
        step.c >= 0 &&
        step.c < 8 &&
        !reservedCells.has(`${step.r}-${step.c}`)
      ) {
        return step;
      }
    }

    return null;
  }

  /**
   * Executes continuous independent running animation to next cell
   */
  private async executeUnitRun(
    unit: TacticalAxieUnit,
    stepTarget: { r: number; c: number }
  ): Promise<void> {
    const dCol = stepTarget.c - unit.col;

    // Apply new coordinates
    unit.row = stepTarget.r;
    unit.col = stepTarget.c;

    // Face movement direction if moving horizontally
    if (dCol > 0) {
      unit.spineEngine?.setFlipped(true); // Face right
    } else if (dCol < 0) {
      unit.spineEngine?.setFlipped(false); // Face left
    }

    // 2D Spine running animation
    unit.spineEngine?.setAnimation('action/run', true);
    unit.domElement?.classList.add('is-running');

    if (unit.domElement) {
      const { leftPct, topPct } = this.getGridCellCenter(unit.row, unit.col);
      unit.domElement.style.left = `${leftPct.toFixed(2)}%`;
      unit.domElement.style.top = `${topPct.toFixed(2)}%`;
      unit.domElement.style.zIndex = `${15 + unit.row * 10}`;
    }

    await this.sleep(550);

    unit.domElement?.classList.remove('is-running');

    // Re-face default enemy side
    const isRed = unit.team === 'red';
    unit.spineEngine?.setFlipped(isRed);
    unit.spineEngine?.setAnimation('action/idle/normal', true);
  }

  /**
   * Executes defense card action: adds armor and plays defense animation
   */
  private async executeUnitDefense(
    unit: TacticalAxieUnit,
    card: AxieCardAbility
  ): Promise<void> {
    unit.domElement?.classList.add('is-defending');
    this.showFloatingCardBadge(unit, card);

    const armorGain = Math.round((card.defaultDefense || 50) * 16);
    unit.currentShield += armorGain;

    unit.spineEngine?.setAnimation('battle/get-buff', false);
    this.showFloatingShield(unit, armorGain);
    this.updateUnitHud(unit);

    // Play Origins Shield SFX & Additive Shield VFX
    audioManager.playBuffSfx('shield');
    if (this.arenaVfxCanvas && this.arenaVfxCtx) {
      try {
        const center = this.getGridCellCenter(unit.row, unit.col);
        const w = this.arenaVfxCanvas.width;
        const h = this.arenaVfxCanvas.height;
        const posX = (center.leftPct / 100) * w;
        const posY = (center.topPct / 100) * h;
        const clip = await loadClip('shield');
        const atlas = await AdditiveAtlas.load(clip);
        playOnCanvas(
          atlas,
          this.arenaVfxCtx,
          () => ({ attacker: { x: posX, y: posY }, defender: { x: posX, y: posY }, fieldWidth: w }),
          { loop: false, playAudio: false }
        );
      } catch {}
    }

    const readout = document.getElementById('arena-hover-cell-readout');
    if (readout) {
      readout.textContent = `${unit.team === 'red' ? '🔴' : '🔵'} #${unit.id} (${unit.class}) activated [${card.skillName}] gaining 🛡️ +${armorGain.toLocaleString()} Armor!`;
    }

    await this.sleep(400);
    unit.domElement?.classList.remove('is-defending');

    if (!unit.isDefeated) {
      unit.spineEngine?.setAnimation('action/idle/normal', true);
    }
  }

  /**
   * Executes attack card action (Melee lunge or Ranged projectile)
   * Applies damage to target shield first, then target HP
   */
  private async executeUnitAttack(
    attacker: TacticalAxieUnit,
    target: TacticalAxieUnit,
    card: AxieCardAbility
  ): Promise<void> {
    attacker.domElement?.classList.add('is-attacking');
    this.showFloatingCardBadge(attacker, card);

    const isRanged = card.expectType === 'ranged';
    const isRed = attacker.team === 'red';

    // Official Origins Card-to-VFX mapping
    const vfxMapping = getVfxForAbility(card.id);
    const vfxId = vfxMapping
      ? vfxMapping.vfxId
      : (isRanged ? `${attacker.class.toLowerCase()}_projectile` : `${attacker.class.toLowerCase()}_slash`);

    if (vfxMapping && vfxMapping.attackAnimation) {
      attacker.spineEngine?.setAnimation(vfxMapping.attackAnimation, false);
    } else if (isRanged) {
      attacker.spineEngine?.setAnimation('attack/ranged/cast-fly', false);
    } else {
      attacker.spineEngine?.setAnimation('attack/melee/horn-gore', false);
    }

    if (!isRanged) {
      attacker.domElement?.classList.add(isRed ? 'is-lunge-right' : 'is-lunge-left');
      setTimeout(() => {
        attacker.domElement?.classList.remove('is-lunge-right', 'is-lunge-left');
      }, 300);
    } else {
      this.spawnRangedProjectile(attacker, target);
    }

    // Play Origins Attack SFX
    audioManager.playSkillSfx(vfxId, 'attack');

    // Trigger Origins Additive VFX on battlefield overlay
    if (this.arenaVfxCanvas && this.arenaVfxCtx) {
      try {
        const start = this.getGridCellCenter(attacker.row, attacker.col);
        const end = this.getGridCellCenter(target.row, target.col);
        const w = this.arenaVfxCanvas.width;
        const h = this.arenaVfxCanvas.height;
        const atkPos = { x: (start.leftPct / 100) * w, y: (start.topPct / 100) * h };
        const defPos = { x: (end.leftPct / 100) * w, y: (end.topPct / 100) * h };

        const clip = await loadClip(vfxId);
        const atlas = await AdditiveAtlas.load(clip);
        playOnCanvas(
          atlas,
          this.arenaVfxCtx,
          () => ({ attacker: atkPos, defender: defPos, fieldWidth: w }),
          {
            loop: false,
            playAudio: false,
            onEvent: (evt) => {
              if (evt.function === 'OnThrow') {
                audioManager.playSkillSfx(vfxId, 'fly');
              } else if (evt.function === 'OnHit') {
                audioManager.playSkillSfx(vfxId, 'hit');
                if (vfxMapping && vfxMapping.hitAnimation) {
                  target.spineEngine?.setAnimation(vfxMapping.hitAnimation, false);
                }
              }
            },
          }
        );
      } catch (e) {
        setTimeout(() => audioManager.playSkillSfx(vfxId, 'hit'), 320);
      }
    } else {
      setTimeout(() => audioManager.playSkillSfx(vfxId, 'hit'), 320);
    }

    await this.sleep(340);

    // Calculate Damage
    const priorityClasses = this.getAggressionPriorityTargets(attacker.class).map((s) => s.toLowerCase());
    const hasClassAdvantage = priorityClasses.includes(target.class.toLowerCase());
    const advantageMultiplier = hasClassAdvantage ? 1.15 : 1.0;

    const baseDmg = Math.round((card.defaultAttack || 100) * 18 * advantageMultiplier);
    const isCrit = Math.random() < attacker.morale / 180;
    const finalDmg = Math.round(isCrit ? baseDmg * 1.5 : baseDmg);

    // Damage Absorption: Shield first, then HP
    let remainingDamage = finalDmg;
    let absorbedShield = 0;
    if (target.currentShield > 0) {
      if (target.currentShield >= remainingDamage) {
        target.currentShield -= remainingDamage;
        absorbedShield = remainingDamage;
        remainingDamage = 0;
      } else {
        absorbedShield = target.currentShield;
        remainingDamage -= target.currentShield;
        target.currentShield = 0;
      }
    }

    target.currentHp = Math.max(0, target.currentHp - remainingDamage);
    if (!vfxMapping || !vfxMapping.hitAnimation) {
      target.spineEngine?.setAnimation('defense/hit-by-normal', false);
    }
    target.domElement?.classList.add('is-hit');
    setTimeout(() => target.domElement?.classList.remove('is-hit'), 350);

    // Floating Numbers
    if (absorbedShield > 0) {
      this.showFloatingDamage(target, absorbedShield, false, false, true);
    }
    if (remainingDamage > 0) {
      this.showFloatingDamage(target, remainingDamage, isCrit, hasClassAdvantage, false);
    }

    // If card also provides Defense (e.g. Carrot Hammer), give armor to attacker
    if ((card.defaultDefense || 0) > 0) {
      const bonusArmor = Math.round(card.defaultDefense * 10);
      attacker.currentShield += bonusArmor;
      this.showFloatingShield(attacker, bonusArmor);
      this.updateUnitHud(attacker);
    }

    this.updateUnitHud(target);

    // Update Readout Ticker
    const readout = document.getElementById('arena-hover-cell-readout');
    if (readout) {
      const advText = hasClassAdvantage ? ' 🔥 +15% CLASS ADVANTAGE!' : '';
      const shieldText = absorbedShield > 0 ? ` (🛡️ ${absorbedShield.toLocaleString()} Armor Absorbed)` : '';
      readout.textContent = `${attacker.team === 'red' ? '🔴' : '🔵'} #${attacker.id} (${attacker.class}) used [${card.skillName}] on ${target.team === 'red' ? '🔴' : '🔵'} #${target.id} for ${finalDmg.toLocaleString()} DMG!${shieldText}${advText}`;
    }

    await this.sleep(380);
    attacker.domElement?.classList.remove('is-attacking');

    if (!attacker.isDefeated) {
      attacker.spineEngine?.setAnimation('action/idle/normal', true);
    }

    if (target.currentHp <= 0) {
      target.isDefeated = true;
      target.domElement?.classList.add('is-defeated');
    } else {
      target.spineEngine?.setAnimation('action/idle/normal', true);
    }
  }

  /**
   * Process a single unit's independent action (Auto-Chess Tick)
   */
  private async processUnitAutoChessAction(unit: TacticalAxieUnit): Promise<void> {
    if (unit.isDefeated || unit.currentHp <= 0 || unit.isActing) return;

    unit.isActing = true;

    try {
      // 1. Maintain or Acquire Locked Target
      const target = this.getOrAcquireLockedTarget(unit);
      if (!target) {
        unit.isActing = false;
        unit.nextActionTime = Date.now() + 500;
        return;
      }

      // 2. Cycle Card Sequentially 1 by 1 (no repetition at the same time)
      const currentCard = unit.cards[unit.cardIndex % unit.cards.length];
      unit.cardIndex = (unit.cardIndex + 1) % unit.cards.length;

      const isDefenseCard =
        (currentCard.defaultDefense || 0) > (currentCard.defaultAttack || 0) ||
        (currentCard.defaultAttack || 0) === 0;

      if (isDefenseCard) {
        // Execute Defense / Armor action
        await this.executeUnitDefense(unit, currentCard);
        unit.nextActionTime = Date.now() + Math.max(650, 1350 - unit.speed * 10);
      } else {
        // Attack Card Action
        if (this.isCardInRange(unit, target, currentCard)) {
          await this.executeUnitAttack(unit, target, currentCard);
          unit.nextActionTime = Date.now() + Math.max(700, 1400 - unit.speed * 10);
        } else {
          // Not in range: step towards locked target
          const reservedCells = new Set<string>(
            this.tacticalUnits
              .filter((u) => !u.isDefeated && u.currentHp > 0)
              .map((u) => `${u.row}-${u.col}`)
          );

          const stepTarget = this.calculateNextStep(unit, target, reservedCells);
          if (stepTarget) {
            await this.executeUnitRun(unit, stepTarget);
            unit.nextActionTime = Date.now() + Math.max(450, 850 - unit.speed * 6);
          } else {
            // Path blocked or crowded
            unit.nextActionTime = Date.now() + 300;
          }
        }
      }
    } finally {
      unit.isActing = false;
    }
  }

  private updateUnitHud(unit: TacticalAxieUnit) {
    if (!unit.domElement) return;

    const hpFill = unit.domElement.querySelector('.board-axie-hp-fill') as HTMLElement;
    if (hpFill) {
      const pct = Math.max(0, Math.min(100, (unit.currentHp / unit.maxHp) * 100));
      hpFill.style.width = `${pct.toFixed(1)}%`;
    }

    const shieldBar = unit.domElement.querySelector('.board-axie-shield-bar') as HTMLElement;
    const shieldFill = unit.domElement.querySelector('.board-axie-shield-fill') as HTMLElement;
    if (shieldBar && shieldFill) {
      if (unit.currentShield > 0) {
        shieldBar.style.display = 'block';
        const shieldPct = Math.min(100, (unit.currentShield / (unit.maxHp * 0.5)) * 100);
        shieldFill.style.width = `${Math.max(15, shieldPct).toFixed(1)}%`;
      } else {
        shieldBar.style.display = 'none';
      }
    }
  }

  private showFloatingDamage(
    unit: TacticalAxieUnit,
    dmg: number,
    isCrit: boolean,
    hasAdvantage: boolean,
    isShieldAbsorb: boolean = false
  ) {
    if (!unit.domElement) return;
    const el = document.createElement('div');
    if (isShieldAbsorb) {
      el.className = 'floating-shield-text';
      el.textContent = `🛡️ -${dmg.toLocaleString()} ARMOR`;
    } else {
      el.className = `floating-dmg-text ${isCrit ? 'crit' : ''}`;
      el.textContent = `${isCrit ? '💥 ' : ''}-${dmg.toLocaleString()}${hasAdvantage ? ' (+15%)' : ''}`;
    }
    unit.domElement.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  private showFloatingShield(unit: TacticalAxieUnit, armor: number) {
    if (!unit.domElement) return;
    const el = document.createElement('div');
    el.className = 'floating-shield-text';
    el.textContent = `🛡️ +${armor.toLocaleString()} ARMOR`;
    unit.domElement.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  private showFloatingCardBadge(unit: TacticalAxieUnit, card: AxieCardAbility) {
    if (!unit.domElement) return;
    const el = document.createElement('div');
    el.className = 'floating-card-action';
    const isDef = (card.defaultDefense || 0) > (card.defaultAttack || 0) || (card.defaultAttack || 0) === 0;
    const typeIcon = isDef ? '🛡️ Defense' : card.expectType === 'ranged' ? '🏹 3-Cell' : '⚔️ 1-Cell Melee';
    el.textContent = `🃏 ${card.skillName} (${typeIcon})`;
    unit.domElement.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  private spawnRangedProjectile(attacker: TacticalAxieUnit, target: TacticalAxieUnit) {
    const aspectBox = document.querySelector('.arena-board-aspect-box');
    if (!aspectBox) return;

    const start = this.getGridCellCenter(attacker.row, attacker.col);
    const end = this.getGridCellCenter(target.row, target.col);

    const proj = document.createElement('div');
    proj.className = `ranged-projectile ${attacker.team === 'red' ? 'red-proj' : 'blue-proj'}`;
    proj.style.left = `${start.leftPct}%`;
    proj.style.top = `${start.topPct - 4}%`;

    aspectBox.appendChild(proj);

    requestAnimationFrame(() => {
      proj.style.left = `${end.leftPct}%`;
      proj.style.top = `${end.topPct - 4}%`;
    });

    setTimeout(() => {
      proj.remove();
    }, 380);
  }

  /**
   * Real-Time Independent Auto-Chess Loop
   * Each Axie unit acts and moves at its own speed without turn-based locking
   */
  private async startTacticalBattle() {
    if (this.isTacticalBattleRunning) return;
    this.isTacticalBattleRunning = true;

    const startBtn = document.getElementById('btn-start-tactical-battle');
    if (startBtn) {
      startBtn.textContent = '⚔️ FIGHTING (REAL-TIME AUTO-CHESS)...';
      startBtn.classList.add('is-fighting');
    }

    // Play Origins Tactical Battle Theme
    audioManager.playBgm('pve_1');

    const readout = document.getElementById('arena-hover-cell-readout');
    const roundBadge = document.getElementById('battle-round-badge');
    if (roundBadge) roundBadge.textContent = 'REAL-TIME AUTO BATTLE';

    const now = Date.now();
    this.tacticalUnits.forEach((unit) => {
      if (!unit.isDefeated) {
        // Stagger initial actions slightly based on speed
        unit.nextActionTime = now + Math.max(100, 600 - unit.speed * 8);
        unit.isActing = false;
        unit.lockedTargetId = null;
      }
    });

    while (this.isTacticalBattleRunning) {
      const currentTime = Date.now();

      // Check alive units
      const aliveRed = this.tacticalUnits.filter((u) => u.team === 'red' && !u.isDefeated && u.currentHp > 0);
      const aliveBlue = this.tacticalUnits.filter((u) => u.team === 'blue' && !u.isDefeated && u.currentHp > 0);

      // Check win condition
      if (aliveRed.length === 0 || aliveBlue.length === 0) {
        const winner = aliveRed.length > 0 ? '🔴 RED TEAM WINS!' : aliveBlue.length > 0 ? '🔵 BLUE TEAM WINS!' : 'DRAW!';
        if (readout) readout.textContent = `🏆 AUTO BATTLE ENDED: ${winner}`;
        if (startBtn) {
          startBtn.textContent = '⚔️ START BATTLE';
          startBtn.classList.remove('is-fighting');
        }
        this.isTacticalBattleRunning = false;
        audioManager.playSfx('power_awaken');
        break;
      }

      // Process each alive unit independently
      const allAlive = [...aliveRed, ...aliveBlue];
      for (const unit of allAlive) {
        if (!unit.isActing && currentTime >= unit.nextActionTime) {
          // Trigger independent asynchronous action
          this.processUnitAutoChessAction(unit);
        }
      }

      // Fast tick rate (30 FPS check)
      await this.sleep(35);
    }
  }

  private resetTacticalBattle() {
    this.isTacticalBattleRunning = false;
    this.currentTacticalRound = 1;
    audioManager.playBgm('pvp');

    const startBtn = document.getElementById('btn-start-tactical-battle');
    if (startBtn) {
      startBtn.textContent = '⚔️ START BATTLE';
      startBtn.classList.remove('is-fighting');
    }

    const roundBadge = document.getElementById('battle-round-badge');
    if (roundBadge) roundBadge.textContent = 'REAL-TIME AUTO BATTLE';

    const readout = document.getElementById('arena-hover-cell-readout');
    if (readout) readout.textContent = 'Click START BATTLE to begin!';

    // Reset units to initial position, full HP, zero shield, and reset card queues
    this.tacticalUnits.forEach((unit) => {
      unit.row = unit.initialRow;
      unit.col = unit.initialCol;
      unit.currentHp = unit.maxHp;
      unit.currentShield = 0;
      unit.cardIndex = 0;
      unit.lockedTargetId = null;
      unit.isActing = false;
      unit.nextActionTime = 0;
      unit.isDefeated = false;

      if (unit.domElement) {
        unit.domElement.classList.remove('is-defeated', 'is-attacking', 'is-defending', 'is-hit', 'is-running');
        const { leftPct, topPct } = this.getGridCellCenter(unit.row, unit.col);
        unit.domElement.style.left = `${leftPct.toFixed(2)}%`;
        unit.domElement.style.top = `${topPct.toFixed(2)}%`;
        unit.domElement.style.zIndex = `${15 + unit.row * 10}`;

        this.updateUnitHud(unit);
      }

      unit.spineEngine?.setAnimation('action/idle/normal', true);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* ==========================================================================
     BATTLE LOGS MODAL
     ========================================================================== */
  private renderBattleLogs() {
    const container = document.getElementById('battle-logs-container');
    if (!container) return;

    container.innerHTML = '';

    this.battleLogsList.forEach((log) => {
      const div = document.createElement('div');
      div.className = 'log-item';

      div.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.2rem;">
          <span style="font-weight: 700; font-size: 0.9rem;">${log.mode} vs <strong>${log.opponent}</strong></span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${log.time}</span>
        </div>
        <span class="log-result ${log.isWin ? 'win' : 'loss'}">${log.result}</span>
      `;

      container.appendChild(div);
    });
  }

  private showLoading(show: boolean, message: string = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    if (text) text.textContent = message;
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
  }
}

// Start application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new AxieBattleGroundApp();
});
