#!/usr/bin/env node
// Commandes portables pour le travail local sur Splitly.
// Adaptation de scripts/course.py du dépôt de cours Rental : mêmes commandes, mêmes codes de sortie.
// Usage : node scripts/course.mjs <commande>
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GROUP_SERVICE = join(ROOT, 'backend', 'group-service');
const FRONTEND = join(ROOT, 'frontend');
const WORKFLOWS = join(ROOT, '.github', 'workflows');
const COMPOSE_FILE = join(ROOT, 'docker-compose.yml');
const GROUP_URL = process.env.GROUP_URL ?? 'http://localhost:8080';

const ACTION_SHA = /^[0-9a-f]{40}$/;
const IMAGE_DIGEST = /@sha256:[0-9a-f]{64}(?:\s|$)/;

/** Équivalent de RuntimeError / CalledProcessError : un contrôle a échoué, sortie en code 1. */
class CourseError extends Error {}

function run(command, { cwd = ROOT } = {}) {
  console.log(`+ ${command.join(' ')}`);
  const [file, ...args] = command;
  const result = spawnSync(file, args, { cwd, stdio: 'inherit' });
  if (result.error) throw new CourseError(`${file} : ${result.error.message}`);
  if (result.status !== 0) {
    throw new CourseError(`Command '${command.join(' ')}' returned non-zero exit status ${result.status}`);
  }
}

// Sous Windows, npm est un script npm.cmd : on passe par cmd /c, comme gradlew.bat dans course.py.
function npmCommand() {
  return process.platform === 'win32' ? ['cmd', '/c', 'npm'] : ['npm'];
}

function testGroup() {
  run([...npmCommand(), 'test'], { cwd: GROUP_SERVICE });
}

function testFront() {
  run([...npmCommand(), 'test'], { cwd: FRONTEND });
}

function test() {
  testGroup();
  testFront();
}

// Lint (oxlint), formatage (Prettier) et types (tsc) : les scripts npm de chaque application
// sont la source de vérité, la CI appellera les mêmes.
function lintApp(cwd) {
  for (const script of ['lint', 'format:check', 'typecheck']) {
    run([...npmCommand(), 'run', script], { cwd });
  }
}

function lintGroup() {
  lintApp(GROUP_SERVICE);
}

function lintFront() {
  lintApp(FRONTEND);
}

function lint() {
  lintGroup();
  lintFront();
}

function listFiles(dir, predicate) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(predicate)
    .sort()
    .map((name) => join(dir, name));
}

function supplyChainPolicy() {
  const errors = [];
  const workflows = listFiles(WORKFLOWS, (name) => name.endsWith('.yml') || name.endsWith('.yaml'));

  for (const workflow of workflows) {
    readFileSync(workflow, 'utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        const stripped = line.trim();
        if (!stripped.startsWith('uses:')) return;
        const reference = stripped.slice('uses:'.length).split('#')[0].trim();
        if (reference.startsWith('./')) return;
        const at = reference.lastIndexOf('@');
        if (at === -1 || !ACTION_SHA.test(reference.slice(at + 1))) {
          errors.push(`${relative(ROOT, workflow)}:${index + 1}: action not pinned to a SHA`);
        }
      });
  }

  const dockerfiles = [GROUP_SERVICE, FRONTEND].map((app) => join(app, 'Dockerfile')).filter(existsSync);
  for (const dockerfile of dockerfiles) {
    readFileSync(dockerfile, 'utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (line.trim().toUpperCase().startsWith('FROM ') && !IMAGE_DIGEST.test(line)) {
          errors.push(`${relative(ROOT, dockerfile)}:${index + 1}: base image not pinned to a digest`);
        }
      });
  }

  if (errors.length > 0) {
    throw new CourseError(`Supply-chain policy failed:\n${errors.join('\n')}`);
  }
  console.log('OK supply-chain policy');
}

function verify() {
  test();
  lint();
}

function composeUp() {
  requireCommand('docker');
  if (!existsSync(COMPOSE_FILE)) throw new CourseError(`Compose file not found: ${relative(ROOT, COMPOSE_FILE)}`);
  run(['docker', 'compose', 'up', '--build', '--detach']);
}

function composeDown() {
  requireCommand('docker');
  if (!existsSync(COMPOSE_FILE)) throw new CourseError(`Compose file not found: ${relative(ROOT, COMPOSE_FILE)}`);
  run(['docker', 'compose', 'down']);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(url, { timeoutSeconds = 45 } = {}) {
  const deadline = performance.now() + timeoutSeconds * 1000;
  let lastError = null;

  while (performance.now() < deadline) {
    try {
      // timeout par requête : un serveur qui accepte la connexion sans répondre ne bloque pas la boucle
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        console.log(`OK ${url}`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.cause?.code ?? error.message; // ECONNREFUSED tant que le service démarre
    }
    await sleep(1000);
  }

  throw new CourseError(`Service unavailable at ${url}: ${lastError}`);
}

async function smoke() {
  await waitFor(`${GROUP_URL}/health`);
  let group;
  let status;
  try {
    const response = await fetch(`${GROUP_URL}/api/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke', currency: 'EUR' }),
      signal: AbortSignal.timeout(3000),
    });
    status = response.status;
    group = await response.json();
  } catch (error) {
    throw new CourseError(`Group creation failed: ${error.cause?.code ?? error.message}`);
  }
  // Réponse métier attendue : 201, la devise demandée et un code d'invitation généré.
  if (status !== 201 || group.currency !== 'EUR' || typeof group.inviteCode !== 'string') {
    throw new CourseError(`Unexpected group response: HTTP ${status} ${JSON.stringify(group)}`);
  }
  console.log('OK group creation');
}

/** Équivalent de shutil.which : chemin de l'exécutable, ou null s'il est absent du PATH. */
function which(command) {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(finder, [command], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.split(/\r?\n/)[0].trim() : null;
}

function requireCommand(command) {
  if (which(command) === null) throw new CourseError(`Required command not found: ${command}`);
}

function prerequisites() {
  const checks = {
    Node: process.execPath,
    npm: which('npm'),
    Docker: which('docker'),
  };
  let missing = false;

  for (const [name, location] of Object.entries(checks)) {
    if (location) {
      console.log(`OK ${name}: ${location}`);
    } else {
      console.log(`MISSING ${name}`);
      missing = true;
    }
  }

  if (missing) throw new CourseError('One or more prerequisites are missing');
}

const COMMANDS = {
  prerequisites,
  test,
  'test-group': testGroup,
  'test-front': testFront,
  lint,
  'lint-group': lintGroup,
  'lint-front': lintFront,
  'supply-chain-policy': supplyChainPolicy,
  verify,
  'compose-up': composeUp,
  'compose-down': composeDown,
  smoke,
};

async function main() {
  const usage = `usage: node scripts/course.mjs {${Object.keys(COMMANDS).join(',')}}`;
  const args = process.argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    console.log(usage);
    return 0;
  }
  if (args.length !== 1 || !(args[0] in COMMANDS)) {
    // même convention qu'argparse : 2 = mauvaise utilisation, distincte d'un contrôle en échec
    console.error(`${usage}\ncourse.mjs: error: invalid command: ${args.join(' ') || '(none)'}`);
    return 2;
  }

  try {
    await COMMANDS[args[0]]();
  } catch (error) {
    if (!(error instanceof CourseError)) throw error;
    console.error(`ERROR: ${error.message}`);
    return 1;
  }
  return 0;
}

process.exitCode = await main();
