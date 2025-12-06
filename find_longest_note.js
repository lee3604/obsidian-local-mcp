const http = require('http');

const PORT = 51234;
const HOST = '127.0.0.1';
const PATH = '/mcp';

function sendRequest(method, params) {
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
                    if (!body) return reject(new Error("Empty body"));
                    const json = JSON.parse(body);
                    if (json.error) return reject(new Error(json.error.message));
                    resolve(json.result);
                } catch (e) {
                    reject(new Error("Failed to parse: " + body));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

async function main() {
    try {
        console.log("1. Fetching list of all notes...");
        const listResult = await sendRequest("resources/list", {});
        const resources = listResult.resources || [];

        console.log(`✅ Found ${resources.length} notes.`);

        if (resources.length === 0) {
            console.log("No notes found. (Check 'Allowed Folders' setting?)");
            return;
        }

        console.log("2. Reading notes to find the longest one...");

        let maxLen = 0;
        let maxNote = null;
        let processed = 0;

        // Process sequentially to be safe
        for (let i = 0; i < resources.length; i++) {
            const res = resources[i];
            try {
                // Determine file size efficiently? 
                // Currently 'resources/read' is the only way to get size via content length.
                const readResult = await sendRequest("resources/read", { uri: res.uri });
                const content = readResult.contents[0].text;
                const len = content.length;

                if (len > maxLen) {
                    maxLen = len;
                    maxNote = { name: res.name, len: len, uri: res.uri };
                    process.stdout.write(`\nFound new max: ${res.name} (${len.toLocaleString()} chars)`);
                }

                if (i % 10 === 0) process.stdout.write('.');
            } catch (e) {
                // process.stdout.write('x');
            }
        }

        console.log("\n\n🎉 Analysis Complete!");
        if (maxNote) {
            console.log(`=========================`);
            console.log(`🏆 LONGEST NOTE: ${maxNote.name}`);
            console.log(`📏 Length: ${maxNote.len.toLocaleString()} characters`);
            console.log(`📍 URI: ${maxNote.uri}`);
            console.log(`=========================`);
        } else {
            console.log("Could not read any notes.");
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

main();
