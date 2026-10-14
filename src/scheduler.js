'use strict';

/**
 * Polling scheduler: one setInterval "tick" checks which tasks are due and runs them.
 *
 * Why polling instead of one setTimeout per task?
 *  1. setTimeout delays above 2^31-1 ms (~24.8 days) overflow and fire IMMEDIATELY. Polling has
 *     no such limit.
 *  2. Cancelling is just a status change; there are no timer handles to track and clear.
 *  3. One timer in total, no matter how many tasks exist.
 *  Trade-off: execution can be late by up to one tick (default 1s). Fine for this use case.
 */
class Scheduler {
  constructor({ store, executor, intervalMs = 1000 }) {
    this.store = store;
    this.executor = executor;
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  start() {
    if (this.timer) return; // calling start() twice must not create two timers (double execution)
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    this.timer.unref(); // don't keep the process alive just for this timer (helps tests/shutdown)
    console.log(`Scheduler started (polling every ${this.intervalMs}ms)`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick() {
    const due = this.store.findDue(Date.now());
    for (const task of due) {
      // Flip to "running" SYNCHRONOUSLY, before any await. Node runs this loop on a single thread,
      // so the next tick (or a cancel request) can never see this task as "scheduled" again.
      // That is what guarantees "execute only once" and "cancelled tasks never run".
      this.store.markRunning(task);
      this.run(task); // intentionally not awaited: one slow task must not delay the others
    }
  }

  async run(task) {
    try {
      await this.executor(task);
      this.store.markCompleted(task);
    } catch (err) {
      // A crashing task must never crash the server or stay stuck in "running".
      console.error(`[${new Date().toISOString()}] FAILED ${task.taskId}: ${err.message}`);
      this.store.markFailed(task, err);
    }
  }
}

module.exports = { Scheduler };
