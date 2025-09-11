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
  })
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showSubmitScore, setShowSubmitScore] = useState(false)

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

  const placeMines = useCallback(
    (board: Cell[][], difficulty: Difficulty, firstClickRow: number, firstClickCol: number) => {
      const mines = difficulty.mines
      let minesPlaced = 0

      // Create safe zone around first click (3x3 area)
      const safeZone = new Set<string>()
      for (let r = firstClickRow - 1; r <= firstClickRow + 1; r++) {
        for (let c = firstClickCol - 1; c <= firstClickCol + 1; c++) {
          if (r >= 0 && r < difficulty.rows && c >= 0 && c < difficulty.cols) {
            safeZone.add(`${r},${c}`)
          }
        }
      }

      while (minesPlaced < mines) {
        const row = Math.floor(Math.random() * difficulty.rows)
        const col = Math.floor(Math.random() * difficulty.cols)

        if (!board[row][col].isMine && !safeZone.has(`${row},${col}`)) {
          board[row][col].isMine = true
          minesPlaced++
        }
      }
    },
    [],
  )

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

  const revealCell = useCallback((board: Cell[][], row: number, col: number, difficulty: Difficulty) => {
    if (row < 0 || row >= difficulty.rows || col < 0 || col >= difficulty.cols) return
    if (board[row][col].isRevealed || board[row][col].isFlagged) return

    board[row][col].isRevealed = true

    if (board[row][col].adjacentMines === 0 && !board[row][col].isMine) {
      for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
          if (r !== row || c !== col) {
            revealCell(board, r, c, difficulty)
          }
        }
      }
    }
  }, [])

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (gameState.gameStatus !== "playing") return

      setGameState((prevState) => {
        const newBoard = prevState.board.map((row) => row.map((cell) => ({ ...cell })))

        // Handle first click
        if (prevState.firstClick) {
          placeMines(newBoard, currentDifficulty, row, col)
          calculateAdjacentMines(newBoard, currentDifficulty)
        }

        if (newBoard[row][col].isFlagged) return prevState

        if (newBoard[row][col].isMine && !prevState.firstClick) {
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

        revealCell(newBoard, row, col, currentDifficulty)

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
        }
      })
    },
    [gameState.gameStatus, currentDifficulty, placeMines, calculateAdjacentMines, revealCell],
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
      })
    },
    [initializeBoard, timerInterval],
  )

  // Timer effect
  useEffect(() => {
    if (gameState.gameStatus === "playing" && !gameState.firstClick) {
      const interval = setInterval(() => {
        setGameState((prev) => ({ ...prev, timer: prev.timer + 1 }))
      }, 1000)
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
                Time: {gameState.timer}s
              </Badge>
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
        timeSeconds={gameState.timer}
        onSubmitted={() => {
          // Optionally refresh leaderboard or show success message
        }}
      />
    </div>
  )
}
