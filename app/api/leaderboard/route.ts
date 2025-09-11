// <CHANGE> Replaced Neon database client with Vercel Postgres for Amazon RDS compatibility
import { sql } from "@vercel/postgres"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const difficulty = searchParams.get("difficulty")

    if (!difficulty || !["easy", "medium", "hard"].includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 })
    }

    // <CHANGE> Updated query syntax for @vercel/postgres
    const result = await sql`
      SELECT player_name, time_seconds, created_at
      FROM leaderboards 
      WHERE difficulty = ${difficulty}
      ORDER BY time_seconds ASC
      LIMIT 10
    `

    return NextResponse.json({ leaderboard: result.rows })
  } catch (error) {
    console.error("Error fetching leaderboard:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { playerName, difficulty, timeSeconds } = await request.json()

    if (!playerName || !difficulty || !timeSeconds) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 })
    }

    if (typeof timeSeconds !== "number" || timeSeconds <= 0) {
      return NextResponse.json({ error: "Invalid time" }, { status: 400 })
    }

    if (playerName.length > 50) {
      return NextResponse.json({ error: "Player name too long" }, { status: 400 })
    }

    // <CHANGE> Updated query syntax for @vercel/postgres
    const result = await sql`
      INSERT INTO leaderboards (player_name, difficulty, time_seconds)
      VALUES (${playerName}, ${difficulty}, ${timeSeconds})
      RETURNING id
    `

    return NextResponse.json({ success: true, id: result.rows[0].id })
  } catch (error) {
    console.error("Error submitting score:", error)
    return NextResponse.json({ error: "Failed to submit score" }, { status: 500 })
  }
}
