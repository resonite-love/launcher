import fs from 'fs';
import { spawn } from 'child_process';

// Read credentials from file
const credentials = fs.readFileSync('./credential', 'utf8').trim().split('\n');
const userId = credentials[0].split('=')[1];
const password = credentials[1].split('=')[1];

console.log(`Running Node.js version with user: ${userId}`);

// Create a child process to run the main script
const child = spawn('node', ['resonite-friends.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send credentials when prompted
let responseCount = 0;
child.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('OUTPUT:', output);
  
  if (output.includes('Enter your ID:')) {
    console.log('Sending user ID...');
    child.stdin.write(userId + '\n');
    responseCount++;
  } else if (output.includes('Enter your password:')) {
    console.log('Sending password...');
    child.stdin.write(password + '\n');
    responseCount++;
  } else if (output.includes('Enter to stop') || responseCount >= 2) {
    console.log('Both credentials sent, letting it run for 10 seconds...');
    setTimeout(() => {
      console.log('Stopping Node.js version...');
      child.stdin.write('\n');
      setTimeout(() => child.kill(), 1000);
    }, 10000);
  }
});

child.stderr.on('data', (data) => {
  console.log('ERROR:', data.toString());
});

child.on('close', (code) => {
  console.log(`Node.js version exited with code ${code}`);
});