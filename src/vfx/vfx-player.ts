import { BLEND_MODES, Rectangle, Sprite, Texture, Container } from 'pixi.js';
import { atlasUrl, frameAt, loadClip, loadCatalog, type ClipEvent, type VfxClip, type Catalog } from './clip';
import { audioManager } from '../audio/audio-manager';

export type Point = { x: number; y: number };
export type Anchors = { attacker: Point; defender: Point; fieldWidth: number };

export type PlayHandle = {
  stop: () => void;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

export function mapCaptureToField(clip: VfxClip, anchors: Anchors) {
  const { attacker, defender, fieldWidth } = anchors;
  const cdx = clip.captureDefender.x - clip.captureAttacker.x;
  const jdx = defender.x - attacker.x;
  const captureSpan = Math.abs(cdx) > 8 ? Math.abs(cdx) : 390;

  // Responsive field width factor normalized to standard 1024px arena width
  const fieldFactor = fieldWidth > 0 ? Math.max(0.75, Math.min(1.25, fieldWidth / 1024)) : 1.0;

  let scale: number;
  let flip: boolean;

  if (clip.kind === 'buff') {
    // Buff / Attached effects (e.g. Shield, Bubble, Buff Aura):
    // Positioned directly on the unit. Sized generously (~0.84) to wrap around the 140px Axie body.
    scale = 0.84 * fieldFactor;
    flip = false; // Standard upright orientation for buffs
  } else if (clip.isRanged) {
    // Ranged Projectile / Cast / Throw effects:
    // Scale dynamically with flight distance across grid columns, with a minimum floor (0.68)
    // so close-range shots are never microscopic dots.
    const spanScale = Math.abs(jdx) > 8 ? Math.abs(jdx) / captureSpan : 0.75;
    scale = Math.max(0.68, Math.min(1.25, spanScale)) * fieldFactor;
    flip = Math.sign(jdx || 1) !== Math.sign(cdx || -1);
  } else {
    // Melee attack skills (e.g. Slashes, Bites, Gores, Smashes):
    // Hit effect plays directly ON the defender Axie. Decoupled from inter-cell distance
    // so adjacent melee strikes remain large, punchy, and prominent (~0.82 scale).
    scale = 0.82 * fieldFactor;
    flip = Math.sign(jdx || 1) !== Math.sign(cdx || -1);
  }

  return { scale, flip, defender, attacker };
}

export function cropPointToField(clip: VfxClip, map: ReturnType<typeof mapCaptureToField>, px: number, py: number) {
  const anchorRef = clip.anchor.mapsTo === 'attacker' ? map.attacker : map.defender;
  const dx = px - clip.anchor.x;
  const dy = py - clip.anchor.y;
  const sx = map.flip ? -map.scale : map.scale;
  return {
    x: anchorRef.x + dx * sx,
    y: anchorRef.y + dy * map.scale,
  };
}

export class AdditiveAtlas {
  readonly image: HTMLImageElement;
  readonly clip: VfxClip;
  readonly textures: Texture[] = [];

  constructor(clip: VfxClip, image: HTMLImageElement, base?: Texture) {
    this.clip = clip;
    this.image = image;
    const { cols, frameW, frameH } = clip.atlas;

    if (base) {
      for (let i = 0; i < clip.frames; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        this.textures.push(new Texture(base.baseTexture, new Rectangle(col * frameW, row * frameH, frameW, frameH)));
      }
    }
  }

  static async load(clip: VfxClip): Promise<AdditiveAtlas> {
    const url = atlasUrl(clip);
    const image = await loadImage(url);
    let base: Texture | undefined;
    try {
      base = Texture.from(image);
    } catch {
      // Pixi texture optional for canvas-only usage
    }
    return new AdditiveAtlas(clip, image, base);
  }

  drawCanvas(
    ctx: CanvasRenderingContext2D,
    index: number,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    originX: number,
    originY: number
  ) {
    const { cols, frameW, frameH } = this.clip.atlas;
    const col = index % cols;
    const row = Math.floor(index / cols);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(
      this.image,
      col * frameW,
      row * frameH,
      frameW,
      frameH,
      -originX,
      -originY,
      frameW,
      frameH
    );
    ctx.restore();
  }
}

interface ActiveCanvasEffect {
  atlas: AdditiveAtlas;
  getAnchors: () => Anchors;
  opts: {
    loop?: boolean;
    onEvent?: (evt: ClipEvent & { time: number }) => void;
    onFrame?: (index: number, time: number) => void;
    onDone?: () => void;
    playAudio?: boolean;
  };
  started: number;
  fired: Set<string>;
  cycle: number;
  stopped: boolean;
}

class CanvasVfxManager {
  private activeEffects: ActiveCanvasEffect[] = [];
  private rafId: number | null = null;
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  add(effect: ActiveCanvasEffect): PlayHandle {
    this.activeEffects.push(effect);
    if (this.rafId === null) {
      this.startLoop();
    }
    return {
      stop: () => {
        effect.stopped = true;
        const idx = this.activeEffects.indexOf(effect);
        if (idx !== -1) {
          this.activeEffects.splice(idx, 1);
        }
        if (this.activeEffects.length === 0) {
          this.stopLoop();
          this.clearCanvas();
        }
      },
    };
  }

  private clearCanvas() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.ctx.restore();
  }

  private startLoop() {
    const tick = () => {
      if (this.activeEffects.length === 0) {
        this.stopLoop();
        this.clearCanvas();
        return;
      }

      this.clearCanvas();

      const now = performance.now();
      const remaining: ActiveCanvasEffect[] = [];

      for (const effect of this.activeEffects) {
        if (effect.stopped) continue;

        const clip = effect.atlas.clip;
        const origin = clip.anchor;
        const elapsed = (now - effect.started) / 1000;
        const nextCycle = effect.opts.loop ? Math.floor(elapsed / Math.max(0.05, clip.duration)) : 0;
        if (nextCycle !== effect.cycle) {
          effect.fired.clear();
          effect.cycle = nextCycle;
        }

        const t = effect.opts.loop ? elapsed % clip.duration : Math.min(clip.duration, elapsed);
        const index = frameAt(clip, t);

        const map = mapCaptureToField(clip, effect.getAnchors());
        const pos = cropPointToField(clip, map, origin.x, origin.y);

        effect.atlas.drawCanvas(
          this.ctx,
          index,
          pos.x,
          pos.y,
          map.flip ? -map.scale : map.scale,
          map.scale,
          origin.x,
          origin.y
        );

        effect.opts.onFrame?.(index, t);

        for (const evt of clip.events) {
          const key = `${evt.function}:${evt.time}`;
          if (t + 1 / clip.fps >= evt.time && !effect.fired.has(key)) {
            effect.fired.add(key);
            effect.opts.onEvent?.({ ...evt, time: evt.time });

            if (effect.opts.playAudio !== false) {
              if (evt.function === 'OnAttack') {
                audioManager.playSkillSfx(clip.id, 'attack');
              } else if (evt.function === 'OnThrow') {
                audioManager.playSkillSfx(clip.id, 'fly');
              } else if (evt.function === 'OnHit') {
                audioManager.playSkillSfx(clip.id, 'hit');
              }
            }
          }
        }

        if (!effect.opts.loop && elapsed >= clip.duration) {
          effect.opts.onDone?.();
        } else {
          remaining.push(effect);
        }
      }

      this.activeEffects = remaining;

      if (this.activeEffects.length > 0) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.stopLoop();
        this.clearCanvas();
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

const canvasManagers = new WeakMap<CanvasRenderingContext2D, CanvasVfxManager>();

function getCanvasManager(ctx: CanvasRenderingContext2D): CanvasVfxManager {
  let mgr = canvasManagers.get(ctx);
  if (!mgr) {
    mgr = new CanvasVfxManager(ctx);
    canvasManagers.set(ctx, mgr);
  }
  return mgr;
}

export function playOnCanvas(
  atlas: AdditiveAtlas,
  ctx: CanvasRenderingContext2D,
  getAnchors: () => Anchors,
  opts: {
    loop?: boolean;
    onEvent?: (evt: ClipEvent & { time: number }) => void;
    onFrame?: (index: number, time: number) => void;
    onDone?: () => void;
    playAudio?: boolean;
  } = {}
): PlayHandle {
  const clip = atlas.clip;
  if (opts.playAudio !== false && clip.kind === 'buff') {
    audioManager.playBuffSfx(clip.id);
  }

  const effect: ActiveCanvasEffect = {
    atlas,
    getAnchors,
    opts,
    started: performance.now(),
    fired: new Set<string>(),
    cycle: 0,
    stopped: false,
  };

  const mgr = getCanvasManager(ctx);
  return mgr.add(effect);
}

export function playOnPixi(
  atlas: AdditiveAtlas,
  parent: Container,
  getAnchors: () => Anchors,
  opts: {
    loop?: boolean;
    ticker: { add: (fn: () => void) => void; remove: (fn: () => void) => void };
    onEvent?: (evt: ClipEvent & { time: number }) => void;
    onDone?: () => void;
    playAudio?: boolean;
  }
): PlayHandle {
  const clip = atlas.clip;
  const sprite = new Sprite(atlas.textures[0]);
  sprite.anchor.set(clip.anchor.x / clip.atlas.frameW, clip.anchor.y / clip.atlas.frameH);
  sprite.blendMode = BLEND_MODES.ADD;
  parent.addChild(sprite);

  let stopped = false;
  const started = performance.now();
  const fired = new Set<string>();
  let cycle = 0;

  if (opts.playAudio !== false && clip.kind === 'buff') {
    audioManager.playBuffSfx(clip.id);
  }

  const tick = () => {
    if (stopped) return;
    const elapsed = (performance.now() - started) / 1000;
    const nextCycle = opts.loop ? Math.floor(elapsed / clip.duration) : 0;
    if (nextCycle !== cycle) {
      fired.clear();
      cycle = nextCycle;
    }
    const t = opts.loop ? elapsed % clip.duration : Math.min(clip.duration, elapsed);
    const map = mapCaptureToField(clip, getAnchors());
    const pos = cropPointToField(clip, map, clip.anchor.x, clip.anchor.y);
    sprite.scale.set(map.flip ? -map.scale : map.scale, map.scale);
    sprite.position.set(pos.x, pos.y);
    sprite.texture = atlas.textures[frameAt(clip, t)];

    for (const evt of clip.events) {
      const key = `${evt.function}:${evt.time}`;
      if (t + 1 / clip.fps >= evt.time && !fired.has(key)) {
        fired.add(key);
        opts.onEvent?.({ ...evt, time: evt.time });

        if (opts.playAudio !== false) {
          if (evt.function === 'OnAttack') {
            audioManager.playSkillSfx(clip.id, 'attack');
          } else if (evt.function === 'OnThrow') {
            audioManager.playSkillSfx(clip.id, 'fly');
          } else if (evt.function === 'OnHit') {
            audioManager.playSkillSfx(clip.id, 'hit');
          }
        }
      }
    }

    if (!opts.loop && elapsed >= clip.duration) {
      opts.ticker.remove(tick);
      parent.removeChild(sprite);
      sprite.destroy();
      opts.onDone?.();
    }
  };

  opts.ticker.add(tick);

  return {
    stop() {
      stopped = true;
      opts.ticker.remove(tick);
      parent.removeChild(sprite);
      if (!sprite.destroyed) sprite.destroy();
    },
  };
}

export interface SkillVfxMapping {
  abilityId: string;
  cardNames: string[];
  partClass: string;
  partType: string;
  vfxId: string;
  attackAnimation: string;
  hitAnimation: string;
  isRanged: boolean;
  projectileTravel: number | null;
  duration: number;
}

let skillVfxMap: Map<string, SkillVfxMapping> | null = null;

export async function loadSkillVfxDatabase(): Promise<Map<string, SkillVfxMapping>> {
  if (skillVfxMap) return skillVfxMap;
  skillVfxMap = new Map();
  try {
    const res = await fetch('/catalogs/skill-vfx.json');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.items)) {
        for (const item of data.items) {
          skillVfxMap.set(item.abilityId.toLowerCase(), item);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load skill-vfx.json catalog', err);
  }
  return skillVfxMap;
}

export function getVfxForAbility(abilityId: string): SkillVfxMapping | null {
  if (!skillVfxMap) return null;
  const cleanId = abilityId.toLowerCase().replace(/\.png$/, '');
  return skillVfxMap.get(cleanId) || null;
}
