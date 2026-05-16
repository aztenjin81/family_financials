import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('package exposes staged Gitleaks secret scan', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  assert.equal(pkg.scripts['security:secrets'], 'gitleaks protect --staged --redact --verbose');
});

test('pre-commit hook runs Gitleaks, tests, and build', () => {
  const hook = fs.readFileSync('.githooks/pre-commit', 'utf8');

  assert.match(hook, /npm run security:secrets/);
  assert.match(hook, /node --test --test-concurrency=1/);
  assert.match(hook, /npm run build/);
});

test('agent instructions preserve testing and secret-scan mandates', () => {
  const instructions = fs.readFileSync('AGENTS.md', 'utf8');

  assert.match(instructions, /Every behavior change must include automated tests/);
  assert.match(instructions, /Gitleaks staged secret scan/);
  assert.match(instructions, /halt commits on failure/);
});

test('README documents hook setup', () => {
  const readme = fs.readFileSync('README.md', 'utf8');

  assert.match(readme, /git config core\.hooksPath \.githooks/);
  assert.match(readme, /npm run security:secrets/);
  assert.match(readme, /npm run live/);
  assert.match(readme, /npm run e2e/);
});

test('package exposes an always-on live command', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const live = fs.readFileSync('scripts/live.mjs', 'utf8');
  const install = fs.readFileSync('scripts/install-live-service.mjs', 'utf8');

  assert.equal(pkg.scripts.live, 'node scripts/live.mjs');
  assert.equal(pkg.scripts['live:install'], 'node scripts/install-live-service.mjs');
  assert.equal(pkg.scripts.e2e, 'playwright test');
  assert.match(live, /function runBuild/);
  assert.match(live, /\['run', 'build'\]/);
  assert.match(live, /\['run', 'serve'\]/);
  assert.match(live, /live server exited unexpectedly, restarting in 1s/);
  assert.match(install, /systemctl/);
  assert.match(install, /loginctl/);
  assert.match(install, /enable', '--now'/);
});

test('playwright harness launches the app and browser tests', () => {
  const config = fs.readFileSync('playwright.config.js', 'utf8');
  const server = fs.readFileSync('scripts/playwright-server.mjs', 'utf8');

  assert.match(config, /testDir: '\.\/e2e'/);
  assert.match(config, /webServer/);
  assert.match(config, /node scripts\/playwright-server\.mjs/);
  assert.match(config, /channel|executablePath/);
  assert.match(server, /node_modules\/vite\/bin\/vite\.js/);
  assert.match(server, /--host', '127\.0\.0\.1'/);
});

test('dev and preview servers default to LAN-reachable hosts', () => {
  const apiServer = fs.readFileSync('scripts/api-server.mjs', 'utf8');
  const staticServer = fs.readFileSync('scripts/serve-dist.mjs', 'utf8');

  assert.match(apiServer, /API_HOST \|\| '0\.0\.0\.0'/);
  assert.match(staticServer, /HOST \|\| '0\.0\.0\.0'/);
});

test('agent instructions require maintaining the todo file', () => {
  const instructions = fs.readFileSync('AGENTS.md', 'utf8');

  assert.match(instructions, /Maintain `TODO\.md`/);
});

test('package test command runs the suite file by file', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  assert.equal(pkg.scripts.test, './scripts/run-tests.sh');
});

test('test runner script enables mock db mode and unsets npm vars before running node tests', () => {
  const runner = fs.readFileSync('scripts/run-tests.sh', 'utf8');

  assert.match(runner, /export USE_MOCK_DB=1/);
  assert.match(runner, /unset "\$var"/);
  assert.match(runner, /npm_/);
  assert.match(runner, /test\/api-handler\.test\.mjs/);
});

test('todo file tracks agreed future work', () => {
  const todo = fs.readFileSync('TODO.md', 'utf8');

  assert.match(todo, /Improve merchant suggestions/);
});
