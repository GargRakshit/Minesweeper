#!/bin/bash

# Minesweeper Game Deployment Script for EC2
# Run this script on your EC2 instance

set -e

echo "🚀 Starting Minesweeper Game deployment..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Create application directory
sudo mkdir -p /var/www/minesweeper
sudo chown -R $USER:$USER /var/www/minesweeper

# Clone or copy your application files here
# git clone https://github.com/yourusername/minesweeper-game.git /var/www/minesweeper
# OR upload your files to /var/www/minesweeper

cd /var/www/minesweeper

# Install dependencies
npm install

# Build the application
npm run build

# Create PM2 log directory
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2

# Start application with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure Nginx
sudo cp nginx.conf /etc/nginx/sites-available/minesweeper
sudo ln -sf /etc/nginx/sites-available/minesweeper /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Start and enable services
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "✅ Deployment complete!"
echo "📝 Next steps:"
echo "1. Configure your domain DNS to point to this EC2 instance"
echo "2. Install SSL certificate with: sudo certbot --nginx -d your-domain.com"
echo "3. Update nginx.conf with your actual domain name"
echo "4. Set up your DATABASE_URL environment variable"
