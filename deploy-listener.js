const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');

const app = express();
const PORT = 3001;

app.use(bodyParser.json());

const REPO_PATH = '/Form4Tracker';
const DEPLOY_SCRIPT = './deploy.sh';

app.post('/webhook', (req, res) => {
    if (req.body.ref === 'refs/heads/main') {
        console.log('Received webhook for main branch. Starting deployment...');
        
        const deploy = spawn('sh', [DEPLOY_SCRIPT], { cwd: REPO_PATH });

        deploy.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        deploy.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        deploy.on('close', (code) => {
            console.log(`Deployment script finished with code ${code}`);
        });

        res.status(200).send('Deployment initiated.');
    } else {
        res.status(200).send('Webhook received, but not for the main branch.');
    }
});

app.listen(PORT, () => {
    console.log(`Webhook listener running on port ${PORT}`);
});
