#!/bin/bash

# 🚀 Logs SSE Gateway Deployment Script

set -e  # Exit on any error

echo "🚀 Logs SSE Gateway Deployment Script"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "logs-sse-gateway/package.json" ]; then
    echo -e "${RED}❌ Error: Please run this script from the sse-poc root directory${NC}"
    echo "Expected structure: sse-poc/logs-sse-gateway/package.json"
    exit 1
fi

echo -e "${BLUE}📁 Found logs-sse-gateway directory${NC}"

# Navigate to gateway directory
cd logs-sse-gateway

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}🔧 Initializing git repository...${NC}"
    git init
    git add .
    git commit -m "Initial commit - Logs SSE Gateway for deployment"
else
    echo -e "${GREEN}✅ Git repository already initialized${NC}"
    
    # Check if there are uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo -e "${YELLOW}📝 Committing latest changes...${NC}"
        git add .
        git commit -m "Update gateway for deployment - $(date)"
    fi
fi

echo ""
echo -e "${BLUE}🌐 Deployment Options:${NC}"
echo "1. Render (Recommended - Free tier available)"
echo "2. Railway (Simple deployment)"
echo "3. Heroku (Classic PaaS)"
echo "4. Manual instructions only"
echo ""

read -p "Choose deployment option (1-4): " choice

case $choice in
    1)
        echo -e "${BLUE}🎯 Selected: Render Deployment${NC}"
        echo ""
        echo -e "${YELLOW}📋 Next Steps:${NC}"
        echo "1. Push this code to GitHub:"
        echo "   - Create a new repository: https://github.com/new"
        echo "   - Repository name: logs-sse-gateway"
        echo "   - Then run these commands:"
        echo ""
        echo -e "${GREEN}   git remote add origin https://github.com/YOUR_USERNAME/logs-sse-gateway.git${NC}"
        echo -e "${GREEN}   git branch -M main${NC}"
        echo -e "${GREEN}   git push -u origin main${NC}"
        echo ""
        echo "2. Deploy on Render:"
        echo "   - Go to https://render.com"
        echo "   - Click 'New +' → 'Web Service'"
        echo "   - Connect your GitHub repository"
        echo "   - Render will use the render.yaml configuration automatically"
        echo ""
        echo -e "${BLUE}🔧 Configuration files ready:${NC}"
        echo "   ✅ render.yaml (deployment config)"
        echo "   ✅ package.json (with start script)"
        echo "   ✅ Dockerfile (backup option)"
        ;;
    2)
        echo -e "${BLUE}🎯 Selected: Railway Deployment${NC}"
        echo ""
        echo "Installing Railway CLI..."
        if command -v railway &> /dev/null; then
            echo -e "${GREEN}✅ Railway CLI already installed${NC}"
        else
            npm install -g @railway/cli
        fi
        
        echo "Logging in to Railway..."
        railway login
        
        echo "Initializing Railway project..."
        railway init
        
        echo "Setting environment variables..."
        railway variables set NODE_ENV=production
        railway variables set ALLOWED_ORIGINS="*"
        
        echo "Deploying..."
        railway up
        
        echo -e "${GREEN}🎉 Deployment complete!${NC}"
        echo "Your gateway should be available at the URL shown above."
        ;;
    3)
        echo -e "${BLUE}🎯 Selected: Heroku Deployment${NC}"
        echo ""
        if command -v heroku &> /dev/null; then
            echo -e "${GREEN}✅ Heroku CLI found${NC}"
            
            read -p "Enter your app name (e.g., my-logs-sse-gateway): " app_name
            
            echo "Logging in to Heroku..."
            heroku login
            
            echo "Creating Heroku app..."
            heroku create $app_name
            
            echo "Setting environment variables..."
            heroku config:set NODE_ENV=production
            heroku config:set ALLOWED_ORIGINS="*"
            
            echo "Deploying..."
            git push heroku main
            
            echo -e "${GREEN}🎉 Deployment complete!${NC}"
            echo "Your gateway is available at: https://$app_name.herokuapp.com"
        else
            echo -e "${RED}❌ Heroku CLI not found${NC}"
            echo "Please install Heroku CLI from: https://devcenter.heroku.com/articles/heroku-cli"
            echo "Then run this script again."
        fi
        ;;
    4)
        echo -e "${BLUE}📖 Manual Deployment Instructions${NC}"
        echo ""
        echo "Your gateway is ready for deployment! Here's what you have:"
        echo ""
        echo -e "${GREEN}✅ Files ready:${NC}"
        echo "   • package.json (with start script)"
        echo "   • render.yaml (Render config)"
        echo "   • Dockerfile (Docker config)"
        echo "   • server/logs-gateway.js (main application)"
        echo ""
        echo -e "${BLUE}📋 Deployment checklist:${NC}"
        echo "   1. Push code to GitHub"
        echo "   2. Connect to your preferred platform (Render/Railway/Heroku)"
        echo "   3. Set environment variables:"
        echo "      - NODE_ENV=production"
        echo "      - ALLOWED_ORIGINS=*"
        echo "   4. Deploy and test"
        echo ""
        echo "See DEPLOYMENT_GUIDE.md for detailed instructions."
        ;;
    *)
        echo -e "${RED}❌ Invalid option. Please run the script again.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo -e "${BLUE}📝 Next steps after deployment:${NC}"
echo "1. Test your deployed gateway:"
echo "   curl https://your-gateway-url.com/health"
echo ""
echo "2. Update your POC configuration:"
echo "   - Set GATEWAY_URL in gateway-log-publisher.js"
echo "   - Update SSE_BACKEND_URL in datashop proxy"
echo ""
echo "3. Test the complete flow:"
echo "   - Run: GATEWAY_URL=https://your-gateway-url.com node gateway-log-publisher.js continuous 3"
echo "   - Connect frontend to see real-time logs"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "   • README.md - Usage and API documentation"
echo "   • DEPLOYMENT_GUIDE.md - Detailed deployment steps"
echo ""
echo -e "${GREEN}🚀 Happy deploying!${NC}" 