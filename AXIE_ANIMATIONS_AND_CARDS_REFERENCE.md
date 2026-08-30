# Axie Infinity Spine 2D Animations & Cards Reference Guide

This reference document contains all **46 Axie Spine 2D Animation names**, usage instructions, code implementation examples, and **Axie Classic Cards data**.

---

## 🎬 Spine 2D Animations Dictionary & Usage Guide

To set or trigger animations on an `AxieSpine` object:

```typescript
// Set looping animation (track index 0)
axieSpine.state.setAnimation(0, 'action/idle/normal', true);

// Set one-shot action animation and return to idle
axieSpine.state.setAnimation(0, 'attack/melee/tail-smash', false);
axieSpine.state.addAnimation(0, 'action/idle/normal', true, 1.0);

// Adjust playback speed
axieSpine.state.timeScale = 1.2;
```

### 1. Idle & Resting Animations
- **`action/idle/normal`**: Standard combat resting idle animation (Loopable, primary idle stance).
- **`action/idle/random-01`**: Idle variation with subtle tail sway.
- **`action/idle/random-02`**: Idle variation with head tilt.
- **`action/idle/random-03`**: Idle variation with eye blinking.
- **`action/idle/random-04`**: Idle variation looking around.
- **`action/idle/random-05`**: Subtle breathing idle stance.

### 2. Locomotion & Movement Animations
- **`action/run`**: Standard running animation for movement.
- **`draft/run-origin`**: Classic Origin dash sprint animation.
- **`action/move-forward`**: Stepping forward into attack position.
- **`action/move-back`**: Stepping backward back into formation.

### 3. Melee Attack Animations
- **`attack/melee/normal-attack`**: Standard physical strike hit.
- **`attack/melee/multi-attack`**: Rapid multi-hit flurry strike.
- **`attack/melee/horn-gore`**: Horn thrust physical attack.
- **`attack/melee/mouth-bite`**: Chomping mouth bite attack.
- **`attack/melee/shrimp`**: Shrimp leap tail strike attack.
- **`attack/melee/tail-smash`**: Heavy tail slam attack.
- **`attack/melee/tail-multi-slap`**: Multi-slap tail strike.
- **`attack/melee/tail-roll`**: Spinning tail roll attack.
- **`attack/melee/tail-thrash`**: Aggressive tail thrash strike.

### 4. Ranged & Spell Cast Animations
- **`attack/ranged/cast-fly`**: Flying magical spell cast.
- **`attack/ranged/cast-high`**: High arc projectile energy launch.
- **`attack/ranged/cast-low`**: Ground-level projectile energy launch.
- **`attack/ranged/cast-multi`**: Multi-target projectile spell barrage.
- **`attack/ranged/cast-tail`**: Tail-fired projectile launch.

### 5. Defense & Hurt Reaction Animations
- **`defense/hit-by-normal`**: Standard hurt recoil response.
- **`defense/hit-by-normal-crit`**: Heavy critical hit recoil animation.
- **`defense/hit-by-normal-dramatic`**: Dramatic knockback recoil.
- **`defense/hit-by-ranged-attack`**: Impact stance against ranged hits.
- **`defense/hit-with-shield`**: Shield block impact mitigation.
- **`defense/evade`**: Dodge / Evade sidestep animation.

### 6. Activities & Expressions
- **`activity/appear`**: Spawn entrance / match entrance transition.
- **`activity/prepare`**: Combat ready battle stance.
- **`activity/sleep`**: Sleeping / idle Zzz state.
- **`activity/eat-bite`**: Biting food in land/adventure mode.
- **`activity/eat-chew`**: Chewing food in land/adventure mode.
- **`activity/bath`**: Bathing animation.
- **`activity/evolve`**: Evolution particle aura stance.
- **`activity/victory-pose-back-flip`**: Victory backflip celebration.

### 7. Battle Status Buffs & Debuffs
- **`battle/get-buff`**: Receiving a positive status buff.
- **`battle/get-debuff`**: Receiving a negative status debuff.

---

## 🎴 Axie Classic Cards & Trigger Text Data

- **Total Cards**: 132 Cards across Aquatic, Beast, Plant, Bird, Reptile, and Bug parts.
- **Total Unique Trigger Texts**: 62 Status/Effect triggers (e.g. `Critical Block`, `Draw Card`, `Speed+`, `Stun`, `Poison`, `Gain Energy`, `Aroma`, `Fear`, `End Last Stand`, `Melee Disable`).
- **Cards Endpoint**: `https://cdn.axieinfinity.com/game/cards/card-abilities.json`
- **Card Images Base**: `https://cdn.axieinfinity.com/game/cards/base/{cardId}.png`
- **Saved Full Reference File**: [`/public/axie-animations-and-cards-reference.json`](file:///Users/anthonyestrada/.gemini/antigravity/scratch/axie-mixer-app/public/axie-animations-and-cards-reference.json)
