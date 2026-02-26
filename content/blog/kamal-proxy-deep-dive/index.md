---
title: kamal-proxy deep dive
date: "2026-02-25T18:00:00.284Z"
description: "An exploration on how kamal-proxy works under the hood."
---

I've started experimenting with [Kamal](https://kamal-deploy.org/) in order to deploy web applications to my DigitalOcean VPS. It is a pretty opinionated tool that sits on top of Docker and allows you to deploy without downtime. It relies on a [proxy](https://kamal-deploy.org/docs/configuration/proxy/) named `kamal-proxy` to interface with the web application, which is what allows the tool to perform gapless deploys and rollbacks. I've read the bare minimum amount of documentation in order to deploy my application, but thought it would be an interesting exercise to inspect what `kamal-proxy` does under the hood. I will be using my currently deployed application as we perform the deep dive.

## Exploration

The first thing to notice is that `kamal-proxy` runs as a container side-by-side to our application:

```bash
$ docker ps
CONTAINER ID   IMAGE                         COMMAND             CREATED        STATUS                  PORTS                                                                          NAMES
c11a984b98e8   kaeros/xps:46b447e            "/app/server"       20 hours ago   Up 20 hours (healthy)   8080/tcp                                                                       xps-web-46b447e
b9958b81313c   basecamp/kamal-proxy:v0.9.0   "kamal-proxy run"   20 hours ago   Up 20 hours             0.0.0.0:80->80/tcp, [::]:80->80/tcp, 0.0.0.0:443->443/tcp, [::]:443->443/tcp   kamal-proxy
```

### Networking

Our application exposes port `8080` while `kamal-proxy` binds to every interface on ports `80` and `443`.

We can use `docker inspect kamal-proxy` to learn more about the container configuration and confirm our thought process. For example, what is the command being executed by the container? Which ports is it binding to?

```bash
$ docker inspect kamal-proxy | jq '.[0].Config.Cmd'
[
  "kamal-proxy",
  "run"
]

$ docker inspect kamal-proxy | jq '.[0].HostConfig.PortBindings'
{
  "443/tcp": [
    {
      "HostIp": "",
      "HostPort": "443"
    }
  ],
  "80/tcp": [
    {
      "HostIp": "",
      "HostPort": "80"
    }
  ]
}
```

Notice how the `kamal-proxy` container is running a binary called `kamal-proxy`. This will help us in the future. Another interesting thing to confirm is that both our `web application` and `kamal-proxy` share the same network ID:

```bash
$ docker inspect kamal-proxy | jq '.[0].NetworkSettings.Networks.kamal.NetworkID'
"ee31959bc2474fff68ea97e6ec162052982bd61d5ae24731fbcb8b3f87fdea72"
$ docker inspect c11a984b98e8 | jq '.[0].NetworkSettings.Networks.kamal.NetworkID'
"ee31959bc2474fff68ea97e6ec162052982bd61d5ae24731fbcb8b3f87fdea72"
 ```

We can inspect this network by doing:

```bash
$ docker network inspect ee31959bc2474fff68ea97e6ec162052982bd61d5ae24731fbcb8b3f87fdea72
[
    {
        "Name": "kamal",
        "Id": "ee31959bc2474fff68ea97e6ec162052982bd61d5ae24731fbcb8b3f87fdea72",
        "Created": "2026-02-25T03:48:00.949931206Z",
        "Scope": "local",
        "Driver": "bridge",
        "EnableIPv4": true,
        "EnableIPv6": false,
        "IPAM": {
            "Driver": "default",
            "Options": {},
            "Config": [
                {
                    "Subnet": "172.18.0.0/16",
                    "Gateway": "172.18.0.1"
                }
            ]
        },
        # ...
        "Containers": {
            "b9958b81313ca466bfb55a5e97cdef16123ddab4c8443d37e8c88282ed19be7e": {
                "Name": "kamal-proxy",
                "EndpointID": "b7b61aa9003e31101b2e224bce4cd6078d592baf108c2bf7371e39136a59631a",
                "MacAddress": "8a:1c:8b:54:0a:ba",
                "IPv4Address": "172.18.0.2/16",
                "IPv6Address": ""
            },
            "c11a984b98e89b3e461c90c17988fdd2345d4d02eead8f7dadb155818642be4d": {
                "Name": "xps-web-46b447e",
                "EndpointID": "2dce046a356d81e034268ab22f7bc933cfee8044f783ddcefc0d181259c84f76",
                "MacAddress": "6a:39:d0:75:3b:0b",
                "IPv4Address": "172.18.0.3/16",
                "IPv6Address": ""
            }
        },
        "Status": {
            "IPAM": {
                "Subnets": {
                    "172.18.0.0/16": {
                        "IPsInUse": 5,
                        "DynamicIPsAvailable": 65531
                    }
                }
            }
        }
```

