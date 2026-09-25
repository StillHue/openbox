import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

let queue: Queue | null = null;
let queueEvents: QueueEvents | null = null;

export function createQueue(): Queue {
  if (queue) return queue;

  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
  });

  connection.on('error', (err: Error) => {
    console.error('Redis connection error:', err);
  });

  queue = new Queue('ingest', {
    connection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  queueEvents = new QueueEvents('ingest', { connection });

  queueEvents.on('completed', ({ jobId }: { jobId: string }) => {
    console.log(`Job ${jobId} completed`);
  });

  queueEvents.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    console.error(`Job ${jobId} failed:`, failedReason);
  });

  return queue;
}

export async function closeQueue(): Promise<void> {
  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}

export function getQueue(): Queue | null {
  return queue;
}