import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const serviceName = 'family-financials-plaid-webhook.service';
const workdir = process.cwd();
const userSystemdDir = resolve(homedir(), '.config/systemd/user');
const targetService = resolve(userSystemdDir, serviceName);
const templatePath = resolve('deploy/plaid-webhook.service.template');

async function main() {
  const template = await readFile(templatePath, 'utf8');
  const service = template.replaceAll('__WORKDIR__', workdir);

  await mkdir(dirname(targetService), { recursive: true });
  await writeFile(targetService, service);

  await execFileAsync('systemctl', ['--user', 'daemon-reload']);
  await execFileAsync('systemctl', ['--user', 'enable', '--now', serviceName]);

  try {
    await execFileAsync('loginctl', ['enable-linger', process.env.USER || process.env.LOGNAME || 'root']);
  } catch {
    // Linger is helpful for always-on hosting, but not required for the unit itself.
  }

  console.log(`Installed and enabled ${serviceName} for ${workdir}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
