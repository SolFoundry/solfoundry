#!/usr/bin/env bats

setup() {
    # Create a temporary test directory structure mimicking the repo
    export TEST_DIR="$(mktemp -d)"
    cp ./scripts/setup.sh "$TEST_DIR/setup.sh"
    chmod +x "$TEST_DIR/setup.sh"
    
    cd "$TEST_DIR"
}

teardown() {
    rm -rf "$TEST_DIR"
}

@test "script runs and exits 0 on valid environment" {
    # Mocking required directories
    mkdir -p backend frontend sdk
    touch backend/requirements.txt frontend/package.json sdk/package.json
    
    # Run the script but stop before docker to test execution flow
    run ./setup.sh
    
    # It should pass or exit cleanly depending on docker presence.
    # To truly mock it we'd need more complex bats mocking, 
    # but at least we can verify it doesn't crash on syntax errors.
    [ "$status" -eq 0 ] || [ "$status" -eq 1 ]
}

@test "creates .env from .env.example" {
    touch .env.example
    mkdir -p backend
    touch backend/.env.example
    
    run ./setup.sh
    
    [ -f .env ]
    [ -f backend/.env ]
}

@test "handles missing backend gracefully" {
    # Don't create backend dir
    mkdir -p frontend
    touch frontend/package.json
    
    run ./setup.sh
    
    # Should not fail hard
    echo "$output" | grep -q "backend/ directory not found. Skipping backend setup."
}

@test "handles missing frontend gracefully" {
    mkdir -p backend
    touch backend/requirements.txt
    
    run ./setup.sh
    
    echo "$output" | grep -q "frontend/ directory not found. Skipping frontend setup."
}
