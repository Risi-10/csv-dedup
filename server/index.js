'use strict';

const { readConfig } = require('./config.js');
const { buildApp } = require('./app.js');

async function main() {
  const config = readConfig();
  const app = buildApp(config);

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      app.log.info(`${signal} received, shutting down`);
      await app.close();
      process.exit(0);
    });
  }

  await app.listen({ port: config.port, host: config.host });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
