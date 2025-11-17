# osascript Techniques for Obsidian Testing

**Purpose:** Document specific osascript commands and techniques for Obsidian automation

---

## What is osascript?

`osascript` is macOS's command-line tool for executing AppleScript and JavaScript for Automation (JXA). It allows shell scripts to interact with macOS applications.

```bash
man osascript  # View full documentation
```

---

## Basic Syntax

### AppleScript (Default)

```bash
osascript -e 'AppleScript command here'
```

### JavaScript for Automation

```bash
osascript -l JavaScript -e 'JavaScript code here'
```

### Multi-line Scripts

```bash
osascript <<EOF
tell application "SystemEvents"
    -- Multi-line script here
end tell
EOF
```

---

## Technique 1: Check if Application is Running

### Method 1: Process Name Check (Recommended)

```bash
# Returns: true or false
osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"'

# Usage in script:
if osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; then
    echo "Obsidian is running"
else
    echo "Obsidian is not running"
fi
```

**Why this works:**
- Checks actual running processes
- Works even if app is in background
- Fast (<100ms)
- Reliable

### Method 2: Application Running Check

```bash
# Returns: true or false
osascript -e 'tell application "System Events" to (exists process "Obsidian")'

# Alternative form:
osascript <<EOF
tell application "System Events"
    set isRunning to exists (processes where name is "Obsidian")
end tell
return isRunning
EOF
```

### Method 3: Try to Get Process Information

```bash
# Returns error if not running
osascript -e 'tell application "System Events" to get process "Obsidian"'

# Usage with error handling:
if osascript -e 'tell application "System Events" to get process "Obsidian"' 2>/dev/null; then
    echo "Running"
else
    echo "Not running"
fi
```

---

## Technique 2: Get Application Information

### Get Application Version

```bash
# Get Obsidian version
osascript -e 'tell application "System Events" to get version of process "Obsidian"'
```

### Get Process ID

```bash
# Get PID
osascript -e 'tell application "System Events" to get unix id of process "Obsidian"'

# Alternative using ps:
ps aux | grep Obsidian | grep -v grep | awk '{print $2}'
```

### Get Application Path

```bash
# Get full path to app
osascript -e 'tell application "Finder" to get POSIX path of (application file id "md.obsidian" as alias)'
```

### List All Running Processes

```bash
# Get all process names
osascript -e 'tell application "System Events" to get name of every process'

# Search for specific pattern:
osascript -e 'tell application "System Events" to get name of every process' | grep -i obsidian
```

---

## Technique 3: Launch and Quit Applications

### Launch Obsidian

```bash
# Method 1: Using 'open' (simpler)
open -a Obsidian

# Method 2: Using osascript
osascript -e 'tell application "Obsidian" to activate'

# Method 3: Open specific vault
open -a Obsidian "/path/to/vault"
```

### Launch and Wait

```bash
# Open and wait for app to be ready
open -a Obsidian
sleep 5  # Wait for app to initialize

# Or check until running:
open -a Obsidian
until osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; do
    echo "Waiting for Obsidian to start..."
    sleep 1
done
echo "Obsidian is ready!"
```

### Quit Application

```bash
# Graceful quit
osascript -e 'tell application "Obsidian" to quit'

# Force quit
killall Obsidian

# Force quit with osascript
osascript -e 'tell application "System Events" to kill process "Obsidian"'
```

---

## Technique 4: Window Management

### Check if Window is Open

```bash
# Check if Obsidian has any windows
osascript <<EOF
tell application "System Events"
    tell process "Obsidian"
        count of windows
    end tell
end tell
EOF
```

### Get Window Title

```bash
# Get title of front window
osascript <<EOF
tell application "System Events"
    tell process "Obsidian"
        get title of front window
    end tell
end tell
EOF
```

### Bring to Front

```bash
# Activate Obsidian (bring to front)
osascript -e 'tell application "Obsidian" to activate'
```

### Minimize/Maximize

```bash
# Minimize all windows
osascript <<EOF
tell application "System Events"
    tell process "Obsidian"
        set value of attribute "AXMinimized" of every window to true
    end tell
end tell
EOF
```

---

## Technique 5: Interact with UI Elements

### Click Menu Item

