#!/bin/bash
# Security Audit Script for SolFoundry
# 
# Runs security checks on both Python and Node.js dependencies
# Usage: ./scripts/security-audit.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check Python dependencies
audit_python() {
    log_info "Auditing Python dependencies..."
    
    cd backend
    
    # Check if pip-audit is installed
    if ! command -v pip-audit &> /dev/null; then
        log_warn "pip-audit not found, installing..."
        pip install pip-audit
    fi
    
    # Run pip-audit
    log_info "Running pip-audit..."
    if pip-audit -r requirements.txt --format json > pip-audit-report.json 2>&1; then
        log_success "No Python vulnerabilities found"
    else
        log_warn "Python vulnerabilities detected, check pip-audit-report.json"
        pip-audit -r requirements.txt --format json || true
    fi
    
    # Also check with safety if available
    if command -v safety &> /dev/null; then
        log_info "Running safety check..."
        safety check -r requirements.txt --json > safety-report.json 2>&1 || true
    fi
    
    cd ..
}

# Check Node.js dependencies
audit_nodejs() {
    log_info "Auditing Node.js dependencies..."
    
    if [ -d "frontend" ]; then
        cd frontend
        
        # Run npm audit
        log_info "Running npm audit..."
        if npm audit --json > npm-audit-report.json 2>&1; then
            log_success "No Node.js vulnerabilities found"
        else
            log_warn "Node.js vulnerabilities detected, check npm-audit-report.json"
            npm audit || true
        fi
        
        # Check for outdated packages
        log_info "Checking for outdated packages..."
        npm outdated || true
        
        cd ..
    fi
}

# Check for secrets in code
check_secrets() {
    log_info "Checking for exposed secrets..."
    
    # Patterns to check
    local patterns=(
        "password\s*=\s*[\"'][^\"']+[\"']"
        "secret\s*=\s*[\"'][^\"']+[\"']"
        "api_key\s*=\s*[\"'][^\"']+[\"']"
        "token\s*=\s*[\"'][^\"']+[\"']"
        "private_key\s*=\s*[\"'][^\"']+[\"']"
    )
    
    local found_secrets=false
    
    for pattern in "${patterns[@]}"; do
        # Check Python files
        if grep -rE "$pattern" --include="*.py" . 2>/dev/null | grep -v ".env.example" | grep -v "test" | grep -v "# "; then
            found_secrets=true
        fi
        
        # Check TypeScript/JavaScript files
        if grep -rE "$pattern" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | grep -v "node_modules" | grep -v ".d.ts"; then
            found_secrets=true
        fi
    done
    
    if [ "$found_secrets" = true ]; then
        log_error "Potential secrets found in code! Please review and remove."
        return 1
    else
        log_success "No exposed secrets found"
    fi
}

# Check file permissions
check_permissions() {
    log_info "Checking file permissions..."
    
    # Check for world-writable files
    local writable_files=$(find . -type f -perm -002 ! -path "./node_modules/*" ! -path "./.git/*" 2>/dev/null)
    
    if [ -n "$writable_files" ]; then
        log_warn "Found world-writable files:"
        echo "$writable_files"
    else
        log_success "No world-writable files found"
    fi
    
    # Check for sensitive files with loose permissions
    local sensitive_files=(".env" ".env.local" ".env.production" "*.pem" "*.key")
    
    for file_pattern in "${sensitive_files[@]}"; do
        for file in $(find . -name "$file_pattern" 2>/dev/null); do
            if [ -f "$file" ]; then
                local perms=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%Lp" "$file" 2>/dev/null)
                if [ "${perms: -1}" -gt "0" ]; then
                    log_warn "Sensitive file $file has world-readable permissions: $perms"
                fi
            fi
        done
    done
}

# Check Docker configuration
check_docker() {
    log_info "Checking Docker configuration..."
    
    if [ -f "Dockerfile.backend" ]; then
        # Check for USER instruction (should not run as root)
        if grep -q "USER" Dockerfile.backend; then
            log_success "Dockerfile.backend specifies non-root user"
        else
            log_warn "Dockerfile.backend should specify a non-root USER"
        fi
        
        # Check for COPY --chown
        if grep -q "COPY --chown" Dockerfile.backend; then
            log_success "Dockerfile.backend uses COPY --chown"
        fi
    fi
    
    # Check docker-compose for secrets
    if [ -f "docker-compose.yml" ]; then
        if grep -E "environment:.*password|environment:.*secret" docker-compose.yml | grep -v "\${" > /dev/null; then
            log_error "Hardcoded secrets found in docker-compose.yml"
        else
            log_success "No hardcoded secrets in docker-compose.yml"
        fi
    fi
}

# Generate report
generate_report() {
    log_info "Generating security report..."
    
    local report_file="security-report-$(date +%Y%m%d).md"
    
    cat > "$report_file" << EOF
# Security Audit Report

**Date:** $(date)
**Environment:** ${ENV:-development}

## Summary

This report contains the results of automated security checks.

## Python Dependencies

$(if [ -f backend/pip-audit-report.json ]; then
    echo 'See pip-audit-report.json for details'
else
    echo 'Not checked'
fi)

## Node.js Dependencies

$(if [ -f frontend/npm-audit-report.json ]; then
    echo 'See npm-audit-report.json for details'
else
    echo 'Not checked'
fi)

## Recommendations

1. Review any flagged vulnerabilities
2. Update dependencies as needed
3. Run \`pip-audit fix\` or \`npm audit fix\` for automatic fixes
4. Test application after dependency updates

EOF

    log_info "Report generated: $report_file"
}

# Main execution
main() {
    echo ""
    echo "========================================"
    echo "  SolFoundry Security Audit"
    echo "========================================"
    echo ""
    
    audit_python || true
    audit_nodejs || true
    check_secrets || true
    check_permissions || true
    check_docker || true
    generate_report
    
    echo ""
    echo "========================================"
    log_info "Security audit completed"
    echo "========================================"
    echo ""
}

main "$@"