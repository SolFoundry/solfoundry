#!/usr/bin/env bats

setup() {
    # Create a temporary test directory structure mimicking the repo
    export TEST_DIR="$(mktemp -d)"
    cp ./scripts/setup.sh "$TEST_DIR/setup.sh"
    chmod +x "$TEST_DIR/setup.sh"
    
    # We use DRY_RUN=1 so it skips executing actual slow/side-effect commands 
    # like npm install, pip install, and docker compose
    export DRY_RUN=1
    
    cd "$TEST_DIR"
}

teardown() {
    rm -rf "$TEST_DIR"
}

@test "creates .env from .env.example correctly" {
    touch .env.example
    mkdir -p backend
    touch backend/.env.example
    
    run ./setup.sh
    
    [ "$status" -eq 0 ]
    [ -f .env ]
    [ -f backend/.env ]
    echo "$output" | grep "Created Root .env from .env.example"
    echo "$output" | grep "Created backend/.env from backend/.env.example"
}

@test "skips backend setup gracefully when missing" {
    mkdir -p frontend
    touch frontend/package.json
    
    run ./setup.sh
    
    echo "$output" | grep "backend/ directory not found. Skipping backend setup."
}

@test "skips frontend setup gracefully when missing" {
    mkdir -p backend
    touch backend/requirements.txt
    
    run ./setup.sh
    
    echo "$output" | grep "frontend/ directory not found. Skipping frontend setup."
}

@test "skips docker compose if docker-compose.yml is missing" {
    mkdir -p backend frontend sdk
    touch backend/requirements.txt frontend/package.json sdk/package.json
    
    run ./setup.sh
    
    echo "$output" | grep "docker-compose.yml not found. Skipping local service startup."
    echo "$output" | grep "Setup Completed with Warnings"
}

@test "reports global success when all components are present and mock execution succeeds" {
    mkdir -p backend frontend sdk
    touch backend/requirements.txt frontend/package.json sdk/package.json
    touch docker-compose.yml
    
    run ./setup.sh
    
    [ "$status" -eq 0 ]
    echo "$output" | grep "Setup Complete! All components successfully installed."
}

@test "creates Python virtual environment using proper paths" {
    mkdir -p backend
    touch backend/requirements.txt
    
    run ./setup.sh
    
    echo "$output" | grep "\[DRY RUN\] Would execute: python3 -m venv venv"
    echo "$output" | grep "\[DRY RUN\] Would execute: venv/bin/pip install -r requirements.txt"
}
