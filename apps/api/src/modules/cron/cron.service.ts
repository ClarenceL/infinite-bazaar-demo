import { Agenda } from "agenda";
import { logger } from "@infinite-bazaar-demo/logs";

interface CronJobStatus {
  instanceId: string;
  isRunning: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  cycleInterval: string;
  jobId?: string;
}

export class CronService {
  private agenda: Agenda;

  constructor() {
    const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017/infinite-bazaar-agenda";
    
    this.agenda = new Agenda({
      db: { address: mongoUrl, collection: "agendaJobs" },
      processEvery: "5 second",
      maxConcurrency: 1,
    });

    // Initialize agenda connection
    this.initializeAgenda();
  }

  private async initializeAgenda() {
    try {
      logger.info("Initializing agenda for cron control");
      
      // Don't start the agenda processor here - we only want to manage jobs
      // The actual processing is done by the separate cron service
      
      logger.info("Agenda initialized for cron control");
    } catch (error) {
      logger.error({ error }, "Failed to initialize agenda for cron control");
      throw error;
    }
  }

  /**
   * Start cron job for a specific instance
   */
  async startCronJob(instanceId: string, cycleInterval: string = "1 minute"): Promise<CronJobStatus> {
    try {
      logger.info({ instanceId, cycleInterval }, "Starting cron job for instance");

      // Cancel any existing jobs for this instance
      await this.stopCronJob(instanceId);

      // Create new job
      const job = await this.agenda.every(cycleInterval, "opus-agent", {
        cycle_interval: cycleInterval,
        instance_id: instanceId,
      });

      const status: CronJobStatus = {
        instanceId,
        isRunning: true,
        nextRunAt: job.attrs.nextRunAt,
        lastRunAt: job.attrs.lastRunAt,
        cycleInterval,
        jobId: job.attrs._id?.toString(),
      };

      logger.info({ instanceId, jobId: status.jobId }, "Cron job started successfully");
      return status;
    } catch (error) {
      logger.error({ error, instanceId }, "Failed to start cron job");
      throw error;
    }
  }

  /**
   * Stop cron job for a specific instance
   */
  async stopCronJob(instanceId: string): Promise<boolean> {
    try {
      logger.info({ instanceId }, "Stopping cron job for instance");

      // Cancel jobs with matching instance_id
      const cancelCount = await this.agenda.cancel({
        name: "opus-agent",
        "data.instance_id": instanceId,
      });

      logger.info({ instanceId, cancelCount: cancelCount || 0 }, "Cron job stopped");
      return (cancelCount || 0) > 0;
    } catch (error) {
      logger.error({ error, instanceId }, "Failed to stop cron job");
      throw error;
    }
  }

  /**
   * Get status of cron job for a specific instance
   */
  async getCronJobStatus(instanceId: string): Promise<CronJobStatus> {
    try {
      logger.info({ instanceId }, "Getting cron job status");

      // Find active jobs for this instance
      const jobs = await this.agenda.jobs({
        name: "opus-agent",
        "data.instance_id": instanceId,
      });

      if (jobs.length === 0) {
        return {
          instanceId,
          isRunning: false,
          nextRunAt: null,
          lastRunAt: null,
          cycleInterval: "1 minute",
        };
      }

      const job = jobs[0];
      if (!job) {
        return {
          instanceId,
          isRunning: false,
          nextRunAt: null,
          lastRunAt: null,
          cycleInterval: "1 minute",
        };
      }

      const status: CronJobStatus = {
        instanceId,
        isRunning: true,
        nextRunAt: job.attrs.nextRunAt || null,
        lastRunAt: job.attrs.lastRunAt || null,
        cycleInterval: job.attrs.data?.cycle_interval || "1 minute",
        jobId: job.attrs._id?.toString(),
      };

      logger.info({ instanceId, status }, "Cron job status retrieved");
      return status;
    } catch (error) {
      logger.error({ error, instanceId }, "Failed to get cron job status");
      throw error;
    }
  }

  /**
   * Get status of all cron jobs
   */
  async getAllCronJobStatuses(): Promise<CronJobStatus[]> {
    try {
      logger.info("Getting all cron job statuses");

      const jobs = await this.agenda.jobs({ name: "opus-agent" });
      
      const statuses: CronJobStatus[] = jobs.map(job => ({
        instanceId: job.attrs.data?.instance_id || "unknown",
        isRunning: true,
        nextRunAt: job.attrs.nextRunAt || null,
        lastRunAt: job.attrs.lastRunAt || null,
        cycleInterval: job.attrs.data?.cycle_interval || "1 minute",
        jobId: job.attrs._id?.toString() || "",
      }));

      logger.info({ jobCount: statuses.length }, "All cron job statuses retrieved");
      return statuses;
    } catch (error) {
      logger.error({ error }, "Failed to get all cron job statuses");
      throw error;
    }
  }

  /**
   * Update cron job interval for a specific instance
   */
  async updateCronJobInterval(instanceId: string, newInterval: string): Promise<CronJobStatus> {
    try {
      logger.info({ instanceId, newInterval }, "Updating cron job interval");

      // Stop existing job
      await this.stopCronJob(instanceId);

      // Start new job with updated interval
      const status = await this.startCronJob(instanceId, newInterval);

      logger.info({ instanceId, newInterval }, "Cron job interval updated successfully");
      return status;
    } catch (error) {
      logger.error({ error, instanceId, newInterval }, "Failed to update cron job interval");
      throw error;
    }
  }
}

export const cronService = new CronService(); 