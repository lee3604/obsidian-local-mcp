const http = require('http');

const PORT = 51234;
const HOST = '127.0.0.1';
const PATH = '/mcp';
const TARGET_FILE = 'mcp_hello.md';
const CONTENT = '# 안녕하세요 MCP!\n\n이 파일은 로컬 MCP 클라이언트 스크립트가 생성했습니다.\n시간: ' + new Date().toLocaleString();

function sendRequest(method, params, callback) {
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
                if (!body) return callback(new Error("Empty body"));
                const json = JSON.parse(body);
                callback(null, json);
            } catch (e) {
                callback(new Error("Failed to parse: " + body));
            }
        });
    });

    req.on('error', (e) => callback(e));
    req.write(postData);
    req.end();
}

console.log(`Payload: Writing to '${TARGET_FILE}'...`);

// 1. Try to WRITE the file
sendRequest("tools/call", {
    name: "write_note",
    arguments: {
        path: TARGET_FILE,
        content: CONTENT
    }
}, (err, json) => {
    if (err) {
        console.error("Connection Error:", err.message);
        return;
    }

    if (json.error) {
        console.error("\n❌ Write Failed!");
        console.error("Error Code:", json.error.code);
        console.error("Message:", json.error.message);

        if (json.error.message.includes("Read-only")) {
            console.log("\n💡 TIP: Please change 'Write Mode' in Obsidian Settings -> MCP Server to 'Confirm each write' or 'Allow-list'.");
        }
        return;
    }

    console.log("✅ Write Success:", json.result.content[0].text);

    // 2. Try to READ the file back
    console.log(`\nPayload: Reading '${TARGET_FILE}'...`);

    sendRequest("resources/read", {
        uri: `obsidian://note/${TARGET_FILE}`
    }, (err, json) => {
        if (err) {
            console.error("Read Error:", err.message);
            return;
        }

        if (json.error) {
            console.error("❌ Read Failed:", json.error.message);
            return;
        }

        const resource = json.result.contents[0];
        console.log("✅ Read Success!");
        console.log("--- File Content Start ---");
        console.log(resource.text);
        console.log("--- File Content End ---");
    });
});
