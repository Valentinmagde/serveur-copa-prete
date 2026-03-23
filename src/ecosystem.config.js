module.exports = {
  apps: [{
    name: 'copa-backend',
    script: 'dist/src/main.js',
    
    // Mode cluster - utiliser tous les cœurs CPU
    instances: 'max',
    exec_mode: 'cluster',
    
    // Variables d'environnement
    env: {
      NODE_ENV: 'production',
    },
    
    // Options avancées
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    
    // Mémoire
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
    
    // Logging
    error_file: '/opt/copa/logs/backend/error.log',
    out_file: '/opt/copa/logs/backend/out.log',
    log_file: '/opt/copa/logs/backend/combined.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Temps d'attente
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true,
    
    // Restart strategy
    autorestart: true,
    restart_delay: 4000,
    
    // Instance ID
    instance_var: 'INSTANCE_ID',
    
    // Source map support
    source_map_support: true,
    
    // Graceful shutdown
    kill_retry_time: 1000,
    wait_ready: true
  }],