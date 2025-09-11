-- Create leaderboards table for Minesweeper scores
CREATE TABLE IF NOT EXISTS leaderboards (
  id SERIAL PRIMARY KEY,
  player_name VARCHAR(50) NOT NULL,
  difficulty VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  time_seconds INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries by difficulty
CREATE INDEX IF NOT EXISTS idx_leaderboards_difficulty ON leaderboards(difficulty);

-- Create index for faster queries by time (for ranking)
CREATE INDEX IF NOT EXISTS idx_leaderboards_time ON leaderboards(difficulty, time_seconds);
