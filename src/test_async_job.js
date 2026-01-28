// Native fetch is available in Node 18+

const BASE_URL = 'http://localhost:3000';

async function testAsyncWorkflow() {
    console.log('🚀 Testing Async Background Job Workflow...');

    try {
        // 1. Start Job
        console.log('1. Starting Job...');
        const startRes = await fetch(`${BASE_URL}/api/jobs/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!startRes.ok) throw new Error(`Start failed: ${startRes.status}`);
        const startData = await startRes.json();
        const jobId = startData.jobId;
        console.log(`✅ Job Started with ID: ${jobId}`);

        // 2. Poll
        console.log('2. Polling for completion...');

        let status = 'running';
        while (status === 'running') {
            const jobRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
            const jobData = await jobRes.json();

            if (!jobData.success) throw new Error('Failed to get job info');

            const job = jobData.job;
            status = job.status;

            console.log(`   Job Status: ${status} (Step: ${job.currentStep})`);

            if (job.logs && job.logs.length > 0) {
                console.log(`      Latest Log: ${job.logs[job.logs.length - 1].message}`);
            }

            if (status === 'running') {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        if (status === 'completed') {
            console.log('✅ Job Completed Successfully!');
        } else {
            console.error('❌ Job Failed:', status);
        }

    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

testAsyncWorkflow();
