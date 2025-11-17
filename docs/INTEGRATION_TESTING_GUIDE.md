# Integration Testing Guide for Obsidian Plugins

**Author:** Claude Code
**Date:** 2025-11-15
**Purpose:** Comprehensive guide for automated integration testing of Obsidian plugins using osascript + curl

---

## Table of Contents

1. [Overview](#overview)
2. [The Problem We're Solving](#the-problem-were-solving)
3. [Solution Architecture](#solution-architecture)
4. [Prerequisites](#prerequisites)
5. [Step-by-Step Setup](#step-by-step-setup)
6. [How It Works](#how-it-works)
7. [Code Examples](#code-examples)
8. [Common Pitfalls](#common-pitfalls)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)
11. [Future Enhancements](#future-enhancements)

---

## Overview

This guide documents a technique for **automated integration testing of Obsidian plugins** using macOS automation tools. Unlike unit tests that mock the Obsidian API, this approach tests against a **real running Obsidian instance**.

### What You'll Learn

- ✅ How to check if Obsidian is running programmatically
- ✅ How to interact with Obsidian plugins via REST API
- ✅ How to automate plugin testing without manual interaction
- ✅ How to validate plugin functionality in production environment
- ✅ How to create reproducible integration test suites

---

## The Problem We're Solving

### Challenge: Obsidian Plugins Can't Be Unit Tested Traditionally

**The Issue:**

```typescript
// This code imports from Obsidian
import { Plugin, Notice, TFile } from "obsidian";

// Problem: 'obsidian' package is types-only
// - Contains only TypeScript definitions (obsidian.d.ts)
// - No executable code
// - APIs only exist inside running Obsidian app
```

**Why Unit Tests Fail:**

1. **No Runtime Code** - The `obsidian` npm package has no implementation:
   ```json
   {
     "name": "obsidian",
     "main": "",  // Empty!
     "types": "obsidian.d.ts"
   }
   ```

2. **Bun/Jest Module Resolution** - Test frameworks try to import the module before mocks are applied

3. **Error:**
   ```
   error: Cannot find package 'obsidian' from '/path/to/plugin/main.ts'
   ```

### The Gap This Creates

| Test Type | What It Validates | What It Misses |
|-----------|-------------------|----------------|
| **Unit Tests** | Code logic, edge cases | Plugin loading, API compatibility |
| **Manual Testing** | Real environment | Not automated, not reproducible |
| **❌ Missing** | Automated + Real environment | **This is the gap we fill** |

---

## Solution Architecture

### The Approach

Use **external automation** to interact with a running Obsidian instance:

```
┌─────────────────────────────────────────────────┐
│  macOS System                                   │
│                                                 │
│  ┌──────────────┐         ┌─────────────────┐  │
│  │ Test Script  │────────▶│ osascript       │  │
│  │ (Bash)       │         │ (Check if       │  │
│  │              │         │  running)       │  │
│  └──────────────┘         └─────────────────┘  │
│         │                                       │
│         │ curl (HTTPS)                          │
│         ▼                                       │
│  ┌──────────────────────────────────────────┐  │
│  │ Obsidian Application (Running)           │  │
│  │                                          │  │
│  │  ┌────────────────────┐                 │  │
│  │  │ Local REST API     │◀────────────────┼──┤ Port 27124
│  │  │ Plugin (v3.2.0)    │                 │  │
│  │  └────────────────────┘                 │  │
│  │           │                              │  │
│  │           │ Extension API                │  │
│  │           ▼                              │  │
│  │  ┌────────────────────┐                 │  │
│  │  │ MCP Tools Plugin   │                 │  │
│  │  │ (Your Plugin)      │                 │  │
│  │  └────────────────────┘                 │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Key Components

1. **osascript** - macOS automation (checks if Obsidian is running)
2. **curl** - HTTP client (interacts with REST API)
3. **Local REST API Plugin** - Provides HTTP access to Obsidian
4. **Your Plugin** - Registers custom endpoints via Local REST API
5. **Bash Script** - Orchestrates the tests

---

## Prerequisites

### Required Software

1. **macOS** (or Linux with equivalent tools)
   ```bash
   # Check macOS version
   sw_vers
   ```

2. **Obsidian** (v1.7.7+)
   ```bash
   # Install from: https://obsidian.md
   ```

3. **Local REST API Plugin**
   ```bash
   # Install from Obsidian Community Plugins:
   # Settings → Community plugins → Browse → "Local REST API"
   ```

4. **curl** (usually pre-installed on macOS)
   ```bash
   curl --version
   ```

5. **jq** (optional, for JSON parsing)
   ```bash
   brew install jq
   ```

### Plugin Requirements

Your Obsidian plugin must:

1. ✅ Be installed and enabled in Obsidian
2. ✅ Register endpoints with Local REST API (if needed)
3. ✅ Be running/active when tests execute

---

## Step-by-Step Setup

### 1. Install and Configure Local REST API

**Install:**
1. Open Obsidian
2. Settings → Community plugins → Browse
3. Search "Local REST API"
4. Install and Enable

**Configure:**
```bash
# Configuration file location:
~/.obsidian/vaults/YOUR_VAULT/.obsidian/plugins/obsidian-local-rest-api/data.json

# Extract API key:
grep '"apiKey"' data.json | cut -d'"' -f4
```

**Important Settings:**
- ✅ Enable HTTPS (recommended)
- ✅ Note the port (default: 27124 for HTTPS, 27123 for HTTP)
- ✅ Copy the API key

### 2. Verify Obsidian is Running

**Check programmatically:**

```bash
# Method 1: Using osascript
osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"'
# Output: true (if running) or false

# Method 2: Using ps
ps aux | grep -v grep | grep Obsidian
# Output: Process details (if running) or nothing
```

### 3. Test API Connectivity

**Get API info:**

```bash
# Set variables
API_KEY="your-api-key-here"
BASE_URL="https://127.0.0.1:27124"

# Test connection
curl -k -s \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/" | jq
```

**Expected output:**
```json
{
  "status": "OK",
  "service": "Obsidian Local REST API",
  "authenticated": true,
  "versions": {
    "obsidian": "1.10.3",
    "self": "3.2.0"
  }
}
```

### 4. Create Test Script Template

**File:** `test-integration.sh`

```bash
#!/bin/bash
set -e

# Configuration
VAULT_PATH="/path/to/your/vault"
API_CONFIG="$VAULT_PATH/.obsidian/plugins/obsidian-local-rest-api/data.json"

# Extract API key
API_KEY=$(grep -o '"apiKey":"[^"]*' "$API_CONFIG" | cut -d'"' -f4)
PORT=$(grep -o '"port":[0-9]*' "$API_CONFIG" | cut -d':' -f2)
BASE_URL="https://127.0.0.1:${PORT}"

# Test counters
TOTAL=0
PASSED=0
FAILED=0

# Helper functions
test_pass() {
    echo "✓ PASS: $1"
    PASSED=$((PASSED + 1))
    TOTAL=$((TOTAL + 1))
}

test_fail() {
    echo "✗ FAIL: $1"
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
}

# Test 1: Check if Obsidian is running
echo "=== Environment Checks ==="
if osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; then
    test_pass "Obsidian is running"
else
    test_fail "Obsidian is running"
    exit 1
fi

# Test 2: API is accessible
HTTP_CODE=$(curl -k -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $API_KEY" "$BASE_URL/")
if [ "$HTTP_CODE" = "200" ]; then
    test_pass "API is accessible (HTTP $HTTP_CODE)"
else
    test_fail "API is accessible (got HTTP $HTTP_CODE)"
fi

# Add more tests here...

# Summary
echo ""
echo "Results: $PASSED passed, $FAILED failed out of $TOTAL tests"
[ $FAILED -eq 0 ] && exit 0 || exit 1
```

### 5. Make Script Executable

```bash
chmod +x test-integration.sh
```

### 6. Run Tests

```bash
./test-integration.sh
```

---

## How It Works

### Process Flow

1. **Environment Check**
   ```bash
   osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"'
   ```
   - Queries macOS for running processes
   - Returns `true` if Obsidian is running
   - Fast and reliable

2. **API Configuration Discovery**
   ```bash
   API_KEY=$(grep -o '"apiKey":"[^"]*' "$API_CONFIG" | cut -d'"' -f4)
   ```
   - Reads Local REST API config file
   - Extracts API key and port dynamically
   - No hardcoding needed

3. **HTTP Request to Plugin**
   ```bash
   curl -k -s \
     -H "Authorization: Bearer $API_KEY" \
     "$BASE_URL/your-endpoint"
   ```
   - `-k`: Skip SSL verification (self-signed cert)
   - `-s`: Silent mode (no progress bar)
   - `-H`: Add authorization header
   - Returns actual plugin response

4. **Response Validation**
   ```bash
   if echo "$response" | grep -q "expected-pattern"; then
       test_pass "Description"
   else
       test_fail "Description"
   fi
   ```
   - Pattern matching for validation
   - Can use `jq` for JSON parsing
   - Exit codes for pass/fail

### Why This Works

✅ **No Mocking Required** - Tests real plugin code
✅ **Real Dependencies** - All Obsidian APIs available
✅ **Production Environment** - Same as end users
✅ **Automated** - Runs without human interaction
✅ **Fast** - Typically < 1 second per test
✅ **Reproducible** - Same results every time

---

## Code Examples

### Example 1: Check Plugin is Loaded

```bash
test_plugin_loaded() {
    echo "Testing: Plugin is loaded..."

    response=$(curl -k -s \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL/")

    if echo "$response" | jq -e '.apiExtensions[] | select(.id=="your-plugin-id")' > /dev/null 2>&1; then
        test_pass "Plugin is loaded and registered"

        # Get version
        version=$(echo "$response" | jq -r '.apiExtensions[] | select(.id=="your-plugin-id") | .version')
        echo "  Version: $version"
    else
        test_fail "Plugin is loaded and registered"
    fi
}
```

### Example 2: Test Custom Endpoint

```bash
test_custom_endpoint() {
    echo "Testing: Custom endpoint /my-endpoint..."

    # Send POST request with JSON data
    response=$(curl -k -s \
        -X POST \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"key":"value"}' \
        "$BASE_URL/my-endpoint")

    # Check HTTP status code
    http_code=$(curl -k -s -o /dev/null -w '%{http_code}' \
        -X POST \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"key":"value"}' \
        "$BASE_URL/my-endpoint")

    if [ "$http_code" = "200" ]; then
        test_pass "Custom endpoint responds (HTTP $http_code)"
    else
        test_fail "Custom endpoint responds (HTTP $http_code)"
    fi
}
```

### Example 3: Test File Operations

```bash
test_file_operations() {
    echo "Testing: File operations..."

    test_file="test-$(date +%s).md"
    test_content="# Test\n\nContent"

    # Create file
    create_response=$(curl -k -s -X PUT \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: text/markdown" \
        -d "$test_content" \
        "$BASE_URL/vault/$test_file")

    if [ -f "$VAULT_PATH/$test_file" ]; then
        test_pass "File created successfully"

        # Read file
        read_response=$(curl -k -s \
            -H "Authorization: Bearer $API_KEY" \
            "$BASE_URL/vault/$test_file")

        if echo "$read_response" | grep -q "Test"; then
            test_pass "File content is correct"
        fi

        # Delete file
        curl -k -s -X DELETE \
            -H "Authorization: Bearer $API_KEY" \
            "$BASE_URL/vault/$test_file" > /dev/null

        if [ ! -f "$VAULT_PATH/$test_file" ]; then
            test_pass "File deleted successfully"
        fi
    else
        test_fail "File created successfully"
    fi
}
```

### Example 4: Test Error Handling

```bash
test_error_handling() {
    echo "Testing: Error handling..."

    # Try to access non-existent file
    http_code=$(curl -k -s -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL/vault/non-existent-file.md")

    if [ "$http_code" = "404" ]; then
        test_pass "Returns 404 for non-existent file"
    else
        test_fail "Returns 404 for non-existent file (got $http_code)"
    fi

    # Try with invalid API key
    http_code=$(curl -k -s -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer invalid-key" \
        "$BASE_URL/")

    if [ "$http_code" = "401" ]; then
        test_pass "Returns 401 for invalid API key"
    else
        test_fail "Returns 401 for invalid API key (got $http_code)"
    fi
}
```

### Example 5: Test with JSON Validation

```bash
test_json_response() {
    echo "Testing: JSON response structure..."

    response=$(curl -k -s \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL/your-endpoint")

    # Validate JSON structure
    if echo "$response" | jq -e '.status == "OK"' > /dev/null 2>&1; then
        test_pass "Response has correct status"
    else
        test_fail "Response has correct status"
    fi

    if echo "$response" | jq -e '.data | type == "array"' > /dev/null 2>&1; then
        test_pass "Response data is an array"

        count=$(echo "$response" | jq '.data | length')
        echo "  Found $count items"
    else
        test_fail "Response data is an array"
    fi
}
```

---

## Common Pitfalls

### 1. SSL Certificate Issues

**Problem:**
```bash
curl: (60) SSL certificate problem: self-signed certificate
```

**Solution:**
```bash
# Use -k flag to skip certificate verification
curl -k -s "$BASE_URL/"

# Or install the certificate (more secure):
# 1. Get cert from Local REST API settings
# 2. Add to system keychain
security add-trusted-cert -d -r trustRoot \
  -k ~/Library/Keychains/login.keychain-db \
  /path/to/cert.pem
```

### 2. Variable Expansion in Eval

**Problem:**
```bash
# This fails when using eval:
run_test() {
    eval "$command"  # Variables like $API_KEY don't expand
}
```

**Solution:**
```bash
# Don't use eval - execute directly:
run_test() {
    # Execute command directly
    $command
}

# Or use double quotes for expansion:
eval "curl -H \"Authorization: Bearer ${API_KEY}\" ..."
```

### 3. Obsidian Not Running

**Problem:**
Test fails because Obsidian isn't running

**Solution:**
```bash
# Always check first
if ! osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; then
    echo "Error: Obsidian is not running"
    echo "Please start Obsidian and try again"
    exit 1
fi
```

### 4. Wrong API Key

**Problem:**
Getting 401 Unauthorized

**Solution:**
```bash
# Verify API key extraction
echo "API Key: ${API_KEY:0:10}..." # Show first 10 chars
echo "Config file: $API_CONFIG"

# Test with explicit key first
API_KEY="your-known-working-key"
```

### 5. Port Conflicts

**Problem:**
API not responding on expected port

**Solution:**
```bash
# Read port dynamically
PORT=$(grep -o '"port":[0-9]*' "$API_CONFIG" | cut -d':' -f2)
echo "Using port: $PORT"

# Or check both ports
for port in 27123 27124; do
    if curl -k -s "https://127.0.0.1:$port/" > /dev/null 2>&1; then
        echo "API responding on port $port"
        BASE_URL="https://127.0.0.1:$port"
        break
    fi
done
```

### 6. JSON Parsing Errors

**Problem:**
```bash
jq: parse error: Invalid numeric literal
```

**Solution:**
```bash
# Always check if response is valid JSON first
if echo "$response" | jq empty > /dev/null 2>&1; then
    # Valid JSON, safe to parse
    value=$(echo "$response" | jq -r '.key')
else
    echo "Error: Invalid JSON response"
    echo "Response: $response"
fi
```

### 7. File Path Issues

**Problem:**
Files not found in vault

**Solution:**
```bash
# Always use absolute paths
VAULT_PATH="/absolute/path/to/vault"

# Verify vault exists
if [ ! -d "$VAULT_PATH" ]; then
    echo "Error: Vault not found at $VAULT_PATH"
    exit 1
fi

# Test with known file
curl -k -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/vault/" | jq # List all files
```

---

## Best Practices

### 1. Structure Your Tests

```bash
#!/bin/bash
set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration section
readonly VAULT_PATH="/path/to/vault"
readonly API_CONFIG="$VAULT_PATH/.obsidian/plugins/obsidian-local-rest-api/data.json"

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly NC='\033[0m'

# Test sections
main() {
    setup
    test_environment
    test_api_connectivity
    test_plugin_functionality
    test_edge_cases
    cleanup
    report_results
}

main "$@"
```

### 2. Use Helper Functions

```bash
# HTTP request helper
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"

    local args="-k -s -X $method -H \"Authorization: Bearer $API_KEY\""

    if [ -n "$data" ]; then
        args="$args -H \"Content-Type: application/json\" -d '$data'"
    fi

    eval "curl $args \"$BASE_URL$endpoint\""
}

# Usage
response=$(api_request GET "/vault/")
response=$(api_request POST "/my-endpoint" '{"key":"value"}')
```

### 3. Validate Prerequisites

```bash
check_prerequisites() {
    local errors=0

    # Check curl
    if ! command -v curl &> /dev/null; then
        echo "Error: curl is not installed"
        errors=$((errors + 1))
    fi

    # Check jq
    if ! command -v jq &> /dev/null; then
        echo "Warning: jq is not installed (optional but recommended)"
    fi

    # Check Obsidian
    if ! osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; then
        echo "Error: Obsidian is not running"
        errors=$((errors + 1))
    fi

    # Check config file
    if [ ! -f "$API_CONFIG" ]; then
        echo "Error: API config not found at $API_CONFIG"
        errors=$((errors + 1))
    fi

    if [ $errors -gt 0 ]; then
        exit 1
    fi
}
```

### 4. Add Timeouts

```bash
# Add timeout to curl requests
curl_with_timeout() {
    timeout 10 curl "$@" || {
        echo "Error: Request timed out after 10 seconds"
        return 1
    }
}

# Usage
response=$(curl_with_timeout -k -s \
    -H "Authorization: Bearer $API_KEY" \
    "$BASE_URL/")
```

### 5. Create Cleanup Functions

```bash
cleanup() {
    echo "Cleaning up..."

    # Delete test files
    for file in test-*.md; do
        if [ -f "$VAULT_PATH/$file" ]; then
            curl -k -s -X DELETE \
                -H "Authorization: Bearer $API_KEY" \
                "$BASE_URL/vault/$file" > /dev/null
        fi
    done

    echo "Cleanup complete"
}

# Register cleanup on exit
trap cleanup EXIT
```

### 6. Generate Detailed Reports

```bash
generate_report() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local report_file="test-report-$timestamp.md"

    cat > "$report_file" <<EOF
# Integration Test Report

**Date:** $(date)
**Total Tests:** $TOTAL
**Passed:** $PASSED
**Failed:** $FAILED
**Pass Rate:** $((PASSED * 100 / TOTAL))%

## Environment
- Obsidian Version: $(get_obsidian_version)
- Local REST API Version: $(get_api_version)
- Vault Path: $VAULT_PATH

## Test Results

$(print_test_results)

EOF

    echo "Report saved to $report_file"
}
```

### 7. Use Environment Variables

```bash
# .env file
VAULT_PATH="/path/to/vault"
TEST_TIMEOUT=10
VERBOSE=true

# In script
if [ -f .env ]; then
    source .env
fi

# Override from command line
VERBOSE=true ./test-integration.sh
```

---

## Troubleshooting

### Debug Mode

```bash
#!/bin/bash
set -x  # Print all commands

# Or toggle with environment variable
if [ "${DEBUG:-false}" = "true" ]; then
    set -x
fi

# Usage:
DEBUG=true ./test-integration.sh
```

### Verbose Output

```bash
verbose_log() {
    if [ "${VERBOSE:-false}" = "true" ]; then
        echo "[DEBUG] $*"
    fi
}

# Usage
verbose_log "API Key: ${API_KEY:0:10}..."
verbose_log "Making request to $BASE_URL$endpoint"

# Run with:
VERBOSE=true ./test-integration.sh
```

### Save Request/Response

```bash
test_with_logging() {
    local test_name="$1"
    local endpoint="$2"

    # Save request
    echo "GET $BASE_URL$endpoint" > "logs/${test_name}_request.txt"

    # Save response
    response=$(curl -k -s \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL$endpoint" \
        | tee "logs/${test_name}_response.json")

    # Validate
    if echo "$response" | jq empty > /dev/null 2>&1; then
        test_pass "$test_name"
    else
        test_fail "$test_name"
        echo "See logs/${test_name}_response.json for details"
    fi
}
```

### Check API Logs

```bash
# Local REST API logs location
tail -f "$VAULT_PATH/.obsidian/plugins/obsidian-local-rest-api/logs/latest.log"

# Or in Obsidian:
# Open Developer Tools (Cmd+Opt+I)
# Check Console tab for errors
```

---

## Future Enhancements

### 1. CI/CD Integration

```yaml
# .github/workflows/integration-test.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest

    steps:
      - uses: actions/checkout@v3

      - name: Install Obsidian
        run: |
          brew install --cask obsidian

      - name: Setup vault
        run: |
          mkdir -p test-vault/.obsidian/plugins
          # Copy plugin to vault

      - name: Start Obsidian
        run: |
          open -a Obsidian test-vault
          sleep 10  # Wait for startup

      - name: Run tests
        run: ./test-integration.sh

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-report-*.md
```

### 2. Docker Container

```dockerfile
# Dockerfile for integration testing
FROM ubuntu:22.04

# Install Obsidian dependencies
RUN apt-get update && apt-get install -y \
    curl \
    jq \
    xvfb \
    libgtk-3-0

# Install Obsidian AppImage
RUN curl -L https://github.com/obsidianmd/obsidian-releases/releases/download/vX.X.X/Obsidian-X.X.X.AppImage \
    -o /usr/local/bin/obsidian && \
    chmod +x /usr/local/bin/obsidian

# Copy test scripts
COPY test-integration.sh /tests/

CMD ["bash", "/tests/test-integration.sh"]
```

### 3. Parallel Test Execution

```bash
# Run tests in parallel
run_tests_parallel() {
    local pids=()

    # Start tests in background
    test_api_connectivity & pids+=($!)
    test_file_operations & pids+=($!)
    test_custom_endpoints & pids+=($!)

    # Wait for all to complete
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
}
```

### 4. Performance Benchmarking

```bash
benchmark_test() {
    local test_name="$1"
    local endpoint="$2"
    local iterations=100

    echo "Benchmarking $test_name..."

    local start=$(date +%s%N)

    for i in $(seq 1 $iterations); do
        curl -k -s \
            -H "Authorization: Bearer $API_KEY" \
            "$BASE_URL$endpoint" > /dev/null
    done

    local end=$(date +%s%N)
    local duration=$(( (end - start) / 1000000 ))  # Convert to ms
    local avg=$(( duration / iterations ))

    echo "  Total time: ${duration}ms"
    echo "  Average time: ${avg}ms per request"
    echo "  Requests/sec: $(( 1000 * iterations / duration ))"
}
```

### 5. Visual Reporting

```bash
# Generate HTML report with charts
generate_html_report() {
    cat > report.html <<'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Integration Test Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <h1>Integration Test Report</h1>
    <canvas id="resultsChart"></canvas>
    <script>
        new Chart(document.getElementById('resultsChart'), {
            type: 'pie',
            data: {
                labels: ['Passed', 'Failed'],
                datasets: [{
                    data: [PASSED_COUNT, FAILED_COUNT],
                    backgroundColor: ['#28a745', '#dc3545']
                }]
            }
        });
    </script>
</body>
</html>
EOF

    # Replace placeholders
    sed -i "s/PASSED_COUNT/$PASSED/g" report.html
    sed -i "s/FAILED_COUNT/$FAILED/g" report.html

    open report.html
}
```

### 6. Cross-Platform Support

```bash
# Detect OS and adjust commands
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            OS="macos"
            CHECK_RUNNING="osascript -e 'tell application \"System Events\" to (name of processes) contains \"Obsidian\"'"
            ;;
        Linux*)
            OS="linux"
            CHECK_RUNNING="pgrep -x obsidian"
            ;;
        MINGW*|MSYS*)
            OS="windows"
            CHECK_RUNNING="tasklist | findstr obsidian.exe"
            ;;
        *)
            echo "Unsupported OS"
            exit 1
            ;;
    esac
}
```

---

## Summary

### What We've Documented

✅ **Complete technique** for integration testing Obsidian plugins
✅ **Step-by-step setup** from scratch
✅ **Working code examples** for common scenarios
✅ **Common pitfalls** and solutions
✅ **Best practices** for maintainable tests
✅ **Troubleshooting guide** for debugging
✅ **Future enhancements** for scaling up

### Key Takeaways

1. **osascript** enables programmatic Obsidian detection on macOS
2. **Local REST API** provides HTTP access to Obsidian internals
3. **curl** is sufficient for most integration testing needs
4. **Bash scripts** can orchestrate complex test scenarios
5. **This approach fills the gap** between unit tests and manual testing

### When to Use This

✅ Testing plugin loading and initialization
✅ Validating API compatibility
✅ Testing custom endpoints
✅ Verifying file operations
✅ Testing error handling in production
✅ Pre-release validation

### When NOT to Use This

❌ Testing pure business logic (use unit tests)
❌ Testing UI interactions (use manual testing)
❌ High-frequency testing (use unit tests)
❌ Testing without Obsidian installed

---

## Additional Resources

- **Local REST API Docs:** https://github.com/coddingtonbear/obsidian-local-rest-api
- **Obsidian API Docs:** https://docs.obsidian.md/
- **osascript Guide:** `man osascript`
- **curl Manual:** https://curl.se/docs/manual.html
- **jq Tutorial:** https://stedolan.github.io/jq/tutorial/

---

**This technique was developed while testing the MCP Tools plugin and successfully validated functionality that couldn't be unit tested due to Obsidian API limitations.**
