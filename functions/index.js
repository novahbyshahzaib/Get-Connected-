const { onRequest } = require('firebase-functions/v2/https');
const path = require('path');
const fs = require('fs');

const funcDir = __dirname;

let nextDir;
if (fs.existsSync(path.join(funcDir, '.next'))) {
  nextDir = funcDir;
} else {
  nextDir = path.resolve(funcDir, '..');
}

const next = require('next');

const app = next({
  dev: false,
  dir: nextDir,
  conf: {
    distDir: path.join(nextDir, '.next'),
  },
});
const handle = app.getRequestHandler();

exports.nextApp = onRequest(
  { concurrency: 80, minInstances: 0 },
  async (req, res) => {
    await app.prepare();
    return handle(req, res);
  }
);
