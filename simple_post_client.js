const http = require('http');

const PORT = 51234;
const HOST = '127.0.0.1';
const PATH = '/mcp';

async function listResources() {
    console.log(`Sending resources/list to http://${HOST}:${PORT}${PATH}...`);

    const postData = JSON.stringify({
        jsonrpc: "2.0",
        method: "resources/list",
        id: 1,
        params: {}
    });

    const postOptions = {
        hostname: HOST,
        port: PORT,
        path: PATH,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream', // Required by the SDK
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(postOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            console.log(`\nResponse Status: ${res.statusCode}`);
            // console.log('Response Body:', body);

            try {
                if (!body) {
                    console.log("Empty body received.");
                    return;
                }
                const json = JSON.parse(body);
                if (json.error) {
                    console.error('RPC Error:', json.error);
                } else if (json.result && json.result.resources) {
                    const resources = json.result.resources;
                    console.log(`Total Resources: ${resources.length}`);
                    console.log('--- Top 3 Resources ---');
                    resources.slice(0, 3).forEach((r, i) => {
                        console.log(`${i + 1}. [${r.name}] (${r.uri})`);
                        // console.log(`   ${r.description}`);
                    });
                    if (resources.length === 0) {
                        console.log("(No markdown notes found in the vault)");
                    }
                } else {
                    console.log('Unexpected response:', body);
                }
            } catch (e) {
                console.log('Failed to parse JSON:', e.message);
                console.log('Raw body:', body);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.write(postData);
    req.end();
}

listResources();
