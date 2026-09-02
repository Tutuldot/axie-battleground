# Tactical Grid Auto-Battle: Simultaneous Combat, Multi-Step Running & Melee Row Alignment

Updated the tactical auto-battle engine with simultaneous action execution for all units, 3-step continuous Spine running animation without jumping hops, and strict side-by-side same-row melee positioning.

---

## ⚡ 1. Simultaneous Action Execution (All Units Act Together)
- **Simultaneous Action Planning**: At the start of each round, all living Red and Blue units evaluate the battlefield concurrently.
- **Simultaneous Movement Phase**: All units requiring movement start running across cells at the exact same time (`Promise.all(movingUnits.map(...))`).
- **Simultaneous Combat Phase**: All units in range cast abilities, launch projectiles, or lunge into melee simultaneously (`Promise.all(attackingUnits.map(...))`), updating damage numbers and HP bars concurrently.

---

## 🏃 2. Continuous 3-Step Running Animation (No Hopping)
- **Spine `action/run` Animation**: Units utilize the official continuous 2D Spine running cycle featuring rapid leg/body stride cadence.
- **Smooth Glide**: Replaced vertical bouncing hops with dynamic forward leaning (`transform: skewX(-3.5deg)` for Red, `skewX(3.5deg)` for Blue) and linear grid translation over 850ms.

---

## ⚔️ 3. Strict Same-Row Side-by-Side Melee Positioning
- **Melee Condition**: Melee abilities (`1-Cell Melee`) can only strike when an attacker is directly beside its target on the **same row** (`target.row === attacker.row && |target.col - attacker.col| === 1`).
- **Row Alignment Shift**: If the target is on a different row, the attacker automatically shifts row first to align horizontally before closing the gap.
- **Melee Strike Lunge**: When attacking, units quickly lunge into the target's cell boundary (`is-lunge-right` / `is-lunge-left`) before snapping back to their cell center.

---

## 🎯 4. Class Aggression Targeting
- **Bird, Aqua, Dawn** &rarr; Hunt **Bug, Mech, Beast**
- **Bug, Mech, Beast** &rarr; Hunt **Dusk, Plant, Reptile**
- **Dusk, Plant, Reptile** &rarr; Hunt **Bird, Dawn, Aqua**
- **HP Formula**: `HP = HP stat * 300`




