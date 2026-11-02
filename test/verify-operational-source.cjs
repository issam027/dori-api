// Run in the API container with OPERATIONAL_RULES_FIXTURE pointing to the SQL fixture.
// All fixtures, calls and emitted outbox rows are rolled back, including on failure.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DataSource } = require('/app/node_modules/typeorm');
const {
  MonitoringRepository,
} = require('/app/dist/modules/monitoring/monitoring.repository');
const {
  QueueEngineRepository,
} = require('/app/dist/modules/queue-engine/queue-engine.repository');
const {
  QueuesRepository,
} = require('/app/dist/modules/queues/queues.repository');
const {
  QueueWaitEstimationRepository,
} = require('/app/dist/modules/queue-estimation/queue-wait-estimation.repository');
const {
  QueueWaitEstimationService,
} = require('/app/dist/modules/queue-estimation/queue-wait-estimation.service');

(async () => {
  const db = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [],
  });
  await db.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(
      fs.readFileSync(process.env.OPERATIONAL_RULES_FIXTURE, 'utf8'),
    );
    const [{ data: fixture }] = await runner.query(
      'SELECT data FROM operational_rules_fixture',
    );
    const { queueId, siteId, date, tickets, sessions, users } = fixture;
    const now = new Date(fixture.now);
    await runner.query(
      'UPDATE dorify.dori_operator_session SET disconnected_at=NULL WHERE session_id=ANY($1::uuid[])',
      [sessions],
    );
    let pendingRead = Promise.resolve();
    const connection = {
      query: (sql, params) => {
        // A fixture uses one transaction connection rather than the production pool.
        const work = pendingRead.then(() => runner.query(sql, params));
        pendingRead = work.then(
          () => undefined,
          () => undefined,
        );
        return work;
      },
      transaction: async (isolationOrWork, maybeWork) =>
        (maybeWork ?? isolationOrWork)(runner.manager),
    };
    const engine = new QueueEngineRepository(connection);
    const queues = new QueuesRepository(connection);
    const estimates = new QueueWaitEstimationService(
      new QueueWaitEstimationRepository(connection),
    );
    const estimate = await estimates.estimateQueue({
      queueId,
      activityDate: date,
      now,
    });
    const cockpit = await engine.getCockpitData({
      siteId,
      queueIds: [queueId],
      userId: users[0],
      now,
      previewLimit: 10,
      recentLimit: 0,
    });
    const display = await queues.getDisplaySnapshot(queueId, date, now);
    const supervision = await new MonitoringRepository(connection).liveSnapshot(
      siteId,
      now,
    );
    const supervisedQueue = supervision.queues.find(
      (row) => row.queue_id === queueId,
    );
    assert.equal(
      supervisedQueue.estimated_wait_minutes,
      estimate.estimatedWaitMinutes,
    );
    assert.equal(supervisedQueue.waiting, estimate.waitingCount);
    const preview = await engine.findPreviewCandidates([queueId], now, 10);
    assert.equal(estimate.estimatedWaitMinutes, 20);
    assert.equal(
      cockpit.queues[0].estimated_wait_minutes,
      estimate.estimatedWaitMinutes,
    );
    assert.equal(cockpit.queues[0].waiting_count, estimate.waitingCount);
    assert.deepEqual(display.nextTickets, ['TEST-3', 'TEST-5', 'TEST-4']);
    assert.deepEqual(
      preview.map((row) => row.registration_id),
      [tickets[2], tickets[4], tickets[3]],
    );
    assert.deepEqual(
      cockpit.candidates.map((row) => row.ticket_number),
      display.nextTickets,
    );
    const first = await engine.callNext({
      queueId,
      sessionId: sessions[0],
      userId: users[0],
      businessDate: date,
      now,
    });
    assert.equal(first.registration_id, tickets[2]);
    assert.equal(first.called_early, false);
    const calledEstimate = await estimates.estimate(
      { registration_id: tickets[2] },
      now,
    );
    assert.equal(calledEstimate.position, 0);
    assert.equal(calledEstimate.estimatedWaitMinutes, 0);
    const early = await engine.callNextForSite({
      siteId,
      userId: users[1],
      allowedQueueIds: [queueId],
      now,
    });
    assert.equal(early.outcome, 'called');
    assert.equal(early.candidate.registration_id, tickets[4]);
    assert.equal(early.candidate.called_early, true);
    console.log(
      JSON.stringify({
        canonicalSQL: 'passed',
        cockpitMatchesKiosk: true,
        supervisionMatchesKiosk: true,
        displayMatchesPreviewAndCallOrder: true,
        calledTicketPositionZero: true,
        earliestFutureAppointmentCalled: true,
        rolledBack: true,
      }),
    );
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
    await db.destroy();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
