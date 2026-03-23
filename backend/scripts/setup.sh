#!/bin/bash
# SolFoundry Elite Environment Setup Script (T1-011)
# Author: [ShanaBoo]
# Description: Automated one-command setup for the SolFoundry backend.

set -e

# --- Configuration ---
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"
VENV_DIR=".venv"
LOG_DIR="logs"

# --- UI Helpers ---
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}  🏗️  SolFoundry Elite Setup Engine (v1.0) ${NC}"
echo -e "${BLUE}==================================================${NC}"

# 1. Dependency Checks
echo -e "${YELLOW}[1/5] Checking System Dependencies...${NC}"

check_tool() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed. Please install it first.${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ $1 found: $($1 --version | head -n 1)${NC}"
    fi
}

check_tool "python3"
check_tool "docker"
check_tool "git"

# 2. Environment Configuration
echo -e "\n${YELLOW}[2/5] Configuring Environment Variables...${NC}"

if [ ! -f "../../$ENV_EXAMPLE" ]; then
    echo -e "${RED}❌ $ENV_EXAMPLE not found in root. Cannot copy template.${NC}"
else
    if [ ! -f "../$ENV_FILE" ]; then
        cp "../../$ENV_EXAMPLE" "../$ENV_FILE"
        echo -e "${GREEN}✅ Created $ENV_FILE from template.${NC}"
    else
        echo -e "${BLUE}ℹ️  $ENV_FILE already exists. Skipping copy.${NC}"
    fi
fi

# 3. Python Virtual Environment
echo -e "\n${YELLOW}[3/5] Setting up Virtual Environment...${NC}"

if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
    echo -e "${GREEN}✅ Virtual environment created in $VENV_DIR.${NC}"
else
    echo -e "${BLUE}ℹ️  $VENV_DIR already exists.${NC}"
fi

source "$VENV_DIR/bin/activate"
echo -e "${YELLOW}📦 Installing Python requirements...${NC}"
pip install --upgrade pip
pip install -r ../requirements.txt
echo -e "${GREEN}✅ Requirements installed.${NC}"

# 4. Directory Preparation
echo -e "\n${YELLOW}[4/5] Preparing Directories...${NC}"
mkdir -p "../$LOG_DIR"
echo -e "${GREEN}✅ $LOG_DIR directory ready.${NC}"

# 5. Database Readiness
echo -e "\n${YELLOW}[5/5] Checking Backend Integrity...${NC}"

# Syntax Check
python3 -m py_compile ../main.py
echo -e "${GREEN}✅ main.py syntax verified.${NC}"

echo -e "\n${GREEN}==================================================${NC}"
echo -e "${GREEN}      ✨ SolFoundry Setup Complete ✨          ${NC}"
echo -e "${GREEN}==================================================${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Update your .env file with secrets."
echo -e "  2. Run 'docker-compose up -d' in the root directory."
echo -e "  3. Start the server: 'uvicorn main:app --reload' within the backend folder."
echo -e "${BLUE}==================================================${NC}"
