'use strict';

/**
 * What "running a task" means. For this assessment it is just a console message.
 *
 * Kept in its own module (and injected into the scheduler) so that:
 *  - real work (send email, build report...) can replace this without touching scheduling code
 *  - tests can pass a fake executor and assert on it
 *  - it may be async; the scheduler awaits it
 */
async function executeTask(task) {
  console.log(
    `[${new Date().toISOString()}] EXECUTING ${task.taskId} "${task.taskName}" ` +
      `payload=${JSON.stringify(task.payload)}`
  );
}

module.exports = { executeTask };