Both containers are on the same private Docker bridge network called `kamal`. This means that `kamal-proxy` doesn't reach our web application through our host's public IP or localhost, instead it uses the internal network using Docker's built-in DNS. This is the reason our web application doesn't need to publish port `8080` on the host.

Through `ip link show` we can see that the bridge network exists at the kernel level:

```bash
$ ip link show
# ...
5: br-ee31959bc247: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default
    link/ether 2e:5e:52:ec:df:0d brd ff:ff:ff:ff:ff:ff
# ...
```

Running `ip addr show` with the bridge's interface confirms that it acts as the `gateway` for both containers with the associated IP being `172.18.0.1/16`.

```bash
ip addr show br-ee31959bc247
5: br-ee31959bc247: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 2e:5e:52:ec:df:0d brd ff:ff:ff:ff:ff:ff
    inet 172.18.0.1/16 brd 172.18.255.255 scope global br-ee31959bc247
       valid_lft forever preferred_lft forever
    inet6 fe80::2c5e:52ff:feec:df0d/64 scope link
       valid_lft forever preferred_lft forever
```

Each container should be "plugged" into the bridge. This happens through [veth](https://man7.org/linux/man-pages/man4/veth.4.html) pairs (virtual ethernet cables). Let's inspect that:

```bash
$ ip link show | grep -A1 veth

6: vethec5fa95@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue master br-ee31959bc247 state UP mode DEFAULT group default
    link/ether fe:df:5a:20:3e:5a brd ff:ff:ff:ff:ff:ff link-netnsid 0
7: vethf226152@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue master br-ee31959bc247 state UP mode DEFAULT group default
    link/ether be:96:a0:9d:e9:a5 brd ff:ff:ff:ff:ff:ff link-netnsid 1
```

Two things of notice. First, both `veth` pairs are `@if2`, which means they are connected to the second interface in the [namespace](https://man7.org/linux/man-pages/man7/namespaces.7.html) container network stack. Second, see that `master` is `br-ee31959bc247`? That's our bridge! Let's check the other side of one of our veth pairs inside `kamal-proxy` container namespace by using [nsenter](https://man7.org/linux/man-pages/man1/nsenter.1.html):

```bash
$ nsenter --net --target $(docker inspect -f '{{.State.Pid}}' kamal-proxy) ip addr show

# ...
2: eth0@if6: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 8a:1c:8b:54:0a:ba brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.18.0.2/16 brd 172.18.255.255 scope global eth0
       valid_lft forever preferred_lft forever
```

See how our second interface has the IP `172.18.0.2`? That's exactly what the output from `docker network inspect` printed. Let's also inspect the routes within our `kamal-proxy` container to see how it is linked to the gateway:

```bash
$ nsenter --net --target $(docker inspect -f '{{.State.Pid}}' kamal-proxy) ip route show
default via 172.18.0.1 dev eth0
172.18.0.0/16 dev eth0 proto kernel scope link src 172.18.0.2
```

See how the default gateway is `172.18.0.1`? That's our bridge again! How does a packet coming from the internet make it to the bridge though? That's the job of the routing table!

```bash
$ iptables -t nat -L -n --line-numbers
Chain PREROUTING (policy ACCEPT)
num  target     prot opt source               destination
1    DOCKER     0    --  0.0.0.0/0            0.0.0.0/0            ADDRTYPE match dst-type LOCAL

Chain INPUT (policy ACCEPT)
num  target     prot opt source               destination

Chain OUTPUT (policy ACCEPT)
num  target     prot opt source               destination
1    DOCKER     0    --  0.0.0.0/0           !127.0.0.0/8          ADDRTYPE match dst-type LOCAL

Chain POSTROUTING (policy ACCEPT)
num  target     prot opt source               destination
1    MASQUERADE  0    --  172.18.0.0/16        0.0.0.0/0
2    MASQUERADE  0    --  172.17.0.0/16        0.0.0.0/0

Chain DOCKER (2 references)
num  target     prot opt source               destination
1    DNAT       6    --  0.0.0.0/0            0.0.0.0/0            tcp dpt:80 to:172.18.0.2:80
2    DNAT       6    --  0.0.0.0/0            0.0.0.0/0            tcp dpt:443 to:172.18.0.2:443
```

This can be pretty overwhelming, so let's break it down:

1. `PREROUTING` handles packets as they arrive, rule `1` sends any packet destined for a local address into the `DOCKER chain` for inspection.
2. We make it to `DOCKER chain`, here we have two rules:
    - Any packets arriving at port `80` gets DNAT'd (Destination NAT) to `172.18.0.2:80`, which is kamal-proxy's IP.
    - The same thing happens, but for port `443`


DNAT rewrites the destination IP of the packet before it's forwarded. So a packet arriving from the internet destined for `67.205.158.151:443` gets its destination rewritten to `172.18.0.2:443` and sent into the `bridge` network. The original sender never knows this happened.

What about packets _leaving the container_?

1. `POSTROUTING` handles packets just before leaving the host:
    - In `1`, any packet from `172.18.0.0/16` going anywhere gets `MASQUERADE'd`, as in, its source IP is rewritten to the host's public IP. This is how container traffic appears to come from the VPS when it reaches the internet.

### New deploys

We know how the network is configured, but how does `kamal-proxy` handle a new deploy without downtime though? The first part of the magic is that during deploys the container for `kamal-proxy` remains stable, but how does it know to reach the newly deployed container rather than the old one?

In order to do this I've triggered a deploy and dug through logs, because why not? The first thing to notice is the new output for `docker ps`:

```bash
$ docker ps
CONTAINER ID   IMAGE                         COMMAND             CREATED          STATUS                    PORTS                                                                          NAMES
dfdee429978c   kaeros/xps:98043a3            "/app/server"       11 minutes ago   Up 11 minutes (healthy)   8080/tcp                                                                       xps-web-98043a3
b9958b81313c   basecamp/kamal-proxy:v0.9.0   "kamal-proxy run"   23 hours ago     Up 23 hours               0.0.0.0:80->80/tcp, [::]:80->80/tcp, 0.0.0.0:443->443/tcp, [::]:443->443/tcp   kamal-proxy
```

Armed with the container ID, we can investigate our logs:

```bash
$ docker logs kamal-proxy --since 1h 2>/dev/null | grep "dfdee429978c"
# ...
{"time":"2026-02-26T02:26:33.849624737Z","level":"INFO","msg":"Request","host":"tasks.xps.one","port":443,"path":"/up","request_id":"146c65d1-9f6f-4584-83bb-6d75f274b5ae","status":200,"service":"xps-web","target":"dfdee429978c:8080","duration":560366,"method":"GET","req_content_length":0,"req_content_type":"","resp_content_length":2,"resp_content_type":"text/plain; charset=utf-8","client_addr":"66.130.127.41","client_port":"64586","remote_addr":"66.130.127.41","user_agent":"curl/8.7.1","proto":"HTTP/2.0","scheme":"https","query":"","req_cache_control":"","req_last_modified":"","req_user_agent":"curl/8.7.1"}
```

Notice the `"target":"dfdee429978c:8080"`. That's not an IP address, it's a container ID prefix and a port. Docker DNS resolves `dfdee429978c` to whatever IP that container has on the kamal network. Let's look inside the `kamal-proxy` network namespace to see how that DNS interception actually works:

```bash
$ nsenter --net --target $(docker inspect -f '{{.State.Pid}}' kamal-proxy) \
  iptables -t nat -L -n
Chain PREROUTING (policy ACCEPT)
target     prot opt source               destination

Chain INPUT (policy ACCEPT)
target     prot opt source               destination

Chain OUTPUT (policy ACCEPT)
target     prot opt source               destination
DOCKER_OUTPUT  0    --  0.0.0.0/0            127.0.0.11

Chain POSTROUTING (policy ACCEPT)
target     prot opt source               destination
DOCKER_POSTROUTING  0    --  0.0.0.0/0            127.0.0.11

Chain DOCKER_OUTPUT (1 references)
target     prot opt source               destination
DNAT       6    --  0.0.0.0/0            127.0.0.11           tcp dpt:53 to:127.0.0.11:39291
DNAT       17   --  0.0.0.0/0            127.0.0.11           udp dpt:53 to:127.0.0.11:57361

Chain DOCKER_POSTROUTING (1 references)
target     prot opt source               destination
SNAT       6    --  127.0.0.11           0.0.0.0/0            tcp spt:39291 to::53
SNAT       17   --  127.0.0.11           0.0.0.0/0            udp spt:57361 to::53
```

In order to understand these rules it's important to know that Docker's embedded DNS resolver runs at 127.0.0.11 inside every container's network namespace. Let's see what these rules are doing:

`DOCKER_OUTPUT` intercepts outgoing DNS queries:
- TCP port 53 → redirected to 127.0.0.11:39291
- UDP port 53 → redirected to 127.0.0.11:57361

Any process inside this namespace that tries to query DNS on port 53 gets silently redirected to dockerd's actual listening ports. The process never knows.

`DOCKER_POSTROUTING` is the return path, it rewrites the source port back to 53 on the way out:
- Responses from 127.0.0.11:39291 → source rewritten to port 53
- Responses from 127.0.0.11:57361 → source rewritten to port 53

But this still doesn't explain how `kamal-proxy` knows about the new container! Let's inspect the binary itself:

```bash
$ docker exec kamal-proxy kamal-proxy deploy --help
Deploy a target host
# ...
--target strings  Target host(s) to deploy
# ...
```

Turns out `kamal-proxy` is told about the container instead of figuring it out!

```bash
$ docker exec kamal-proxy kamal-proxy list
Service  Host           Path  Target             State    TLS
xps-web  tasks.xps.one  /     dfdee429978c:8080  running  yes
```

See how our target is the existing container? Pretty cool! So who tells `kamal-proxy` about the container and how? A common pattern in these systems is to use a unix [socket](https://man7.org/linux/man-pages/man2/socket.2.html) to communicate with a process, do we have one of those?

```bash
$ cat /proc/$(docker inspect -f '{{.State.Pid}}' kamal-proxy)/net/unix
Num       RefCount Protocol Flags    Type St Inode Path
00000000790abc7c: 00000002 00000000 00010000 0001 01 18782 /tmp/kamal-proxy.sock
```

Bingo! `proc/<pid>/net/` shows the network state from inside the process's network namespace, including sockets. Since we are interested in unix sockets, we ran `/proc/<pid>/net/unix` to find it. This is the path as seen from inside the container's filesystem. To access it from the host we need to find it through the overlay filesystem:

```bash
$ find /var/lib/docker -name "kamal-proxy.sock" 2>/dev/null
/var/lib/docker/rootfs/overlayfs/b9958b81313ca466bfb55a5e97cdef16123ddab4c8443d37e8c88282ed19be7e/tmp/kamal-proxy.sock
```

There we have it! Can we use something like [socat](https://linux.die.net/man/1/socat) to intercept the traffic going through it? In order to do it we will have to put a proxy in front of Kamal's proxy and then trigger a re-deploy. How fun is that?!

```bash
$ cd /var/lib/docker/rootfs/overlayfs/b9958b81313ca466bfb55a5e97cdef16123ddab4c8443d37e8c88282ed19be7e/tmp/ 

# Move the real socket aside
mv kamal-proxy.sock kamal-proxy.sock.real

# Create the intercepting proxy
socat -v \
  UNIX-LISTEN:kamal-proxy.sock,fork,reuseaddr,mode=777 \
  UNIX-CONNECT:kamal-proxy.sock.real \
  2>&1 | tee /tmp/socket-traffic.log
> 2026/02/26 04:01:02.000725236  length=1024 from=0 to=1023
.....\aRequest.......\rServiceMethod.\f...Seq..........kamal-proxy.Deploy........
DeployArgs.....\a.\aService.\f..
TargetURLs.....
ReaderURLs.....\rDeployTimeout....\fDrainTimeout.....ServiceOptions.....\rTargetOptions............\b[]string.....\f...........ServiceOptions.....\f..Hosts.....\fPathPrefixes.....
TLSEnabled.....TLSCertificatePath.\f...TLSPrivateKeyPath.\f..\vTLSRedirect....\rACMEDirectory.\f..\rACMECachePath.\f..\rErrorPagePath.\f..\vStripPrefix.....WriterAffinityTimeout.....ReadTargetsAcceptWebsockets............\rTargetOptions.....
..HealthCheckConfig......ResponseTimeout.....BufferRequests.....BufferResponses.....MaxMemoryBufferSize.....MaxRequestBodySize.....MaxResponseBodySize.....LogRequestHeaders......LogResponseHeaders......ForwardHeaders.....A......HealthCheckConfig........Path.\f..\bInterval....\aTimeout..........\axps-web...13e21e3cada6:8080..\r.GX...\r.GX....\rtasks.xps.one.../.....+/home/kamal-proxy/.config/kamal-proxy/certs.....e......../up..........T\v.....\r.GX....... ....\rCache-Control\rLast-Modified
User-Agent..< 2026/02/26 04:01:02.000744785  length=86 from=0 to=85
9....\bResponse.......\rServiceMethod.\f...Seq.....Error.\f........kamal-proxy.Deploy.....
```

It seems like `kamal-proxy` communicates through RPC. More importantly, can you spot the new container ID in there? Here it is! `13e21e3cada6:8080`. And if we run `docker ps` again:

```bash
$ docker ps
CONTAINER ID   IMAGE                         COMMAND             CREATED         STATUS                   PORTS                                                                          NAMES
13e21e3cada6   kaeros/xps:98043a3            "/app/server"       4 minutes ago   Up 4 minutes (healthy)   8080/tcp                                                                       xps-web-98043a3
b9958b81313c   basecamp/kamal-proxy:v0.9.0   "kamal-proxy run"   24 hours ago    Up About an hour         0.0.0.0:80->80/tcp, [::]:80->80/tcp, 0.0.0.0:443->443/tcp, [::]:443->443/tcp   kamal-proxy
```

The container IDs match! Very neat.

We are getting to the end here. The `image` used by Kamal is deterministic since in my case every deploy uses `git rev-parse --short HEAD` as a tag:

```bash
$ git rev-parse --short HEAD
98043a3
```

See how it matches `kaeros/xps:98043a3`? Kamal uses the git SHA as the image tag, then after starting the new container it gets the container ID from Docker's API and passes that to `kamal-proxy`. We can apply the same socat interception technique to the Docker socket itself in order to learn which commands Kamal is running since it SSHs into our server:

```bash
$ ls -la /var/run/docker.sock
srw-rw---- 1 root docker 0 Feb 26 03:00 /var/run/docker.sock

# Move it aside and proxy it
mv /var/run/docker.sock /var/run/docker.sock.real

socat -v \
  UNIX-LISTEN:/var/run/docker.sock,fork,reuseaddr,mode=777 \
  UNIX-CONNECT:/var/run/docker.sock.real \
  2>&1 | tee /tmp/docker-socket-traffic.log

# ...
HEAD /_ping HTTP/1.1\r
Host: api.moby.localhost\r
User-Agent: Docker-Client/29.2.1 (linux)\r
\r
< 2026/02/26 04:18:53.000758423  length=316 from=0 to=315
HTTP/1.1 200 OK\r
Api-Version: 1.53\r
Builder-Version: 2\r
Cache-Control: no-cache, no-store, must-revalidate\r
Content-Length: 0\r
Content-Type: text/plain; charset=utf-8\r
Docker-Experimental: false\r
Ostype: linux\r
Pragma: no-cache\r
Server: Docker/29.2.1 (linux)\r
Swarm: inactive\r
Date: Thu, 26 Feb 2026 04:18:53 GMT\r
\r
> 2026/02/26 04:18:53.000764740  length=128 from=92 to=219
# ...
# waaay more requests
# ...
```

And this clears any doubt of what is happening:

1. Pull the new image
```bash
DELETE /v1.53/images/kaeros/xps:98043a3   ← remove stale local copy
POST   /v1.53/images/create?fromImage=kaeros/xps&tag=98043a3  ← pull fresh from Docker Hub
GET    /v1.53/images/kaeros/xps:98043a3/json  ← inspect the image
```

2. Ensure infrastructure exists
```bash
POST /v1.53/networks/create {"Name":"kamal"...}
GET  /v1.53/containers/kamal-proxy/json
POST /v1.53/containers/kamal-proxy/start
```

3. Find and rename the old container
```bash
GET  /v1.53/containers/json?filters={"label":{"service=xps","role=web"...}}
POST /v1.53/containers/xps-web-98043a3/rename?name=xps-web-98043a3_replaced_4c73fa88
```

4. Create and start the new container
```bash
POST /v1.53/containers/create?name=xps-web-98043a3
{
  "Image": "kaeros/xps:98043a3",
  "Labels": {"destination":"","role":"web","service":"xps"},
  "Env": ["KAMAL_VERSION=98043a3", "KAMAL_CONTAINER_NAME=xps-web-98043a3"...],
  "Memory": 268435456,      ← 256MB limit from deploy.yml
  "NanoCpus": 1000000000,   ← 1 CPU limit
  "SecurityOpt": ["no-new-privileges:true"]
}
POST /v1.53/containers/7c001501e3ca/start
```

5. Tell kamal-proxy about the new container
```bash
POST /v1.53/containers/kamal-proxy/exec
{
  "Cmd": [
    "kamal-proxy", "deploy", "xps-web",
    "--target=7c001501e3ca:8080",   ← new container ID, first 12 chars
    "--host=tasks.xps.one",
    "--tls",
    "--health-check-path=/up",
    "--buffer-requests",
    "--buffer-responses"
    ...
  ]
}
```

6. Stop the old container
```bash
POST /v1.53/containers/13e21e3cada6/stop
```

7. Cleanup
```bash
POST /v1.53/images/kaeros/xps:98043a3/tag?repo=kaeros/xps&tag=latest
POST /v1.53/images/prune?filters={"dangling":true,"label":{"service=xps"}}
GET  /v1.53/containers/json?filters={"label":{"service=xps"},"status":{"exited"}}
```

Before quitting, let's quickly see how `kamal-proxy` stores its state.

### Mounts

```bash
$ docker inspect kamal-proxy | jq '.[0].Mounts'
[
  {
    "Type": "volume",
    "Name": "kamal-proxy-config",
    "Source": "/var/lib/docker/volumes/kamal-proxy-config/_data",
    "Destination": "/home/kamal-proxy/.config/kamal-proxy",
    "Driver": "local",
    "Mode": "z",
    "RW": true,
    "Propagation": ""
  },
  {
    "Type": "bind",
    "Source": "/home/deploy/.kamal/proxy/apps-config",
    "Destination": "/home/kamal-proxy/.apps-config",
    "Mode": "",
    "RW": true,
    "Propagation": "rprivate"
  }
]
```

Let's dig into these:

```bash
$ find /var/lib/docker/volumes/kamal-proxy-config/_data -type f
/var/lib/docker/volumes/kamal-proxy-config/_data/certs/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855/tasks.xps.one
/var/lib/docker/volumes/kamal-proxy-config/_data/certs/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855/acme_account+key
/var/lib/docker/volumes/kamal-proxy-config/_data/kamal-proxy.state
```

That `kamal-proxy.state` looks interesting!

```bash
$ cat /var/lib/docker/volumes/kamal-proxy-config/_data/kamal-proxy.state | jq .[
  {
    "name": "xps-web",
    # ...
    "active_targets": [
      "dfdee429978c:8080"
    ],
     # ...
  }
]
```

`active_targets` has our new container ID! Let's re-deploy and see how this file changes:

```bash
$ watch -n0.5 'cat /var/lib/docker/volumes/kamal-proxy-config/_data/kamal-proxy.state | jq .'

# ...
"active_targets": [
      "00b4e865ec54:8080" # Changed!
]
# ...
```

So this is how `kamal-proxy` keeps the current state of the system.

This was an interesting journey with lots of dead ends. As the reader you have the privilege of walking on the paved path instead of blindly stumbling through the infrastructure like I did. If you feel like I missed something or things are unclear, give me a shout! See you next time.
