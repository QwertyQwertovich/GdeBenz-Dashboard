import paramiko
import sys
import time
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def deploy():
    host = "138.16.162.142"
    user = "root"
    password = "n831eZWeUN2122Ce#873"

    print(f"Connecting to {host}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(host, username=user, password=password, timeout=10)
    except Exception as e:
        print("Failed to connect:", e)
        sys.exit(1)
        
    print("Connected successfully.")

    commands = [
        "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get --fix-broken install -y",
        "curl -fsSL https://deb.nodesource.com/setup_18.x | bash -",
        "DEBIAN_FRONTEND=noninteractive apt-get install -y git python3-pip python3-venv nginx nodejs certbot python3-certbot-nginx",
        "rm -rf /var/www/gdebenz",
        "git clone https://github.com/QwertyQwertovich/GdeBenz-Dashboard.git /var/www/gdebenz",
        "cd /var/www/gdebenz/dashboard && npm install && npm run build",
        "cd /var/www/gdebenz && python3 -m venv venv && ./venv/bin/pip install flask shapely gunicorn",
        
        # Systemd API
        """cat << 'EOF' > /etc/systemd/system/gdebenz-api.service
[Unit]
Description=Gunicorn instance to serve GdeBenz API
After=network.target

[Service]
User=root
Group=www-data
WorkingDirectory=/var/www/gdebenz
Environment="PATH=/var/www/gdebenz/venv/bin"
Environment="PYTHONPATH=/var/www/gdebenz"
ExecStart=/var/www/gdebenz/venv/bin/gunicorn --workers 3 --timeout 120 --bind 127.0.0.1:5000 api.server:app

[Install]
WantedBy=multi-user.target
EOF""",
        
        # Systemd Scraper
        """cat << 'EOF' > /etc/systemd/system/gdebenz-scraper.service
[Unit]
Description=GdeBenz Scraper Service
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/gdebenz
Environment="PATH=/var/www/gdebenz/venv/bin"
Environment="PYTHONPATH=/var/www/gdebenz"
ExecStart=/var/www/gdebenz/venv/bin/python scraper/collect.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF""",
        
        "systemctl daemon-reload",
        "systemctl enable gdebenz-api gdebenz-scraper",
        "systemctl restart gdebenz-api gdebenz-scraper",
        
        # Nginx Setup
        """cat << 'EOF' > /etc/nginx/sites-available/fuel
server {
    listen 80;
    server_name fuel.alexkharitonov.dev;

    root /var/www/gdebenz/dashboard/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_addrs;
    }
}
EOF""",
        "ln -sf /etc/nginx/sites-available/fuel /etc/nginx/sites-enabled/",
        "systemctl reload nginx",
        "certbot --nginx -d fuel.alexkharitonov.dev --non-interactive --agree-tos -m admin@alexkharitonov.dev --redirect || echo 'Certbot failed, possibly DNS not propagated'"
    ]

    for cmd in commands:
        print(f"\nRunning: {cmd[:50]}...")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        # Wait for command to finish and print output dynamically if needed, 
        # or just print at the end. Some commands like npm install take time.
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        
        if out: 
            print("STDOUT:")
            sys.stdout.buffer.write(out.strip()[-500:].encode('utf-8', errors='replace') + b'\n')
            sys.stdout.flush()
        if err: 
            print("STDERR:")
            sys.stdout.buffer.write(err.strip()[-500:].encode('utf-8', errors='replace') + b'\n')
            sys.stdout.flush()
        
        if exit_status != 0:
            print(f"Command failed with status {exit_status}")
            if 'certbot' not in cmd:
                ssh.close()
                sys.exit(1)

    print("\nDeployment completed successfully!")
    ssh.close()

if __name__ == "__main__":
    deploy()
