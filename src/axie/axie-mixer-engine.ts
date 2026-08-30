import { Application, Assets, Texture } from 'pixi.js';
import { Spine, TextureAtlas } from 'pixi-spine';
import { AtlasAttachmentLoader, SkeletonJson } from '@pixi-spine/runtime-3.8';
import {
  initAxieMixer,
  getAxieSpineFromGenes,
  getAxieColorPartShift,
  getVariantAttachmentPath,
  AxieBuilderResult,
} from '@axieinfinity/mixer';

// Import required data files from @axieinfinity/mixer
import GenesData from '@axieinfinity/mixer/dist/data/axie-2d-v3-stuff-genes.json';
import SamplesData from '@axieinfinity/mixer/dist/data/axie-2d-v3-stuff-samples.json';
import VariantsData from '@axieinfinity/mixer/dist/data/axie-2d-v3-stuff-variant.json';
import AnimationsData from '@axieinfinity/mixer/dist/data/axie-2d-v3-stuff-animations.json';

const AXIE_IMAGES_URL = 'https://axiecdn.axieinfinity.com/mixer-stuffs/v6/';
const ACCESSORY_SPINES_URL = 'https://axiecdn.axieinfinity.com/mixer-stuffs/accessory-spines/v1';

export interface AccessoryItem {
  key: string;
  name: string;
  placement: 'Air' | 'Cheek' | 'Ground' | 'Hip' | 'Neck';
}

export class AxieMixerEngine {
  private app: Application;
  private currentAxieSpine?: Spine;
  private currentGenes: string = '';
  private currentAnimation: string = 'action/idle/normal';
  private availableAnimations: string[] = [];
  private isLooping: boolean = true;
  private playbackSpeed: number = 1.0;
  private zoomScale: number = 0.35;
  private isFlipped: boolean = false;
  private equippedAccessories: AccessoryItem[] = [];

