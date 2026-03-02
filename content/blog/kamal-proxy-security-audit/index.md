---
title: kamal-proxy security audit
date: "2026-03-01T00:00:00.000Z"
description: "Security audit of kamal-proxy's Docker container."
---

In my [previous post](/kamal-proxy-deep-dive/) we explored how `kamal-proxy` works under the hood, covering topics like the bridge network, the iptables rules and the Unix socket RPC protocol. Near the end, we intercepted the Docker socket to watch Kamal orchestrate a full deploy. Now that we understand the domain, I thought it would be interesting to perform a quick security audit under the assumption that an attacker managed to _get remote code execution inside the web container_.

Kamal runs the web app and its proxy side-by-side on the same host. How well are they isolated from each other? Can an attacker in the web app container reach `kamal-proxy`'s control plane and stop it, redeploy it, or redirect traffic? That's what this post is about and we will be using my live production server throughout.

## The threat model

An attacker exploits a vulnerability in the web application and achieves RCE inside the web app container. They have a shell, so they can run any commands and make network requests. What can they reach?

I see two clear targets:

1. **The Unix socket:** `kamal-proxy` uses `/tmp/kamal-proxy.sock` as its RPC control plane. Whoever can talk to this socket can deploy or stop targets.
2. **The network surface:** both containers share the same Docker bridge network. Can the web app container reach `kamal-proxy` over TCP and abuse its HTTP interface?

Let's start our investigation!

## The Unix socket

From the [previous post](/kamal-proxy-deep-dive/) we know the socket exists at `/tmp/kamal-proxy.sock` inside the container, exposed on the host through the overlay filesystem at:

```
/var/lib/docker/rootfs/overlayfs/b9958b81313c.../tmp/kamal-proxy.sock
```

The first thing to check is who owns it and what permissions it has:

```bash
$ stat /var/lib/docker/rootfs/overlayfs/b9958b81313c.../tmp/kamal-proxy.sock
  File: ...kamal-proxy.sock
  Size: 0
Access: (0755/srwxr-xr-x)  Uid: ( 1001/ UNKNOWN)   Gid: ( 1001/ UNKNOWN)
```

The permission bits `srwxr-xr-x` can be broken down as:
- Owner (uid 1001): can connect
- Group (gid 1001): read + execute, but **no write**, so it cannot connect
- Others: read + execute, but again **no write** so it also cannot connect

For Unix sockets, the write permission is what allows a process to connect. So only `uid 1001` can talk to this socket. That's the `kamal-proxy` process itself and anything exec'd into the container via `docker exec`.

But can the web app container even reach this path? Let's check!

```bash
$ ls -la /var/lib/docker/rootfs/
drwx--x---  3 root root 4096 ...
```

`drwx--x---`, so only `root` can traverse this path. This means that even if a process were running as `uid 1001` somewhere on the host, it couldn't navigate to the socket through the overlayfs path. Can we reach the socket from the web app container itself?

```bash
$ docker exec xps-web-98043a3 ls /tmp/
# Empty...
```

The directory is empty, so the answer to our previous question is no. The reason for this behavior is that the app container has its own mount namespace, which is the Linux mechanism for giving each container a completely isolated view of the filesystem. In practice this means that the web app container has no view of `kamal-proxy`'s filesystem at all.

In order to be thorough, let's also check what user the web app container runs as, and whether any sockets are visible anywhere in its filesystem:

```bash
$ docker exec xps-web-98043a3 id
uid=1000(appuser) gid=1000(appuser) groups=1000(appuser)

$ docker exec xps-web-98043a3 find / -name "*.sock" -type s 2>/dev/null
# Nothing...
```

So `uid 1000` and no sockets within the container. The control plane is genuinely unreachable from the web app container.

Another thing worth noting is that Docker is running without user namespace remapping (the default behavior) and confirmed through:

```bash
$ docker inspect kamal-proxy --format '{{.HostConfig.UsernsMode}}'
# No output...
```

Having no output means no remapping, which means the `uid 1001` inside the `kamal-proxy` container is also `uid 1001` on the host kernel. This is an anonymous, unmapped uid that no legitimate host user or process runs as on my system. Kamal's own deployment workflow reaches kamal-proxy's Unix socket via `docker exec`, running commands inside the container's own mount namespace where the socket is visible. The broader orchestration (pulling images, starting containers, routing traffic) goes through the Docker socket API as we have seen in the previous post.

