# 🎮 Pixel Blaster: Maze Mayhem

A fast-paced 2D maze game inspired by **Bomberman**, built using **Next.js** and **TypeScript**. Blast your way through walls, dodge enemies, and rack up high scores—all without a login system!

## 🧠 Game Concept

**Pixel Blaster** is a top-down, grid-based maze game where players place bombs to destroy breakable walls and eliminate enemies.

- 🔹 2D Top-down view
- 🔹 Smooth canvas-based animations
- 🔹 Local high score saving with `localStorage`
- 🔹 No backend or database — pure frontend fun!

---

## 📦 Tech Stack

| Feature       | Technology                          |
|--------------|--------------------------------------|
| Frontend     | Next.js + TypeScript                 |
| UI Styling   | Tailwind CSS                         |
| State Mgmt   | React Hooks (`useState`, `useEffect`)|
| Game Engine  | Canvas API / `react-konva`           |
| Audio        | HTML5 Audio API                      |
| Storage      | `localStorage`                       |
| Deployment   | Vercel                               |

---

## 🕹️ Gameplay Features

### 👤 Player
- Move with **Arrow keys** or **WASD**
- Place bombs using **Spacebar**
- Starts with **3 lives**

### 💣 Bomb
- Explodes **2 seconds** after placement
- Destroys **breakable walls** in a **+ pattern**
- Eliminates enemies within blast radius

### 🧱 Tiles
- 🟫 **Breakable Walls** — destroyed by bombs
- ⬛ **Unbreakable Walls** — indestructible
- 🟩 **Empty Tiles** — floor tiles the player can walk on

### 👾 Enemies
- Move **randomly** around the maze
- Lose a life if they **touch the player**
- Can be **killed by bomb explosions**

### 🏆 Scoring
- +100 points per **enemy killed**
- +50 points per **wall destroyed**
- **High scores** are saved locally in the browser

---

## 🚀 How to Run Locally

```bash
git clone https://github.com/ashu191/pixel-blaster.git
cd pixel-blaster
npm install
npm run dev
