module.exports = {
  apps: [
    {
      name: "minesweeper-game",
      script: "npm",
      args: "start",
      cwd: "/var/www/minesweeper",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        POSTGRES_URL_NON_POOLING: "postgresql://postgres:Aaryav7934@minesweeper-db.cvecaus80mud.ap-south-1.rds.amazonaws.com:5432/postgres",
      },
      error_file: "/var/log/pm2/minesweeper-error.log",
      out_file: "/var/log/pm2/minesweeper-out.log",
      log_file: "/var/log/pm2/minesweeper-combined.log",
      time: true,
    },
  ],
}