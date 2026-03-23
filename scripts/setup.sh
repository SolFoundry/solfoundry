#!/bin/bash

# SolFoundry Environment Setup Script
# This script sets up the local development environment from scratch.
# It checks for dependencies, installs packages, sets up .env, and starts services.

set -euo pipefail # Strict error handling

# Text formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${BLUE}${BOLD}🚀 Starting SolFoundry Environment Setup...${NC}\n"

# Helper functions
print_step() {
    echo -e "${YELLOW}➤ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

version_gt() { test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"; }

# 1. Dependency Checks
print_step "Checking required tools..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js v18+."
fi
NODE_VERSION=$(node -v | sed 's/v//')
if ! version_gt "$NODE_VERSION" "17.9.9"; then
    print_error "Node.js version must be 18+. Found $NODE_VERSION."
fi
print_success "Node.js is installed (v$NODE_VERSION)."

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm."
fi
print_success "npm is installed."

if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python v3.10+."
fi
PYTHON_VERSION=$(python3 -c 'import platform; print(platform.python_version())')
if ! version_gt "$PYTHON_VERSION" "3.9.9"; then
    print_error "Python version must be 3.10+. Found $PYTHON_VERSION."
fi
print_success "Python is installed (v$PYTHON_VERSION)."

if ! python3 -c 'import venv' &> /dev/null; then
    print_error "python3-venv is not installed. Please install it (e.g. sudo apt install python3-venv)."
fi
print_success "python3-venv is available."

if ! command -v pip3 &> /dev/null; then
    print_error "pip3 is not installed. Please install pip for Python 3."
fi
print_success "pip3 is installed."

if ! command -v rustc &> /dev/null; then
    print_error "Rust is not installed. Please install Rust (https://rustup.rs/)."
fi
RUST_VERSION=$(rustc --version | awk '{print $2}')
print_success "Rust is installed ($RUST_VERSION)."

if ! command -v anchor &> /dev/null; then
    print_warning "Anchor is not installed. Smart contract development might fail."
    echo -e "Install later with: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
else
    ANCHOR_VERSION=$(anchor --version | awk '{print $2}')
    print_success "Anchor is installed ($ANCHOR_VERSION)."
fi

if ! command -v docker &> /dev/null; then
    print_warning "Docker is not installed. You will need it to run Postgres/Redis via compose."
else
    print_success "Docker is installed."
fi

# 2. Setup .env Files
print_step "Setting up environment variables..."

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        print_success "Created Root .env from .env.example."
    else
        print_warning "Root .env.example not found. Skipping..."
    fi
else
    print_success "Root .env already exists."
fi

if [ -d "backend" ] && [ ! -f backend/.env ]; then
    if [ -f backend/.env.example ]; then
        cp backend/.env.example backend/.env
        print_success "Created backend/.env from backend/.env.example."
    else
         print_warning "backend/.env.example not found. Skipping..."
    fi
elif [ -f backend/.env ]; then
    print_success "backend/.env already exists."
fi

# 3. Install Backend Dependencies
if [ -d "backend" ]; then
    print_step "Installing backend dependencies (Python)..."
    cd backend
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
        print_success "Backend dependencies installed."
    else
        print_warning "backend/requirements.txt not found."
    fi
    deactivate
    cd ..
else
    print_warning "backend/ directory not found. Skipping backend setup."
fi

# 4. Install Frontend Dependencies
if [ -d "frontend" ]; then
    print_step "Installing frontend dependencies (Node.js)..."
    cd frontend
    if [ -f "package.json" ]; then
        npm install
        print_success "Frontend dependencies installed."
    else
        print_warning "frontend/package.json not found."
    fi
    cd ..
else
    print_warning "frontend/ directory not found. Skipping frontend setup."
fi

# 5. Install SDK Dependencies (if applicable)
if [ -d "sdk" ]; then
    print_step "Installing SDK dependencies..."
    cd sdk
    if [ -f "package.json" ]; then
        if npm install; then
            print_success "SDK dependencies installed successfully."
        else
            print_warning "npm install in sdk failed. Continuing anyway."
        fi
    else
        print_warning "sdk/package.json not found."
    fi
    cd ..
fi

# 6. Start Local Services
print_step "Starting local services..."

if command -v docker-compose &> /dev/null; then
    if docker-compose up -d db redis; then
        print_success "Database and Redis started via docker-compose."
    else
        print_warning "Failed to start services via docker-compose. Is Docker daemon running?"
    fi
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    if docker compose up -d db redis; then
        print_success "Database and Redis started via docker compose."
    else
        print_warning "Failed to start services via docker compose. Is Docker daemon running?"
    fi
else
    print_warning "Docker Compose not found or failed. Please ensure Postgres and Redis are running locally."
fi

# Final Output
echo -e "\n${GREEN}${BOLD}🎉 Setup Complete! You are ready to build.${NC}\n"

echo -e "To start the development servers, open separate terminals and run:"
echo -e "  ${BOLD}Backend:${NC}  cd backend && source venv/bin/activate && uvicorn app.main:app --reload"
echo -e "  ${BOLD}Frontend:${NC} cd frontend && npm run dev\n"

echo -e "${BLUE}${BOLD}Local Services URLs:${NC}"
echo -e "  - Frontend: http://localhost:5173 (or port shown by Vite)"
echo -e "  - Backend API: http://localhost:8000"
echo -e "  - Backend Docs: http://localhost:8000/docs"

