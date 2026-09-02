# ⚔️ Axie Battleground

> **A 2D Tactical Auto-Battler powered by Axie Classic Cards, Genetic Breeding, and Real-Time Grid Combat.**
> 
> *An official entry for the [Axie Vibeathon 2026](https://vibeathon.axieinfinity.ai).*

---

## 🌟 Overview

**Axie Battleground** bridges the competitive depth and nostalgic card combinations of **Axie Classic** with the addictive, rapid strategy of modern **2D Auto-Battlers**.

Players step into the role of a Lunacian squad commander. Rather than manually playing cards every turn, commanders breed Axies for specialized part synergies, optimize stat distributions, position their squad across a 2D battlefield grid, and let the combat resolve in dynamic automated battles.

With deep class synergies, tactical energy management, and real-time auto-combat resolution, victory belongs to the mastermind who breeds Axies with exciting capabilities and unstoppable card combos!

---

## 🧬 Core Gameplay Pillars

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AXIE BATTLEGROUND ENGINE                        │
│                                                                        │
│   🧬 1. BREED & OPTIMIZE   ──►   ♟️ 2. GRID FORMATIONS   ──►   ⚡ 3. AUTO-RESOLVE  │
│   Inherit Classic parts          Frontline tanks, midline       Classic combos,     │
│   and synergize stats            buffers & backline snipers     energy & Last Stand │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. 🧬 Genetic Breeding & Part Combinations
* **6-Part Inheritance**: Pass down Eyes, Ears, Mouth, Horn, Back, and Tail parts that define both battle stats (HP, Speed, Skill, Morale) and signature Classic cards.
* **Hybrid Archetypes**: Craft unconventional builds—such as heavy armored Beast tanks wielding *Pumpkin* shields, or hyper-speed Aquas delivering lethal *Ronin* critical hits.
* **Theorycrafting Depth**: Tailor your team composition to counter meta formations and maximize class bonus effects.

### 2. 🃏 Iconic Axie Classic Cards Reimagined
* **Automated Card Execution**: Skirmishes dynamically build energy, triggering signature Classic cards when tactical requirements and energy thresholds are reached.
* **Combos & Chains**: Multi-card synergies activate bonus shields, amplified critical strike damage, and status triggers.
* **Status Effects**:
  * ☠️ **Poison**: Stacking tick-damage that bypasses shields.
  * 💫 **Stun**: Halts attack animations and nullifies the next defensive guard.
  * 🌸 **Aroma**: Manipulates enemy targeting towards designated targets.
  * 🔥 **Last Stand**: High-morale fighters refuse to fall, making clutch final attacks.

### 3. ♟️ 2D Grid Tactics & Smart Targeting
* **Formation Strategy**: Place sturdy Plant and Reptile defenders on the frontline while squishy Bird, Beast, and Aqua damage-dealers snipe from the backline.
* **Sniper Priority**: Utilize iconic targeting cards like *Dark Swoop* (target fastest foe) and *Sneaky Raid* (target furthest foe) to bypass enemy frontlines and eliminate key glass cannons.

---

## 🛠️ Technology Stack

* **Frontend Framework**: [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **Spine 2D Animation Engine**: [`@axieinfinity/mixer`](https://www.npmjs.com/package/@axieinfinity/mixer) (Official Sky Mavis Spine 2D Mixer for real-time customizable Axie rendering)
* **Styling**: Vanilla CSS3 design system with glassmorphic UI, responsive overlays, and arena grids
* **Ecosystem Integration**: Sky Mavis GraphQL API / Ronin Developer Console integration readiness

---

## 🚀 Getting Started Locally

### Prerequisites
* [Node.js](https://nodejs.org/) (version 18 or higher recommended)
* `npm` or `pnpm` or `yarn`

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Tutuldot/axie-battleground.git
   cd axie-battleground
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in your browser:**
   Navigate to `http://localhost:5173` to explore the arena, Axie mixer, and battle simulation.

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## 🏆 Axie Vibeathon 2026 Submission Highlights

* **Accessible Web Play**: Zero installation friction; runs directly in any modern web browser.
* **IP Fidelity**: True to Axie Classic heritage, lore, and visual identity.
* **Deep Metagame**: Strategic depth that rewards both casual auto-battler fans and seasoned Axie breeders.

---

## 📄 License
This project is built for the **Axie Vibeathon 2026** hackathon. All Axie Infinity intellectual property, assets, and trademarks are owned by [Sky Mavis](https://skymavis.com/).
