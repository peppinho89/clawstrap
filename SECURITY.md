# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Clawstrap, **do not open a public issue**.

Instead, email **giuseppe@clawstrap.dev** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

## What Counts as a Security Issue

- Generated workspaces that leak secrets or credentials
- CLI commands that write outside the workspace directory
- Template injection vulnerabilities
- Dependency vulnerabilities with a known exploit

## What Is Not a Security Issue

- Bugs that don't have security implications
- Feature requests
- Questions about usage

## Response Time

We aim to acknowledge reports within 48 hours and provide a fix or mitigation within 7 days for critical issues.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| < 1.0   | No        |
