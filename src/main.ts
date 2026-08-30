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
import { TeamManager, TeamRole } from './game/team-manager';
import { getAxieBodyStructure512 } from '@axieinfinity/mixer';

class AxieBattleGroundApp {
  private teamManager: TeamManager = new TeamManager();
  private inspectorEngine?: AxieMixerEngine;
  private studioEngine?: AxieMixerEngine;
  private currentInspectedAxie?: SampleAxie;
  private currentSampleIndex: number = 0;
  private equippedAccessoriesMap: Map<string, AccessoryItem> = new Map();
  private currentAxieCards: AxieCardAbility[] = [];
  private jsonTabMode: 'selected' | 'all' = 'selected';

  constructor() {
    this.init();
  }

  private async init() {
    // Pre-load card database
    await loadCardAbilitiesDatabase();

    this.setupNavigation();
    this.renderSamplesList();
    this.renderAccessoriesList();
    this.renderAxiesDirectory();
    this.renderTeamBuilder();
    this.renderFriendsList();
    this.renderBattleLogs();
  }

  private setupNavigation() {
    const pageLanding = document.getElementById('page-landing');
    const pageDashboard = document.getElementById('page-dashboard');
    const pageStudio = document.getElementById('page-mixer-studio');

    // Landing Screen -> Start Game
    const btnStartGame = document.getElementById('btn-start-game');
    btnStartGame?.addEventListener('click', () => {
      if (pageLanding) pageLanding.style.display = 'none';
      if (pageDashboard) pageDashboard.style.display = 'flex';
      if (pageStudio) pageStudio.style.display = 'none';
    });

    // Landing Screen -> Mixer Studio
    const btnLandingMixer = document.getElementById('btn-landing-mixer');
    btnLandingMixer?.addEventListener('click', async () => {
      if (pageLanding) pageLanding.style.display = 'none';
      if (pageDashboard) pageDashboard.style.display = 'none';
      if (pageStudio) pageStudio.style.display = 'flex';

      await this.initStudioMode();
    });

    // Dashboard Header -> Mixer Studio
    const btnOpenMixerStudio = document.getElementById('btn-open-mixer-studio');
    btnOpenMixerStudio?.addEventListener('click', async () => {
      if (pageDashboard) pageDashboard.style.display = 'none';
      if (pageStudio) pageStudio.style.display = 'flex';

      await this.initStudioMode();
    });

    // Studio Header -> Back to Game
    const btnBackToGame = document.getElementById('btn-back-to-game');
    btnBackToGame?.addEventListener('click', () => {
      if (pageStudio) pageStudio.style.display = 'none';
      if (pageDashboard) pageDashboard.style.display = 'flex';
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
        }
      });
    });

    // LIGHTBOX INSPECTOR X CLOSE BUTTON FIX
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
    }
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
        chk.checked = this.equippedAccessoriesMap.has(acc.placement) &&
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
    if (modalPart) modalPart.textContent = `Part: ${card.partName} (${card.partType}) | Atk: ${card.defaultAttack} | Def: ${card.defaultDefense}`;
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
     AXIE DIRECTORY REAL AXIES (IDs 1-30) & LIGHTBOX MODAL
     ========================================================================== */
  private renderAxiesDirectory(filterTerm: string = '') {
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

    filteredAxies.forEach((axie) => {
      const stats = calculateAxieClassicStats(axie.genes);
      const role = this.teamManager.getAxieRole(axie.id);
      const classTagClass = `tag-${axie.class.toLowerCase()}`;

      const cardEl = document.createElement('div');
      cardEl.className = 'axie-directory-card';

      const imgSrc = axie.image || `https://assets.axieinfinity.com/axies/${axie.id}/axie/axie-full-transparent.png`;

      cardEl.innerHTML = `
        <div class="axie-portrait-container">
          <img class="axie-portrait-img" src="${imgSrc}" alt="${axie.name}" loading="lazy" />
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
     TAB 2: TEAM BUILDER (Defense Green, Offense Red, Neutral Blue)
     ========================================================================== */
  private renderTeamBuilder() {
    const defContainer = document.getElementById('defense-squad-list');
    const offContainer = document.getElementById('offense-squad-list');
    const neuContainer = document.getElementById('neutral-squad-list');
    const summaryBadge = document.getElementById('team-summary-badge');

    if (!defContainer || !offContainer || !neuContainer) return;

    defContainer.innerHTML = '';
    offContainer.innerHTML = '';
    neuContainer.innerHTML = '';

    const summary = this.teamManager.getSquadSummary();
    if (summaryBadge) {
      summaryBadge.innerHTML = `<span>🟢 ${summary.defenseCount} Defense</span> | <span>🔴 ${summary.offenseCount} Offense</span> | <span>🔵 ${summary.neutralCount} Neutral</span>`;
    }

    const axies = this.teamManager.getPlayerAxies();

    axies.forEach((axie) => {
      const role = this.teamManager.getAxieRole(axie.id);
      const classTagClass = `tag-${axie.class.toLowerCase()}`;

      const item = document.createElement('div');
      item.className = 'squad-axie-card';

      item.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.2rem;">
          <span style="font-weight: 700; font-size: 0.85rem;">${axie.name}</span>
          <span class="sample-class-tag ${classTagClass}" style="width: fit-content;">${axie.class}</span>
        </div>

        <select class="role-assign-select" data-id="${axie.id}">
          <option value="Defense" ${role === 'Defense' ? 'selected' : ''}>🟢 Defense</option>
          <option value="Offense" ${role === 'Offense' ? 'selected' : ''}>🔴 Offense</option>
          <option value="Neutral" ${role === 'Neutral' ? 'selected' : ''}>🔵 Neutral</option>
        </select>
      `;

      const select = item.querySelector('select') as HTMLSelectElement;
      select.addEventListener('change', (e) => {
        const newRole = (e.target as HTMLSelectElement).value as TeamRole;
        this.teamManager.setAxieRole(axie.id, newRole);
        this.renderTeamBuilder();
      });

      if (role === 'Defense') defContainer.appendChild(item);
      else if (role === 'Offense') offContainer.appendChild(item);
      else neuContainer.appendChild(item);
    });
  }

  /* ==========================================================================
     TAB 4: FRIENDS LIST
     ========================================================================== */
  private renderFriendsList() {
    const container = document.getElementById('friends-list-container');
    if (!container) return;

    container.innerHTML = '';

    const sampleFriends = [
      { name: 'Jihoz_Axie', status: 'Online', rank: 'Challenger (2,450 MMR)', trophies: '🏆 2,450' },
      { name: 'Axie_Master_99', status: 'In Battle', rank: 'Grandmaster (2,100 MMR)', trophies: '🏆 2,100' },
      { name: 'Ronin_Knight', status: 'Online', rank: 'Master I (1,920 MMR)', trophies: '🏆 1,920' },
      { name: 'Lunacia_Explorer', status: 'Offline', rank: 'Diamond II (1,650 MMR)', trophies: '🏆 1,650' },
    ];

    sampleFriends.forEach((friend) => {
      const card = document.createElement('div');
      card.className = 'friend-card';

      const statusColor = friend.status === 'Offline' ? '#94a3b8' : '#00e676';

      card.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.2rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></span>
            <span style="font-weight: 700; font-size: 0.95rem;">${friend.name}</span>
          </div>
          <span style="font-size: 0.78rem; color: var(--text-secondary);">${friend.rank}</span>
        </div>

        <button class="btn btn-sm" style="border-color: var(--accent-cyan); color: var(--accent-cyan);">
          ⚔️ Challenge
        </button>
      `;

      const btnChallenge = card.querySelector('button');
      btnChallenge?.addEventListener('click', () => {
        alert(`⚔️ Challenge invitation sent to ${friend.name}! Waiting for acceptance...`);
      });

      container.appendChild(card);
    });
  }

  /* ==========================================================================
     BATTLE LOGS MODAL
     ========================================================================== */
  private renderBattleLogs() {
    const container = document.getElementById('battle-logs-container');
    if (!container) return;

    container.innerHTML = '';

    const sampleLogs = [
      { mode: 'Ranked Arena', opponent: 'Jihoz_Axie', result: 'VICTORY (+32 MMR)', time: '10 mins ago', isWin: true },
      { mode: 'Ranked Arena', opponent: 'Ronin_Knight', result: 'VICTORY (+28 MMR)', time: '42 mins ago', isWin: true },
      { mode: 'Casual Practice', opponent: 'AI Commander', result: 'VICTORY', time: '2 hours ago', isWin: true },
      { mode: 'Ranked Arena', opponent: 'Axie_Master_99', result: 'DEFEAT (-18 MMR)', time: '5 hours ago', isWin: false },
    ];

    sampleLogs.forEach((log) => {
      const item = document.getElementById('log-item');
      const div = document.createElement('div');
      div.className = 'log-item';

      div.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.2rem;">
          <span style="font-weight: 700; font-size: 0.9rem;">${log.mode} vs ${log.opponent}</span>
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
