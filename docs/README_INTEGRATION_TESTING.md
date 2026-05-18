# Integration Testing Documentation

**Complete guide to automated integration testing for Obsidian plugins**

---

## 📚 Documentation Index

This directory contains comprehensive documentation for integration testing Obsidian plugins using osascript and curl.

### Quick Links

| Document | Purpose | Audience |
|----------|---------|----------|
| **[Quick Start](./QUICK_START_INTEGRATION_TESTING.md)** | Get testing in 5 minutes | Everyone |
| **[Integration Testing Guide](./INTEGRATION_TESTING_GUIDE.md)** | Complete reference | Developers |
| **[osascript Techniques](./OSASCRIPT_TECHNIQUES.md)** | macOS automation details | Advanced users |
| **[Template Script](../templates/integration-test-template.sh)** | Ready-to-use template | Developers |

---

## 🎯 What is This?

This documentation solves a critical problem: **Obsidian plugins can't be traditionally unit tested** because the Obsidian API is types-only.

Our solution:
- ✅ Automated integration tests
- ✅ Real Obsidian instance
- ✅ Actual plugin functionality
- ✅ Production environment validation

---

## 🚀 Quick Start

**Got 5 minutes?** Follow the [Quick Start Guide](./QUICK_START_INTEGRATION_TESTING.md)

1. Ensure Obsidian is running
2. Get your API key
3. Run the template script
4. **Done!** You have automated integration tests

---

## 📖 Documentation Structure

### 1. [Quick Start Guide](./QUICK_START_INTEGRATION_TESTING.md)

**For:** Everyone new to integration testing

**Contains:**
- 5-minute setup
- Simple working example
- Common issues and fixes
- Ready-to-use template

**Start here if:** You want to get testing immediately

---

### 2. [Integration Testing Guide](./INTEGRATION_TESTING_GUIDE.md)

**For:** Developers building test suites

**Contains:**
- Complete architecture explanation
- Step-by-step setup
- Extensive code examples
- Common pitfalls and solutions
- Best practices
- Troubleshooting guide
- Future enhancements

**Start here if:** You want to understand the full approach

**Topics covered:**
- Why traditional unit tests fail for Obsidian plugins
- Solution architecture (osascript + curl + Local REST API)
- Prerequisites and setup
- 10+ working code examples
- Error handling patterns
- Performance optimization
- CI/CD integration
- Docker containerization

---

### 3. [osascript Techniques](./OSASCRIPT_TECHNIQUES.md)

**For:** Advanced users and macOS automation enthusiasts

**Contains:**
- 10 documented techniques
- AppleScript examples
- JavaScript for Automation (JXA) examples
- Window management
- UI interaction
- Error handling
- Performance optimization
- Cross-platform alternatives

**Start here if:** You want to master osascript

**Techniques covered:**
1. Check if application is running
2. Get application information
3. Launch and quit applications
4. Window management
5. UI element interaction
6. Error handling
7. Combined with curl
8. JavaScript for Automation
9. Performance optimization
10. Cross-platform alternatives

---

### 4. [Integration Test Template](../templates/integration-test-template.sh)

**For:** Developers starting a new test suite

**Contains:**
- Complete, executable template
- Well-documented sections
- Helper functions
- Multiple test suite examples
- Cleanup handlers
- Summary reporting

**Features:**
- ✅ Auto-extracts API configuration
- ✅ Colored output
- ✅ Test counter with pass/fail tracking
- ✅ Prerequisite checking
- ✅ Error handling
- ✅ Cleanup on exit
- ✅ Comprehensive examples

**Usage:**
```bash
# 1. Copy template
cp templates/integration-test-template.sh my-plugin-tests.sh

# 2. Edit configuration section
# Update VAULT_PATH and PLUGIN_ID

# 3. Add your custom tests

# 4. Run
chmod +x my-plugin-tests.sh
./my-plugin-tests.sh
```

---

## 🛠 How It Works

### The Problem

```typescript
// Your plugin code
import { Plugin, Notice } from "obsidian";

// ❌ Can't unit test - "obsidian" has no runtime code
// - Only TypeScript definitions
// - No executable JavaScript
// - APIs only exist in running Obsidian app
```

### The Solution

```
Test Script (Bash)
    ↓
osascript ─────────▶ Check if Obsidian running
    ↓
curl ──────────────▶ Local REST API Plugin ──▶ Your Plugin
    ↓
Validate Response
```

**Key Components:**
1. **osascript** - macOS automation (checks if Obsidian running)
2. **curl** - HTTP client (calls REST API)
3. **Local REST API** - Obsidian plugin providing HTTP access
4. **Your Plugin** - Registers custom endpoints
5. **Bash Script** - Orchestrates everything

---

## 📦 What's Included

### Files in This Repository

```
docs/
├── README_INTEGRATION_TESTING.md       ← You are here
├── QUICK_START_INTEGRATION_TESTING.md  ← 5-minute guide
├── INTEGRATION_TESTING_GUIDE.md        ← Complete reference
└── OSASCRIPT_TECHNIQUES.md             ← osascript deep dive

templates/
└── integration-test-template.sh        ← Ready-to-use template

test-integration-simple.sh               ← Working example for MCP Tools
INTEGRATION_TEST_RESULTS.md             ← Our actual test results
```

---

## 💡 Use Cases

### When to Use Integration Tests

✅ **Testing plugin loading**
- Verify plugin loads in Obsidian
- Check plugin is registered with Local REST API
- Validate plugin version

✅ **Testing API compatibility**
- Verify plugin works with current Obsidian version
- Test Local REST API integration
- Validate custom endpoints

✅ **Testing file operations**
- Create, read, update, delete files
- Validate file content
- Test error handling

