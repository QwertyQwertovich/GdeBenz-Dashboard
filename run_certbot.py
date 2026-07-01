import paramiko

host = "138.16.162.142"
user = "root"
password = "n831eZWeUN2122Ce#873"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=user, password=password, timeout=10)

cmd = "certbot --nginx -d fuel.alexkharitonov.dev --non-interactive --agree-tos -m admin@alexkharitonov.dev --redirect"
print("Running certbot...")
stdin, stdout, stderr = ssh.exec_command(cmd)
exit_status = stdout.channel.recv_exit_status()

print("STDOUT:", stdout.read().decode('utf-8'))
print("STDERR:", stderr.read().decode('utf-8'))
print("Exit code:", exit_status)

ssh.close()
