#!/bin/bash

# AI Effort Regulation - Setup Verification Script
# This script checks if your environment is properly configured

echo "🔍 AI Effort Regulation - Setup Verification"
echo "=============================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Check Node.js version
echo "📦 Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✓${NC} Node.js $(node --version) installed"
    else
        echo -e "${RED}✗${NC} Node.js version too old (need 18+, have $(node --version))"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Node.js not found"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check npm
echo "📦 Checking npm..."
if command -v npm &> /dev/null; then
    echo -e "${GREEN}✓${NC} npm $(npm --version) installed"
else
    echo -e "${RED}✗${NC} npm not found"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check Ollama
echo "🤖 Checking Ollama..."
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✓${NC} Ollama installed"
    
    # Check if Ollama is running
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Ollama is running"
    else
        echo -e "${YELLOW}⚠${NC} Ollama is installed but not running"
        echo "  Run: ollama serve"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗${NC} Ollama not found"
    echo "  Install from: https://ollama.ai"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check required models
echo "🧠 Checking required models..."
if command -v ollama &> /dev/null; then
    if ollama list | grep -q "llama3.2:1b"; then
        echo -e "${GREEN}✓${NC} llama3.2:1b installed"
    else
        echo -e "${RED}✗${NC} llama3.2:1b not found"
        echo "  Run: ollama pull llama3.2:1b"
        ERRORS=$((ERRORS + 1))
    fi
    
    if ollama list | grep -q "llama3.2:3b"; then
        echo -e "${GREEN}✓${NC} llama3.2:3b installed"
    else
        echo -e "${RED}✗${NC} llama3.2:3b not found"
        echo "  Run: ollama pull llama3.2:3b"
        ERRORS=$((ERRORS + 1))
    fi
fi
echo ""

# Check .env file
echo "⚙️  Checking configuration..."
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    
    # Check OLLAMA_BASE_URL
    if grep -q "OLLAMA_BASE_URL" .env; then
        echo -e "${GREEN}✓${NC} OLLAMA_BASE_URL configured"
    else
        echo -e "${YELLOW}⚠${NC} OLLAMA_BASE_URL not set in .env"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    # Check PORT
    if grep -q "PORT" .env; then
        PORT=$(grep "PORT=" .env | cut -d'=' -f2)
        echo -e "${GREEN}✓${NC} PORT configured ($PORT)"
    else
        echo -e "${YELLOW}⚠${NC} PORT not set (will use default 6740)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗${NC} .env file not found"
    echo "  Run: cp .env.example .env"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check if project is built
echo "🔨 Checking build..."
if [ -d "dist" ]; then
    echo -e "${GREEN}✓${NC} Project is built"
else
    echo -e "${YELLOW}⚠${NC} Project not built yet"
    echo "  Run: npm run build"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check if node_modules exists
echo "📚 Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${RED}✗${NC} Dependencies not installed"
    echo "  Run: npm install"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Summary
echo "=============================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! You're ready to start.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Start the system: npm start"
    echo "  2. Open browser: http://localhost:6740/"
    echo "  3. Try the demo: ./demo.sh"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Setup complete with $WARNINGS warning(s)${NC}"
    echo "You can proceed, but consider addressing the warnings above."
else
    echo -e "${RED}❌ Setup incomplete: $ERRORS error(s), $WARNINGS warning(s)${NC}"
    echo "Please fix the errors above before starting."
    exit 1
fi
