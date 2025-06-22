#!/usr/bin/env node

// Simple test script to verify XSS protection logic

// HTML escape function implementation
function escapeHtml(input) {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;");
}

// URL safety validation
function isSafeUrl(url) {
    const urlLower = url.trim().toLowerCase();
    
    // Block dangerous schemes
    if (urlLower.startsWith("javascript:") 
        || urlLower.startsWith("data:") 
        || urlLower.startsWith("vbscript:")
        || urlLower.startsWith("file:")
        || urlLower.startsWith("about:")) {
        return false;
    }
    
    // Allow safe schemes and relative URLs
    return urlLower.startsWith("http://") 
        || urlLower.startsWith("https://") 
        || urlLower.startsWith("//")
        || urlLower.startsWith("/")
        || urlLower.startsWith("./")
        || urlLower.startsWith("../")
        || urlLower.startsWith("#")
        || urlLower.startsWith("?")
        || (!urlLower.includes(':') && !urlLower.startsWith("//"));
}

// Test cases
function runTests() {
    console.log("🧪 Testing XSS Protection Implementation");
    console.log("=".repeat(50));
    
    // Test HTML escaping
    console.log("\n📝 Testing HTML Escaping:");
    
    const testCases = [
        { input: "Hello World", expected: "Hello World" },
        { input: "<script>alert('xss')</script>", expected: "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;" },
        { input: "\"quoted\" & 'single'", expected: "&quot;quoted&quot; &amp; &#x27;single&#x27;" },
        { input: "<img src=x onerror=alert('XSS')>", expected: "&lt;img src=x onerror=alert(&#x27;XSS&#x27;)&gt;" },
    ];
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach((test, i) => {
        const result = escapeHtml(test.input);
        if (result === test.expected) {
            console.log(`✅ Test ${i+1}: PASS`);
            passed++;
        } else {
            console.log(`❌ Test ${i+1}: FAIL`);
            console.log(`   Input:    "${test.input}"`);
            console.log(`   Expected: "${test.expected}"`);
            console.log(`   Got:      "${result}"`);
            failed++;
        }
    });
    
    // Test URL validation
    console.log("\n🔗 Testing URL Validation:");
    
    const urlTests = [
        { url: "https://example.com", safe: true },
        { url: "http://example.com", safe: true },
        { url: "/relative/path", safe: true },
        { url: "./relative/path", safe: true },
        { url: "../relative/path", safe: true },
        { url: "#anchor", safe: true },
        { url: "?query=param", safe: true },
        { url: "javascript:alert('XSS')", safe: false },
        { url: "data:text/html,<script>alert('XSS')</script>", safe: false },
        { url: "vbscript:alert('XSS')", safe: false },
        { url: "file:///etc/passwd", safe: false },
        { url: "about:blank", safe: false },
    ];
    
    urlTests.forEach((test, i) => {
        const result = isSafeUrl(test.url);
        if (result === test.safe) {
            console.log(`✅ URL Test ${i+1}: PASS - "${test.url}" -> ${result}`);
            passed++;
        } else {
            console.log(`❌ URL Test ${i+1}: FAIL - "${test.url}" -> ${result} (expected ${test.safe})`);
            failed++;
        }
    });
    
    // Test XSS attack vectors
    console.log("\n🚨 Testing XSS Attack Vector Protection:");
    
    const attacks = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "javascript:alert('XSS')",
        "';alert('XSS');//",
        "<iframe src='javascript:alert(\"XSS\")'></iframe>",
        "<body onload=alert('XSS')>",
        "<input onfocus=alert('XSS') autofocus>",
    ];
    
    attacks.forEach((attack, i) => {
        const escaped = escapeHtml(attack);
        
        // Verify dangerous elements are properly escaped (should NOT contain literal HTML tags or executable code)
        const dangerousUnescaped = ["<script>", "<img ", "<svg ", "<iframe ", "<body ", "<input "];
        const hasUnescapedDangerous = dangerousUnescaped.some(part => escaped.includes(part));
        
        // Also check that < and > are properly escaped (no executable HTML)
        const hasRawAngles = escaped.includes('<') || escaped.includes('>');
        const isProperlyEscaped = !hasUnescapedDangerous && !hasRawAngles;
        
        if (isProperlyEscaped) {
            console.log(`✅ Attack Test ${i+1}: PASS - Attack vector neutralized`);
            passed++;
        } else {
            console.log(`❌ Attack Test ${i+1}: FAIL - Attack vector not fully neutralized: ${escaped}`);
            failed++;
        }
    });
    
    // Summary
    console.log("\n" + "=".repeat(50));
    console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log("🎉 All XSS protection tests passed!");
        return true;
    } else {
        console.log("⚠️  Some XSS protection tests failed!");
        return false;
    }
}

// Run the tests
const success = runTests();
process.exit(success ? 0 : 1);