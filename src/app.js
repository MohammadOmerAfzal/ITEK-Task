'use strict';

const express = require('express');
const { createTasksRouter } = require('./routes/tasks');

/** Builds the Express app without starting it, so tests can start it on any port. */
function createApp(store) {
  const app = express();
  app.use(express.json());

  app.use('/tasks', createTasksRouter(store));

  // Unknown route -> JSON 404 (instead of Express's default HTML page)
  app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

  // Central error handler (4 args). Mainly catches malformed JSON bodies thrown by express.json().
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON in request body' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
