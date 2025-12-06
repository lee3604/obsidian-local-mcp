const http = require('http');

const PORT = 51234;
const HOST = '127.0.0.1';
const PATH = '/mcp';

console.log(`Pid: ${process.pid}`);

const options = {
    hostname: HOST,
    port: PORT,
    path: PATH,
    method: 'GET',
    headers: {
        'Accept': 'text/event-stream',
    }
};

console.log(`Connecting to http://${HOST}:${PORT}${PATH}...`);

const req = http.request(options, (res) => {
    console.log(`Connected with status: ${res.statusCode}`);

    let buffer = '';

    res.on('data', (chunk) => {
        buffer += chunk.toString();

        // Process visible lines
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);

            if (line.length === 0) continue; // Empty line (heartbeat or separator)

            // console.log(`LINE: ${line}`);

            if (line.startsWith('event: endpoint')) {
                // The NEXT line(s) should be data
                // Simple state machine: if we see event: endpoint, we look for data:
                // But simplified: usually they come together in a packet.
            } else if (line.startsWith('data: ')) {
                const data = line.substring(6).trim();
                // Check if this data looks like an endpoint path
                // It usually contains sessionId
                if (data.includes('sessionId=')) {
                    console.log(`\nEndpoint detected: ${data}`);
                    sendListResources(data);
                }
            }
        }
    });

    res.on('end', () => {
        console.log('Server closed connection.');
    });
});

req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
});

req.end();

let postSent = false;
function sendListResources(postPath) {
    if (postSent) return;
    postSent = true;

    console.log(`Sending resources/list to ${postPath}...`);

    const postData = JSON.stringify({
        jsonrpc: "2.0",
        method: "resources/list",
        id: 1,
        params: {}
    });

    const postOptions = {
        hostname: HOST,
        port: PORT,
        path: postPath,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const postReq = http.request(postOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            console.log('\n--- Response ---');
            try {
                // If the response is empty or not json
                if (!body) {
                    console.log("Empty body received");
                    return;
                }
                const json = JSON.parse(body);
                if (json.result && json.result.resources) {
                    const resources = json.result.resources;
                    console.log(`Total Resources: ${resources.length}`);
                    console.log('Top 3 Resources:');
                    resources.slice(0, 3).forEach((r, i) => {
                        console.log(`${i + 1}. [${r.name}] (${r.uri})`);
                    });
                } else {
                    console.log('Full response:', body);
                }
            } catch (e) {
                console.log('Failed to parse response:', body);
            }
            process.exit(0);
        });
    });

    postReq.on('error', (e) => {
        console.error(`POST error: ${e.message}`);
    });

    postReq.write(postData);
    postReq.end();
}
