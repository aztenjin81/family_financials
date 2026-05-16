import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let shuttingDown = false;
let serveChild = null;

function runBuild() {
  return new Promise((resolve, reject) => {
    const buildChild = spawn(npmCommand, ['run', 'build'], {
      stdio: 'inherit',
      windowsHide: true,
    });

    buildChild.on('exit', (code, signal) => {
      if (code === 0 && !signal) {
        resolve();
        return;
      }

      reject(new Error(`Build failed with code ${code ?? 'null'}${signal ? ` and signal ${signal}` : ''}`));
    });

    buildChild.on('error', reject);
  });
}

function startServe() {
  serveChild = spawn(npmCommand, ['run', 'serve'], {
    stdio: 'inherit',
    windowsHide: true,
  });

  serveChild.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.error(`live server exited unexpectedly, restarting in 1s...`);
    setTimeout(() => {
      if (!shuttingDown) {
        startServe();
      }
    }, 1000);

    if (code || signal) {
      process.exitCode = 1;
    }
  });

  serveChild.on('error', (error) => {
    if (shuttingDown) {
      return;
    }

    console.error(`Failed to start live server: ${error.message}`);
    setTimeout(() => {
      if (!shuttingDown) {
        startServe();
      }
    }, 1000);
    process.exitCode = 1;
  });
}

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (serveChild && !serveChild.killed) {
    serveChild.kill();
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await runBuild();
  startServe();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