```bash
# Example: Click File > New Note
osascript <<EOF
tell application "System Events"
    tell process "Obsidian"
        click menu item "New Note" of menu "File" of menu bar 1
    end tell
end tell
EOF
```

### Get Menu Structure

```bash
# List all menu items
osascript <<EOF
tell application "System Events"
    tell process "Obsidian"
        get name of every menu of menu bar 1
    end tell
end tell
EOF
```

### Type Text

```bash
# Type text into Obsidian
osascript <<EOF
tell application "Obsidian" to activate
tell application "System Events"
    keystroke "Hello from osascript!"
end tell
EOF
```

### Keyboard Shortcuts

```bash
# Press Cmd+N (New Note)
osascript <<EOF
tell application "Obsidian" to activate
tell application "System Events"
    keystroke "n" using command down
end tell
EOF
```

---

## Technique 6: Error Handling

### Try-Catch Pattern

```bash
result=$(osascript <<EOF 2>&1
try
    tell application "System Events"
        get process "Obsidian"
    end tell
    return "success"
on error errMsg
    return "error: " & errMsg
end try
EOF
)

if echo "$result" | grep -q "success"; then
    echo "Command succeeded"
else
    echo "Command failed: $result"
fi
```

### Timeout Handling

```bash
# Set timeout for slow operations
osascript <<EOF
with timeout of 10 seconds
    tell application "Obsidian"
        -- Long-running operation
    end tell
end timeout
EOF
```

---

## Technique 7: Combined with curl

### Wait for App, Then Test API

```bash
#!/bin/bash

# 1. Check if Obsidian is running
echo "Checking Obsidian status..."
if ! osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; then
    echo "Starting Obsidian..."
    open -a Obsidian

    # Wait for it to start
    timeout=30
    elapsed=0
    until osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; do
        if [ $elapsed -ge $timeout ]; then
            echo "Timeout waiting for Obsidian to start"
            exit 1
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done
fi

echo "Obsidian is running"

# 2. Wait a bit for plugins to load
echo "Waiting for plugins to load..."
sleep 5

# 3. Test API
echo "Testing API..."
response=$(curl -k -s \
    -H "Authorization: Bearer $API_KEY" \
    "https://127.0.0.1:27124/")

if echo "$response" | grep -q "OK"; then
    echo "API is working!"
else
    echo "API is not responding"
    exit 1
fi
```

---

## Technique 8: JavaScript for Automation (JXA)

### Check if Running (JXA)

```bash
osascript -l JavaScript -e '
var se = Application("System Events");
se.processes.whose({name: "Obsidian"}).length > 0
'
```

### Get Process Information (JXA)

```bash
osascript -l JavaScript -e '
var se = Application("System Events");
var processes = se.processes.whose({name: "Obsidian"});
if (processes.length > 0) {
    var obs = processes[0];
    JSON.stringify({
        name: obs.name(),
        pid: obs.unixId(),
        frontmost: obs.frontmost()
    });
}
'
```

### Why Use JXA?

- ✅ Familiar syntax for JS developers
- ✅ Better for complex data structures
- ✅ JSON output is easier to parse
- ❌ Slightly slower than AppleScript
- ❌ Less documentation available

---

## Technique 9: Performance Optimization

### Cache Results

```bash
# Bad: Check multiple times
if osascript -e '...' | grep -q true; then
    echo "Running"
fi
if osascript -e '...' | grep -q true; then
    do_something
fi

# Good: Check once, cache result
IS_RUNNING=$(osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"')

if echo "$IS_RUNNING" | grep -q true; then
    echo "Running"
    do_something
fi
```

### Use Faster Alternatives When Possible

```bash
# osascript: ~100ms
osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"'

# ps + grep: ~10ms (10x faster)
ps aux | grep -v grep | grep -q Obsidian

# pgrep: ~5ms (20x faster)
pgrep -x Obsidian > /dev/null
```

**When to use each:**
- `osascript`: When you need macOS-specific app info
- `ps + grep`: When you just need to check if running
- `pgrep`: Fastest, but less precise

---

## Technique 10: Cross-Platform Alternatives

### Detect OS and Choose Method

