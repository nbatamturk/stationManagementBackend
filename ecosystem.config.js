module.exports = {
  apps: [
    {
      name: 'station-backend',
      cwd: __dirname,
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '3000',
      },
    },
    {
      name: 'station-admin-web',
      cwd: __dirname,
      script: 'npm',
      args: 'run start:admin',
      env: {
        NODE_ENV: 'production',
        API_BASE_URL: 'http://127.0.0.1:3000',
        NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3000',
      },
    },
  ],
};
