"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Leaderboard, SubmitScoreDialog } from "@/components/leaderboard"

interface Cell {
  isMine: boolean
  isRevealed: boolean
  isFlagged: boolean
  adjacentMines: number
}

interface GameState {
  board: Cell[][]
  gameStatus: "playing" | "won" | "lost"
  mineCount: number
  flagCount: number
  timer: number
  firstClick: boolean
  currency: number
  hasRevive: boolean
}

interface Difficulty {
  name: string
  rows: number
  cols: number
  mines: number
}

const difficulties: Difficulty[] = [
  { name: "Easy", rows: 9, cols: 9, mines: 10 },
  { name: "Medium", rows: 16, cols: 16, mines: 40 },
  { name: "Hard", rows: 16, cols: 30, mines: 99 },
]

export default function MinesweeperPage() {
  const [currentDifficulty, setCurrentDifficulty] = useState<Difficulty>(difficulties[0])
  const [gameState, setGameState] = useState<GameState>({
    board: [],
    gameStatus: "playing",
    mineCount: 0,
    flagCount: 0,
    timer: 0,
    firstClick: true,
    currency: 0,
    hasRevive: false,
  })
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showSubmitScore, setShowSubmitScore] = useState(false)

  const CURRENCY_PER_CELL = 5
  const POWERUP_COSTS = {
    revealRow: 200,
    revealColumn: 150,
    reveal10Random: 100,
    revive: 300,
  }

  const initializeBoard = useCallback((difficulty: Difficulty): Cell[][] => {
    const board: Cell[][] = []
    for (let row = 0; row < difficulty.rows; row++) {
      board[row] = []
      for (let col = 0; col < difficulty.cols; col++) {
        board[row][col] = {
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          adjacentMines: 0,
        }
      }
    }
    return board
  }, [])

  const calculateAdjacentMines = useCallback((board: Cell[][], difficulty: Difficulty) => {
    for (let row = 0; row < difficulty.rows; row++) {
      for (let col = 0; col < difficulty.cols; col++) {
        if (!board[row][col].isMine) {
          let count = 0
          for (let r = row - 1; r <= row + 1; r++) {
            for (let c = col - 1; c <= col + 1; c++) {
              if (r >= 0 && r < difficulty.rows && c >= 0 && c < difficulty.cols && board[r][c].isMine) {
                count++
              }
            }
          }
          board[row][col].adjacentMines = count
        }
      }
    }
  }, [])

  const isBoardSolvable = useCallback((board: Cell[][], difficulty: Difficulty, safeZone: Set<string>) => {
    // Create a test board state
    const testBoard = board.map(row => row.map(cell => ({
      ...cell,
      isRevealed: false,
      isFlagged: false
    })))

    // Reveal the safe zone
    safeZone.forEach(coord => {
      const [r, c] = coord.split(',').map(Number)
      testBoard[r][c].isRevealed = true
    })

    // Expand initial reveal (0-adjacent cells)
    let changed = true
    while (changed) {
      changed = false
      for (let r = 0; r < difficulty.rows; r++) {
        for (let c = 0; c < difficulty.cols; c++) {
          if (testBoard[r][c].isRevealed && testBoard[r][c].adjacentMines === 0 && !testBoard[r][c].isMine) {
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr, nc = c + dc
                if (nr >= 0 && nr < difficulty.rows && nc >= 0 && nc < difficulty.cols && !testBoard[nr][nc].isRevealed) {
                  testBoard[nr][nc].isRevealed = true
                  changed = true
                }
              }
            }
          }
        }
      }
    }

    // Solver logic - try to solve the board using logical deduction
    const MAX_ITERATIONS = 1000
    let iterations = 0
    
    while (iterations < MAX_ITERATIONS) {
      iterations++
      let progress = false

      for (let r = 0; r < difficulty.rows; r++) {
        for (let c = 0; c < difficulty.cols; c++) {
          if (!testBoard[r][c].isRevealed || testBoard[r][c].isMine) continue

          const neighbors = []
          let hiddenCount = 0
          let flaggedCount = 0

          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue
              const nr = r + dr, nc = c + dc
              if (nr >= 0 && nr < difficulty.rows && nc >= 0 && nc < difficulty.cols) {
                neighbors.push({ r: nr, c: nc })
                if (testBoard[nr][nc].isFlagged) flaggedCount++
                if (!testBoard[nr][nc].isRevealed && !testBoard[nr][nc].isFlagged) hiddenCount++
              }
            }
          }

          const minesNeeded = testBoard[r][c].adjacentMines - flaggedCount

          // Rule 1: If mines needed equals hidden cells, all hidden cells are mines
          if (minesNeeded === hiddenCount && hiddenCount > 0) {
            neighbors.forEach(({ r: nr, c: nc }) => {
              if (!testBoard[nr][nc].isRevealed && !testBoard[nr][nc].isFlagged) {
                testBoard[nr][nc].isFlagged = true
                progress = true
              }
            })
          }

          // Rule 2: If all mines are flagged, reveal remaining cells
          if (minesNeeded === 0 && hiddenCount > 0) {
            neighbors.forEach(({ r: nr, c: nc }) => {
              if (!testBoard[nr][nc].isRevealed && !testBoard[nr][nc].isFlagged) {
                testBoard[nr][nc].isRevealed = true
                progress = true
                
                // Cascade for 0-cells
                if (testBoard[nr][nc].adjacentMines === 0) {
                  const stack = [{ r: nr, c: nc }]
                  while (stack.length > 0) {
                    const { r: cr, c: cc } = stack.pop()!
                    for (let dr = -1; dr <= 1; dr++) {
                      for (let dc = -1; dc <= 1; dc++) {
                        const nnr = cr + dr, nnc = cc + dc
                        if (nnr >= 0 && nnr < difficulty.rows && nnc >= 0 && nnc < difficulty.cols && 
                            !testBoard[nnr][nnc].isRevealed && !testBoard[nnr][nnc].isFlagged && !testBoard[nnr][nnc].isMine) {
                          testBoard[nnr][nnc].isRevealed = true
                          if (testBoard[nnr][nnc].adjacentMines === 0) {
                            stack.push({ r: nnr, c: nnc })
                          }
                        }
                      }
                    }
                  }
                }
              }
            })
          }
        }
      }

      if (!progress) break
    }

    // Check if all non-mine cells are revealed
    for (let r = 0; r < difficulty.rows; r++) {
      for (let c = 0; c < difficulty.cols; c++) {
        if (!testBoard[r][c].isMine && !testBoard[r][c].isRevealed) {
          return false
        }
      }
    }

    return true
  }, [])

  const placeMines = useCallback(
    (board: Cell[][], difficulty: Difficulty, firstClickRow: number, firstClickCol: number) => {
      const mines = difficulty.mines
      const MAX_ATTEMPTS = 100

      // Create safe zone around first click (3x3 area)
      const safeZone = new Set<string>()
      for (let r = firstClickRow - 1; r <= firstClickRow + 1; r++) {
        for (let c = firstClickCol - 1; c <= firstClickCol + 1; c++) {
          if (r >= 0 && r < difficulty.rows && c >= 0 && c < difficulty.cols) {
            safeZone.add(`${r},${c}`)
          }
        }
      }

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // Reset board
        for (let r = 0; r < difficulty.rows; r++) {
          for (let c = 0; c < difficulty.cols; c++) {
            board[r][c].isMine = false
            board[r][c].adjacentMines = 0
          }
        }

        // Place mines randomly
        let minesPlaced = 0
        while (minesPlaced < mines) {
          const row = Math.floor(Math.random() * difficulty.rows)
          const col = Math.floor(Math.random() * difficulty.cols)

          if (!board[row][col].isMine && !safeZone.has(`${row},${col}`)) {
            board[row][col].isMine = true
            minesPlaced++
          }
        }

        // Calculate adjacent mines
        calculateAdjacentMines(board, difficulty)

        // Check if board is solvable
        if (isBoardSolvable(board, difficulty, safeZone)) {
          return
        }
      }

      // If no solvable board found after MAX_ATTEMPTS, use the last generated board
      // This is a fallback to ensure the game doesn't hang
      console.warn("Could not generate guaranteed solvable board after", MAX_ATTEMPTS, "attempts")
    },
    [calculateAdjacentMines, isBoardSolvable],
  )

  const revealCell = useCallback((board: Cell[][], row: number, col: number, difficulty: Difficulty, earnCurrency = false): number => {
    if (row < 0 || row >= difficulty.rows || col < 0 || col >= difficulty.cols) return 0
    if (board[row][col].isRevealed || board[row][col].isFlagged) return 0

    board[row][col].isRevealed = true
    let cellsRevealed = 1

    if (board[row][col].adjacentMines === 0 && !board[row][col].isMine) {
      for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
          if (r !== row || c !== col) {
            cellsRevealed += revealCell(board, r, c, difficulty, earnCurrency)
          }
        }
      }
    }

    return cellsRevealed
  }, [])

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (gameState.gameStatus !== "playing") return

      setGameState((prevState) => {
        const newBoard = prevState.board.map((row) => row.map((cell) => ({ ...cell })))

        // Handle first click
        if (prevState.firstClick) {
          placeMines(newBoard, currentDifficulty, row, col)
        }

        if (newBoard[row][col].isFlagged) return prevState

        if (newBoard[row][col].isMine && !prevState.firstClick) {
          // Check if player has revive powerup
          if (prevState.hasRevive && currentDifficulty.name === "Hard") {
            // Use revive - just flag the mine and continue
            newBoard[row][col].isFlagged = true
            const flagCount = newBoard.flat().filter((cell) => cell.isFlagged).length
            return {
              ...prevState,
              board: newBoard,
              hasRevive: false,
              flagCount,
            }
          }
          
          // Game over
          newBoard.forEach((boardRow) => {
            boardRow.forEach((cell) => {
              if (cell.isMine) cell.isRevealed = true
            })
          })
          return {
            ...prevState,
            board: newBoard,
            gameStatus: "lost",
          }
        }

        const cellsRevealed = revealCell(newBoard, row, col, currentDifficulty, true)

        // Award currency for hard mode
        let currencyEarned = 0
        if (currentDifficulty.name === "Hard" && !prevState.firstClick) {
          currencyEarned = cellsRevealed * CURRENCY_PER_CELL
        }

        // Check win condition
        let revealedCount = 0
        newBoard.forEach((boardRow) => {
          boardRow.forEach((cell) => {
            if (cell.isRevealed && !cell.isMine) revealedCount++
          })
        })

        const totalCells = currentDifficulty.rows * currentDifficulty.cols
        const isWon = revealedCount === totalCells - currentDifficulty.mines

        return {
          ...prevState,
          board: newBoard,
          gameStatus: isWon ? "won" : "playing",
          firstClick: false,
          currency: prevState.currency + currencyEarned,
        }
      })
    },
    [gameState.gameStatus, currentDifficulty, placeMines, calculateAdjacentMines, revealCell, CURRENCY_PER_CELL],
  )

  const handleCellRightClick = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      e.preventDefault()
      if (gameState.gameStatus !== "playing") return

      setGameState((prevState) => {
        const newBoard = prevState.board.map((row) => row.map((cell) => ({ ...cell })))

        if (!newBoard[row][col].isRevealed) {
          newBoard[row][col].isFlagged = !newBoard[row][col].isFlagged
          const flagCount = newBoard.flat().filter((cell) => cell.isFlagged).length

          return {
            ...prevState,
            board: newBoard,
            flagCount,
          }
        }

        return prevState
      })
    },
    [gameState.gameStatus],
  )

  const startNewGame = useCallback(
    (difficulty: Difficulty) => {
      if (timerInterval) {
        clearInterval(timerInterval)
        setTimerInterval(null)
      }

      setCurrentDifficulty(difficulty)
      setGameState({
        board: initializeBoard(difficulty),
        gameStatus: "playing",
        mineCount: difficulty.mines,
        flagCount: 0,
        timer: 0,
        firstClick: true,
        currency: 0,
        hasRevive: false,
      })
    },
    [initializeBoard, timerInterval],
  )

  const usePowerupRevealRow = useCallback(() => {
    if (currentDifficulty.name !== "Hard" || gameState.currency < POWERUP_COSTS.revealRow || gameState.gameStatus !== "playing") return

    setGameState((prevState) => {
      const newBoard = prevState.board.map((row) => row.map((cell) => ({ ...cell })))
      const unrevealedRows = newBoard
        .map((row, idx) => ({ row, idx }))
        .filter(({ row }) => row.some((cell) => !cell.isRevealed && !cell.isMine))
      
      if (unrevealedRows.length === 0) return prevState

      const randomRow = unrevealedRows[Math.floor(Math.random() * unrevealedRows.length)]
      let cellsRevealed = 0

      randomRow.row.forEach((cell, colIdx) => {
        if (cell.isMine) {
          cell.isFlagged = true
        } else if (!cell.isRevealed) {
          cell.isRevealed = true
          cellsRevealed++
        }
      })

      const flagCount = newBoard.flat().filter((cell) => cell.isFlagged).length

      return {
        ...prevState,
        board: newBoard,
        currency: prevState.currency - POWERUP_COSTS.revealRow,
        flagCount,
      }
    })
  }, [currentDifficulty.name, gameState.currency, gameState.gameStatus, POWERUP_COSTS.revealRow])

  const usePowerupRevealColumn = useCallback(() => {
    if (currentDifficulty.name !== "Hard" || gameState.currency < POWERUP_COSTS.revealColumn || gameState.gameStatus !== "playing") return

    setGameState((prevState) => {
      const newBoard = prevState.board.map((row) => row.map((cell) => ({ ...cell })))
      const unrevealedCols = Array.from({ length: currentDifficulty.cols }, (_, colIdx) => {
        const hasUnrevealed = newBoard.some((row) => !row[colIdx].isRevealed && !row[colIdx].isMine)
        return hasUnrevealed ? colIdx : -1
      }).filter((idx) => idx !== -1)

      if (unrevealedCols.length === 0) return prevState

      const randomCol = unrevealedCols[Math.floor(Math.random() * unrevealedCols.length)]
      let cellsRevealed = 0

      newBoard.forEach((row) => {
        const cell = row[randomCol]
        if (cell.isMine) {
          cell.isFlagged = true
        } else if (!cell.isRevealed) {
          cell.isRevealed = true
          cellsRevealed++
        }
      })

      const flagCount = newBoard.flat().filter((cell) => cell.isFlagged).length

      return {
        ...prevState,
        board: newBoard,
        currency: prevState.currency - POWERUP_COSTS.revealColumn,
        flagCount,
      }
    })
  }, [currentDifficulty.name, currentDifficulty.cols, gameState.currency, gameState.gameStatus, POWERUP_COSTS.revealColumn])

  const usePowerupReveal10Random = useCallback(() => {
    if (currentDifficulty.name !== "Hard" || gameState.currency < POWERUP_COSTS.reveal10Random || gameState.gameStatus !== "playing") return

    setGameState((prevState) => {
      const newBoard = prevState.board.map((row) => row.map((cell) => ({ ...cell })))
      const unrevealedCells: { row: number; col: number }[] = []

      newBoard.forEach((row, rowIdx) => {
        row.forEach((cell, colIdx) => {
          if (!cell.isRevealed && !cell.isMine && !cell.isFlagged) {
            unrevealedCells.push({ row: rowIdx, col: colIdx })
          }
        })
      })

      const cellsToReveal = Math.min(10, unrevealedCells.length)
      for (let i = 0; i < cellsToReveal; i++) {
        const randomIdx = Math.floor(Math.random() * unrevealedCells.length)
        const { row, col } = unrevealedCells[randomIdx]
        newBoard[row][col].isRevealed = true
        unrevealedCells.splice(randomIdx, 1)
      }

      return {
        ...prevState,
        board: newBoard,
        currency: prevState.currency - POWERUP_COSTS.reveal10Random,
      }
    })
  }, [currentDifficulty.name, gameState.currency, gameState.gameStatus, POWERUP_COSTS.reveal10Random])

  const usePowerupRevive = useCallback(() => {
    if (currentDifficulty.name !== "Hard" || gameState.currency < POWERUP_COSTS.revive || gameState.hasRevive || gameState.gameStatus !== "playing") return

    setGameState((prevState) => ({
      ...prevState,
      currency: prevState.currency - POWERUP_COSTS.revive,
      hasRevive: true,
    }))
  }, [currentDifficulty.name, gameState.currency, gameState.hasRevive, gameState.gameStatus, POWERUP_COSTS.revive])

  // Timer effect
  useEffect(() => {
    if (gameState.gameStatus === "playing" && !gameState.firstClick) {
      const interval = setInterval(() => {
        setGameState((prev) => ({ ...prev, timer: prev.timer + 10 }))
      }, 10)
      setTimerInterval(interval)
      return () => clearInterval(interval)
    } else if (timerInterval) {
      clearInterval(timerInterval)
      setTimerInterval(null)
    }
  }, [gameState.gameStatus, gameState.firstClick])

  // Initialize game on mount
  useEffect(() => {
    startNewGame(currentDifficulty)
  }, [])

  useEffect(() => {
    if (gameState.gameStatus === "won" && gameState.timer > 0) {
      setShowSubmitScore(true)
    }
  }, [gameState.gameStatus, gameState.timer])

  const getCellContent = (cell: Cell) => {
    if (cell.isFlagged) return "🚩"
    if (!cell.isRevealed) return ""
    if (cell.isMine) return "💣"
    if (cell.adjacentMines === 0) return ""
    return cell.adjacentMines.toString()
  }

  const getCellClassName = (cell: Cell) => {
    let className =
      "w-8 h-8 border border-gray-400 flex items-center justify-center text-sm font-bold cursor-pointer select-none "

    if (cell.isRevealed) {
      className += "bg-gray-200 "
      if (cell.isMine) {
        className += "bg-red-500 "
      } else {
        const colors = [
          "",
          "text-blue-600",
          "text-green-600",
          "text-red-600",
          "text-purple-600",
          "text-yellow-600",
          "text-pink-600",
          "text-gray-600",
          "text-black",
        ]
        className += colors[cell.adjacentMines] || "text-black"
      }
    } else {
      className += "bg-gray-300 hover:bg-gray-250 "
    }

    return className
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center text-3xl font-bold">Minesweeper</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Difficulty Selection */}
            <div className="flex justify-center gap-2 mb-4">
              {difficulties.map((difficulty) => (
                <Button
                  key={difficulty.name}
                  variant={currentDifficulty.name === difficulty.name ? "default" : "outline"}
                  onClick={() => startNewGame(difficulty)}
                >
                  {difficulty.name}
                </Button>
              ))}
            </div>

            {/* Game Stats */}
            <div className="flex justify-center gap-6 mb-4">
              <Badge variant="outline" className="text-lg px-4 py-2">
                Mines: {gameState.mineCount - gameState.flagCount}
              </Badge>
              <Badge variant="outline" className="text-lg px-4 py-2">
                Time: {(gameState.timer / 1000).toFixed(3)}s
              </Badge>
              {currentDifficulty.name === "Hard" && (
                <Badge variant="outline" className="text-lg px-4 py-2 bg-yellow-100 dark:bg-yellow-900">
                  💰 {gameState.currency}
                </Badge>
              )}
              <Badge
                variant={
                  gameState.gameStatus === "won"
                    ? "default"
                    : gameState.gameStatus === "lost"
                      ? "destructive"
                      : "outline"
                }
                className="text-lg px-4 py-2"
              >
                {gameState.gameStatus === "playing"
                  ? "Playing"
                  : gameState.gameStatus === "won"
                    ? "You Won!"
                    : "Game Over"}
              </Badge>
            </div>

            {/* Powerups (Hard Mode Only) */}
            {currentDifficulty.name === "Hard" && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <h3 className="text-center font-semibold mb-3">Powerups</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    onClick={usePowerupRevealRow}
                    disabled={gameState.currency < POWERUP_COSTS.revealRow || gameState.gameStatus !== "playing"}
                    variant="outline"
                    size="sm"
                    className="flex flex-col h-auto py-2"
                  >
                    <span className="text-lg mb-1">🔍➡️</span>
                    <span className="text-xs">Reveal Row</span>
                    <span className="text-xs font-bold">💰 {POWERUP_COSTS.revealRow}</span>
                  </Button>
                  <Button
                    onClick={usePowerupRevealColumn}
                    disabled={gameState.currency < POWERUP_COSTS.revealColumn || gameState.gameStatus !== "playing"}
                    variant="outline"
                    size="sm"
                    className="flex flex-col h-auto py-2"
                  >
                    <span className="text-lg mb-1">🔍⬇️</span>
                    <span className="text-xs">Reveal Column</span>
                    <span className="text-xs font-bold">💰 {POWERUP_COSTS.revealColumn}</span>
                  </Button>
                  <Button
                    onClick={usePowerupReveal10Random}
                    disabled={gameState.currency < POWERUP_COSTS.reveal10Random || gameState.gameStatus !== "playing"}
                    variant="outline"
                    size="sm"
                    className="flex flex-col h-auto py-2"
                  >
                    <span className="text-lg mb-1">✨</span>
                    <span className="text-xs">Reveal 10 Random</span>
                    <span className="text-xs font-bold">💰 {POWERUP_COSTS.reveal10Random}</span>
                  </Button>
                  <Button
                    onClick={usePowerupRevive}
                    disabled={gameState.currency < POWERUP_COSTS.revive || gameState.hasRevive || gameState.gameStatus !== "playing"}
                    variant="outline"
                    size="sm"
                    className={`flex flex-col h-auto py-2 ${gameState.hasRevive ? "border-green-500 bg-green-50 dark:bg-green-950" : ""}`}
                  >
                    <span className="text-lg mb-1">❤️</span>
                    <span className="text-xs">{gameState.hasRevive ? "Revive Active!" : "Buy Revive"}</span>
                    <span className="text-xs font-bold">{gameState.hasRevive ? "✓" : `💰 ${POWERUP_COSTS.revive}`}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Game Board */}
            <div className="flex justify-center">
              <div
                className="inline-grid gap-0 border-2 border-gray-600"
                style={{
                  gridTemplateColumns: `repeat(${currentDifficulty.cols}, 1fr)`,
                  maxWidth: "fit-content",
                }}
              >
                {gameState.board.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={getCellClassName(cell)}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      onContextMenu={(e) => handleCellRightClick(e, rowIndex, colIndex)}
                    >
                      {getCellContent(cell)}
                    </div>
                  )),
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4 mt-6">
              <Button onClick={() => startNewGame(currentDifficulty)} size="lg">
                New Game
              </Button>
              <Button onClick={() => setShowLeaderboard(true)} variant="outline" size="lg">
                Leaderboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Leaderboard
        difficulty={currentDifficulty.name}
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />

      <SubmitScoreDialog
        isOpen={showSubmitScore}
        onClose={() => setShowSubmitScore(false)}
        difficulty={currentDifficulty.name}
        timeMilliseconds={gameState.timer}
        onSubmitted={() => {
          // Optionally refresh leaderboard or show success message
        }}
      />
    </div>
  )
}
