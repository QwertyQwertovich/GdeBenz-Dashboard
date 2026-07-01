import paramiko
import sys

host = "138.16.162.142"
user = "root"
password = "n831eZWeUN2122Ce#873"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=user, password=password, timeout=10)

commands = [
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
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF""",
    "nginx -t",
    "systemctl reload nginx",
    "certbot --nginx -d fuel.alexkharitonov.dev --non-interactive --agree-tos -m admin@alexkharitonov.dev --redirect || echo 'Certbot skipped'"
]

for cmd in commands:
    print("Running:", cmd[:40])
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    print("OUT:", stdout.read().decode('utf-8'))
    print("ERR:", stderr.read().decode('utf-8'))

ssh.close()