### Proving the namespace separation

We claimed that both containers have distinct mount namespaces, but will you blindly trust me? I hope not! Every process on Linux has its namespaces exposed under `/proc/<pid>/ns/`. The inode number in the symlink target uniquely identifies the namespace, so having the same inode means processes share a namespace, otherwise they have isolated namespaces.

```bash
# Get the host PIDs of both container processes
$ docker inspect kamal-proxy --format '{{.State.Pid}}'
1129
$ docker inspect xps-web-98043a3 --format '{{.State.Pid}}'
6292

# Compare their mount namespace inodes
$ ls -la /proc/1129/ns/mnt
lrwxrwxrwx 1 1001 1001 0 Feb 26 03:00 /proc/1129/ns/mnt -> 'mnt:[4026532438]'

$ ls -la /proc/6292/ns/mnt
lrwxrwxrwx 1 deploy deploy 0 Feb 26 04:18 /proc/6292/ns/mnt -> 'mnt:[4026532307]'
```

See how the inodes are different (`4026532438` vs `4026532307`)? Whatever is mounted in `kamal-proxy`'s filesystem is completely invisible from the web app container's perspective and vice versa.

Another thing worth noticing is the symlink ownership. `/proc/1129/ns/mnt` is owned by `uid 1001`, while `/proc/6292/ns/mnt` is owned by `deploy`, which is the host account Kamal uses to SSH on my system. This is the same uid the web app container runs as, since `user: "1000:1000"` in `deploy.yml` corresponds to the host's `deploy` user. Given that, a reasonable follow up question would be:

> If the `web app` and `kamal-proxy` shared the same uid, could the web app container access `kamal-proxy`'s mount namespace?

The answer is no for the following reasons:

