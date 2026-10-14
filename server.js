'use strict';

const { TaskStore } = require('./src/taskStore');
const { Scheduler } = require('./src/scheduler');
const { executeTask } = require('./src/executor');
const { createApp } = require('./src/app');

const PORT = process.env.PORT || 3000;

// Composition root: the only place where all the pieces are wired together.
const store = new TaskStore();
const scheduler = new Scheduler({ store, executor: executeTask, intervalMs: 1000 });
const app = createApp(store);

const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  scheduler.start();
});

// Graceful shutdown: stop the timer, then close the HTTP server.
function shutdown() {
  console.log('Shutting down...');
  scheduler.stop();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
