import cron from 'node-cron';
import { loadAllSites, loadSiteConfig } from '../services/data-store';
import { generateBlogPostGraph } from '../engine/graph';
import { SiteConfig } from '../types';

function isSiteReady(site: SiteConfig): boolean {
  return !!(site.url || site.systemPrompt || (site.niche && site.niche !== 'general'));
}

interface ScheduledJob {
  siteId: string;
  task: cron.ScheduledTask;
  cronExpression: string;
  isRunning: boolean;
  lastRun?: string;
  nextRun?: string;
  lastError?: string;
}

const jobs: Map<string, ScheduledJob> = new Map();

export function startSchedule(site: SiteConfig): boolean {
  stopSchedule(site.id);

  if (!isSiteReady(site)) {
    console.warn(`Skipping schedule for "${site.name}" — site not configured`);
    return false;
  }

  const cronExpression = site.schedule || '0 9 * * *';

  if (!cron.validate(cronExpression)) {
    console.error(`Invalid cron expression for site ${site.name}: ${cronExpression}`);
    return false;
  }

  const task = cron.schedule(cronExpression, async () => {
    const job = jobs.get(site.id);
    if (!job || job.isRunning) {
      console.log(`Skipping scheduled run for "${site.name}" — already running`);
      return;
    }

    job.isRunning = true;
    job.lastRun = new Date().toISOString();
    console.log(`Scheduled blog generation triggered for "${site.name}"`);

    try {
      const currentSite = await loadSiteConfig(site.id);
      if (!currentSite || !isSiteReady(currentSite)) {
        console.warn(`Skipping scheduled run for "${site.name}" — site no longer configured`);
        return;
      }

      const post = await generateBlogPostGraph({ siteId: site.id });
      console.log(`Scheduled post generated: "${post.title}"`);
      job.lastError = undefined;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Scheduled generation failed for "${site.name}":`, errorMsg);
      job.lastError = errorMsg;
    } finally {
      job.isRunning = false;
    }
  }, {
    timezone: 'UTC',
  });

  task.start();

  jobs.set(site.id, {
    siteId: site.id,
    task,
    cronExpression,
    isRunning: false,
  });

  console.log(`Schedule started for "${site.name}" — ${cronExpression}`);
  return true;
}

export function stopSchedule(siteId: string): boolean {
  const job = jobs.get(siteId);
  if (!job) return false;

  job.task.stop();
  jobs.delete(siteId);
  return true;
}

export function getScheduleStatus(): {
  siteId: string;
  cronExpression: string;
  isRunning: boolean;
  lastRun?: string;
  lastError?: string;
}[] {
  return Array.from(jobs.values()).map(job => ({
    siteId: job.siteId,
    cronExpression: job.cronExpression,
    isRunning: job.isRunning,
    lastRun: job.lastRun,
    lastError: job.lastError,
  }));
}

export async function updateSchedule(siteId: string, cronExpression: string): Promise<boolean> {
  const site = await loadSiteConfig(siteId);
  if (!site) return false;

  site.schedule = cronExpression;
  return startSchedule(site);
}

export async function initializeAllSchedules(): Promise<number> {
  const sites = await loadAllSites();
  let started = 0;

  for (const site of sites) {
    if (site.schedule) {
      const success = startSchedule(site);
      if (success) started++;
    }
  }

  console.log(`Initialized ${started} scheduled jobs`);
  return started;
}

export function stopAllSchedules(): void {
  for (const [siteId] of jobs) {
    stopSchedule(siteId);
  }
}
