'use strict';

const Fastify = require('fastify');
const multipart = require('@fastify/multipart');
const healthRoutes = require('./routes/health.js');
const cleanRoutes = require('./routes/clean.js');

// Builds the server without starting it, so tests can call it with app.inject().
// Request logs hold only method, URL and status: never file contents (customer data).
function buildApp({ maxFileMb = 20, maxFiles = 10, logLevel = 'info' } = {}) {
  const app = Fastify({ logger: { level: logLevel } });

  app.register(multipart, {
    limits: { fileSize: maxFileMb * 1024 * 1024, files: maxFiles, fields: 10 },
  });

  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500;
    if (status === 500) {
      request.log.error({ err: error }, 'Request failed');
      return reply.code(500).send({ error: 'Something went wrong on the server.' });
    }
    return reply.code(status).send({ error: error.message });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: 'Not found.' }));

  app.register(healthRoutes);
  app.register(cleanRoutes, { maxFileMb, maxFiles });
  return app;
}

module.exports = { buildApp };
