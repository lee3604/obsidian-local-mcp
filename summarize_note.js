const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 51234;
const HOST = '127.0.0.1';
const PATH = '/mcp';

// This is the file name we are looking for in Obsidian
const TARGET_NOTE_NAME = "데이터베이스 기본";
const OUTPUT_FILENAME = "summary.txt";

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
        console.log("1. Finding note...");
        // Search for the note first to get its full path
        const searchResult = await sendRequest("tools/call", {
            name: "search_notes",
            arguments: { query: TARGET_NOTE_NAME }
        });

        const files = JSON.parse(searchResult.content[0].text);

        // Find exact match or best match
        const matchedFile = files.find(f => f.includes(TARGET_NOTE_NAME));

        if (!matchedFile) {
            console.error(`❌ Note '${TARGET_NOTE_NAME}' not found.`);
            return;
        }

        console.log(`✅ Found note: ${matchedFile}`);

        console.log("2. Reading content...");
        const readResult = await sendRequest("resources/read", {
            uri: `obsidian://note/${matchedFile}`
        });

        const content = readResult.contents[0].text;
        console.log(`✅ Read ${content.length} characters.`);

        console.log("3. Summarizing...");
        // Simple summary: First 5 lines + stats
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        const summary = `
[Summary of ${matchedFile}]
Date: ${new Date().toLocaleString()}
Original Length: ${content.length} chars

[Key Content]
${lines.slice(0, 5).join('\n')}
...
(Total ${lines.length} lines)
        `.trim();

        console.log("4. Writing summary to local file...");
        fs.writeFileSync(OUTPUT_FILENAME, summary, 'utf8');
        console.log(`✅ Created '${OUTPUT_FILENAME}' in current directory.`);

        console.log("\n--- Content of summary.txt ---");
        console.log(summary);

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

main();
