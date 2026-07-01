import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

host = "138.16.162.142"
user = "root"
password = "n831eZWeUN2122Ce#873"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=user, password=password, timeout=10)

commands = [
    "cd /var/www/gdebenz && git pull",
    "cd /var/www/gdebenz/dashboard && npm run build",
    "systemctl restart gdebenz-api gdebenz-scraper",
]

for cmd in commands:
    print(f"--- {cmd} ---")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read()
    err = stderr.read()
    if b'ERR' in err or b'Error' in err:
        sys.stdout.buffer.write(err + b"\n")
    else:
        print("Success")

ssh.close()