1. Besides mount namespaces, containers also have distinct PID namespaces, so they couldn't access these process IDs like the host does. Docker containers get their own PID namespace by default.
2. [CAP_SYS_ADMIN](https://man7.org/linux/man-pages/man7/capabilities.7.html) is required for [setns()](https://man7.org/linux/man-pages/man2/setns.2.html), so even if the PIDs were visible (e.g. with --pid=host) we wouldn't be able to enter this namespace since containers don't have this capability enabled by default.

There is one exception to point `2`, as always. With a _shared PID namespace and a shared UID_, an attacker could make use of `/proc/<pid>/root` to access the socket. This is a symlink that the Linux kernel maintains for every running process, pointing to whatever that process considers its root directory (/). For a normal process that's just `/`, but for a containerized process it points to that container's root filesystem, as in, the overlay filesystem's merged directory with all its files.

From the host as root we can already do this:

```bash
$ ls /proc/1129/root/tmp/
kamal-proxy.sock

$ ls -la /proc/1129/root/home/kamal-proxy/.config/kamal-proxy/
drwxr-xr-x 3 1001 1001 4096 Feb 25 03:51 .
drwxr-xr-x 3 1001 1001 4096 May 14  2025 ..
drwx------ 3 1001 1001 4096 Feb 25 03:51 certs
-rw-r--r-- 1 1001 1001  953 Feb 26 04:18 kamal-proxy.state
```

The Unix socket isn't the only thing worth reaching here. Let's see what else is in that filesystem.

`kamal-proxy.state` is `0644`, or world-readable, so any uid can access it via this path. It contains the full service topology, internal container IDs, logged header names, and the `acme_cache_path` that points to exactly where the certificates live.

`certs` is `0700`, accessible only by `uid 1001`. Inside, `autocert` stores two files without extensions: the domain's TLS private key and `acme_account+key`. The account key is the more impactful of the two. The domain private key lets an attacker decrypt captured TLS traffic. The ACME account key lets them issue certificates for any other domain registered to the same Let's Encrypt account, or revoke existing ones to cause an outage. Neither requires any additional access to the server itself.

Neither running `--pid=host` or sharing `uid` is the default though, so this path is closed in a standard Kamal deployment. But it's a good illustration of why not breaking PID namespace isolation matters. Once shared PIDs are in the picture, uid alignment becomes a problem.

We have talked a lot about `kamal-proxy`'s uid, but how is it defined?

### Where does uid 1001 actually come from?

kamal-proxy's [Dockerfile](https://github.com/basecamp/kamal-proxy/blob/3e7aebd4cbf66d79667f0fa3671b9913a78903d8/Dockerfile#L1-L24) is defined as:

```dockerfile
FROM ubuntu:noble-20251013 AS base

# ...

RUN useradd kamal-proxy \
    && mkdir -p /home/kamal-proxy/.config/kamal-proxy \
    && chown -R kamal-proxy:kamal-proxy /home/kamal-proxy

USER kamal-proxy:kamal-proxy
```

The `useradd` command without an explicit `-u` flag assigns the **next available uid** after existing system users. On a fresh `ubuntu:noble` image that happens to be `1001`, but it's an implementation detail of the base image, not a deliberate choice by Kamal. If Ubuntu ever adds a new system user in a future release, `kamal-proxy` silently becomes uid `1002`. 

We can verify this live:

```bash
$ docker exec kamal-proxy id
uid=1001(kamal-proxy) gid=1001(kamal-proxy) groups=1001(kamal-proxy)
```

This means that the uids `1000` and `1001` in our production environment are entirely "coincidental". My project's Dockerfile explicitly creates `appuser` with uid `1000` and Ubuntu's `useradd` defaults landing on 1001. Kamal never designed this as a security boundary, but it is interesting to document the behavior nonetheless.

While we are looking at the Dockerfile, a couple of other things are worth noting. The base image is `ubuntu:noble-20251013`, a date-pinned tag that is mutable since DockerHub tags can be force-pushed. A SHA digest (`ubuntu:noble@sha256:...`) is the only truly immutable form. The build stage (`golang:1.26`) is looser, with no date tag at all, meaning the build toolchain can silently change on the next pull.

```bash
FROM golang:1.26 AS build
# ...
FROM ubuntu:noble-20251013 AS base
# ...
```

I didn't spot things like `govulncheck`, `gosec`, or image scanning in CI, so known CVEs in the dependency tree wouldn't be caught during CI-time.

```bash
$ cat .github/workflows/ci.yml
name: Go

permissions:
  contents: read
  pull-requests: write

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]
# ...
```

None of this changes the runtime threat model we have been exploring, but it is worth knowing when evaluating the overall security posture of the project. Let's move on!

## Attempting to reach the RPC control plane directly

We've established that the Unix socket is unreachable from the web app container, but we want to prove it rather than just assert it. The _way_ it fails matters as much as the failure itself.

Let's write a small Go binary that speaks kamal-proxy's RPC protocol and calls `List`, a read-only operation that returns every registered service with its target and associated metadata. We'll run it from the web app container first, then from inside kamal-proxy itself. Our expectation is for the binary to fail within the web app container, but not within `kamal-proxy`.

From the previous post, we intercepted the raw gob-encoded payload on the socket and could read the struct field names directly from it. Cross-referencing with Kamal's [source code](https://github.com/basecamp/kamal-proxy/tree/v0.9.0/internal/cmd) confirms that the approach should work. Let's start!

```go
package main

import (
    "fmt"
    "net"
    "net/rpc"
    "time"
)

type ServiceDescription struct {
    Host   string
    Path   string
    TLS    bool
    Target string
    State  string
}

type ListResponse struct {
    Targets map[string]ServiceDescription
}

func dial(socketPath string) (*rpc.Client, error) {
    conn, err := net.DialTimeout("unix", socketPath, 5*time.Second)
    if err != nil {
        return nil, err
    }
    return rpc.NewClient(conn), nil
}

func main() {
    client, err := dial("/tmp/kamal-proxy.sock")
    if err != nil {
        fmt.Printf("[!] Failed to connect: %v\n", err)
        return
    }
    defer client.Close()

    var response ListResponse
    if err := client.Call("kamal-proxy.List", true, &response); err != nil {
        fmt.Printf("[!] List failed: %v\n", err)
        return
    }

    for name, svc := range response.Targets {
        fmt.Printf("service=%-20s target=%-25s state=%s tls=%v\n",
            name, svc.Target, svc.State, svc.TLS)
    }
}
```

Let's compile the code, send it to our server and run it in both containers:

```bash
# On our local machine
GOOS=linux GOARCH=amd64 go build -o probe_amd64 probe.go
# Copy to the server
scp probe_amd64 deploy@$DROPLET_IP:/tmp/probe_amd64
# Copy into the web app container
docker cp /tmp/probe_amd64 xps-web-98043a3:/tmp/probe
# Run it as the attacker would
docker exec xps-web-98043a3 /tmp/probe
[!] Failed to connect: dial unix /tmp/kamal-proxy.sock: connect: no such file or directory
```

Notice that the error is `no such file or directory`, not `permission denied`. The socket doesn't exist within the web app container at all, the uid check never even runs. The mount namespace separation is doing all the work before permissions get a chance to matter.

Now let's run the same binary from inside `kamal-proxy` to confirm the binary itself works:

```bash
# Copy to kamal-proxy container
docker cp /tmp/probe_amd64 kamal-proxy:/tmp/probe
docker exec kamal-proxy /tmp/probe
service=xps-web              target=7c001501e3ca:8080         state=running tls=true
```

Connecting from the right context reaches the control plane immediately with no authentication. Whoever can reach the socket has full read access to the service topology, and from there full write access to everything else. The only thing protecting it is whether the socket is visible in your mount namespace or not. Let's move to the second target surface area!

## The network surface

The Unix socket is a dead end. But both containers share the `kamal` bridge network, so let's see what's reachable over TCP. First, let's confirm that the web app container can reach `kamal-proxy` at the network level:

```bash
$ docker exec xps-web-98043a3 ping -c2 kamal-proxy
PING kamal-proxy (172.18.0.3): 56 data bytes
64 bytes from 172.18.0.3: seq=0 ttl=42 time=0.067 ms
64 bytes from 172.18.0.3: seq=1 ttl=42 time=0.080 ms
```

ICMP works, let's check what `kamal-proxy` is actually listening on inside its network namespace:

```bash
$ nsenter --net --target $(docker inspect -f '{{.State.Pid}}' kamal-proxy) ss -tlnp
State    Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process
LISTEN   0       4096    127.0.0.11:42217    0.0.0.0:*          users:(("dockerd",pid=719,fd=38))
LISTEN   0       4096    *:80                *:*                users:(("kamal-proxy",pid=1129,fd=3))
LISTEN   0       4096    *:443               *:*                users:(("kamal-proxy",pid=1129,fd=6))
```

Three listeners. The `127.0.0.11:42217` entry is Docker's embedded DNS resolver. `dockerd` binds on the loopback inside the network namespace to intercept DNS queries from containers on the bridge, which is how `kamal-proxy` resolves to `172.18.0.3`. We covered this in detail in the previous post.

The two kamal-proxy listeners bind to `*`, meaning `kamal-proxy` accepts TCP connections from any address, including other containers on the same bridge network. There is no source IP filtering. Let's try connecting:

```bash
$ docker exec xps-web-98043a3 wget -O- http://172.18.0.3:80
wget: server returned error: HTTP/1.1 404 Not Found
```

TCP connects, but `404` happens because `kamal-proxy` routes by `Host` header and a request to `172.18.0.3` doesn't match any configured service. Let's use the right header:

```bash
$ docker exec xps-web-98043a3 wget -O- --header="Host: tasks.xps.one" \
  http://172.18.0.3:80
Connecting to 172.18.0.3:80 (172.18.0.3:80)
Connecting to tasks.xps.one (67.205.158.151:443)
...
{"hostname":"...","service":"Task Manager API","version":"1.0.0"}
```

See how we got redirected to HTTPS and went out through the public IP? `kamal-proxy` enforces HTTPS even for internal traffic. Containers have unrestricted outbound internet access unless egress filtering is explicitly configured. This is a Docker default rather than something Kamal specific. On my VPS hairpin NAT is also enabled, so traffic can leave the container, hit the public IP, and come back in using the real hostname:

```bash
$ docker exec xps-web-98043a3 wget -O- --no-check-certificate \
  https://tasks.xps.one/up
Connecting to tasks.xps.one (67.205.158.151:443)
ok
```

`kamal-proxy`'s HTTP ports are purely for proxying traffic, there is almost no surface over TCP. Reading the [kamal-proxy source](https://github.com/basecamp/kamal-proxy/blob/main/internal/cmd/run.go), there is one potential attack surface worth knowing about, an optional HTTP metrics port that is disabled by default.

```go
// internal/cmd/run.go
runCommand.cmd.Flags().IntVar(&globalConfig.MetricsPort, "metrics-port",
    getEnvInt("METRICS_PORT", 0),
    "Publish metrics on the specified port (default zero to disable)")
```

If enabled with `--metrics-port=9001` (or `METRICS_PORT=9001`), it opens a plain HTTP server on that port exposing Prometheus metrics with no TLS and no authentication. There are no management operations available (stop, pause, or deploy), but the endpoint serves useful information to an attacker like the Go runtime version (CVE checks), proxy metrics (deployment cadence), service names and HTTP status aggregation and error patterns. Any container on the kamal network can reach this port directly, so if you enable it, treat it like any other unauthenticated internal endpoint.

There is one more opt-in listener to account for. The `go.mod` includes `quic-go/quic-go`, which gives `kamal-proxy` HTTP/3 (QUIC) support behind the `--http3` flag. When enabled, `server.go` opens a **UDP** listener on port `443` alongside the existing TCP one. Our earlier `ss -tlnp` command used `-t` for TCP only and would have missed this listener, in order to spot it we would need `ss -ulnp` to catch it. The attack surface is the same as `TCP/443` though (requests still go through the proxy handler, not the control plane), but UDP listeners are easy to overlook in a network scan.

As we can see, the attack surface area is pretty narrow. My one practical concern is that every container on the `kamal` network can talk directly to every other container, with no proxy in the middle. This means no rate limiting, no auth header injection or IP allowlisting unless it is enforced by each application in the network. Any accessory container you add later (a Redis sidecar, a Postgres instance, a background worker) lands on that network by default as well.

We can sketch a realistic scenario for a post-RCE inside the web app container:

1. Attacker reads `/etc/resolv.conf`, sees `nameserver 127.0.0.11` and confirms they're inside a Docker network and have a live internal subnet to explore
2. Attacker reads their own IP and subnet from `ip addr`, then scans the range directly
3. Attacker connects to discovered services on their native ports directly, bypassing any controls at the proxy layer
4. With unrestricted outbound internet access, the attacker can exfiltrate data or pull down additional tooling
5. When probing internal services through `kamal-proxy`, the attacker can set a forged `X-Forwarded-For` header on their requests. The logging middleware trusts this header as the logged source address, so their activity gets attributed to a different IP in the proxy's access logs

There's also a more direct path that doesn't require any network scanning at all. Kamal injects secrets as environment variables like database credentials, API keys and third-party tokens. An attacker with RCE can read them immediately:

```bash
$ env
DATABASE_URL=postgres://app:s3cr3t@postgres:5432/app_production
REDIS_URL=redis://:password@redis:6379/0
HOSTNAME=...
KAMAL_CONTAINER_NAME=...
```

This bypasses any network-level filtering and is often the most direct path to the services you care about protecting. Not specific to Kamal, but worth keeping in mind.

Another thing worth noting is that the logging middleware records the raw query string with every request as a `query` field in the JSON log. If the application uses query parameters to carry tokens like OAuth callbacks, pre-signed URLs or webhook validation secrets, those values end up in the proxy's structured log output. This is worth factoring in when deciding where logs are stored and who can read them.

```go
// internal/server/logging_middleware.go
// ...
attrs := []slog.Attr{
    slog.String("host", r.Host),
    # ...
    slog.String("query", r.URL.RawQuery),
}
// ...
h.logger.LogAttrs(context.Background(), slog.LevelInfo, "Request", attrs...)
```

And I've truly ran out of interesting things to mention at this point. I know we didn't uncover much, but that's a good thing! My takeaway is that if you are using Kamal you should worry about the usual things instead of having to reason about new surface area exposed by the tool in the server. Things like avoiding running containers as root, mounting the Docker socket or the kamal-proxy Unix socket into other containers, and considering outbound egress filtering. These are all best practices that are Kamal independent and will serve you well in the long run.

Thanks for following this post and let me know if I missed something!
