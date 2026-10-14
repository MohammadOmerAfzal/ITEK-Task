'use strict';

const express = require('express');
const { validateCreateTask } = require('../validators');
const { STATUS } = require('../taskStore');

/** Factory: receives the store so the router has no hidden global state (easy to test). */
function createTasksRouter(store) {
  const router = express.Router();

  // POST /tasks - create a task
  router.post('/', (req, res) => {
    const { errors, value } = validateCreateTask(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const task = store.create(value);
    // 201 Created = a new resource now exists. Body matches the shape requested in the spec.
    return res.status(201).json({
      taskId: task.taskId,
      status: task.status,
      message: 'Task scheduled successfully',
    });
  });

  // GET /tasks - list all tasks (optional ?status=scheduled filter)
  router.get('/', (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !Object.values(STATUS).includes(status)) {
      return res.status(400).json({
        error: `Invalid status filter. Allowed: ${Object.values(STATUS).join(', ')}`,
      });
    }
    const tasks = store.list(status);
    return res.json({ count: tasks.length, tasks });
  });

  // DELETE /tasks/:taskId - cancel a task that has not executed yet
  router.delete('/:taskId', (req, res) => {
    const task = store.get(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: `Task ${req.params.taskId} not found` });
    }
    // Only "scheduled" tasks can be cancelled. 409 Conflict = request is valid, but the task's
    // current state doesn't allow it (already running/completed/failed/cancelled).
    if (task.status !== STATUS.SCHEDULED) {
      return res.status(409).json({
        error: `Task cannot be cancelled because its status is "${task.status}"`,
      });
    }
    store.markCancelled(task);
    return res.json({ taskId: task.taskId, status: task.status, message: 'Task cancelled successfully' });
  });

  return router;
}

module.exports = { createTasksRouter };
