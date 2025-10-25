module.exports = {
  apps: [
    {
      name: 'form4-frontend',
      script: 'npm',
      args: 'start',
      cwd: 'frontend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
      env_development: {
        PORT: 3000,
      }
    }
  ]
};
