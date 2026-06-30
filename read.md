# CodeSync — Complete Engineering & Architecture Plan

> Real-time collaborative cloud IDE with full DevOps pipeline on AWS (ap-south-1)

---

## Table of Contents

1. [What We Are Building](#1-what-we-are-building)
2. [High-Level Architecture](#2-high-level-architecture)
3. [EC2 Machine Responsibilities](#3-ec2-machine-responsibilities)
4. [User Journey — End to End](#4-user-journey--end-to-end)
5. [Infrastructure Provisioning — Terraform](#5-infrastructure-provisioning--terraform)
6. [Node Configuration — Ansible](#6-node-configuration--ansible)
7. [Kubernetes Cluster & Pod Layout](#7-kubernetes-cluster--pod-layout)
8. [Frontend — What It Serves & How](#8-frontend--what-it-serves--how)
9. [Backend — What It Does & How](#9-backend--what-it-does--how)
10. [Database Schema](#10-database-schema)
11. [Real-Time Collaboration Flow](#11-real-time-collaboration-flow)
12. [Git Repo Integration Flow](#12-git-repo-integration-flow)
13. [Jenkins CI/CD Pipeline](#13-jenkins-cicd-pipeline)
14. [Communication Map — Who Talks to Whom](#14-communication-map--who-talks-to-whom)
15. [Port Reference](#15-port-reference)
16. [Environment Variables](#16-environment-variables)
17. [File & Directory Structure](#17-file--directory-structure)
18. [Commands to Run — In Order](#18-commands-to-run--in-order)

---

## 1. What We Are Building

CodeSync is a browser-based collaborative code editor, hosted entirely on AWS, where:

- A user visits a landing page, enters their **public GitHub repo URL** and a **username**
- The backend clones that repo immediately onto the Frontend EC2 machine
- The user sees a **VS Code-like Monaco editor** with a full file tree on the left
- They get a **6-character room code** — any collaborator can join with this code
- Both users see each other's changes in **real time**; edits sync every 5 seconds to the database
- The user can click **"Start Server"** inside the IDE — this spins up their Next.js app on port 3000 on the Frontend EC2, accessible via `http://<frontend-ec2-ip>:3000`
- When the user **pushes to their GitHub repo**, Jenkins (running on the Control Plane EC2) picks it up via a webhook, pulls the code, runs `npm run build`, serves the static output on port **4567** on the Frontend EC2

There are **no Docker containers**. Everything runs directly on EC2 instances inside a **Kubernetes cluster** (kubeadm, not EKS).

---

## 2. High-Level Architecture

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  AWS VPC  —  10.0.0.0/16  —  ap-south-1            │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  EC2: codesync-control  (t2.medium)         │   │
│  │  Role: K8s Control Plane                    │   │
│  │                                             │   │
│  │  Pods running here:                         │   │
│  │   • Jenkins (NodePort 30080 → port 8080)    │   │
│  │   • PostgreSQL (ClusterIP, port 5432)       │   │
│  │   • kube-apiserver, etcd, scheduler,        │   │
│  │     controller-manager (K8s system pods)    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  EC2: codesync-frontend  (t2.medium)        │   │
│  │  Role: Everything the user sees + runs      │   │
│  │                                             │   │
│  │  Pods running here:                         │   │
│  │   • Landing Page (NodePort 30001 → port 80) │   │
│  │   • Monaco IDE   (NodePort 30002 → port 80) │   │
│  │                                             │   │
│  │  Host processes (not in pods):              │   │
│  │   • User's Next.js app   → port 3000        │   │
│  │   • Jenkins build output → port 4567        │   │
│  │   • Cloned git repos     → /repos/<roomId>  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  EC2: codesync-backend   (t2.medium)        │   │
│  │  Role: API + Socket.io + business logic     │   │
│  │                                             │   │
│  │  Pods running here:                         │   │
│  │   • Backend API  (NodePort 30003 → port 4000│   │
│  │   • Socket.io handled inside same pod       │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 3. EC2 Machine Responsibilities

### EC2-1: codesync-control (t2.medium)

**Primary role:** Kubernetes control plane + CI/CD brain

| Responsibility | Detail |
|---|---|
| K8s control plane | Runs `kube-apiserver`, `etcd`, `scheduler`, `controller-manager` via kubeadm |
| Jenkins | Runs as a K8s pod pinned to this node. Listens on NodePort 30080 |
| PostgreSQL | Runs as a K8s pod pinned to this node. Stores rooms, sessions, file contents |
| PVC storage | EBS volume mounted into the postgres pod for data persistence |
| Webhook receiver | Jenkins receives GitHub webhook POST requests on port 30080 |

This machine **does not** serve any user-facing traffic other than Jenkins UI.

---

### EC2-2: codesync-frontend (t2.medium)

**Primary role:** Everything user-facing — pages, IDE, running code, build previews

| Responsibility | Detail |
|---|---|
| Landing Page pod | React app served by nginx. Port 30001. Username + repo URL entry |
| Monaco IDE pod | React + Monaco Editor. Port 30002. Full VS Code-like IDE |
| Cloned repos | Backend instructs this node to clone repos into `/repos/<roomId>/` on the host |
| Next.js dev server | When user clicks "Start Server", backend SSHes into this node and runs `npm start` in the repo dir. Exposed on port 3000 |
| Jenkins build output | Jenkins SSHes in, runs `npm run build`, serves the `out/` or `.next/` folder using `npx serve`. Port 4567 |
| `hostPath` volumes | IDE pod mounts `/repos/<roomId>/` from the host so it can read/write files directly |

This machine handles **everything the browser user touches** except the API.

---

### EC2-3: codesync-backend (t2.medium)

**Primary role:** API server + real-time socket hub

| Responsibility | Detail |
|---|---|
| REST API | Express.js. Handles room creation, joining, file CRUD |
| Socket.io | WebSocket connections for real-time collaboration |
| Git clone trigger | On room creation, backend sends an SSH command to the frontend EC2 to `git clone` the repo |
| 5-second sync | On receiving `code_change` socket events, backend writes file content to PostgreSQL |
| Room state | Tracks connected users, their colors, cursor positions |

---

## 4. User Journey — End to End

### Step 1: Landing Page

User visits `http://<frontend-ec2-ip>:30001`

They see:
- Text field: **Username**
- Text field: **Public GitHub repo URL** (e.g. `https://github.com/user/my-nextjs-app`)
- Button: **Start My Session**

When they click "Start My Session":
1. Browser sends `POST /api/rooms` to the backend (EC2-3, port 30003)
2. Backend generates a 6-character room code (e.g. `XK92LM`)
3. Backend inserts room record into PostgreSQL
4. Backend triggers a git clone on EC2-2: `git clone <repo-url> /repos/XK92LM/`
5. Backend reads the directory tree of the cloned repo
6. Backend responds with: `{ roomCode: "XK92LM", fileTree: [...] }`
7. Browser redirects user to `http://<frontend-ec2-ip>:30002?room=XK92LM`

---

### Step 2: Monaco IDE Opens

User lands on the IDE page (port 30002).

The IDE page:
1. Reads `?room=XK92LM` from the URL
2. Opens a Socket.io connection to the backend (EC2-3, port 30003)
3. Emits `join_room` with `{ roomCode, username }`
4. Backend responds with `room_joined` containing: `{ users[], fileTree, openFile, content }`
5. Left sidebar shows the full file tree from the cloned repo
6. Monaco editor opens the root `index` file by default

---

### Step 3: Editing Code

When the user clicks a file in the sidebar:
1. Browser emits `open_file` → `{ roomCode, filePath }`
2. Backend reads `/repos/XK92LM/<filePath>` from the frontend EC2's filesystem (via an internal API call or host-mounted volume)
3. Backend emits `file_content` → `{ filePath, content }` back to the user's socket
4. Monaco editor displays the file content

When the user types:
1. Monaco fires `onChange` on every keystroke
2. The change is held in local state
3. Every **5 seconds**, browser emits `code_change` → `{ roomCode, filePath, content }`
4. Backend writes the content to PostgreSQL: `UPDATE file_snapshots SET content = ... WHERE room_code = ... AND file_path = ...`
5. Backend also writes the file to disk on EC2-2: `fs.writeFile('/repos/XK92LM/<filePath>', content)`
6. Backend emits `code_update` to **all other users in the room** (not the sender)
7. Other users' Monaco editors update with the new content

---

### Step 4: Collaborator Joins

Person B visits `http://<frontend-ec2-ip>:30002?room=XK92LM` and enters their username.

1. Socket.io `join_room` event fires
2. Backend adds them to the in-memory room registry
3. Backend emits `user_joined` to Person A's socket — a floating hearts animation plays briefly
4. Both users now see each other's cursors with different colors
5. When Person B types, Person A's editor updates within 5 seconds (socket push)

---

### Step 5: Testing the App (Port 3000)

User clicks **"Start Server"** button in the IDE toolbar.

1. Browser sends `POST /api/rooms/XK92LM/start-server` to backend
2. Backend SSHes into EC2-2 (frontend node) using a pre-configured internal SSH key
3. Backend runs: `cd /repos/XK92LM && npm install && npm start &`
4. The Next.js dev server starts on port 3000 of EC2-2
5. Backend responds with: `{ url: "http://<frontend-ec2-ip>:3000" }`
6. IDE shows a banner: "Server running at http://<frontend-ec2-ip>:3000 — click to open"
7. The link opens in a new tab

---

### Step 6: Jenkins Build (Port 4567)

User pushes code to their GitHub repo.

Full Jenkins flow is described in [Section 13](#13-jenkins-cicd-pipeline).

Result: `http://<frontend-ec2-ip>:4567` serves the built static output.

---

## 5. Infrastructure Provisioning — Terraform

Terraform runs **once** from the operator's local machine. It creates all AWS resources from scratch.

### What Terraform Creates

```
terraform/
├── main.tf         → VPC, subnets, internet gateway, route tables
├── ec2.tf          → 3 EC2 instances with Elastic IPs
├── security.tf     → Security groups with port rules
├── outputs.tf      → Public IPs printed after apply
└── variables.tf    → key_name, region, instance types
```

### VPC Layout

```
VPC: 10.0.0.0/16
  └── Public Subnet: 10.0.1.0/24 (ap-south-1a)
        ├── EC2: codesync-control   → 10.0.1.10 (private) + Elastic IP (public)
        ├── EC2: codesync-frontend  → 10.0.1.11 (private) + Elastic IP (public)
        └── EC2: codesync-backend   → 10.0.1.12 (private) + Elastic IP (public)
```

All three instances are in the **same public subnet** so they can reach each other on private IPs without traversing the internet.

### Security Group Rules

| Port | Protocol | Source | Purpose |
|---|---|---|---|
| 22 | TCP | Your IP | SSH access for operators |
| 6443 | TCP | 10.0.1.0/24 | K8s API server (inter-node) |
| 2379-2380 | TCP | 10.0.1.0/24 | etcd (inter-node) |
| 10250 | TCP | 10.0.1.0/24 | kubelet (inter-node) |
| 10255 | TCP | 10.0.1.0/24 | kubelet read-only (inter-node) |
| 8472 | UDP | 10.0.1.0/24 | Flannel VXLAN overlay (inter-node) |
| 30001 | TCP | 0.0.0.0/0 | Landing page (user access) |
| 30002 | TCP | 0.0.0.0/0 | Monaco IDE (user access) |
| 30003 | TCP | 0.0.0.0/0 | Backend API + Socket.io |
| 30080 | TCP | 0.0.0.0/0 | Jenkins UI |
| 3000 | TCP | 0.0.0.0/0 | Next.js test server |
| 4567 | TCP | 0.0.0.0/0 | Jenkins build preview |
| 5432 | TCP | 10.0.1.0/24 | PostgreSQL (internal only) |

### EC2 Instances

| Name | Type | Private IP | Elastic IP | Storage |
|---|---|---|---|---|
| codesync-control | t2.medium | 10.0.1.10 | Yes | 30 GB gp2 |
| codesync-frontend | t2.medium | 10.0.1.11 | Yes | 50 GB gp2 (repo storage) |
| codesync-backend | t2.medium | 10.0.1.12 | Yes | 20 GB gp2 |

All instances use `ubuntu-22.04-lts` AMI (ami-0f5ee92e2d63afc18 for ap-south-1).

### What Terraform Does NOT Do

Terraform only creates raw infrastructure. It does **not** install software, configure Kubernetes, or deploy pods. That is Ansible's job.

---

## 6. Node Configuration — Ansible

Ansible runs after Terraform. It SSHes into each node and configures it fully. The operator runs Ansible playbooks **in order**.

```
ansible/
├── inventory.ini           → EC2 IPs from terraform output
├── ansible.cfg             → SSH key path, timeout settings
├── playbooks/
│   ├── 01-common.yml       → All nodes: apt update, base packages
│   ├── 02-kubeadm.yml      → All nodes: kubeadm + kubelet + kubectl
│   ├── 03-master-init.yml  → Control node only: kubeadm init, Flannel CNI
│   ├── 04-workers-join.yml → Frontend + Backend nodes: kubeadm join
│   ├── 05-label-nodes.yml  → Control node: kubectl label nodes for pod pinning
│   ├── 06-deploy-pods.yml  → Control node: kubectl apply all manifests
│   └── 07-jenkins-ssh.yml  → Control node: create SSH key pair for Jenkins→Frontend
└── roles/
    ├── common/             → curl, git, wget, unzip, build-essential
    ├── kubeadm/            → kubeadm, kubelet, kubectl (v1.28)
    └── node-labels/        → Labels for pod scheduling
```

### Playbook 01 — common.yml (all 3 nodes)

Runs on: `[all]`

- `apt update && apt upgrade -y`
- Install: `curl`, `git`, `wget`, `unzip`, `build-essential`, `ca-certificates`
- Install Node.js 18 via NodeSource (needed on frontend node for running repos)
- Disable swap (`swapoff -a` + comment out in `/etc/fstab`) — **required for Kubernetes**
- Set kernel params: `net.bridge.bridge-nf-call-iptables = 1`, `net.ipv4.ip_forward = 1`
- Load kernel modules: `overlay`, `br_netfilter`
- Install `containerd` as the container runtime (Kubernetes requires a CRI)
- Configure containerd with `SystemdCgroup = true`

---

### Playbook 02 — kubeadm.yml (all 3 nodes)

Runs on: `[all]`

- Add Kubernetes apt repo (`pkgs.k8s.io`)
- Install: `kubeadm=1.28.*`, `kubelet=1.28.*`, `kubectl=1.28.*`
- Hold versions with `apt-mark hold` so they don't auto-upgrade
- Enable and start `kubelet` service

---

### Playbook 03 — master-init.yml (control node only)

Runs on: `[control]`

- Run `kubeadm init --pod-network-cidr=10.244.0.0/16 --apiserver-advertise-address=10.0.1.10`
  - `10.244.0.0/16` is Flannel's required pod CIDR
  - `10.0.1.10` is the private IP of the control node
- Copy `admin.conf` to `~ubuntu/.kube/config` so kubectl works as the ubuntu user
- Apply Flannel CNI: `kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml`
- Save the `kubeadm join` command output to `/tmp/join-command.txt`
- Fetch `/tmp/join-command.txt` back to the Ansible controller machine

This step makes the control plane **Ready**. The join command from this step is used in the next playbook.

---

### Playbook 04 — workers-join.yml (frontend + backend nodes)

Runs on: `[frontend, backend]`

- Copy the `join-command.txt` fetched in step 03 to each worker
- Execute: `kubeadm join 10.0.1.10:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>`
- Wait until each node appears as `Ready` in `kubectl get nodes`

After this step, all 3 nodes form a working Kubernetes cluster:

```
NAME                 STATUS   ROLES           AGE
codesync-control     Ready    control-plane   5m
codesync-frontend    Ready    <none>          2m
codesync-backend     Ready    <none>          2m
```

---

### Playbook 05 — label-nodes.yml (control node)

Runs on: `[control]`

Adds labels to nodes so Kubernetes pods are pinned to the right machines:

```bash
kubectl label node codesync-control   role=control
kubectl label node codesync-frontend  role=frontend
kubectl label node codesync-backend   role=backend
```

These labels are referenced in every Deployment manifest via `nodeSelector`.

---

### Playbook 06 — deploy-pods.yml (control node)

Runs on: `[control]`

- Copies all `k8s/` manifest files to the control node
- Runs `kubectl apply -f k8s/namespace.yaml`
- Runs `kubectl apply -f k8s/postgres/`
- Runs `kubectl apply -f k8s/backend/`
- Runs `kubectl apply -f k8s/frontend/`
- Runs `kubectl apply -f k8s/jenkins/`
- Waits for all pods to reach `Running` state

---

### Playbook 07 — jenkins-ssh.yml (control node)

Runs on: `[control]`

Jenkins needs to SSH into the frontend EC2 to:
- Clone repos
- Start the Next.js dev server
- Run `npm run build` and serve the output on port 4567

This playbook:
- Generates an SSH key pair: `ssh-keygen -t rsa -f /var/jenkins_home/.ssh/id_rsa`
- Reads the public key
- Appends it to `~ubuntu/.ssh/authorized_keys` on the **frontend** EC2
- Stores the private key as a Jenkins credential (via Jenkins API call)
- Creates a known_hosts entry for the frontend EC2 IP

After this, Jenkins can SSH to EC2-2 without a password.

---

## 7. Kubernetes Cluster & Pod Layout

### Namespace

All pods run in the `codesync` namespace.

### Pod Placement via nodeSelector

| Pod | Node Label | Physical Machine |
|---|---|---|
| `landing-page` | `role=frontend` | codesync-frontend |
| `monaco-ide` | `role=frontend` | codesync-frontend |
| `backend` | `role=backend` | codesync-backend |
| `postgres` | `role=control` | codesync-control |
| `jenkins` | `role=control` | codesync-control |

### Pod Specs Summary

#### landing-page (1 replica)
- Image: nginx:alpine serving static React build
- ConfigMap: `nginx.conf` for SPA routing
- Service: NodePort 30001
- Mount: None

#### monaco-ide (1 replica)
- Image: nginx:alpine serving static React + Monaco build
- ConfigMap: `nginx.conf` for SPA routing
- Service: NodePort 30002
- Mount: `hostPath` `/repos/` from codesync-frontend host — so the IDE can read cloned repos

#### backend (2 replicas)
- Image: node:18-alpine running Express + Socket.io
- ConfigMap: `DATABASE_URL`, `CORS_ORIGIN`, `FRONTEND_HOST`, `FRONTEND_SSH_USER`
- Secret: `POSTGRES_PASSWORD`, `SSH_PRIVATE_KEY` (base64)
- Service: NodePort 30003 (WebSocket-compatible — `sessionAffinity: ClientIP` for sticky sessions)
- HPA: min 2, max 4 replicas based on CPU

#### postgres (1 replica)
- Image: postgres:15-alpine
- Secret: `POSTGRES_PASSWORD`
- PVC: 10 GB EBS gp2 volume mounted at `/var/lib/postgresql/data`
- Service: ClusterIP (internal only, port 5432)

#### jenkins (1 replica)
- Image: jenkins/jenkins:lts
- Service: NodePort 30080
- PVC: 20 GB EBS gp2 at `/var/jenkins_home`
- Mount: Docker socket from host (so Jenkins can run shell scripts)
- Pinned to control node via `nodeSelector`

---

## 8. Frontend — What It Serves & How

The frontend is split into **two separate React apps**, each served as its own pod.

### App 1: Landing Page (Port 30001)

**What the user sees:**
- CodeSync logo and tagline
- Input: Username
- Input: Public GitHub repo URL (validated to be a public HTTPS git URL)
- Button: "Start My Session"
- Floating animation on success (hearts/sparkles)

**What happens on button click:**
1. React sends `POST /api/rooms` to `http://<backend-ec2-ip>:30003/api/rooms`
2. Receives `{ roomCode, fileTree }` in response
3. Redirects to `http://<frontend-ec2-ip>:30002?room=XK92LM&user=<username>`

**Build:** `npm run build` → static files → served by nginx in pod

---

### App 2: Monaco IDE (Port 30002)

**What the user sees:**

```
┌─────────────────────────────────────────────────────┐
│  Toolbar: Room Code | Users | Language | Start Server│
│           Jenkins Build | Disconnect                 │
├──────────────┬──────────────────────────────────────┤
│              │                                       │
│  File Tree   │   Monaco Editor (main area)           │
│  (sidebar)   │                                       │
│              │   [Tabs for open files]               │
│  📁 src/     │                                       │
│    📄 app.js │   <file content here>                 │
│  📄 package  │                                       │
│              │                                       │
└──────────────┴──────────────────────────────────────┘
│  Status bar: Connected | 2 users | Last saved 3s ago │
└─────────────────────────────────────────────────────┘
```

**File Tree:**
- Rendered from `fileTree` object received on `room_joined` socket event
- Clicking a file emits `open_file` event → backend reads file → `file_content` event returns content
- Files open in tabs (like VS Code)
- Max 10 tabs open at once; oldest closes when exceeded

**Monaco Editor:**
- Language auto-detected from file extension (`.js` → JavaScript, `.tsx` → TypeScript, etc.)
- Each remote user shown as a different-colored cursor decoration
- `onChange` fires on every keystroke → held in local state
- Every 5 seconds: `code_change` event emitted with full file content

**Toolbar buttons:**
- **Start Server** → `POST /api/rooms/:code/start-server` → opens `http://<frontend-ip>:3000` in new tab
- **Jenkins Build** → opens `http://<frontend-ip>:4567` in new tab (shows build output)
- **Room Code** → click to copy to clipboard
- **Language Selector** → changes Monaco editor syntax highlighting

**Build:** `npm run build` → static files → served by nginx in pod

---

### How Frontend Talks to Backend

The landing page nginx config proxies `/api/*` to the backend:

```nginx
location /api/ {
    proxy_pass http://<backend-ec2-ip>:30003;
}
```

The Monaco IDE additionally proxies Socket.io:

```nginx
location /socket.io/ {
    proxy_pass http://<backend-ec2-ip>:30003;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

This means the **browser only ever talks to the frontend EC2 IP**. The nginx pod handles the proxying internally. No CORS issues.

---

## 9. Backend — What It Does & How

The backend is a single Node.js 18 + Express + Socket.io application running in Kubernetes on the backend EC2.

### REST API Endpoints

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/rooms` | Create room, trigger git clone, return roomCode + fileTree |
| `GET` | `/api/rooms/:code` | Get room metadata (users, language, repo URL) |
| `GET` | `/api/rooms/:code/files` | Get full file tree of cloned repo |
| `GET` | `/api/rooms/:code/file?path=<p>` | Get content of a specific file |
| `PATCH` | `/api/rooms/:code/file` | Save file content to DB + write to disk |
| `POST` | `/api/rooms/:code/start-server` | SSH into frontend EC2, run `npm start` |
| `DELETE` | `/api/rooms/:code` | Clean up room, kill server, delete repo dir |

### Git Clone Flow (on Room Creation)

When `POST /api/rooms` is called:

1. Backend generates `roomCode` (6 uppercase alphanumeric chars)
2. Backend inserts into `rooms` table in PostgreSQL
3. Backend opens an SSH connection to EC2-2 (codesync-frontend) using the pre-stored private key
4. Runs: `git clone <repoUrl> /repos/<roomCode>`
5. After clone completes, backend reads the directory tree with a recursive `ls` via SSH
6. Transforms the directory listing into a nested `fileTree` JSON object
7. Returns `{ roomCode, fileTree }` to the browser

**Git clone is synchronous in the HTTP response.** The user waits while the clone happens. For large repos this may take a few seconds — the frontend shows a loading spinner.

### File Read/Write Flow

**Reading a file:**
- Backend SSHes into EC2-2 and runs `cat /repos/<roomCode>/<filePath>`
- Returns content as a string

**Writing a file (on `code_change` event or `PATCH /file`):**
- Backend writes to PostgreSQL: `file_snapshots` table (for persistence across sessions)
- Backend SSHes into EC2-2 and runs: `echo '<content>' > /repos/<roomCode>/<filePath>`
- This keeps the file on disk in sync so `npm start` always runs the latest version

### Start Server Flow

On `POST /api/rooms/:code/start-server`:
1. Backend SSHes into EC2-2
2. Kills any existing process on port 3000: `fuser -k 3000/tcp`
3. Runs: `cd /repos/<roomCode> && npm install --silent && npm start &`
4. Waits 3 seconds, checks if port 3000 is listening
5. Returns `{ url: "http://<frontend-ec2-ip>:3000", status: "running" }`

### Socket.io Events Handled

| Event (received) | What backend does |
|---|---|
| `join_room` | Adds user to room registry, assigns color, emits `room_joined` to sender, `user_joined` to others |
| `open_file` | Reads file via SSH, emits `file_content` back to sender only |
| `code_change` | Saves to DB + disk, emits `code_update` to all other room members |
| `cursor_move` | Emits `cursor_update` to all other room members (no DB write) |
| `language_change` | Updates room's language in DB, emits `language_update` to all members |
| `leave_room` | Removes user, emits `user_left` to remaining members |
| `disconnect` | Same as `leave_room` |

---

## 10. Database Schema

PostgreSQL 15, running on the control node, managed by Prisma ORM in the backend.

```sql
-- Rooms: one per collaborative session
CREATE TABLE rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        CHAR(6) UNIQUE NOT NULL,       -- e.g. "XK92LM"
    repo_url    TEXT NOT NULL,
    language    TEXT DEFAULT 'javascript',
    created_at  TIMESTAMPTZ DEFAULT now(),
    last_active TIMESTAMPTZ DEFAULT now()
);

-- File snapshots: last known content of each file in each room
CREATE TABLE file_snapshots (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE,
    file_path   TEXT NOT NULL,                 -- e.g. "src/app/page.tsx"
    content     TEXT,
    updated_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(room_id, file_path)
);

-- Room sessions: tracks who joined, when, from what IP
CREATE TABLE room_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE,
    username    TEXT NOT NULL,
    color       TEXT NOT NULL,                 -- hex color for cursor
    joined_at   TIMESTAMPTZ DEFAULT now(),
    left_at     TIMESTAMPTZ
);
```

**Indexes:**
- `rooms(code)` — for fast room lookup by code
- `file_snapshots(room_id, file_path)` — for fast file content retrieval

---

## 11. Real-Time Collaboration Flow

### When Two Users Edit the Same File

```
User A types in Monaco
       │
       ▼ (every 5 seconds)
  Browser emits: code_change { roomCode, filePath, content }
       │
       ▼
  Backend (Socket.io)
       ├── Write to PostgreSQL: UPDATE file_snapshots SET content = ...
       ├── Write to disk: SSH → EC2-2 → write file
       └── Emit to User B's socket: code_update { filePath, content }
                                           │
                                           ▼
                                   User B's Monaco
                                   updates (only if
                                   User B doesn't have
                                   that file open in
                                   active focus)
```

### Cursor Sync

Cursors sync on every `onCursorPositionChange` event from Monaco — **not throttled to 5 seconds**. This is lightweight (just `{ line, column }`) so it fires instantly.

### Conflict Resolution

Simple **last-write-wins**. The most recent `code_change` event for a given file overwrites the previous. There is no operational transform or CRDT. This is acceptable because the 5-second sync window naturally staggers writes.

### "Love is Showering" Effect

When `user_joined` event arrives on a browser:
- A small floating hearts animation plays for 2 seconds
- The new user's name and colored dot appear in the toolbar's user list
- Their cursor color is announced in the status bar

---

## 12. Git Repo Integration Flow

### On Room Creation (Clone)

```
Browser → POST /api/rooms { repoUrl, username }
              │
              ▼
         Backend generates roomCode
              │
              ▼
         Backend SSH → EC2-2
         git clone <repoUrl> /repos/<roomCode>/
              │
              ▼
         Backend SSH → EC2-2
         find /repos/<roomCode> -type f | sort
              │
              ▼
         Backend transforms listing → fileTree JSON
         [
           { name: "src", type: "dir", children: [
               { name: "app.js", type: "file", path: "src/app.js" },
               ...
           ]},
           { name: "package.json", type: "file", path: "package.json" }
         ]
              │
              ▼
         Backend saves room to DB
              │
              ▼
         Response: { roomCode, fileTree }
```

### On File Open

```
User clicks file in sidebar
       │
       ▼
Browser emits: open_file { roomCode, filePath: "src/app.js" }
       │
       ▼
Backend checks file_snapshots table first (for unsaved edits in DB)
       │
       ├── If found in DB → return DB content (latest saved version)
       └── If not in DB → SSH to EC2-2 → cat /repos/<roomCode>/src/app.js
                               │
                               ▼
                         Emit: file_content { filePath, content }
```

### File Tree Does Not Include

- `node_modules/`
- `.git/`
- `.next/`
- `dist/`
- `build/`
- `*.env`

These are filtered server-side before building the `fileTree`.

---

## 13. Jenkins CI/CD Pipeline

Jenkins runs as a pod on the control node. It receives webhook events from GitHub and builds + deploys the user's code to port 4567 on the frontend EC2.

### Setup (one-time, manual)

After `kubectl apply -f k8s/jenkins/`:
1. Operator visits `http://<control-ec2-ip>:30080`
2. Completes Jenkins initial setup wizard
3. Installs plugins: **Git**, **Pipeline**, **SSH Agent**, **NodeJS**
4. Creates a **NodeJS installation** named `node18` in Global Tool Configuration
5. Creates an **SSH credential** named `frontend-ssh-key` using the private key from Playbook 07
6. Creates a **Pipeline job** named `codesync-build`
7. Configures it as **Pipeline script from SCM** pointing to the same CodeSync repo (for the Jenkinsfile)
8. Enables **GitHub hook trigger for GITScm polling**

### Webhook Setup (per user room)

When a user creates a room, the backend also creates a unique Jenkins webhook URL:

`http://<control-ec2-ip>:30080/generic-webhook-trigger/invoke?token=<roomCode>`

The backend provides this URL to the user as a **one-time setup instruction**: "Add this webhook to your GitHub repo settings → Webhooks → Add webhook → Payload URL."

The user does this once. After that, every `git push` to their main branch triggers Jenkins automatically.

### Jenkinsfile

```groovy
pipeline {
    agent any

    tools {
        nodejs 'node18'
    }

    environment {
        ROOM_CODE    = "${params.ROOM_CODE}"         // passed from webhook trigger
        FRONTEND_IP  = '10.0.1.11'                  // private IP of frontend EC2
        REPO_DIR     = "/repos/${ROOM_CODE}"
        BUILD_DIR    = "/builds/${ROOM_CODE}"
        SERVE_PORT   = '4567'
    }

    stages {
        stage('Pull Latest Code') {
            steps {
                sshagent(['frontend-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ubuntu@${FRONTEND_IP} \
                          "cd ${REPO_DIR} && git pull origin main"
                    '''
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                sshagent(['frontend-ssh-key']) {
                    sh '''
                        ssh ubuntu@${FRONTEND_IP} \
                          "cd ${REPO_DIR} && npm install --silent"
                    '''
                }
            }
        }

        stage('Build') {
            steps {
                sshagent(['frontend-ssh-key']) {
                    sh '''
                        ssh ubuntu@${FRONTEND_IP} \
                          "cd ${REPO_DIR} && npm run build"
                    '''
                }
            }
        }

        stage('Serve Build Output') {
            steps {
                sshagent(['frontend-ssh-key']) {
                    sh '''
                        ssh ubuntu@${FRONTEND_IP} \
                          "fuser -k ${SERVE_PORT}/tcp || true;
                           mkdir -p ${BUILD_DIR};
                           cp -r ${REPO_DIR}/out ${BUILD_DIR}/ 2>/dev/null || \
                           cp -r ${REPO_DIR}/.next ${BUILD_DIR}/ 2>/dev/null;
                           cd ${BUILD_DIR} && npx serve out -l ${SERVE_PORT} &"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Build deployed to http://${FRONTEND_IP}:${SERVE_PORT}"
        }
        failure {
            echo "Build failed for room ${ROOM_CODE}"
        }
    }
}
```

### Build Output Logic

- If the repo has an `out/` directory after build → it's a Next.js static export (`next export`). Served directly by `npx serve`.
- If the repo has a `.next/` directory → it's a server-rendered Next.js app. Served by `npx serve .next` (static pages only). A banner is shown in the IDE: "Note: Server-rendered routes may not work in static preview."
- For non-Next.js apps (plain React, Vite): serve the `dist/` or `build/` folder.

---

## 14. Communication Map — Who Talks to Whom

```
Browser (User)
    │
    ├── HTTP GET  → EC2-2:30001 (landing page nginx)
    │       └── nginx serves static React files
    │
    ├── HTTP POST /api/rooms → EC2-2:30001 nginx
    │       └── nginx proxies → EC2-3:30003 (backend)
    │
    ├── HTTP GET  → EC2-2:30002 (Monaco IDE nginx)
    │       └── nginx serves static React + Monaco files
    │
    ├── WebSocket /socket.io → EC2-2:30002 nginx
    │       └── nginx upgrades + proxies → EC2-3:30003 (Socket.io)
    │
    ├── HTTP GET → EC2-2:3000  (Next.js test server, direct)
    │
    └── HTTP GET → EC2-2:4567  (Jenkins build output, direct)


EC2-3 (Backend) 
    ├── TCP → EC2-1:5432 (PostgreSQL, internal K8s cluster network)
    └── SSH → EC2-2:22  (git clone, file read/write, npm start, serve)


EC2-1 (Jenkins)
    └── SSH → EC2-2:22  (git pull, npm install, npm run build, serve)


EC2-1 (K8s Control Plane)
    ├── TCP 6443 → EC2-2, EC2-3 (kubectl / API server)
    └── UDP 8472 → EC2-2, EC2-3 (Flannel overlay network)
```

**Key rule:** The browser never talks directly to EC2-3 (backend). Everything goes through EC2-2's nginx. This means a single public IP is needed for the browser.

---

## 15. Port Reference

| Port | Machine | Service | Who accesses it |
|---|---|---|---|
| 30001 | EC2-2 (frontend) | Landing page | Browser |
| 30002 | EC2-2 (frontend) | Monaco IDE | Browser |
| 30003 | EC2-3 (backend) | Backend API + Socket.io | nginx on EC2-2 (proxied) |
| 30080 | EC2-1 (control) | Jenkins UI | Operator browser |
| 3000 | EC2-2 (frontend) | User's Next.js test server | Browser (direct) |
| 4567 | EC2-2 (frontend) | Jenkins build preview | Browser (direct) |
| 5432 | EC2-1 (control) | PostgreSQL | Backend pod (internal K8s network) |
| 6443 | EC2-1 (control) | K8s API server | All nodes (internal) |
| 22 | All machines | SSH | Ansible (setup), Backend (file ops), Jenkins (build) |

---

## 16. Environment Variables

### Backend Pod (ConfigMap)

```env
PORT=4000
NODE_ENV=production
DATABASE_URL=postgresql://codesync:<password>@<postgres-clusterip>:5432/codesync
CORS_ORIGIN=http://<frontend-ec2-public-ip>:30002
FRONTEND_HOST=10.0.1.11
FRONTEND_SSH_USER=ubuntu
REPOS_BASE_PATH=/repos
BUILDS_BASE_PATH=/builds
```

### Backend Pod (Secret)

```env
POSTGRES_PASSWORD=<generated-strong-password>
SSH_PRIVATE_KEY=<base64-encoded-private-key>
```

### Frontend Apps (build-time, baked into static bundle via Vite)

```env
VITE_API_URL=http://<frontend-ec2-public-ip>:30001
VITE_SOCKET_URL=http://<frontend-ec2-public-ip>:30002
VITE_FRONTEND_PUBLIC_IP=<frontend-ec2-public-ip>
```

These are set at Docker build time. If IPs change, the frontend must be rebuilt and redeployed.

---

## 17. File & Directory Structure

```
codesync/
│
├── CLAUDE.md                          ← This document
├── README.md                          ← Quick start for operators
├── Jenkinsfile                        ← Jenkins pipeline definition
│
├── terraform/
│   ├── main.tf                        ← VPC, subnet, IGW, route tables
│   ├── ec2.tf                         ← 3 EC2 instances + Elastic IPs
│   ├── security.tf                    ← Security groups + all port rules
│   ├── ecr.tf                         ← (empty — no Docker images used)
│   ├── outputs.tf                     ← Prints public IPs after apply
│   └── variables.tf                   ← key_name, region, instance types
│
├── ansible/
│   ├── inventory.ini                  ← [control], [frontend], [backend] groups
│   ├── ansible.cfg                    ← SSH key, host key checking off
│   ├── playbooks/
│   │   ├── 01-common.yml
│   │   ├── 02-kubeadm.yml
│   │   ├── 03-master-init.yml
│   │   ├── 04-workers-join.yml
│   │   ├── 05-label-nodes.yml
│   │   ├── 06-deploy-pods.yml
│   │   └── 07-jenkins-ssh.yml
│   └── roles/
│       ├── common/tasks/main.yml
│       ├── kubeadm/tasks/main.yml
│       └── node-labels/tasks/main.yml
│
├── frontend/
│   ├── landing/                       ← Landing page React app
│   │   ├── src/
│   │   │   ├── main.jsx
│   │   │   ├── App.jsx
│   │   │   ├── pages/
│   │   │   │   └── LandingPage.jsx    ← Username + repo URL + Start button
│   │   │   └── api.js                 ← Axios POST /api/rooms
│   │   ├── nginx.conf                 ← SPA routing + /api proxy to backend
│   │   ├── Dockerfile                 ← node:18 build → nginx:alpine serve
│   │   └── package.json
│   │
│   └── ide/                           ← Monaco IDE React app
│       ├── src/
│       │   ├── main.jsx
│       │   ├── App.jsx
│       │   ├── components/
│       │   │   ├── FileTree.jsx        ← Left sidebar, recursive tree
│       │   │   ├── EditorTabs.jsx      ← Tab bar for open files
│       │   │   ├── MonacoEditor.jsx    ← Monaco wrapper + cursor decorations
│       │   │   ├── Toolbar.jsx         ← Room code, users, Start Server btn
│       │   │   ├── UserPresence.jsx    ← Colored dots for connected users
│       │   │   └── HeartsAnimation.jsx ← "Love is showering" effect
│       │   ├── hooks/
│       │   │   ├── useSocket.js        ← Socket.io connection + event handlers
│       │   │   └── useAutoSave.js      ← 5-second save interval
│       │   └── api.js
│       ├── nginx.conf                  ← SPA routing + /api + /socket.io proxy
│       ├── Dockerfile
│       └── package.json
│
├── backend/
│   ├── src/
│   │   ├── index.js                   ← Express + Socket.io bootstrap
│   │   ├── db.js                      ← Prisma client singleton
│   │   ├── ssh.js                     ← SSH client utility (node-ssh)
│   │   ├── routes/
│   │   │   ├── rooms.js               ← POST / GET /:code / PATCH /:code/file
│   │   │   └── server.js              ← POST /:code/start-server
│   │   └── socket/
│   │       └── index.js               ← All Socket.io event handlers
│   ├── prisma/
│   │   └── schema.prisma              ← Room, FileSnapshot, RoomSession models
│   ├── Dockerfile
│   └── package.json
│
└── k8s/
    ├── namespace.yaml
    ├── frontend/
    │   ├── landing-deployment.yaml    ← nodeSelector: role=frontend
    │   ├── landing-service.yaml       ← NodePort 30001
    │   ├── landing-configmap.yaml     ← nginx.conf
    │   ├── ide-deployment.yaml        ← nodeSelector: role=frontend, hostPath mount
    │   ├── ide-service.yaml           ← NodePort 30002
    │   └── ide-configmap.yaml         ← nginx.conf
    ├── backend/
    │   ├── deployment.yaml            ← nodeSelector: role=backend, 2 replicas
    │   ├── service.yaml               ← NodePort 30003, sessionAffinity: ClientIP
    │   ├── configmap.yaml
    │   ├── secret.yaml
    │   └── hpa.yaml                   ← min 2, max 4, CPU 60%
    ├── postgres/
    │   ├── deployment.yaml            ← nodeSelector: role=control, 1 replica
    │   ├── service.yaml               ← ClusterIP, port 5432
    │   ├── pvc.yaml                   ← 10 GB EBS gp2
    │   └── secret.yaml
    └── jenkins/
        ├── deployment.yaml            ← nodeSelector: role=control, 1 replica
        ├── service.yaml               ← NodePort 30080
        └── pvc.yaml                   ← 20 GB EBS gp2
```

---

## 18. Commands to Run — In Order

### Phase 1: Provision Infrastructure (Local machine)

```bash
# 1. Configure AWS credentials
aws configure
# Enter: Access Key ID, Secret Access Key, ap-south-1, json

# 2. Create SSH key pair in AWS
aws ec2 create-key-pair \
  --key-name codesync-key \
  --region ap-south-1 \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/codesync-key.pem
chmod 400 ~/.ssh/codesync-key.pem

# 3. Terraform init
cd terraform
terraform init

# 4. Preview what will be created
terraform plan -var="key_name=codesync-key"

# 5. Create all AWS resources (takes ~3 minutes)
terraform apply -var="key_name=codesync-key"

# 6. Note the output IPs
terraform output
# Expected output:
#   control_public_ip  = "13.x.x.x"
#   frontend_public_ip = "13.x.x.x"
#   backend_public_ip  = "13.x.x.x"
```

---

### Phase 2: Fill Ansible Inventory (Local machine)

```bash
cd ../ansible
nano inventory.ini
# Fill in the IPs from terraform output
```

`inventory.ini` structure:

```ini
[control]
13.x.x.x ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/codesync-key.pem

[frontend]
13.x.x.x ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/codesync-key.pem

[backend]
13.x.x.x ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/codesync-key.pem

[all:vars]
ansible_ssh_common_args='-o StrictHostKeyChecking=no'
```

---

### Phase 3: Configure Nodes (Local machine, run in order)

```bash
cd ansible

# Install base packages + disable swap + containerd on all 3 nodes
ansible-playbook playbooks/01-common.yml -i inventory.ini

# Install kubeadm, kubelet, kubectl on all 3 nodes
ansible-playbook playbooks/02-kubeadm.yml -i inventory.ini

# Init K8s control plane on control node
ansible-playbook playbooks/03-master-init.yml -i inventory.ini

# Join frontend + backend nodes to the cluster
ansible-playbook playbooks/04-workers-join.yml -i inventory.ini

# Label nodes for pod placement
ansible-playbook playbooks/05-label-nodes.yml -i inventory.ini

# Deploy all K8s pods
ansible-playbook playbooks/06-deploy-pods.yml -i inventory.ini

# Set up SSH key for Jenkins → Frontend communication
ansible-playbook playbooks/07-jenkins-ssh.yml -i inventory.ini
```

---

### Phase 4: Verify Cluster (SSH into control node)

```bash
ssh -i ~/.ssh/codesync-key.pem ubuntu@<control-public-ip>

kubectl get nodes
# All 3 should show: Ready

kubectl get pods -n codesync
# All pods should show: Running

# Test backend is reachable from control node
curl http://<backend-private-ip>:30003/health
# Expected: { "status": "ok" }
```

---

### Phase 5: Configure Jenkins (Browser)

```bash
# Visit: http://<control-public-ip>:30080
# Follow setup wizard
# Install plugins: Git, Pipeline, SSH Agent, NodeJS
# Add NodeJS tool: name = "node18", version = "18.x"
# Add SSH credential: ID = "frontend-ssh-key", paste private key from /var/jenkins_home/.ssh/id_rsa
# Create Pipeline job: "codesync-build", SCM = this repo, Jenkinsfile path = Jenkinsfile
# Enable: "GitHub hook trigger for GITScm polling"
```

---

### Phase 6: Access the App (Browser)

```bash
# Landing page
http://<frontend-public-ip>:30001

# Jenkins
http://<control-public-ip>:30080

# After starting a session and clicking "Start Server"
http://<frontend-public-ip>:3000

# After pushing to GitHub and Jenkins build completes
http://<frontend-public-ip>:4567
```

---

### Teardown

```bash
# From control node — delete PVCs first to release EBS volumes
kubectl delete pvc --all -n codesync

# From local machine
cd terraform
terraform destroy -var="key_name=codesync-key"

# Verify in AWS console: no orphaned EBS volumes, no running EC2 instances
```

> ⚠️ Always delete PVCs before `terraform destroy`. EBS volumes provisioned by PVCs are not managed by Terraform and will continue incurring charges (~$0.10/GB/month) if left orphaned.

---

*End of ARCHITECTURE.md*
