# Battle System Update: 10s Tactical Countdown, Axie Repositioning & Audio Balance

Updated the battle system to remove the manual start button requirement, added an interactive **10-Second Tactical Preparation Countdown** allowing the player to freely reposition their Red squad within the first 2 columns, and balanced the audio mix so background music plays continuously without cutting while ability sound effects play at a softened volume.

---

## ⚡ Key Updates

### 1. Automatic Battle Start with 10-Second Countdown
- **No Manual Click Required**: Entering the Tactical Battleground screen (or pressing `🔄 RESET`) automatically kicks off a **10-second tactical preparation phase**.
- **Live Countdown Displays**:
  - **Header Countdown Badge**: Shows `⏱️ PREP: 10s` with a pulsing neon gold/amber indicator.
  - **Floating Tactical Prep Banner**: Positioned above the arena board displaying the live countdown (`10` -> `0`) and guidance instructions: *"Drag or click to reposition your Red Squad within Columns 1–2"*.
- **Auto-Combat Transition**: When the timer reaches 0s, the banner flashes `⚔️ BATTLE START!`, fades out, and real-time auto-chess combat begins automatically from the Axies' chosen positions.
- **`⚡ FIGHT NOW` Early Skip**: An optional button allows players who finish repositioning quickly to begin combat immediately without waiting for the timer to expire.

---

### 2. Interactive Red Axie Repositioning (Columns 1 & 2)
- **Restricted to Player's Side (Columns 1 & 2)**: Players can place any of their 4 Red Axies anywhere among the 16 cells in Column 1 and Column 2 (Rows 1–8).
- **Click-to-Move & Click-to-Swap**:
  - Clicking any Red Axie selects it, displaying a glowing cyan circular halo and highlighting the valid cells in Columns 1 & 2.
  - Clicking an open cell in Columns 1–2 smoothly repositions the Axie there with a crisp placement SFX.
  - Clicking another Red Axie immediately swaps their positions on the board.
  - Attempting to place an Axie outside Columns 1–2 displays a warning feedback message in the readout.
- **Drag-and-Drop**:
  - Players can also drag Red Axies directly onto target cells during the 10-second countdown with live cell hover highlights.

---

### 3. Audio Balancing & Uninterrupted Background Music
- **No Background Volume Cutting**: Background music volume is preserved continuously at its steady level throughout all battle actions.
- **Softened Ability Sound Effects**:
  - Ability SFX (attacks, projectile throws, hits, and buffs) play at a softened volume scale (`~0.28–0.32`).
  - Added duplicate sound effect throttling (50ms window) and gentle output volume capping (`0.40 max`) in `src/audio/audio-manager.ts` to prevent browser and OS dynamic range compression limiters from ducking or cutting out the background music.

---

### 4. Real-Time Combat Flow
- Once the countdown ends (or upon clicking `⚡ FIGHT NOW`), the units immediately engage in real-time independent auto-chess combat from their new coordinates.
