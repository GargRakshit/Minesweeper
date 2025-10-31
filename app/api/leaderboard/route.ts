import { Client } from "pg";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  
  const client = new Client({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { searchParams } = new URL(request.url);
    const difficulty = searchParams.get("difficulty");

    if (!difficulty || !["easy", "medium", "hard"].includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }

    const result = await client.query(
      `SELECT player_name, time_seconds, time_milliseconds, created_at FROM leaderboards WHERE difficulty = $1 ORDER BY COALESCE(time_milliseconds, time_seconds * 1000) ASC LIMIT 10`,
      [difficulty]
    );

    return NextResponse.json({ leaderboard: result.rows });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  } finally {
    await client.end();
  }
}

export async function POST(request: NextRequest) {
  
  const client = new Client({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { playerName, difficulty, timeMilliseconds } = await request.json();

    if (!playerName || !difficulty || !timeMilliseconds) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }

    if (typeof timeMilliseconds !== "number" || timeMilliseconds <= 0) {
      return NextResponse.json({ error: "Invalid time" }, { status: 400 });
    }

    if (playerName.length > 50) {
      return NextResponse.json({ error: "Player name too long" }, { status: 400 });
    }

    const result = await client.query(
      `INSERT INTO leaderboards (player_name, difficulty, time_milliseconds, time_seconds) VALUES ($1, $2, $3, $4) RETURNING id`,
      [playerName, difficulty, timeMilliseconds, Math.round(timeMilliseconds / 1000)]
    );

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error("Error submitting score:", error);
    return NextResponse.json({ error: "Failed to submit score" }, { status: 500 });
  } finally {
    await client.end();
  }
}