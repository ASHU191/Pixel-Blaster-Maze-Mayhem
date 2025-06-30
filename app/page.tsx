"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Play, Pause, RotateCcw, Trophy, Heart, Bomb, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react"

// Game constants
const GRID_SIZE = 15
const CELL_SIZE = 32
const CANVAS_WIDTH = GRID_SIZE * CELL_SIZE
const CANVAS_HEIGHT = GRID_SIZE * CELL_SIZE

// Tile types
const TILE_EMPTY = 0
const TILE_UNBREAKABLE = 1
const TILE_BREAKABLE = 2

// Power-up types
const POWERUP_BOMB_COUNT = "bomb_count"
const POWERUP_BOMB_RANGE = "bomb_range"
const POWERUP_SPEED = "speed"
const POWERUP_LIFE = "life"
const POWERUP_SHIELD = "shield"
const POWERUP_MEGA_BOMB = "mega_bomb"

// Game entities
interface Position {
  x: number
  y: number
}

interface Player {
  x: number
  y: number
  lives: number
  bombCount: number
  maxBombs: number
  bombRange: number
  speed: number
  hasShield: boolean
  shieldTimer: number
}

interface Enemy {
  id: number
  x: number
  y: number
  direction: number
  moveTimer: number
  bombTimer: number
  bombCount: number
  maxBombs: number
  bombRange: number
}

interface BombEntity {
  id: number
  x: number
  y: number
  timer: number
  exploded: boolean
  range: number
  isMega: boolean
  owner: "player" | "enemy"
  ownerId?: number
}

interface Explosion {
  id: number
  x: number
  y: number
  timer: number
}

interface PowerUp {
  id: number
  x: number
  y: number
  type: string
  timer: number
}

