"""Unit tests for security audit module."""
import os
import tempfile
import unittest

from bounty_agent.security_audit import (
    SecurityAuditor, SecretScanner, CodeAuditor,
    Vulnerability, AuditReport, Severity, VulnCategory,
)


class TestSeverity(unittest.TestCase):
    def test_values(self):
        self.assertEqual(Severity.CRITICAL.value, "critical")
        self.assertEqual(Severity.HIGH.value, "high")


class TestVulnerability(unittest.TestCase):
    def test_to_dict(self):
        vuln = Vulnerability(VulnCategory.SECRETS, Severity.HIGH, "Test", "desc")
        d = vuln.to_dict()
        self.assertEqual(d["category"], "hardcoded_secrets")


class TestAuditReport(unittest.TestCase):
    def test_empty_report(self):
        report = AuditReport(target="test")
        self.assertEqual(report.total_count, 0)

    def test_with_vulns(self):
        report = AuditReport(target="test", vulnerabilities=[
            Vulnerability(VulnCategory.INJECTION, Severity.CRITICAL, "SQLi", "desc"),
            Vulnerability(VulnCategory.SECRETS, Severity.HIGH, "Key", "desc"),
        ])
        self.assertEqual(report.total_count, 2)
        self.assertEqual(report.critical_count, 1)

    def test_to_json(self):
        report = AuditReport(target="test")
        self.assertIn("target", report.to_json())


class TestSecretScanner(unittest.TestCase):
    def setUp(self):
        self.scanner = SecretScanner()

    def test_detect_github_token(self):
        line = 'token = "ghp_' + "A" * 36 + '"'
        results = self.scanner.scan_line(line)
        self.assertGreater(len(results), 0)

    def test_detect_private_key(self):
        results = self.scanner.scan_line("-----BEGIN RSA PRIVATE KEY-----")
        self.assertGreater(len(results), 0)

    def test_skip_test_placeholders(self):
        results = self.scanner.scan_line('test_api_key = "mock_key_for_testing"')
        self.assertEqual(len(results), 0)

    def test_scan_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as fh:
            fh.write('TOKEN = "ghp_' + "A" * 36 + '"\n')
            fh.write('normal = "hello"\n')
            fh.flush()
            results = self.scanner.scan_file(fh.name)
            os.unlink(fh.name)
        self.assertGreater(len(results), 0)


class TestCodeAuditor(unittest.TestCase):
    def setUp(self):
        self.auditor = CodeAuditor()

    def test_detect_eval(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as fh:
            fh.write("result = eval(user_input)\n")
            fh.flush()
            results = self.auditor.scan_file(fh.name)
            os.unlink(fh.name)
        self.assertGreater(len(results), 0)

    def test_detect_pickle(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as fh:
            fh.write("data = pickle.loads(raw)\n")
            fh.flush()
            results = self.auditor.scan_file(fh.name)
            os.unlink(fh.name)
        self.assertGreater(len(results), 0)

    def test_skip_comments(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as fh:
            fh.write("# result = eval(user_input)\n")
            fh.flush()
            results = self.auditor.scan_file(fh.name)
            os.unlink(fh.name)
        eval_results = [r for r in results if "Eval" in r.title]
        self.assertEqual(len(eval_results), 0)


class TestSecurityAuditor(unittest.TestCase):
    def setUp(self):
        self.auditor = SecurityAuditor()

    def test_audit_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as fh:
            fh.write('token = "ghp_' + "A" * 36 + '"\n')
            fh.write("result = eval(x)\n")
            fh.flush()
            report = self.auditor.audit(fh.name)
            os.unlink(fh.name)
        self.assertGreater(report.total_count, 0)

    def test_audit_directory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with open(os.path.join(tmpdir, "safe.py"), "w") as fh:
                fh.write("x = 1\n")
            report = self.auditor.audit(tmpdir)
            self.assertGreater(report.files_scanned, 0)

    def test_audit_nonexistent(self):
        report = self.auditor.audit("/nonexistent/path")
        self.assertEqual(report.total_count, 0)

    def test_report_output(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with open(os.path.join(tmpdir, "test.py"), "w") as fh:
                fh.write("x = 1\n")
            output = os.path.join(tmpdir, "report.json")
            self.auditor.audit_and_report(tmpdir, output)
            self.assertTrue(os.path.exists(output))

    def test_deduplication(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as fh:
            fh.write("eval(x) + eval(y)\n")
            fh.flush()
            report = self.auditor.audit(fh.name)
            os.unlink(fh.name)
        eval_findings = [v for v in report.vulnerabilities if "Eval" in v.title]
        self.assertEqual(len(eval_findings), 1)


if __name__ == "__main__":
    unittest.main()
