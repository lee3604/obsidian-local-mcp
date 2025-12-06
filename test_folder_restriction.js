const http = require('http');

const PORT = 51234;
const HOST = '127.0.0.1';
const PATH = '/mcp';

// Mock test: Since we can't easily change settings programmatically without UI interaction in this integration test,
// we will assume the User has NOT set any restrictions first (default behavior),
// and then we will simulate a request. 
// Ideally, this test script requires manual setup validation or unit tests for the functions.
// However, since we are in the 'wild', we can try to access a known file.

async function sendRequest(method, params) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            jsonrpc: "2.0",
            method: method,
            id: Date.now(),
            params: params
        });

        const options = {
            hostname: HOST,
            port: PORT,
            path: PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body || "{}");
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

async function main() {
    console.log("--- Testing Folder Restriction Logic ---");
    console.log("NOTE: This test assumes you have configured 'Allowed Folders' in Settings.");
    console.log("If 'Allowed Folders' is EMPTY, all tests should PASS (access granted).");
    console.log("If 'Allowed Folders' is set to 'Projects', accessing root files should FAIL.\n");

    const targetFile = "mcp_hello.md"; // A file we created earlier at root

    try {
        console.log(`1. Attempting to READ '${targetFile}'...`);
        const res = await sendRequest("resources/read", {
            uri: `obsidian://note/${targetFile}`
        });

        if (res.error) {
            console.log(`❌ BLOCK: ${res.error.message}`);
        } else {
            console.log(`✅ ALLOW: Read successful.`);
        }

        console.log(`\n2. Attempting to WRITE to 'Secret/secret_note.md'...`);
        const writeRes = await sendRequest("tools/call", {
            name: "write_note",
            arguments: {
                path: "Secret/secret_note.md",
                content: "Top Secret"
            }
        });

        if (writeRes.error) {
            console.log(`❌ BLOCK: ${writeRes.error.message}`);
        } else {
            console.log(`✅ ALLOW: Write successful (or pending approval).`);
        }

    } catch (e) {
        console.error("Test failed:", e);
    }
}

main();
