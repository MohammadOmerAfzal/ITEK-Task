'use strict';

/**
 * In-memory task storage + the ONLY place where task status changes.
 *
 * Why centralise state transitions here?
 *  - The lifecycle rules (scheduled -> running -> completed/failed, scheduled -> cancelled)
 *    live in one file, so they are easy to read, test and later swap for a DB.
 *  - Routes and the scheduler never mutate `task.status` directly.
 *
 * Statuses:
 *   scheduled  - waiting for its execution time
 *   running    - picked up by the scheduler, executing right now
 *   completed  - executed successfully
 *   failed     - executor threw an error
 *   cancelled  - cancelled by the user before it ran
 */
const STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

class TaskStore {
  constructor() {
    // Map keeps insertion order and gives O(1) lookup by id.
    this.tasks = new Map();
    // Counter starts at 100 so the first id is "task_101", matching the spec example.
    this.counter = 100;
  }

  create({ taskName, executeAt, payload }) {
    const taskId = `task_${++this.counter}`;
    const task = {
      taskId,
      taskName,
      executeAt, // stored as a Date; JSON.stringify turns it into an ISO string automatically
      payload: payload ?? null,
      status: STATUS.SCHEDULED,
      createdAt: new Date(),
      executedAt: null,
      cancelledAt: null,
      error: null,
    };
    this.tasks.set(taskId, task);
    return task;
  }

  get(taskId) {
    return this.tasks.get(taskId);
  }

  list(status) {
    const all = [...this.tasks.values()];
    return status ? all.filter((t) => t.status === status) : all;
  }

  /** Scheduled tasks whose time has arrived, oldest first so execution order is predictable. */
  findDue(nowMs) {
    return [...this.tasks.values()]
      .filter((t) => t.status === STATUS.SCHEDULED && t.executeAt.getTime() <= nowMs)
      .sort((a, b) => a.executeAt - b.executeAt);
  }

  markRunning(task) {
    task.status = STATUS.RUNNING;
  }

  markCompleted(task) {
    task.status = STATUS.COMPLETED;
    task.executedAt = new Date();
  }

  markFailed(task, err) {
    task.status = STATUS.FAILED;
    task.executedAt = new Date();
    task.error = err && err.message ? err.message : String(err);
  }

  markCancelled(task) {
    task.status = STATUS.CANCELLED;
    task.cancelledAt = new Date();
  }
}

module.exports = { TaskStore, STATUS };