export default function PixelBlasterGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number>()

  // Game state
  const [gameState, setGameState] = useState<"menu" | "playing" | "paused" | "gameOver">("menu")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [level, setLevel] = useState(1)

  // Add movement timer state after other state declarations
  const [lastMoveTime, setLastMoveTime] = useState(0)
  const MOVE_DELAY = 150 // milliseconds between moves

  // Add escape logic state after other state declarations
  const [playerEscaping, setPlayerEscaping] = useState(false)
  const [escapeDirection, setEscapeDirection] = useState<{ x: number; y: number } | null>(null)

  // Mobile controls state
  const [mobileControls, setMobileControls] = useState({
    up: false,
    down: false,
    left: false,
    right: false,
  })

  // Game entities
  const [grid, setGrid] = useState<number[][]>([])
  const [player, setPlayer] = useState<Player>({
    x: 1,
    y: 1,
    lives: 3,
    bombCount: 0,
    maxBombs: 1,
    bombRange: 2,
    speed: 1,
    hasShield: false,
    shieldTimer: 0,
  })
  const [enemies, setEnemies] = useState<Enemy[]>([])
  const [bombs, setBombs] = useState<BombEntity[]>([])
  const [explosions, setExplosions] = useState<Explosion[]>([])
  const [powerUps, setPowerUps] = useState<PowerUp[]>([])

  // Input handling
  const keysPressed = useRef<Set<string>>(new Set())

  // Mobile control handlers
  const handleMobileMove = useCallback((direction: string, pressed: boolean) => {
    setMobileControls((prev) => ({
      ...prev,
      [direction]: pressed,
    }))

    if (pressed) {
      keysPressed.current.add(direction)
    } else {
      keysPressed.current.delete(direction)
    }
  }, [])

  // Mobile control handlers ko update karte hain
  const handleMobileBomb = useCallback(() => {
    if (gameState !== "playing") return

    // Same logic as keyboard spacebar - use current player position
    if (player.bombCount >= player.maxBombs) return

    // Use current player position (not fixed coordinates)
    const bombX = player.x
    const bombY = player.y

    // Check if there's already a bomb at this position
    const existingBomb = bombs.find((bomb) => bomb.x === bombX && bomb.y === bombY)
    if (existingBomb) return

    // Check if player has mega bomb power-up
    const hasMegaPowerUp = powerUps.some((p) => p.type === POWERUP_MEGA_BOMB && p.x === player.x && p.y === player.y)

    const newBomb: BombEntity = {
      id: Date.now() + Math.random(), // Add random to ensure unique ID
      x: bombX,
      y: bombY,
      timer: 120, // 2 seconds at 60fps
      exploded: false,
      range: player.bombRange,
      isMega: hasMegaPowerUp,
      owner: "player",
    }

    setBombs((prev) => [...prev, newBomb])
    setPlayer((prev) => ({ ...prev, bombCount: prev.bombCount + 1 }))
  }, [gameState, player, bombs, powerUps])

  // Also update the placeBomb function to ensure consistency
  const placeBomb = useCallback(() => {
    if (gameState !== "playing") return
    if (player.bombCount >= player.maxBombs) return

    // Use current player position
    const bombX = player.x
    const bombY = player.y

    // Check if there's already a bomb at this position
    const existingBomb = bombs.find((bomb) => bomb.x === bombX && bomb.y === bombY)
    if (existingBomb) return

    // Check if player has mega bomb power-up
    const hasMegaPowerUp = powerUps.some((p) => p.type === POWERUP_MEGA_BOMB && p.x === player.x && p.y === player.y)

    const newBomb: BombEntity = {
      id: Date.now() + Math.random(), // Add random to ensure unique ID
      x: bombX,
      y: bombY,
      timer: 120, // 2 seconds at 60fps
      exploded: false,
      range: player.bombRange,
      isMega: hasMegaPowerUp,
      owner: "player",
    }

    setBombs((prev) => [...prev, newBomb])
    setPlayer((prev) => ({ ...prev, bombCount: prev.bombCount + 1 }))
  }, [gameState, player, bombs, powerUps])

  // Create power-up when wall is destroyed
  const createPowerUp = useCallback((x: number, y: number) => {
    // 40% chance to drop a power-up
    if (Math.random() < 0.4) {
      const powerUpTypes = [
        POWERUP_BOMB_COUNT,
        POWERUP_BOMB_RANGE,
        POWERUP_SPEED,
        POWERUP_LIFE,
        POWERUP_SHIELD,
        POWERUP_MEGA_BOMB,
      ]

      const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)]

      const newPowerUp: PowerUp = {
        id: Date.now() + Math.random(),
        x,
        y,
        type: randomType,
        timer: 600, // 10 seconds to collect
      }

      setPowerUps((prev) => [...prev, newPowerUp])
    }
  }, [])

  // Collect power-up
  const collectPowerUp = useCallback((powerUp: PowerUp) => {
    setPlayer((prev) => {
      const newPlayer = { ...prev }

      switch (powerUp.type) {
        case POWERUP_BOMB_COUNT:
          newPlayer.maxBombs = Math.min(5, prev.maxBombs + 1)
          break
        case POWERUP_BOMB_RANGE:
          newPlayer.bombRange = Math.min(4, prev.bombRange + 1)
          break
        case POWERUP_SPEED:
          newPlayer.speed = Math.min(3, prev.speed + 1)
          break
        case POWERUP_LIFE:
          newPlayer.lives = Math.min(5, prev.lives + 1)
          break
        case POWERUP_SHIELD:
          newPlayer.hasShield = true
          newPlayer.shieldTimer = 300 // 5 seconds
          break
        case POWERUP_MEGA_BOMB:
          // Next bomb will be mega bomb (handled in placeBomb)
          break
      }

      return newPlayer
    })

    // Remove collected power-up
    setPowerUps((prev) => prev.filter((p) => p.id !== powerUp.id))

    // Add score bonus
    setScore((prev) => prev + 200)
  }, [])

  // Check if position is safe from explosions
  const isPositionSafe = useCallback(
    (x: number, y: number, excludeBombId?: number) => {
      // Check if position will be in explosion range of any bomb
      return !bombs.some((bomb) => {
        if (excludeBombId && bomb.id === excludeBombId) return false
        if (bomb.timer > 60) return false // Only check bombs about to explode

        // Check if position is in bomb's explosion range
        if (bomb.x === x && bomb.y === y) return true

        // Check 4 directions
        const directions = [
          { dx: 0, dy: -1 }, // Up
          { dx: 1, dy: 0 }, // Right
          { dx: 0, dy: 1 }, // Down
          { dx: -1, dy: 0 }, // Left
        ]

        return directions.some((dir) => {
          for (let i = 1; i <= bomb.range; i++) {
            const checkX = bomb.x + dir.dx * i
            const checkY = bomb.y + dir.dy * i

            if (checkX < 0 || checkX >= GRID_SIZE || checkY < 0 || checkY >= GRID_SIZE) break
            if (grid[checkY] && grid[checkY][checkX] === TILE_UNBREAKABLE) break

            if (checkX === x && checkY === y) return true

            if (grid[checkY] && grid[checkY][checkX] === TILE_BREAKABLE) break
          }
          return false
        })
      })
    },
    [bombs, grid],
  )

  // Enemy places bomb
  const enemyPlaceBomb = useCallback(
    (enemy: Enemy) => {
      if (enemy.bombCount >= enemy.maxBombs) return false

      // Check if there's already a bomb at this position
      const existingBomb = bombs.find((bomb) => bomb.x === enemy.x && bomb.y === enemy.y)
      if (existingBomb) return false

      // More aggressive bomb placement
      const distanceToPlayer = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y)
      const shouldPlaceBomb =
        distanceToPlayer <= 4 || // Increased range from 3 to 4
        Math.random() < 0.05 || // Increased chance from 0.02 to 0.05 (5%)
        (distanceToPlayer <= 6 && Math.random() < 0.03) // Additional condition

      if (!shouldPlaceBomb) return false

      const newBomb: BombEntity = {
        id: Date.now() + Math.random(),
        x: enemy.x,
        y: enemy.y,
        timer: 120, // 2 seconds at 60fps
        exploded: false,
        range: enemy.bombRange,
        isMega: false,
        owner: "enemy",
        ownerId: enemy.id,
      }

      setBombs((prev) => [...prev, newBomb])

      // Update the specific enemy's bomb count
      setEnemies((prev) => prev.map((e) => (e.id === enemy.id ? { ...e, bombCount: e.bombCount + 1 } : e)))

      return true
    },
    [bombs, player.x, player.y],
  )

  // Initialize game
  const initializeGame = useCallback(() => {
    // Create grid with walls
    const newGrid: number[][] = Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(TILE_EMPTY))

    // Add border walls
    for (let i = 0; i < GRID_SIZE; i++) {
      newGrid[0][i] = TILE_UNBREAKABLE
      newGrid[GRID_SIZE - 1][i] = TILE_UNBREAKABLE
      newGrid[i][0] = TILE_UNBREAKABLE
      newGrid[i][GRID_SIZE - 1] = TILE_UNBREAKABLE
    }

    // Add internal unbreakable walls in a pattern
    for (let y = 2; y < GRID_SIZE - 2; y += 2) {
      for (let x = 2; x < GRID_SIZE - 2; x += 2) {
        newGrid[y][x] = TILE_UNBREAKABLE
      }
    }

    // Add random breakable walls
    for (let y = 1; y < GRID_SIZE - 1; y++) {
      for (let x = 1; x < GRID_SIZE - 1; x++) {
        if (newGrid[y][x] === TILE_EMPTY && Math.random() < 0.4) {
          // Don't place walls near player start position
          if (!(x <= 3 && y <= 3)) {
            newGrid[y][x] = TILE_BREAKABLE
          }
        }
      }
    }

    setGrid(newGrid)

    // Reset player with starting stats
    setPlayer({
      x: 1,
      y: 1,
      lives: 3,
      bombCount: 0,
      maxBombs: 1,
      bombRange: 2,
      speed: 1,
      hasShield: false,
      shieldTimer: 0,
    })

    // Create enemies with bomb abilities
    const newEnemies: Enemy[] = []
    for (let i = 0; i < 3 + level; i++) {
      let x, y
      do {
        x = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1
        y = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1
      } while (newGrid[y][x] !== TILE_EMPTY || (x <= 3 && y <= 3))

      newEnemies.push({
        id: i,
        x,
        y,
        direction: Math.floor(Math.random() * 4),
        moveTimer: 0,
        bombTimer: Math.floor(Math.random() * 60), // Random start timer
        bombCount: 0,
        maxBombs: 2 + Math.floor(level / 2), // Increased from 1 + level/2 to 2 + level/2
        bombRange: 2,
      })
    }
    setEnemies(newEnemies)

    // Clear bombs, explosions, and power-ups
    setBombs([])
    setExplosions([])
    setPowerUps([])
  }, [level])

  // Load high score from localStorage
  useEffect(() => {
    const savedHighScore = localStorage.getItem("pixelBlasterHighScore")
    if (savedHighScore) {
      setHighScore(Number.parseInt(savedHighScore))
    }
  }, [])

  // Save high score to localStorage
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem("pixelBlasterHighScore", score.toString())
    }
  }, [score, highScore])

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault() // Prevent default browser behavior
      const key = e.key.toLowerCase()
      keysPressed.current.add(key)

      if (gameState === "playing") {
        // Multiple ways to detect spacebar
        if (e.code === "Space" || key === " " || e.keyCode === 32) {
          placeBomb()
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysPressed.current.delete(key)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [gameState, placeBomb])

  // Move player with timing and speed
  const movePlayer = useCallback(() => {
    if (gameState !== "playing") return

    const now = Date.now()
    const moveDelay = Math.max(50, MOVE_DELAY - (player.speed - 1) * 30) // Faster with speed power-up
    if (now - lastMoveTime < moveDelay) return

    let newX = player.x
    let newY = player.y
    let moved = false

    // Check movement keys (prioritize last pressed) - support both keyboard and mobile
    if (keysPressed.current.has("arrowup") || keysPressed.current.has("w") || keysPressed.current.has("up")) {
      newY = Math.max(0, player.y - 1)
      moved = true
    } else if (
      keysPressed.current.has("arrowdown") ||
      keysPressed.current.has("s") ||
      keysPressed.current.has("down")
    ) {
      newY = Math.min(GRID_SIZE - 1, player.y + 1)
      moved = true
    }

    if (keysPressed.current.has("arrowleft") || keysPressed.current.has("a") || keysPressed.current.has("left")) {
      newX = Math.max(0, player.x - 1)
      moved = true
    } else if (
      keysPressed.current.has("arrowright") ||
      keysPressed.current.has("d") ||
      keysPressed.current.has("right")
    ) {
      newX = Math.min(GRID_SIZE - 1, player.x + 1)
      moved = true
    }

    // Only move if position changed and no wall collision
    if (moved && (newX !== player.x || newY !== player.y)) {
      if (grid[newY] && grid[newY][newX] === TILE_EMPTY) {
        setPlayer((prev) => ({ ...prev, x: newX, y: newY }))
        setLastMoveTime(now)

        // Check for power-up collection
        const powerUpAtPosition = powerUps.find((p) => p.x === newX && p.y === newY)
        if (powerUpAtPosition) {
          collectPowerUp(powerUpAtPosition)
        }
      }
    }
  }, [gameState, player, grid, lastMoveTime, powerUps, collectPowerUp])

  // Update power-ups
  const updatePowerUps = useCallback(() => {
    setPowerUps((prev) =>
      prev
        .map((powerUp) => ({
          ...powerUp,
          timer: powerUp.timer - 1,
        }))
        .filter((powerUp) => powerUp.timer > 0),
    )
  }, [])

  // Update player shield
  const updatePlayer = useCallback(() => {
    setPlayer((prev) => {
      if (prev.hasShield && prev.shieldTimer > 0) {
        return {
          ...prev,
          shieldTimer: prev.shieldTimer - 1,
          hasShield: prev.shieldTimer > 1,
        }
      }
      return prev
    })
  }, [])

  // Update enemies with smart AI
  const updateEnemies = useCallback(() => {
    setEnemies((prev) =>
      prev.map((enemy) => {
        const newEnemy = { ...enemy }
        newEnemy.moveTimer++
        newEnemy.bombTimer++

        // Try to place bomb every 2 seconds instead of 3
        if (newEnemy.bombTimer >= 120) {
          // Changed from 180 to 120
          newEnemy.bombTimer = 0

          // Try to place bomb with current enemy state
          if (newEnemy.bombCount < newEnemy.maxBombs) {
            const distanceToPlayer = Math.abs(newEnemy.x - player.x) + Math.abs(newEnemy.y - player.y)
            const existingBomb = bombs.find((bomb) => bomb.x === newEnemy.x && bomb.y === newEnemy.y)

            if (!existingBomb && (distanceToPlayer <= 4 || Math.random() < 0.08)) {
              const newBomb: BombEntity = {
                id: Date.now() + Math.random(),
                x: newEnemy.x,
                y: newEnemy.y,
                timer: 120,
                exploded: false,
                range: newEnemy.bombRange,
                isMega: false,
                owner: "enemy",
                ownerId: newEnemy.id,
              }

              setBombs((prev) => [...prev, newBomb])
              newEnemy.bombCount = newEnemy.bombCount + 1
            }
          }
        }

        if (newEnemy.moveTimer >= 20) {
          // Move every 0.33 seconds (faster than before)
          newEnemy.moveTimer = 0

          // Smart movement - try to avoid dangerous areas
          const possibleMoves = [
            { x: enemy.x, y: enemy.y - 1, dir: 0 }, // Up
            { x: enemy.x + 1, y: enemy.y, dir: 1 }, // Right
            { x: enemy.x, y: enemy.y + 1, dir: 2 }, // Down
            { x: enemy.x - 1, y: enemy.y, dir: 3 }, // Left
          ]

          // Filter valid moves
          const validMoves = possibleMoves.filter(
            (move) =>
              move.x >= 0 &&
              move.x < GRID_SIZE &&
              move.y >= 0 &&
              move.y < GRID_SIZE &&
              grid[move.y] &&
              grid[move.y][move.x] === TILE_EMPTY,
          )

          // Prefer safe moves
          const safeMoves = validMoves.filter((move) => isPositionSafe(move.x, move.y))

          let chosenMove
          if (safeMoves.length > 0) {
            // Choose safe move
            chosenMove = safeMoves[Math.floor(Math.random() * safeMoves.length)]
          } else if (validMoves.length > 0) {
            // No safe moves, choose any valid move
            chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)]
          }

          if (chosenMove) {
            newEnemy.x = chosenMove.x
            newEnemy.y = chosenMove.y
            newEnemy.direction = chosenMove.dir
          } else {
            // Change direction randomly if stuck
            newEnemy.direction = Math.floor(Math.random() * 4)
          }
        }

        return newEnemy
      }),
    )
  }, [grid, isPositionSafe, enemyPlaceBomb, player.x, player.y, bombs])

  // Update bombs
  const updateBombs = useCallback(() => {
    setBombs((prev) => {
      const updatedBombs = prev.map((bomb) => ({
        ...bomb,
        timer: bomb.timer - 1,
      }))

      // Handle explosions
      const explodingBombs = updatedBombs.filter((bomb) => bomb.timer <= 0 && !bomb.exploded)

      explodingBombs.forEach((bomb) => {
        // Create explosion
        const newExplosions: Explosion[] = []
        const explosionPositions: Position[] = [{ x: bomb.x, y: bomb.y }]

        // Add explosion in 4 directions
        const directions = [
          { dx: 0, dy: -1 }, // Up
          { dx: 1, dy: 0 }, // Right
          { dx: 0, dy: 1 }, // Down
          { dx: -1, dy: 0 }, // Left
        ]

        directions.forEach((dir) => {
          const range = bomb.isMega ? bomb.range + 2 : bomb.range
          for (let i = 1; i <= range; i++) {
            const x = bomb.x + dir.dx * i
            const y = bomb.y + dir.dy * i

            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
              if (grid[y][x] === TILE_UNBREAKABLE) break

              explosionPositions.push({ x, y })

              if (grid[y][x] === TILE_BREAKABLE) {
                // Destroy breakable wall and create power-up
                setGrid((prevGrid) => {
                  const newGrid = [...prevGrid]
                  newGrid[y] = [...newGrid[y]]
                  newGrid[y][x] = TILE_EMPTY
                  return newGrid
                })
                setScore((prevScore) => prevScore + 50)
                createPowerUp(x, y) // Create power-up chance
                break
              }
            } else {
              break
            }
          }
        })

        // Create explosion entities
        explosionPositions.forEach((pos, index) => {
          newExplosions.push({
            id: Date.now() + index,
            x: pos.x,
            y: pos.y,
            timer: 30,
          })
        })

        setExplosions((prev) => [...prev, ...newExplosions])

        // Decrease bomb count for owner
        if (bomb.owner === "player") {
          setPlayer((prev) => ({ ...prev, bombCount: prev.bombCount - 1 }))
        } else if (bomb.owner === "enemy" && bomb.ownerId !== undefined) {
          setEnemies((prev) => prev.map((e) => (e.id === bomb.ownerId ? { ...e, bombCount: e.bombCount - 1 } : e)))
        }
      })

      return updatedBombs.filter((bomb) => bomb.timer > 0)
    })
  }, [grid, createPowerUp])

  // Update explosions
  const updateExplosions = useCallback(() => {
    setExplosions((prev) =>
      prev
        .map((explosion) => ({
          ...explosion,
          timer: explosion.timer - 1,
        }))
        .filter((explosion) => explosion.timer > 0),
    )
  }, [])

  // Check collisions - only explosions can kill
  const checkCollisions = useCallback(() => {
    // Check player vs explosions with escape
    explosions.forEach((explosion) => {
      if (explosion.x === player.x && explosion.y === player.y) {
        if (!player.hasShield) {
          setPlayer((prev) => ({ ...prev, lives: prev.lives - 1 }))
          // Quick escape from explosion
          escapeFromDanger(explosion.x, explosion.y)
        }
      }
    })

    // Check enemies vs explosions
    setEnemies((prev) =>
      prev.filter((enemy) => {
        const hit = explosions.some((explosion) => explosion.x === enemy.x && explosion.y === enemy.y)
        if (hit) {
          setScore((prevScore) => prevScore + 100)
        }
        return !hit
      }),
    )
  }, [player, explosions])

  // Escape from danger function
  const escapeFromDanger = useCallback(
    (dangerX: number, dangerY: number) => {
      setPlayerEscaping(true)

      // Find safe escape direction
      const directions = [
        { x: -1, y: 0 }, // Left
        { x: 1, y: 0 }, // Right
        { x: 0, y: -1 }, // Up
        { x: 0, y: 1 }, // Down
      ]

      // Try each direction to find safe spot
      for (const dir of directions) {
        const newX = Math.max(0, Math.min(GRID_SIZE - 1, player.x + dir.x * 2))
        const newY = Math.max(0, Math.min(GRID_SIZE - 1, player.y + dir.y * 2))

        // Check if escape position is safe
        if (grid[newY] && grid[newY][newX] === TILE_EMPTY) {
          setEscapeDirection(dir)

          // Move player to safety quickly
          setTimeout(() => {
            setPlayer((prev) => ({ ...prev, x: newX, y: newY }))
            setPlayerEscaping(false)
            setEscapeDirection(null)
          }, 200)
          break
        }
      }

      // If no safe spot found, just move to starting position
      setTimeout(() => {
        setPlayer((prev) => ({ ...prev, x: 1, y: 1 }))
        setPlayerEscaping(false)
        setEscapeDirection(null)
      }, 200)
    },
    [player, grid],
  )

  // Game loop
  const gameLoop = useCallback(() => {
    if (gameState === "playing") {
      movePlayer()
      updatePlayer()
      updateEnemies()
      updateBombs()
      updateExplosions()
      updatePowerUps()
      checkCollisions()

      // Check game over
      if (player.lives <= 0) {
        setGameState("gameOver")
      }

      // Check level complete
      if (enemies.length === 0) {
        setLevel((prev) => prev + 1)
        setScore((prev) => prev + 1000)
        initializeGame()
      }
    }

    render()
    gameLoopRef.current = requestAnimationFrame(gameLoop)
  }, [
    gameState,
    movePlayer,
    updatePlayer,
    updateEnemies,
    updateBombs,
    updateExplosions,
    updatePowerUps,
    checkCollisions,
    player.lives,
    enemies.length,
    level,
    initializeGame,
  ])

  // Render game
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = "#1a1a1a"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw grid
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cellX = x * CELL_SIZE
        const cellY = y * CELL_SIZE

        switch (grid[y]?.[x]) {
          case TILE_UNBREAKABLE:
            ctx.fillStyle = "#4a5568"
            ctx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE)
            break
          case TILE_BREAKABLE:
            ctx.fillStyle = "#8b4513"
            ctx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE)
            break
          default:
            ctx.fillStyle = "#2d3748"
            ctx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE)
            break
        }

        // Draw grid lines
        ctx.strokeStyle = "#1a1a1a"
        ctx.lineWidth = 1
        ctx.strokeRect(cellX, cellY, CELL_SIZE, CELL_SIZE)
      }
    }

    // Draw power-ups
    powerUps.forEach((powerUp) => {
      const alpha = Math.sin(Date.now() * 0.01) * 0.3 + 0.7 // Pulsing effect
      const cellX = powerUp.x * CELL_SIZE
      const cellY = powerUp.y * CELL_SIZE

      // Different colors for different power-ups
      switch (powerUp.type) {
        case POWERUP_BOMB_COUNT:
          ctx.fillStyle = `rgba(255, 215, 0, ${alpha})` // Gold
          break
        case POWERUP_BOMB_RANGE:
          ctx.fillStyle = `rgba(255, 69, 0, ${alpha})` // Orange Red
          break
        case POWERUP_SPEED:
          ctx.fillStyle = `rgba(0, 255, 255, ${alpha})` // Cyan
          break
        case POWERUP_LIFE:
          ctx.fillStyle = `rgba(255, 20, 147, ${alpha})` // Deep Pink
          break
        case POWERUP_SHIELD:
          ctx.fillStyle = `rgba(138, 43, 226, ${alpha})` // Blue Violet
          break
        case POWERUP_MEGA_BOMB:
          ctx.fillStyle = `rgba(255, 0, 0, ${alpha})` // Red
          break
      }

      ctx.fillRect(cellX + 6, cellY + 6, CELL_SIZE - 12, CELL_SIZE - 12)

      // Add icon indicator
      ctx.fillStyle = "#ffffff"
      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      let icon = ""
      switch (powerUp.type) {
        case POWERUP_BOMB_COUNT:
          icon = "+B"
          break
        case POWERUP_BOMB_RANGE:
          icon = "R+"
          break
        case POWERUP_SPEED:
          icon = "S+"
          break
        case POWERUP_LIFE:
          icon = "♥"
          break
        case POWERUP_SHIELD:
          icon = "🛡"
          break
        case POWERUP_MEGA_BOMB:
          icon = "💥"
          break
      }
      ctx.fillText(icon, cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2 + 4)
    })

    // Draw explosions
    explosions.forEach((explosion) => {
      const alpha = explosion.timer / 30
      ctx.fillStyle = `rgba(255, 165, 0, ${alpha})`
      ctx.fillRect(explosion.x * CELL_SIZE, explosion.y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
    })

    // Draw bombs with owner distinction
    bombs.forEach((bomb) => {
      const flash = Math.floor(bomb.timer / 10) % 2
      let bombColor

      if (bomb.owner === "player") {
        bombColor = bomb.isMega ? (flash ? "#ff0000" : "#8b0000") : flash ? "#ff4500" : "#8b0000"
      } else {
        // Enemy bombs are darker/different color
        bombColor = flash ? "#800080" : "#4b0082" // Purple for enemy bombs
      }

      ctx.fillStyle = bombColor
      const size = bomb.isMega ? CELL_SIZE - 4 : CELL_SIZE - 8
      const offset = bomb.isMega ? 2 : 4
      ctx.fillRect(bomb.x * CELL_SIZE + offset, bomb.y * CELL_SIZE + offset, size, size)

      // Add owner indicator
      if (bomb.owner === "enemy") {
        ctx.fillStyle = "#ffffff"
        ctx.font = "10px Arial"
        ctx.textAlign = "center"
        ctx.fillText("E", bomb.x * CELL_SIZE + CELL_SIZE / 2, bomb.y * CELL_SIZE + CELL_SIZE / 2 + 3)
      }
    })

    // Draw enemies
    enemies.forEach((enemy) => {
      ctx.fillStyle = "#e53e3e"
      ctx.fillRect(enemy.x * CELL_SIZE + 2, enemy.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4)

      // Add enemy face
      ctx.fillStyle = "#ffffff"
      // Eyes
      ctx.fillRect(enemy.x * CELL_SIZE + 8, enemy.y * CELL_SIZE + 8, 3, 3)
      ctx.fillRect(enemy.x * CELL_SIZE + 17, enemy.y * CELL_SIZE + 8, 3, 3)

      // Angry mouth
      ctx.fillStyle = "#000000"
      ctx.fillRect(enemy.x * CELL_SIZE + 10, enemy.y * CELL_SIZE + 20, 8, 2)
    })

    // Draw player with character icon and escape animation
    const playerX = player.x * CELL_SIZE
    const playerY = player.y * CELL_SIZE

    // Player escape animation
    if (playerEscaping && escapeDirection) {
      const shakeX = Math.sin(Date.now() * 0.02) * 3
      const shakeY = Math.cos(Date.now() * 0.02) * 3

      // Draw player with shake effect
      ctx.fillStyle = "#ff6b6b"
      ctx.fillRect(playerX + 2 + shakeX, playerY + 2 + shakeY, CELL_SIZE - 4, CELL_SIZE - 4)

      // Draw escape trail
      ctx.fillStyle = "rgba(72, 187, 120, 0.3)"
      ctx.fillRect(playerX - escapeDirection.x * 10, playerY - escapeDirection.y * 10, CELL_SIZE - 4, CELL_SIZE - 4)
    } else {
      // Normal player drawing with character
      let playerColor = "#48bb78"

      // Shield effect
      if (player.hasShield) {
        const shieldAlpha = Math.sin(Date.now() * 0.02) * 0.3 + 0.7
        ctx.fillStyle = `rgba(138, 43, 226, ${shieldAlpha})`
        ctx.fillRect(playerX, playerY, CELL_SIZE, CELL_SIZE)
        playerColor = "#9f7aea"
      }

      ctx.fillStyle = playerColor
      ctx.fillRect(playerX + 2, playerY + 2, CELL_SIZE - 4, CELL_SIZE - 4)

      // Add character face/icon
      ctx.fillStyle = "#ffffff"
      // Eyes
      ctx.fillRect(playerX + 8, playerY + 8, 4, 4)
      ctx.fillRect(playerX + 16, playerY + 8, 4, 4)

      // Smile
      ctx.fillStyle = "#000000"
      ctx.fillRect(playerX + 10, playerY + 18, 8, 2)
      ctx.fillRect(playerX + 8, playerY + 16, 2, 2)
      ctx.fillRect(playerX + 18, playerY + 16, 2, 2)
    }
  }, [grid, player, enemies, bombs, explosions, powerUps, playerEscaping, escapeDirection])

  // Start game loop
  useEffect(() => {
    if (gameState === "playing") {
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    } else {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameState, gameLoop])

  // Initialize game when starting
  useEffect(() => {
    if (gameState === "playing") {
      initializeGame()
    }
  }, [gameState, initializeGame])

  const startGame = () => {
    setScore(0)
    setLevel(1)
    setGameState("playing")
  }

  const pauseGame = () => {
    setGameState(gameState === "paused" ? "playing" : "paused")
  }

  const resetGame = () => {
    setGameState("menu")
    setScore(0)
    setLevel(1)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2 text-yellow-400">🎮 Pixel Blaster: Maze Mayhem</h1>
          <p className="text-gray-300">Smart enemies with bombs! Mobile & Desktop friendly!</p>
        </div>

        <div className="flex flex-col xl:flex-row gap-6 items-start justify-center">
          {/* Game Canvas */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="border-2 border-gray-600 rounded-lg bg-gray-800"
            />

            {/* Mobile Controls */}
            <div className="mt-6 flex flex-col items-center gap-6 md:hidden">
              {/* Direction Pad */}
              <div className="relative w-32 h-32">
                {/* Up Button */}
                <Button
                  className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full ${
                    mobileControls.up ? "bg-blue-600" : "bg-gray-700"
                  } hover:bg-blue-600 active:bg-blue-700 shadow-lg border-2 border-gray-600`}
                  onTouchStart={() => handleMobileMove("up", true)}
                  onTouchEnd={() => handleMobileMove("up", false)}
                  onMouseDown={() => handleMobileMove("up", true)}
                  onMouseUp={() => handleMobileMove("up", false)}
                  onMouseLeave={() => handleMobileMove("up", false)}
                >
                  <ArrowUp className="w-5 h-5" />
                </Button>

                {/* Left Button */}
                <Button
                  className={`absolute top-1/2 left-0 transform -translate-y-1/2 w-12 h-12 rounded-full ${
                    mobileControls.left ? "bg-blue-600" : "bg-gray-700"
                  } hover:bg-blue-600 active:bg-blue-700 shadow-lg border-2 border-gray-600`}
                  onTouchStart={() => handleMobileMove("left", true)}
                  onTouchEnd={() => handleMobileMove("left", false)}
                  onMouseDown={() => handleMobileMove("left", true)}
                  onMouseUp={() => handleMobileMove("up", false)}
                  onMouseLeave={() => handleMobileMove("left", false)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>

                {/* Center Circle */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-gray-800 rounded-full border-2 border-gray-600 shadow-inner"></div>

                {/* Right Button */}
                <Button
                  className={`absolute top-1/2 right-0 transform -translate-y-1/2 w-12 h-12 rounded-full ${
                    mobileControls.right ? "bg-blue-600" : "bg-gray-700"
                  } hover:bg-blue-600 active:bg-blue-700 shadow-lg border-2 border-gray-600`}
                  onTouchStart={() => handleMobileMove("right", true)}
                  onTouchEnd={() => handleMobileMove("right", false)}
                  onMouseDown={() => handleMobileMove("right", true)}
                  onMouseUp={() => handleMobileMove("right", false)}
                  onMouseLeave={() => handleMobileMove("right", false)}
                >
                  <ArrowRight className="w-5 h-5" />
                </Button>

                {/* Down Button */}
                <Button
                  className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full ${
                    mobileControls.down ? "bg-blue-600" : "bg-gray-700"
                  } hover:bg-blue-600 active:bg-blue-700 shadow-lg border-2 border-gray-600`}
                  onTouchStart={() => handleMobileMove("down", true)}
                  onTouchEnd={() => handleMobileMove("down", false)}
                  onMouseDown={() => handleMobileMove("down", true)}
                  onMouseUp={() => handleMobileMove("down", false)}
                  onMouseLeave={() => handleMobileMove("down", false)}
                >
                  <ArrowDown className="w-5 h-5" />
                </Button>
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center gap-8">
                {/* Bomb Button */}
                <Button
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 active:from-red-700 active:to-red-900 text-white font-bold shadow-lg border-2 border-red-400 transform transition-transform active:scale-95"
                  onTouchStart={handleMobileBomb}
                  onMouseDown={handleMobileBomb}
                >
                  <Bomb className="w-7 h-7" />
                </Button>

                {/* Pause Button for Mobile */}
                {gameState === "playing" && (
                  <Button
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 hover:from-yellow-600 hover:to-yellow-800 text-white shadow-lg border-2 border-yellow-400"
                    onClick={pauseGame}
                  >
                    <Pause className="w-5 h-5" />
                  </Button>
                )}
              </div>

              {/* Mobile Controls Guide */}
              <div className="text-center text-xs text-gray-400 max-w-xs">
                <p>🎮 Hold direction buttons to move • 💣 Tap to drop bomb</p>
              </div>
            </div>

            {/* Game State Overlays */}
            {gameState === "menu" && (
              <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center rounded-lg">
                <Card className="p-6 bg-gray-800 border-gray-600">
                  <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-yellow-400">Welcome to Pixel Blaster!</h2>
                    <div className="text-sm text-gray-300 space-y-2">
                      <p>🎯 Use WASD/Arrow Keys or Mobile Controls</p>
                      <p>💣 Press SPACEBAR or Bomb Button to drop bombs</p>
                      <p>🤖 Enemies also place bombs now!</p>
                      <p>💥 Only bomb explosions can kill!</p>
                      <p>⭐ Collect power-ups from destroyed walls</p>
                      <p>❤️ You have 3 lives - avoid explosions!</p>
                    </div>
                    <Button onClick={startGame} className="bg-yellow-600 hover:bg-yellow-700">
                      <Play className="w-4 h-4 mr-2" />
                      Start Game
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {gameState === "paused" && (
              <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center rounded-lg">
                <Card className="p-6 bg-gray-800 border-gray-600">
                  <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-yellow-400">Game Paused</h2>
                    <Button onClick={pauseGame} className="bg-green-600 hover:bg-green-700">
                      <Play className="w-4 h-4 mr-2" />
                      Resume
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {gameState === "gameOver" && (
              <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center rounded-lg">
                <Card className="p-6 bg-gray-800 border-gray-600">
                  <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-red-400">Game Over!</h2>
                    <p className="text-lg">
                      Final Score: <span className="text-yellow-400">{score}</span>
                    </p>
                    {score === highScore && <p className="text-green-400 font-bold">🎉 New High Score!</p>}
                    <div className="flex gap-2 justify-center">
                      <Button onClick={startGame} className="bg-green-600 hover:bg-green-700">
                        <Play className="w-4 h-4 mr-2" />
                        Play Again
                      </Button>
                      <Button onClick={resetGame} variant="outline" className="border-gray-600 bg-transparent">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Main Menu
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* Game Info Panel */}
          <div className="space-y-4">
            {/* Score & Stats */}
            <Card className="p-4 bg-gray-800 border-gray-600">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Score:</span>
                  <span className="text-yellow-400 font-bold text-lg">{score}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Level:</span>
                  <span className="text-blue-400 font-bold">{level}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Lives:</span>
                  <div className="flex gap-1">
                    {Array.from({ length: player.lives }, (_, i) => (
                      <Heart key={i} className="w-4 h-4 text-red-500 fill-current" />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Bombs:</span>
                  <div className="flex gap-1">
                    {Array.from({ length: player.maxBombs - player.bombCount }, (_, i) => (
                      <Bomb key={i} className="w-4 h-4 text-orange-500" />
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Power-up Stats */}
            <Card className="p-4 bg-gray-800 border-gray-600">
              <h3 className="font-bold mb-2 text-purple-400">Power-ups:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Max Bombs:</span>
                  <span className="text-yellow-400">{player.maxBombs}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Bomb Range:</span>
                  <span className="text-orange-400">{player.bombRange}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Speed:</span>
                  <span className="text-cyan-400">{player.speed}</span>
                </div>
                {player.hasShield && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Shield:</span>
                    <span className="text-purple-400">{Math.ceil(player.shieldTimer / 60)}s</span>
                  </div>
                )}
              </div>
            </Card>

            {/* High Score */}
            <Card className="p-4 bg-gray-800 border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="text-gray-300">High Score:</span>
                </div>
                <span className="text-yellow-400 font-bold text-lg">{highScore}</span>
              </div>
            </Card>

            {/* Game Controls */}
            {gameState === "playing" && (
              <Card className="p-4 bg-gray-800 border-gray-600">
                <div className="space-y-2">
                  <Button onClick={pauseGame} className="w-full bg-blue-600 hover:bg-blue-700">
                    <Pause className="w-4 h-4 mr-2" />
                    Pause Game
                  </Button>
                  <Button onClick={resetGame} variant="outline" className="w-full border-gray-600 bg-transparent">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restart
                  </Button>
                </div>
              </Card>
            )}

            {/* Mobile Controls Info */}
            <Card className="p-4 bg-gray-800 border-gray-600 md:hidden">
              <h3 className="font-bold mb-2 text-green-400">Mobile Controls:</h3>
              <div className="text-xs text-gray-300 space-y-1">
                <p>📱 Use direction pad to move</p>
                <p>💣 Red button to drop bombs</p>
                <p>👆 Touch and hold for movement</p>
                <p>🎮 Works on all touch devices</p>
              </div>
            </Card>

            {/* Desktop Controls Info */}
            <Card className="p-4 bg-gray-800 border-gray-600 hidden md:block">
              <h3 className="font-bold mb-2 text-yellow-400">Desktop Controls:</h3>
              <div className="text-sm text-gray-300 space-y-1">
                <p>🎮 WASD / Arrow Keys: Move</p>
                <p>💣 SPACEBAR: Drop Bomb</p>
                <p>⭐ Walk over power-ups to collect</p>
              </div>
            </Card>

            {/* Enemy AI Info */}
            <Card className="p-4 bg-gray-800 border-gray-600">
              <h3 className="font-bold mb-2 text-red-400">Enemy AI:</h3>
              <div className="text-xs text-gray-300 space-y-1">
                <p>🤖 Enemies place bombs strategically</p>
                <p>🧠 They avoid dangerous areas</p>
                <p>💜 Purple bombs = Enemy bombs</p>
                <p>💥 Only explosions can kill anyone</p>
                <p>⚡ Enemies get smarter each level</p>
              </div>
            </Card>

            {/* Power-up Guide */}
            <Card className="p-4 bg-gray-800 border-gray-600">
              <h3 className="font-bold mb-2 text-green-400">Power-ups:</h3>
              <div className="text-xs text-gray-300 space-y-1">
                <p>🟡 +B: Extra Bomb</p>
                <p>🟠 R+: Bigger Range</p>
                <p>🔵 S+: Speed Boost</p>
                <p>🟣 ♥: Extra Life</p>
                <p>🟪 🛡: Shield (5s)</p>
                <p>🔴 💥: Mega Bomb</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
