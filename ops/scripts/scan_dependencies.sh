#!/bin/bash
echo 'Running security scans for Python dependencies...'
pip install bandit safety > /dev/null 2>&1
safety check -r requirements.txt || echo 'Safety check found vulnerabilities or failed.'
bandit -r app/ || echo 'Bandit scan found issues or failed.'

echo 'Running security scans for Node.js dependencies...'
npm install -g npm-audit-ci > /dev/null 2>&1
npm audit --audit-level=high || echo 'npm audit found vulnerabilities or failed.'
npm audit-ci --config .auditci.json || echo 'npm-audit-ci found issues or failed.'

echo 'Dependency audit complete. Review logs for findings.'