  private isInitialized: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.app = new Application({
      view: canvas,
      resizeTo: canvas.parentElement || undefined,
      backgroundColor: 0x0f172a,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preserveDrawingBuffer: true,
    });
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      // Initialize @axieinfinity/mixer with data JSONs
      initAxieMixer(GenesData, SamplesData, VariantsData, AnimationsData);
      this.isInitialized = true;
      console.log('AxieMixerEngine initialized successfully.');
    } catch (err) {
      console.error('Failed to initialize AxieMixerEngine:', err);
      throw err;
    }
  }

  public async loadAxieFromGenes(
    genesHex: string,
    accessories: AccessoryItem[] = []
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const cleanGenes = genesHex.trim();
    const formattedGenes = cleanGenes.startsWith('0x') ? cleanGenes : `0x${cleanGenes}`;

    // Validate 512-bit gene string length (should be 130 characters with 0x)
    if (formattedGenes.length < 100) {
      throw new Error(
        `Invalid gene string length (${formattedGenes.length} chars). Axie 2D Spine Mixer requires 512-bit (128 hex chars / 0x...) genes string.`
      );
    }

    this.currentGenes = formattedGenes;
    this.equippedAccessories = accessories;

    // Clear previous children
    this.app.stage.removeChildren();

    // Prepare accessory metadata map
    const metaMap = new Map<string, string>();
    accessories.forEach((acc) => {
      metaMap.set(`accessory-${acc.placement.toLowerCase()}`, `accessory-${acc.key}`);
    });

    // Build Axie Spine DataAsset
    const builderResult: AxieBuilderResult = getAxieSpineFromGenes(formattedGenes, metaMap, false);

    if (builderResult.error) {
      throw new Error(`Axie Mixer Error: ${builderResult.error}`);
    }

    if (!builderResult.skeletonDataAsset) {
      throw new Error('Failed to generate skeleton data asset.');
    }

    const { skeletonDataAsset, variant } = builderResult;

    // Collect available animations safely (skeletonDataAsset.animations is a key-value map in Spine JSON)
    if (skeletonDataAsset.animations) {
      if (Array.isArray(skeletonDataAsset.animations)) {
        this.availableAnimations = skeletonDataAsset.animations.map((a: any) => a.name || a);
      } else if (typeof skeletonDataAsset.animations === 'object') {
        this.availableAnimations = Object.keys(skeletonDataAsset.animations);
      }
    }

    // Load textures & construct Spine object
    this.currentAxieSpine = await this.createAxieSpine(skeletonDataAsset, variant);

    // Apply transformation
    this.updateSpineTransform();

    // Set animation
    this.setAnimation(this.currentAnimation, this.isLooping);

    // Add Axie Spine to Pixi Application stage
    this.app.stage.addChild(this.currentAxieSpine as any);

    // Attach accessories
    if (accessories.length > 0) {
      await this.attachAccessories(accessories);
    }
  }

  private async createAxieSpine(
    skeletonData: any,
    variant: string
  ): Promise<Spine> {
    const skinAttachments = skeletonData.skins[0].attachments;
    const imagesToLoad: Array<{ key: string; imagePath: string }> = [];
    const partColorShift = getAxieColorPartShift(variant);

    for (const slotName in skinAttachments) {
      const skinSlotAttachments = skinAttachments[slotName];
      for (const attachmentName in skinSlotAttachments) {
        const att = skinSlotAttachments[attachmentName];
        const path = att.path || attachmentName;
        const imagePath =
          AXIE_IMAGES_URL + getVariantAttachmentPath(slotName, path, variant, partColorShift);

        imagesToLoad.push({ key: path, imagePath });
        if (attachmentName !== path) {
          imagesToLoad.push({ key: attachmentName, imagePath });
        }
      }
    }

    // Collect unique image paths to avoid duplicate concurrent fetch requests
    const uniquePaths = Array.from(new Set(imagesToLoad.map((item) => item.imagePath)));

    // Load textures
    const loadedMap = new Map<string, Texture>();
    await Promise.all(
      uniquePaths.map(async (url) => {
        try {
          const tex = await Assets.load(url);
          if (tex) loadedMap.set(url, tex);
        } catch (err) {
          console.warn(`Failed to load texture at ${url}`, err);
        }
      })
    );

    const allTextures: { [key: string]: Texture } = {};
    imagesToLoad.forEach((item) => {
      const tex = loadedMap.get(item.imagePath);
      if (tex) {
        allTextures[item.key] = tex;
      }
    });

    // Create Spine Texture Atlas and Json Parser
    const spineAtlas = new TextureAtlas();
    spineAtlas.addTextureHash(allTextures as any, false);

    const spineAtlasLoader = new AtlasAttachmentLoader(spineAtlas);
    const spineJsonParser = new SkeletonJson(spineAtlasLoader);
    const parsedSpineData = spineJsonParser.readSkeletonData(skeletonData);

    return new Spine(parsedSpineData);
  }

  private async attachAccessories(accessories: AccessoryItem[]): Promise<void> {
    if (!this.currentAxieSpine) return;

    for (const accessory of accessories) {
      try {
        const baseUrl = `${ACCESSORY_SPINES_URL}/${accessory.key}/${accessory.key}`;
        const [rawJson, atlasText, texture] = await Promise.all([
          fetch(`${baseUrl}.json`).then((r) => r.json()),
          fetch(`${baseUrl}.atlas`).then((r) => r.text()),
          Assets.load(`${baseUrl}.png`),
        ]);

        if (rawJson && atlasText && texture) {
          const spineAtlas = new TextureAtlas(atlasText, (_line: string, callback: (t: any) => void) => {
            callback((texture as any).baseTexture || texture);
          });
          const spineAtlasLoader = new AtlasAttachmentLoader(spineAtlas);
          const spineJsonParser = new SkeletonJson(spineAtlasLoader);
          const spineData = spineJsonParser.readSkeletonData(rawJson);

          const accessorySpine = new Spine(spineData);
          // Accessories use Spine 2D format and require Y-axis flip
          accessorySpine.scale.set(1, -1);

          if (spineData.animations && spineData.animations.length > 0) {
            accessorySpine.state.setAnimation(0, spineData.animations[0].name, true);
          }

          const slotName = `body-${accessory.placement.toLowerCase()}`;
          const slotIndex = this.currentAxieSpine.skeleton.findSlotIndex(slotName);

          if (slotIndex >= 0) {
            this.currentAxieSpine.slotContainers[slotIndex].addChild(accessorySpine as any);
          }
        }
      } catch (err) {
        console.warn(`Could not attach accessory ${accessory.name}:`, err);
      }
    }
  }

  public setAnimation(animName: string, loop: boolean = true): void {
    this.currentAnimation = animName;
    this.isLooping = loop;

    if (!this.currentAxieSpine) return;

    if (this.availableAnimations.includes(animName)) {
      this.currentAxieSpine.state.setAnimation(0, animName, loop);
      this.currentAxieSpine.state.timeScale = this.playbackSpeed;

      if (!loop) {
        // Return to idle after one-shot action
        this.currentAxieSpine.state.addAnimation(0, 'action/idle/normal', true, 1.2);
      }
    } else if (this.availableAnimations.length > 0) {
      this.currentAxieSpine.state.setAnimation(0, this.availableAnimations[0], loop);
    }
  }

  public setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = speed;
    if (this.currentAxieSpine) {
      this.currentAxieSpine.state.timeScale = speed;
    }
  }

  public setZoomScale(scale: number): void {
    this.zoomScale = scale;
    this.updateSpineTransform();
  }

  public toggleFlip(): void {
    this.isFlipped = !this.isFlipped;
    this.updateSpineTransform();
  }

  private updateSpineTransform(): void {
    if (!this.currentAxieSpine) return;

    const width = this.app.screen.width;
    const height = this.app.screen.height;

    this.currentAxieSpine.position.set(width / 2, height / 2 + 80);
    const scaleX = (this.isFlipped ? -1 : 1) * this.zoomScale;
    this.currentAxieSpine.scale.set(scaleX, this.zoomScale);
  }

  public setBackgroundColor(colorHex: number): void {
    this.app.renderer.background.color = colorHex;
  }

  public getAvailableAnimations(): string[] {
    return this.availableAnimations;
  }

  public getCurrentAnimation(): string {
    return this.currentAnimation;
  }

  public exportCanvasSnapshot(): string {
    const extract = this.app.renderer.extract as any;
    if (typeof extract.canvas === 'function') {
      return extract.canvas(this.app.stage).toDataURL('image/png');
    }
    return (this.app.view as HTMLCanvasElement).toDataURL('image/png');
  }

  public resize(): void {
    this.app.resize();
    this.updateSpineTransform();
  }

  public destroy(): void {
    this.app.destroy(true, { children: true, texture: true, baseTexture: true });
  }

  // Helper method to fetch genes from Axie GraphQL API by Axie ID
  public static async fetchGenesByAxieId(axieId: string): Promise<{ genes: string; name: string; class: string }> {
    const query = `
      query GetAxieDetail($axieId: ID!) {
        axie(axieId: $axieId) {
          id
          genes
          newGenes
          name
          class
        }
      }
    `;

    const res = await fetch('https://graphql-gateway.axieinfinity.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { axieId: axieId.trim() },
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Axie #${axieId} (HTTP ${res.status})`);
    }

    const json = await res.json();
    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0].message || `Axie #${axieId} not found`);
    }

    const axie = json.data?.axie;
    if (!axie) {
      throw new Error(`Axie #${axieId} not found`);
    }

    const genes = axie.newGenes || axie.genes;
    if (!genes) {
      throw new Error(`Axie #${axieId} genes data not found`);
    }

    return {
      genes: genes,
      name: axie.name || `Axie #${axieId}`,
      class: axie.class || 'Unknown',
    };
  }
}
