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
  assert.match(hook, /npm test/);
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
});

test('agent instructions require maintaining the todo file', () => {
  const instructions = fs.readFileSync('AGENTS.md', 'utf8');

  assert.match(instructions, /Maintain `TODO\.md`/);
});

test('todo file tracks agreed future work', () => {
  const todo = fs.readFileSync('TODO.md', 'utf8');

  assert.match(todo, /Auto-fill transaction category/);
  assert.match(todo, /transaction edit\/delete/);
});