```bash
detect_obsidian() {
    case "$(uname -s)" in
        Darwin*)
            # macOS: Use osascript
            osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true
            ;;
        Linux*)
            # Linux: Use pgrep
            pgrep -x obsidian > /dev/null
            ;;
        MINGW*|MSYS*)
            # Windows: Use tasklist
            tasklist | grep -i obsidian.exe > /dev/null
            ;;
        *)
            echo "Unsupported OS"
            return 1
            ;;
    esac
}

# Usage
if detect_obsidian; then
    echo "Obsidian is running"
fi
```

---

## Common Patterns

### Pattern 1: Ensure App is Running

```bash
ensure_obsidian_running() {
    if ! osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; then
        echo "Starting Obsidian..."
        open -a Obsidian
        sleep 5
    fi
}
```

### Pattern 2: Restart App

```bash
restart_obsidian() {
    echo "Restarting Obsidian..."

    # Quit if running
    if osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; then
        osascript -e 'tell application "Obsidian" to quit'
        sleep 2
    fi

    # Start
    open -a Obsidian
    sleep 5
}
```

### Pattern 3: Wait for Ready State

```bash
wait_for_obsidian_ready() {
    local timeout=30
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        # Check if running
        if ! osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; then
            sleep 1
            elapsed=$((elapsed + 1))
            continue
        fi

        # Check if API is responding
        if curl -k -s -o /dev/null -w '%{http_code}' \
            -H "Authorization: Bearer $API_KEY" \
            "https://127.0.0.1:27124/" | grep -q 200; then
            echo "Obsidian is ready!"
            return 0
        fi

        sleep 1
        elapsed=$((elapsed + 1))
    done

    echo "Timeout waiting for Obsidian"
    return 1
}
```

---

## Debugging osascript

### Verbose Output

```bash
# See what AppleScript is doing
osascript -s so <<EOF
tell application "System Events"
    log "Getting process list..."
    get name of every process
end tell
EOF
```

### Check Syntax

```bash
# Validate script without running
osascript -c 'tell application "System Events" to get name of processes' > /dev/null && echo "Valid" || echo "Invalid"
```

### Error Messages

```bash
# Capture stderr
result=$(osascript -e 'invalid script' 2>&1)
echo "Error: $result"
```

---

## Security Considerations

### Privacy Permissions

osascript may require permissions:

1. **System Events** - Always needed for process checks
2. **Accessibility** - Needed for UI interaction
3. **Automation** - Needed for app control

Grant in: System Settings → Privacy & Security → Automation

### Best Practices

✅ **DO:**
- Check if app is running before interacting
- Use timeout for long operations
- Handle errors gracefully
- Test on clean system

❌ **DON'T:**
- Run untrusted osascript code
- Hardcode sensitive data
- Assume permissions are granted
- Interact with UI without checking window exists

---

## Summary

### Key osascript Commands for Obsidian Testing

```bash
# 1. Check if running (fastest, most reliable)
osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"'

# 2. Launch Obsidian
open -a Obsidian

# 3. Quit Obsidian
osascript -e 'tell application "Obsidian" to quit'

# 4. Get PID
osascript -e 'tell application "System Events" to get unix id of process "Obsidian"'

# 5. Check window count
osascript -e 'tell application "System Events" to count of windows of process "Obsidian"'
```

### When to Use osascript

✅ **Use osascript when:**
- Checking if macOS app is running
- Getting app-specific information
- Controlling app behavior
- Interacting with UI elements
- Need macOS-specific features

❌ **Don't use osascript when:**
- Simple process check (use `pgrep` instead)
- Cross-platform needed (use `ps` instead)
- Testing API functionality (use `curl` instead)

---

## Additional Resources

- **osascript Manual:** `man osascript`
- **AppleScript Language Guide:** https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/
- **System Events Reference:** `/System/Library/ScriptingDefinitions/SystemEvents.sdef`
- **JXA Guide:** https://developer.apple.com/library/archive/releasenotes/InterapplicationCommunication/RN-JavaScriptForAutomation/

---

**This document is part of the integration testing suite for Obsidian plugins. For complete testing workflows, see [INTEGRATION_TESTING_GUIDE.md](./INTEGRATION_TESTING_GUIDE.md)**
