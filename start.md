# CodeSync Cloud IDE — Full Deployment Guide

Run all commands in **Windows CMD** from `c:\Users\Admin\Desktop\aws`

---

## Step 1: Provision EC2 Instances (Terraform)

```cmd
cd c:\Users\Admin\Desktop\aws\terraform
terraform init
terraform apply -auto-approve
```

> Note the output IPs — you'll need them for the next step:
> - `control_public_ip`
> - `frontend_public_ip`
> - `backend_public_ip`

---

## Step 2: Update Inventory with New IPs

Open `ansible/inventory.ini` and replace the IPs with the ones from Terraform output.

```ini
[control]
control-node ansible_host=<control_public_ip>

[frontend]
frontend-node ansible_host=<frontend_public_ip>

[backend]
backend-node ansible_host=<backend_public_ip>

[all:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=~/.ssh/codesync-key.pem
ansible_ssh_common_args='-o StrictHostKeyChecking=no'

[workers:children]
frontend
backend

control_private_ip=10.0.1.10
frontend_private_ip=10.0.1.11
backend_private_ip=10.0.1.12
```

---

## Step 3: Update ConfigMaps with Frontend IP

Open `k8s/backend/configmap.yaml` and update `FRONTEND_HOST` and `FRONTEND_PUBLIC_IP` with the **frontend public IP**.

Open `k8s/jenkins/configmap.yaml` and update `FRONTEND_IP` with the **frontend public IP**.

---

## Step 4: Wait for EC2 Instances to Boot

Wait ~60 seconds for instances to fully initialize, then verify SSH access:

```cmd
wsl ssh -o StrictHostKeyChecking=no -i ~/.ssh/codesync-key.pem ubuntu@<control_public_ip> "hostname"
```

---

## Step 5: Run Ansible Playbooks (Setup Kubernetes Cluster)

```cmd
wsl bash -c "cd /mnt/c/Users/Admin/Desktop/aws/ansible && ansible-playbook playbooks/01-common.yml -i inventory.ini"
```

```cmd
wsl bash -c "cd /mnt/c/Users/Admin/Desktop/aws/ansible && ansible-playbook playbooks/02-masters-setup.yml -i inventory.ini"
```

```cmd
wsl bash -c "cd /mnt/c/Users/Admin/Desktop/aws/ansible && ansible-playbook playbooks/03-master-init.yml -i inventory.ini"
```

```cmd
wsl bash -c "cd /mnt/c/Users/Admin/Desktop/aws/ansible && ansible-playbook playbooks/04-workers-join.yml -i inventory.ini"
```

```cmd
wsl bash -c "cd /mnt/c/Users/Admin/Desktop/aws/ansible && ansible-playbook playbooks/05-label-nodes.yml -i inventory.ini"
```

---

## Step 6: Deploy K8s Manifests (Postgres, Backend, Frontend, Jenkins)

```cmd
wsl bash -c "cd /mnt/c/Users/Admin/Desktop/aws/ansible && ansible-playbook playbooks/06-deploy-pods.yml -i inventory.ini"
```

---

## Step 7: Build Docker Images & Deploy to Cluster

This builds all Docker images on the EC2 nodes, imports them into containerd, generates SSH keys, and restarts all pods:

```cmd
wsl bash -c "cd /mnt/c/Users/Admin/Desktop/aws/ansible && ansible-playbook playbooks/08-build-images.yml -i inventory.ini"
```

---

## Step 8: Setup Host-Based Jenkins (on Control Plane)

```cmd
wsl bash -c "cd /mnt/c/Users/Admin/Desktop/aws/ansible && ansible-playbook playbooks/11-jenkins-host.yml -i inventory.ini"
```

---

## Step 9: Remove Control Plane Taint (if needed)

```cmd
wsl ssh -o StrictHostKeyChecking=no -i ~/.ssh/codesync-key.pem ubuntu@<control_public_ip> "kubectl taint nodes ip-10-0-1-10 node-role.kubernetes.io/control-plane:NoSchedule-"
```

---

## Step 10: Push Database Schema

```cmd
wsl ssh -o StrictHostKeyChecking=no -i ~/.ssh/codesync-key.pem ubuntu@<control_public_ip> "kubectl exec -n codesync deploy/backend-deployment -- npx prisma db push --force-reset"
```

---

## Step 11: Verify All Pods Are Running

```cmd
wsl ssh -o StrictHostKeyChecking=no -i ~/.ssh/codesync-key.pem ubuntu@<control_public_ip> "kubectl get pods -n codesync"
```

Expected: All 4 pods should show `Running`:
- `backend-deployment`
- `landing-deployment`
- `ide-deployment`
- `postgres-deployment`

---

## Step 12: Get Jenkins Admin Password

```cmd
wsl ssh -o StrictHostKeyChecking=no -i ~/.ssh/codesync-key.pem ubuntu@<control_public_ip> "sudo cat /var/lib/jenkins/secrets/initialAdminPassword"
```

---

## Access URLs

| Service | URL |
|---|---|
| Landing Page | `http://<frontend_public_ip>:30001` |
| IDE | `http://<frontend_public_ip>:30002` |
| Backend API | `http://<backend_public_ip>:30003` |
| Jenkins UI | `http://<control_public_ip>:8080` |
| App hosted by Jenkins | `http://<control_public_ip>:4567` |

---

## Teardown

```cmd
cd c:\Users\Admin\Desktop\aws\terraform
terraform destroy -auto-approve
```
```
# 1. Download and run the NodeSource setup script for Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 2. Install the updated Node.js
sudo apt-get install -y nodejs

# 3. Verify the version (it should now say v20.x.x)
node -v

```