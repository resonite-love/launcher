/**
 * シンプルなWebSocketクライアント
 *
 * Usage: node ws-client.js <ws-url>
 * Example: node ws-client.js ws://localhost:33333
 */

const WebSocket = require('ws');
const readline = require('readline');

const url = process.argv[2];

if (!url) {
  console.log('Usage: node ws-client.js <ws-url>');
  console.log('Example: node ws-client.js ws://localhost:33333');
  process.exit(1);
}

console.log(`Connecting to ${url}...`);

const ws = new WebSocket(url);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

ws.on('open', () => {
  console.log('Connected!');
  console.log('Type a message and press Enter to send. Ctrl+C to exit.');
  console.log('');

  rl.on('line', (line) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(line);
      console.log(`> Sent: ${line}`);
    }
  });
});

ws.on('message', (data) => {
  console.log(`< Received: ${data.toString()}`);
});

ws.on('close', () => {
  console.log('Disconnected');
  rl.close();
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('Error:', err.message);
  rl.close();
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nClosing...');
  ws.close();
  rl.close();
});
