# Background Task Scheduling System (Node.js + Express)

## Run
```bash
npm install
npm start        # http://localhost:3000
npm test         # 6 integration tests, ~2.5s
```

## API
| Method | Path | Success | Errors |
|---|---|---|---|
| POST | `/tasks` | 201 `{taskId, status, message}` | 400 validation |
| GET | `/tasks[?status=scheduled]` | 200 `{count, tasks}` | 400 bad filter |
| DELETE | `/tasks/:taskId` | 200 | 404 unknown id, 409 not cancellable |

```bash
curl -X POST localhost:3000/tasks -H 'Content-Type: application/json' \
  -d '{"taskName":"Generate Daily Report","executeAt":"2026-10-15T15:00:00Z","payload":{"reportType":"daily"}}'
curl localhost:3000/tasks
curl -X DELETE localhost:3000/tasks/task_101
```

## Lifecycle
`scheduled -> running -> completed | failed`, and `scheduled -> cancelled`.

## Known limitations
- In-memory: tasks are lost on restart (swap `TaskStore` for a DB + reload "scheduled" tasks on boot).
- Single process: running multiple instances would need a DB lock / queue (e.g. BullMQ) to avoid double execution.
- Polling precision is up to 1 second late.
- Tasks that were due while the server was down would run on the next tick after restart (once persistence exists).
