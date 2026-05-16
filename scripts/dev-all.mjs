import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const processes = [
  {
    name: 'api',
    command: npmCommand,
    args: ['run', 'api'],
  },
  {
    name: 'vite',
    command: npmCommand,
    args: ['run', 'dev'],
  },
];

let shuttingDown = false;
const children = processes.map(({ name, command, args }) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    windowsHide: true,
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    stopChildren(child);
    process.exitCode = code ?? (signal ? 1 : 0);
  });

  child.on('error', (error) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.error(`Failed to start ${name}: ${error.message}`);
    stopChildren(child);
    process.exitCode = 1;
  });

  return child;
});

function stopChildren(exceptChild) {
  for (const child of children) {
    if (child === exceptChild || child.killed) {
      continue;
    }

    child.kill();
  }
}

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  stopChildren();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
