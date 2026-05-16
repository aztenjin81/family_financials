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
const children = new Map();

function spawnChild(processConfig) {
  const child = spawn(processConfig.command, processConfig.args, {
    stdio: 'inherit',
    windowsHide: true,
  });

  children.set(processConfig.name, child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.error(`${processConfig.name} exited unexpectedly, restarting...`);
    children.delete(processConfig.name);
    setTimeout(() => {
      if (!shuttingDown) {
        spawnChild(processConfig);
      }
    }, 1000);

    if (code || signal) {
      process.exitCode = 1;
    }
  });

  child.on('error', (error) => {
    if (shuttingDown) {
      return;
    }

    console.error(`Failed to start ${processConfig.name}: ${error.message}`);
    children.delete(processConfig.name);
    setTimeout(() => {
      if (!shuttingDown) {
        spawnChild(processConfig);
      }
    }, 1000);
    process.exitCode = 1;
  });

  return child;
}

processes.forEach(spawnChild);

function stopChildren(exceptChild) {
  for (const child of children.values()) {
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