✅ **Pre-release validation**
- Final check before releasing
- Confirm no breaking changes
- Validate in production environment

✅ **CI/CD pipeline**
- Automated testing on push
- Pre-merge validation
- Release gate

### When NOT to Use

❌ **Pure business logic** - Use unit tests instead
❌ **High-frequency testing** - Unit tests are faster
❌ **UI interaction testing** - Manual testing better
❌ **Without Obsidian installed** - Obviously won't work

---

## 🎓 Learning Path

### Beginner Path

1. **Read:** [Quick Start](./QUICK_START_INTEGRATION_TESTING.md)
2. **Do:** Run the template script
3. **Modify:** Add one custom test
4. **Success!** You have working integration tests

**Time:** 15 minutes

### Intermediate Path

1. **Read:** [Integration Testing Guide](./INTEGRATION_TESTING_GUIDE.md)
2. **Study:** Code examples section
3. **Copy:** [Template script](../templates/integration-test-template.sh)
4. **Customize:** Add your plugin's specific tests
5. **Run:** Validate your plugin

**Time:** 1-2 hours

### Advanced Path

1. **Read:** All documentation
2. **Master:** [osascript Techniques](./OSASCRIPT_TECHNIQUES.md)
3. **Build:** Custom test framework
4. **Integrate:** CI/CD pipeline
5. **Optimize:** Performance and reporting

**Time:** 4-8 hours

---

## 🔧 Prerequisites

### Required

- ✅ macOS (or Linux with modifications)
- ✅ Obsidian installed and running
- ✅ Local REST API plugin installed
- ✅ Your plugin installed
- ✅ curl (pre-installed on macOS)

### Optional but Recommended

- ✅ jq (for JSON parsing)
- ✅ Git (for version control)
- ✅ Basic bash knowledge

---

## 📊 Real-World Results

We used this technique to test the **MCP Tools plugin**:

### Results
- ✅ 14/16 tests passing (87%)
- ✅ Validated PR #55 (couldn't be unit tested)
- ✅ Confirmed production readiness
- ✅ Detected version compatibility
- ✅ Verified custom endpoints

### What We Tested
- Plugin loading and registration
- Custom endpoint availability
- MCP server binary
- API connectivity
- File operations

**See:** [INTEGRATION_TEST_RESULTS.md](../INTEGRATION_TEST_RESULTS.md) for complete results

---

## 🤝 Contributing

Found an issue or have an improvement?

1. Document your use case
2. Share your test patterns
3. Submit examples
4. Help improve docs

---

## 📝 Examples

### Example 1: Basic Check

```bash
#!/bin/bash
API_KEY="your-api-key"

# Check if running
if osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; then
    echo "✓ Obsidian is running"

    # Test API
    if curl -k -s -H "Authorization: Bearer $API_KEY" \
        "https://127.0.0.1:27124/" | grep -q "OK"; then
        echo "✓ API is working"
    fi
fi
```

### Example 2: Test Custom Endpoint

```bash
# Test your plugin's endpoint
response=$(curl -k -s -X POST \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"query":"test"}' \
    "https://127.0.0.1:27124/your-endpoint")

if echo "$response" | jq -e '.success == true' > /dev/null; then
    echo "✓ Endpoint works"
fi
```

### Example 3: File Operation

```bash
# Create test file
curl -k -s -X PUT \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: text/markdown" \
    -d "# Test\nContent" \
    "https://127.0.0.1:27124/vault/test.md"

# Verify it exists
if [ -f "/path/to/vault/test.md" ]; then
    echo "✓ File created"

    # Clean up
    curl -k -s -X DELETE \
        -H "Authorization: Bearer $API_KEY" \
        "https://127.0.0.1:27124/vault/test.md"
fi
```

---

## 🎯 Success Stories

### MCP Tools Plugin

**Challenge:** PR #55 added version checking and custom endpoints but couldn't be unit tested due to Obsidian API limitations.

**Solution:** Created integration tests using this technique.

**Result:**
- ✅ Verified plugin loads correctly
- ✅ Confirmed custom endpoints registered
- ✅ Validated version compatibility
- ✅ Detected MCP server running
- ✅ Ready for production release

**Outcome:** PR #55 approved and merged with confidence

---

## 🔗 Additional Resources

### Official Documentation
- [Obsidian API](https://docs.obsidian.md/)
- [Local REST API Plugin](https://github.com/coddingtonbear/obsidian-local-rest-api)
- [osascript Manual](https://ss64.com/osx/osascript.html)

### Tools Used
- [curl](https://curl.se/)
- [jq](https://stedolan.github.io/jq/)
- [AppleScript](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/)

### Related Topics
- Integration testing
- macOS automation
- REST API testing
- Shell scripting

---

## 💬 Feedback

Have questions or suggestions?

- Check the [troubleshooting section](./INTEGRATION_TESTING_GUIDE.md#troubleshooting)
- Review [common pitfalls](./INTEGRATION_TESTING_GUIDE.md#common-pitfalls)
- Study the [working template](../templates/integration-test-template.sh)

---

## 📄 License

This documentation is part of the MCP Tools project.

---

## 🙏 Acknowledgments

This technique was developed while testing the MCP Tools plugin for Obsidian. Special thanks to:

- The Obsidian team for the excellent API
- Local REST API plugin maintainers
- The macOS automation community

---

**Ready to start?** → [Quick Start Guide](./QUICK_START_INTEGRATION_TESTING.md)

**Want details?** → [Integration Testing Guide](./INTEGRATION_TESTING_GUIDE.md)

**Master osascript?** → [osascript Techniques](./OSASCRIPT_TECHNIQUES.md)

**Need template?** → [Template Script](../templates/integration-test-template.sh)
