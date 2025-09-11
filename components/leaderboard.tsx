"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface LeaderboardEntry {
  player_name: string
  time_seconds: number
  created_at: string
}

interface LeaderboardProps {
  difficulty: string
  isOpen: boolean
  onClose: () => void
}

export function Leaderboard({ difficulty, isOpen, onClose }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/leaderboard?difficulty=${difficulty.toLowerCase()}`)
      const data = await response.json()
      setLeaderboard(data.leaderboard || [])
    } catch (error) {
      console.error("Error fetching leaderboard:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard()
    }
  }, [isOpen, difficulty])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{difficulty} Leaderboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No scores yet. Be the first!</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={index === 0 ? "default" : "outline"}>#{index + 1}</Badge>
                    <span className="font-medium">{entry.player_name}</span>
                  </div>
                  <span className="font-mono text-sm">{formatTime(entry.time_seconds)}</span>
                </div>
              ))}
            </div>
          )}
          <Button onClick={fetchLeaderboard} variant="outline" className="w-full bg-transparent">
            Refresh
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface SubmitScoreDialogProps {
  isOpen: boolean
  onClose: () => void
  difficulty: string
  timeSeconds: number
  onSubmitted: () => void
}

export function SubmitScoreDialog({ isOpen, onClose, difficulty, timeSeconds, onSubmitted }: SubmitScoreDialogProps) {
  const [playerName, setPlayerName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!playerName.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerName: playerName.trim(),
          difficulty: difficulty.toLowerCase(),
          timeSeconds,
        }),
      })

      if (response.ok) {
        setSubmitted(true)
        onSubmitted()
        setTimeout(() => {
          onClose()
          setSubmitted(false)
          setPlayerName("")
        }, 2000)
      }
    } catch (error) {
      console.error("Error submitting score:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Congratulations!</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-center">
          <div>
            <p className="text-lg font-semibold">You won in {formatTime(timeSeconds)}!</p>
            <p className="text-sm text-muted-foreground">Difficulty: {difficulty}</p>
          </div>

          {submitted ? (
            <div className="py-4">
              <p className="text-green-600 font-medium">Score submitted successfully!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="playerName" className="block text-sm font-medium mb-2">
                  Enter your name for the leaderboard:
                </label>
                <Input
                  id="playerName"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Your name"
                  maxLength={50}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={!playerName.trim() || submitting} className="flex-1">
                  {submitting ? "Submitting..." : "Submit Score"}
                </Button>
                <Button onClick={onClose} variant="outline">
                  Skip
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
