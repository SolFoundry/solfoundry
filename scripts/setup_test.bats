#!/usr/bin/env bats

setup() {
    export TEST_DIR="$(mktemp -d)"
    
    # Locate the script relative to this test file
    local BATS_SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")" && pwd)"
    cp "$BATS_SCRIPT_DIR/setup.sh" "$TEST_DIR/setup.sh"
    chmod +x "$TEST_DIR/setup.sh"
    
    # Export mock control flags
    export DRY_RUN=1
    
    cd "$TEST_DIR"
    
    # Mock external tools so tests don't depend on host system
    mkdir -p bin
    cat << 'MOCK' > bin/docker-compose
#!/bin/bash
exit 0
MOCK
    chmod +x bin/docker-compose
    export PATH="$TEST_DIR/bin:$PATH"
}

teardown() {
    rm -rf "$TEST_DIR"
}

@test "creates .env from .env.example correctly" {
    # Skip deps check so it doesn't fail on missing node/python locally
    export SKIP_DEP_CHECKS=1
    
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
    export SKIP_DEP_CHECKS=1
    
    mkdir -p frontend
    touch frontend/package.json
    
    run ./setup.sh
    
    [ "$status" -eq 0 ]
    echo "$output" | grep "backend/ directory not found. Skipping backend setup."
}

@test "skips frontend setup gracefully when missing" {
    export SKIP_DEP_CHECKS=1
    
    mkdir -p backend
    touch backend/requirements.txt
    
    run ./setup.sh
    
    [ "$status" -eq 0 ]
    echo "$output" | grep "frontend/ directory not found. Skipping frontend setup."
}

@test "skips docker compose if docker-compose.yml is missing" {
    export SKIP_DEP_CHECKS=1
    
    mkdir -p backend frontend sdk
    touch backend/requirements.txt frontend/package.json sdk/package.json
    
    run ./setup.sh
    
    [ "$status" -eq 0 ]
    echo "$output" | grep "docker-compose.yml not found. Skipping local service startup."
    echo "$output" | grep "Setup Completed with Warnings"
}

@test "reports global success when all components are present and mock execution succeeds" {
    export SKIP_DEP_CHECKS=1
    
    mkdir -p backend frontend sdk
    touch backend/requirements.txt frontend/package.json sdk/package.json
    touch docker-compose.yml
    
    run ./setup.sh
    
    [ "$status" -eq 0 ]
    echo "$output" | grep "Setup Complete! All components successfully installed."
}

@test "creates Python virtual environment using proper paths" {
    export SKIP_DEP_CHECKS=1
    
    mkdir -p backend
    touch backend/requirements.txt
    
    run ./setup.sh
    
    [ "$status" -eq 0 ]
    echo "$output" | grep "\[DRY RUN\] Would execute: python3 -m venv venv"
    echo "$output" | grep "\[DRY RUN\] Would execute: venv/bin/pip install -r requirements.txt"
}
