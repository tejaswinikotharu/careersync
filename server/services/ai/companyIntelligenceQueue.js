const queue = [];
let isProcessing = false;
let workerFn = null;

/**
 * Register the pipeline execution worker function.
 * @param {Function} fn - Async worker function taking (companyId, jobDetails)
 */
const registerWorker = (fn) => {
    workerFn = fn;
    console.log("[CompanyIntelligenceQueue] Worker registered successfully.");
};

/**
 * Enqueue a new intelligence task.
 * @param {Object} job - Job parameters
 * @param {string} job.companyId - Mongoose Company ID
 * @param {string} job.type - Job type ('enrich' | 'refresh')
 */
const addJob = (job) => {
    if (!job || !job.companyId) {
        console.warn("[CompanyIntelligenceQueue] Invalid job enqueued, ignoring:", job);
        return;
    }
    
    // De-duplicate active pending jobs for same company/type in queue
    const isDuplicate = queue.some(j => j.companyId.toString() === job.companyId.toString() && j.type === job.type);
    if (isDuplicate) {
        console.log(`[CompanyIntelligenceQueue] Duplicate job for company ${job.companyId} (${job.type}) already in queue. Skipping.`);
        return;
    }

    queue.push(job);
    console.log(`[CompanyIntelligenceQueue] Job enqueued. Queue length: ${queue.length}. Company: ${job.companyId}`);
    
    // Process next tick
    setTimeout(processNext, 0);
};

/**
 * Execute next queue item in serial worker thread.
 */
const processNext = async () => {
    if (isProcessing) return;
    if (queue.length === 0) return;

    isProcessing = true;
    const job = queue.shift();
    console.log(`[CompanyIntelligenceQueue] Starting execution of job: ${job.type} for Company: ${job.companyId}`);

    try {
        if (workerFn) {
            await workerFn(job.companyId, job);
            console.log(`[CompanyIntelligenceQueue] Job completed successfully: ${job.type} for Company: ${job.companyId}`);
        } else {
            console.warn("[CompanyIntelligenceQueue] No worker registered to handle job queue!");
        }
    } catch (err) {
        console.error(`[CompanyIntelligenceQueue] Job failed for Company: ${job.companyId}:`, err.message);
    } finally {
        isProcessing = false;
        // Schedule next execution
        setTimeout(processNext, 50);
    }
};

module.exports = {
    registerWorker,
    addJob
};
