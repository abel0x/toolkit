/* TOOLKIT — assets/js/tools/port-reference.js
   Common network ports and what uses them, and what a port number means:
   its IANA range, whether Unix keeps it for root, whether systems hand it
   out for outgoing connections, and whether browsers refuse it. A web page
   cannot see which ports are open on this computer, so it shows commands. */
(function initPortReference() {
  'use strict';

  const queryEl = document.getElementById('portQuery');
  const categoryEl = document.getElementById('portCategory');
  const infoEl = document.getElementById('portInfo');
  const countEl = document.getElementById('portCount');
  const rowsEl = document.getElementById('portRows');
  const commandsEl = document.getElementById('portCommands');
  if (!queryEl || !rowsEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  // [port, last port of a range or 0, protocol, service, category, use]
  const PORTS = [
    [0, 0, "TCP/UDP", "Reserved", "network", "Not used on the wire; asking the system for port 0 means “any free port”"],
    [7, 0, "TCP/UDP", "Echo", "network", "Sends back whatever it receives; old test service"],
    [9, 0, "TCP/UDP", "Discard", "network", "Throws away whatever it receives; old test service, also Wake-on-LAN"],
    [20, 0, "TCP", "FTP data", "files", "FTP file transfers in active mode"],
    [21, 0, "TCP", "FTP", "files", "FTP commands (login, listing); unencrypted"],
    [22, 0, "TCP", "SSH", "remote", "Secure shell, SFTP, SCP and Git over SSH"],
    [23, 0, "TCP", "Telnet", "remote", "Remote terminal without encryption; still found on network devices"],
    [25, 0, "TCP", "SMTP", "mail", "Mail between mail servers; often blocked by home internet providers"],
    [53, 0, "TCP/UDP", "DNS", "network", "Domain name lookups"],
    [67, 0, "UDP", "DHCP server", "network", "Hands out IP addresses on a local network"],
    [68, 0, "UDP", "DHCP client", "network", "Device side of DHCP"],
    [69, 0, "UDP", "TFTP", "files", "Simple file transfer for network boot and device firmware"],
    [80, 0, "TCP", "HTTP", "web", "Web pages without encryption; usually redirects to 443"],
    [88, 0, "TCP/UDP", "Kerberos", "network", "Kerberos sign-in (Active Directory)"],
    [110, 0, "TCP", "POP3", "mail", "Downloading mail, without encryption"],
    [111, 0, "TCP/UDP", "RPC port mapper", "files", "Finds ONC RPC services such as NFS"],
    [119, 0, "TCP", "NNTP", "messaging", "Usenet news"],
    [123, 0, "UDP", "NTP", "network", "Clock synchronisation"],
    [135, 0, "TCP", "Microsoft RPC", "network", "Windows RPC endpoint mapper"],
    [137, 0, "UDP", "NetBIOS name", "files", "Old Windows name service"],
    [138, 0, "UDP", "NetBIOS datagram", "files", "Old Windows network browsing"],
    [139, 0, "TCP", "NetBIOS session", "files", "Old Windows file sharing (SMB over NetBIOS)"],
    [143, 0, "TCP", "IMAP", "mail", "Reading mail on the server, with STARTTLS"],
    [161, 0, "UDP", "SNMP", "infra", "Monitoring network devices"],
    [162, 0, "UDP", "SNMP traps", "infra", "Alerts sent by network devices"],
    [179, 0, "TCP", "BGP", "network", "Routing between internet providers"],
    [389, 0, "TCP/UDP", "LDAP", "network", "Directory lookups (Active Directory, OpenLDAP)"],
    [443, 0, "TCP", "HTTPS", "web", "Web pages over TLS"],
    [443, 0, "UDP", "HTTP/3", "web", "HTTP/3 over QUIC"],
    [445, 0, "TCP", "SMB", "files", "Windows file and printer sharing, Samba"],
    [465, 0, "TCP", "SMTP over TLS", "mail", "Sending mail from an app, TLS from the start"],
    [500, 0, "UDP", "IKE", "network", "IPsec VPN key exchange"],
    [514, 0, "UDP", "Syslog", "infra", "System logs sent over the network"],
    [515, 0, "TCP", "LPD", "network", "Old network printing"],
    [546, 0, "UDP", "DHCPv6 client", "network", "Device side of DHCP for IPv6"],
    [547, 0, "UDP", "DHCPv6 server", "network", "Hands out IPv6 addresses"],
    [548, 0, "TCP", "AFP", "files", "Apple file sharing (older Macs, Time Machine)"],
    [554, 0, "TCP/UDP", "RTSP", "messaging", "Video streaming, often from IP cameras"],
    [587, 0, "TCP", "SMTP submission", "mail", "Sending mail from an app, with STARTTLS"],
    [631, 0, "TCP/UDP", "IPP", "network", "Network printing (CUPS, AirPrint)"],
    [636, 0, "TCP", "LDAPS", "network", "LDAP over TLS"],
    [853, 0, "TCP/UDP", "DNS over TLS", "network", "Encrypted DNS (DoT on TCP, DoQ on UDP)"],
    [873, 0, "TCP", "rsync", "files", "rsync daemon"],
    [989, 0, "TCP", "FTPS data", "files", "FTP over TLS, file transfers"],
    [990, 0, "TCP", "FTPS", "files", "FTP over TLS, commands"],
    [993, 0, "TCP", "IMAPS", "mail", "Reading mail over TLS"],
    [995, 0, "TCP", "POP3S", "mail", "Downloading mail over TLS"],
    [1025, 0, "TCP", "Mailpit SMTP", "dev", "Catches test mail on a development machine (MailHog, Mailpit)"],
    [1080, 0, "TCP", "SOCKS", "network", "SOCKS proxy, including ssh -D"],
    [1194, 0, "TCP/UDP", "OpenVPN", "network", "OpenVPN tunnels"],
    [1433, 0, "TCP", "SQL Server", "database", "Microsoft SQL Server"],
    [1434, 0, "UDP", "SQL Server Browser", "database", "Finds named SQL Server instances"],
    [1521, 0, "TCP", "Oracle Database", "database", "Oracle Database listener"],
    [1701, 0, "UDP", "L2TP", "network", "L2TP VPN, usually with IPsec"],
    [1723, 0, "TCP", "PPTP", "network", "Outdated VPN, not secure"],
    [1812, 0, "UDP", "RADIUS", "network", "Network sign-in (Wi-Fi WPA Enterprise, VPN)"],
    [1813, 0, "UDP", "RADIUS accounting", "network", "Usage records for RADIUS"],
    [1883, 0, "TCP", "MQTT", "messaging", "Messages between IoT devices"],
    [1900, 0, "UDP", "SSDP", "network", "UPnP device discovery"],
    [2049, 0, "TCP/UDP", "NFS", "files", "Network file system"],
    [2181, 0, "TCP", "ZooKeeper", "infra", "ZooKeeper clients"],
    [2375, 0, "TCP", "Docker API", "infra", "Docker daemon without TLS; never expose it"],
    [2376, 0, "TCP", "Docker API (TLS)", "infra", "Docker daemon over TLS"],
    [2377, 0, "TCP", "Docker Swarm", "infra", "Swarm cluster management"],
    [2379, 0, "TCP", "etcd", "infra", "etcd clients (Kubernetes state)"],
    [2380, 0, "TCP", "etcd peers", "infra", "Traffic between etcd members"],
    [3000, 0, "TCP", "Dev server", "dev", "Node.js and Express, Rails, Grafana, Next.js"],
    [3074, 0, "TCP/UDP", "Xbox network", "games", "Xbox online play"],
    [3128, 0, "TCP", "Squid", "network", "Squid web proxy"],
    [3306, 0, "TCP", "MySQL", "database", "MySQL and MariaDB"],
    [3389, 0, "TCP/UDP", "RDP", "remote", "Windows Remote Desktop"],
    [3478, 0, "TCP/UDP", "STUN/TURN", "messaging", "Connecting WebRTC calls through routers"],
    [3690, 0, "TCP", "Subversion", "dev", "svn:// repositories"],
    [4000, 0, "TCP", "Dev server", "dev", "Jekyll and Phoenix"],
    [4200, 0, "TCP", "Angular dev server", "dev", "ng serve"],
    [4222, 0, "TCP", "NATS", "infra", "NATS messaging clients"],
    [4317, 0, "TCP", "OTLP gRPC", "infra", "OpenTelemetry traces and metrics over gRPC"],
    [4318, 0, "TCP", "OTLP HTTP", "infra", "OpenTelemetry traces and metrics over HTTP"],
    [4369, 0, "TCP", "EPMD", "infra", "Erlang port mapper (RabbitMQ clusters)"],
    [5000, 0, "TCP", "Dev server", "dev", "Flask; on macOS the AirPlay receiver also uses it"],
    [5005, 0, "TCP", "Java debugger", "dev", "Common JDWP debug port"],
    [5060, 0, "TCP/UDP", "SIP", "messaging", "Internet phone calls (VoIP)"],
    [5061, 0, "TCP", "SIP over TLS", "messaging", "Encrypted VoIP signalling"],
    [5173, 0, "TCP", "Vite dev server", "dev", "vite and npm run dev"],
    [5222, 0, "TCP", "XMPP", "messaging", "XMPP (Jabber) chat clients"],
    [5269, 0, "TCP", "XMPP server", "messaging", "XMPP between servers"],
    [5349, 0, "TCP", "TURN over TLS", "messaging", "Encrypted STUN/TURN"],
    [5353, 0, "UDP", "mDNS", "network", "Local names and discovery (Bonjour, Avahi, .local)"],
    [5355, 0, "UDP", "LLMNR", "network", "Windows local name lookups"],
    [5432, 0, "TCP", "PostgreSQL", "database", "PostgreSQL"],
    [5500, 0, "TCP", "Live Server", "dev", "VS Code Live Server extension"],
    [5601, 0, "TCP", "Kibana", "infra", "Kibana dashboards"],
    [5672, 0, "TCP", "AMQP", "infra", "RabbitMQ and other AMQP brokers"],
    [5900, 0, "TCP", "VNC", "remote", "Screen sharing (VNC, macOS Screen Sharing)"],
    [5938, 0, "TCP/UDP", "TeamViewer", "remote", "TeamViewer remote control"],
    [5984, 0, "TCP", "CouchDB", "database", "CouchDB HTTP API"],
    [6000, 0, "TCP", "X11", "remote", "X Window System display"],
    [6006, 0, "TCP", "TensorBoard", "dev", "TensorBoard"],
    [6379, 0, "TCP", "Redis", "database", "Redis and Valkey"],
    [6443, 0, "TCP", "Kubernetes API", "infra", "Kubernetes API server"],
    [6665, 6669, "TCP", "IRC", "messaging", "IRC chat"],
    [6697, 0, "TCP", "IRC over TLS", "messaging", "Encrypted IRC chat"],
    [6881, 6889, "TCP/UDP", "BitTorrent", "files", "Traditional BitTorrent ports"],
    [8000, 0, "TCP", "Dev server", "dev", "Django runserver, python -m http.server"],
    [8008, 0, "TCP", "Alternative HTTP", "web", "HTTP on a second port"],
    [8025, 0, "TCP", "Mailpit web", "dev", "Web page for caught test mail (MailHog, Mailpit)"],
    [8080, 0, "TCP", "Alternative HTTP", "web", "Tomcat, Jenkins, proxies and many dev servers"],
    [8086, 0, "TCP", "InfluxDB", "database", "InfluxDB HTTP API"],
    [8200, 0, "TCP", "Vault", "infra", "HashiCorp Vault"],
    [8443, 0, "TCP", "Alternative HTTPS", "web", "HTTPS on a second port, admin panels"],
    [8500, 0, "TCP", "Consul", "infra", "HashiCorp Consul HTTP API"],
    [8883, 0, "TCP", "MQTT over TLS", "messaging", "Encrypted MQTT"],
    [8888, 0, "TCP", "Jupyter", "dev", "Jupyter Notebook and JupyterLab"],
    [9000, 0, "TCP", "PHP-FPM", "dev", "PHP-FPM; also SonarQube and MinIO"],
    [9042, 0, "TCP", "Cassandra", "database", "Cassandra CQL clients"],
    [9090, 0, "TCP", "Prometheus", "infra", "Prometheus server"],
    [9092, 0, "TCP", "Kafka", "infra", "Kafka brokers"],
    [9100, 0, "TCP", "JetDirect", "network", "Raw network printing; also the Prometheus node exporter"],
    [9200, 0, "TCP", "Elasticsearch", "database", "Elasticsearch and OpenSearch HTTP API"],
    [9229, 0, "TCP", "Node.js inspector", "dev", "node --inspect debugger"],
    [9418, 0, "TCP", "Git", "dev", "git:// repositories"],
    [10000, 0, "TCP", "Webmin", "infra", "Webmin server administration"],
    [11211, 0, "TCP/UDP", "Memcached", "database", "Memcached; never expose UDP to the internet"],
    [11434, 0, "TCP", "Ollama", "dev", "Ollama local model API"],
    [16686, 0, "TCP", "Jaeger", "infra", "Jaeger tracing web page"],
    [19132, 0, "UDP", "Minecraft Bedrock", "games", "Minecraft Bedrock Edition servers"],
    [25565, 0, "TCP", "Minecraft", "games", "Minecraft Java Edition servers"],
    [27015, 0, "TCP/UDP", "Steam game servers", "games", "Source engine and Steam dedicated servers"],
    [27017, 0, "TCP", "MongoDB", "database", "MongoDB"],
    [51820, 0, "UDP", "WireGuard", "network", "WireGuard VPN (common default)"]
  ].map(([port, to, protocol, service, category, use]) => ({ port, to: to || port, protocol, service, category, use }));

  // Fetch standard "bad ports": browsers refuse http(s) requests to them.
  const BLOCKED = new Set([0, 1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);

  const CATEGORIES = { web: 'Web', mail: 'Mail', files: 'Files and sharing', remote: 'Remote access', database: 'Databases',
    dev: 'Development', network: 'Network', messaging: 'Messaging and calls', infra: 'Servers and monitoring', games: 'Games' };

  const blockedIn = (entry) => { for (let port = entry.port; port <= entry.to; port += 1) if (BLOCKED.has(port)) return true; return false; };

  // Everything a port number says on its own.
  function describe(port) {
    if (!Number.isInteger(port) || port < 0 || port > 65535) return null;
    return {
      port,
      range: port === 0 ? 'reserved' : port < 1024 ? 'system' : port < 49152 ? 'user' : 'dynamic',
      privileged: port > 0 && port < 1024,
      linuxEphemeral: port >= 32768 && port <= 60999,
      windowsEphemeral: port >= 49152,
      blocked: BLOCKED.has(port),
      services: PORTS.filter((entry) => port >= entry.port && port <= entry.to)
    };
  }

  // Entries that match a number (exactly, or inside a range) or words.
  function search(query, category) {
    const text = query.trim().toLowerCase();
    const number = /^\d+$/.test(text) ? Number(text) : null;
    return PORTS.filter((entry) => (!category || entry.category === category) && (!text
      || (number !== null ? number >= entry.port && number <= entry.to
        : `${entry.service} ${entry.use} ${t(entry.use)} ${entry.protocol} ${CATEGORIES[entry.category]} ${t(CATEGORIES[entry.category])}`.toLowerCase().includes(text))));
  }

  const portLabel = (entry) => (entry.to !== entry.port ? `${entry.port}–${entry.to}` : String(entry.port));

  function cell(text, className) {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function badge(text, kind) {
    const span = document.createElement('span');
    span.className = `port-badge port-badge--${kind}`;
    span.textContent = t(text);
    return span;
  }

  function renderRows(list) {
    rowsEl.replaceChildren(...list.map((entry) => {
      const row = document.createElement('tr');
      const notes = document.createElement('td');
      if (entry.port > 0 && entry.port < 1024) notes.append(badge('Root on Linux', 'root'));
      if (blockedIn(entry)) notes.append(badge('Blocked in browsers', 'blocked'));
      row.append(cell(portLabel(entry), 'font-mono port-number'), cell(entry.protocol, 'font-mono'), cell(entry.service, 'port-service'),
        cell(t(entry.use)), notes);
      row.cells[0].dataset.i18nSkip = '';
      row.cells[1].dataset.i18nSkip = '';
      row.cells[2].dataset.i18nSkip = '';
      return row;
    }));
    // An empty table would show only its header.
    document.getElementById('portTable').hidden = !list.length;
    countEl.textContent = list.length === 1 ? t('1 port') : t(`${list.length} ports`);
  }

  function line(text, kind) {
    const item = document.createElement('li');
    item.className = `port-fact port-fact--${kind}`;
    item.textContent = text;
    return item;
  }

  function renderInfo(info) {
    if (!info) { infoEl.hidden = true; infoEl.replaceChildren(); return; }
    const heading = document.createElement('h2');
    heading.className = 'port-info__title';
    heading.textContent = `${t('Port')} ${info.port}`;
    const list = document.createElement('ul');
    list.className = 'port-facts';
    const RANGES = {
      reserved: 'Reserved: never used for a connection. A program that asks to listen on port 0 gets a free port chosen by the system.',
      system: 'System port (0–1023): assigned by IANA to well-known services.',
      user: 'User port (1024–49151): registered with IANA for a service, or free to use.',
      dynamic: 'Dynamic port (49152–65535): never assigned; meant for short-lived connections.'
    };
    list.append(line(t(RANGES[info.range]), 'neutral'));
    if (info.privileged) list.append(line(t('Linux and BSD: only root, or a program with CAP_NET_BIND_SERVICE, may listen on it. macOS and Windows let any user.'), 'warn'));
    else if (info.port > 0) list.append(line(t('Any user may listen on it.'), 'ok'));
    if (info.linuxEphemeral || info.windowsEphemeral) {
      const systems = [info.linuxEphemeral && 'Linux', info.windowsEphemeral && 'Windows', info.windowsEphemeral && 'macOS'].filter(Boolean).join(', ');
      list.append(line(`${t('Used for outgoing connections by default on:')} ${systems}. ${t('A server here can clash with them.')}`, 'warn'));
    }
    list.append(info.blocked
      ? line(t('Browsers refuse to open http:// or https:// addresses on this port; pick another one for a web server.'), 'bad')
      : line(t('Browsers can open web addresses on this port.'), 'ok'));
    if (!info.services.length && info.port > 0) list.append(line(t('No common service in this list uses it.'), 'neutral'));
    infoEl.replaceChildren(heading, list);
    infoEl.dataset.i18nSkip = '';
    infoEl.hidden = false;
  }

  function renderCommands(port) {
    const value = port === null || port === undefined ? 8080 : port;
    const commands = [['Linux', `ss -ltnup 'sport = :${value}'`], ['macOS', `lsof -nP -iTCP:${value} -sTCP:LISTEN`], ['Windows', `netstat -ano | findstr :${value}`]];
    commandsEl.replaceChildren(...commands.map(([system, command]) => {
      const row = document.createElement('tr');
      const code = document.createElement('code');
      code.textContent = command;
      const td = document.createElement('td');
      td.append(code);
      row.append(cell(system), td);
      row.cells[0].dataset.i18nSkip = '';
      td.dataset.i18nSkip = '';
      return row;
    }));
  }

  function render() {
    const text = queryEl.value.trim();
    const number = /^\d+$/.test(text) ? Number(text) : null;
    const info = number === null ? null : describe(number);
    if (number !== null && !info) {
      infoEl.hidden = false;
      infoEl.replaceChildren(line(t('Ports go from 0 to 65535.'), 'bad'));
      infoEl.dataset.i18nSkip = '';
    } else renderInfo(info);
    renderRows(search(text, categoryEl.value));
    renderCommands(info ? info.port : null);
  }

  categoryEl.replaceChildren(...[['', 'All kinds'], ...Object.entries(CATEGORIES)].map(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = t(label);
    return option;
  }));

  queryEl.addEventListener('input', render);
  categoryEl.addEventListener('change', render);
  window.addEventListener('toolkit:languagechange', () => {
    const selected = categoryEl.value;
    [...categoryEl.options].forEach((option) => { option.textContent = t(option.value ? CATEGORIES[option.value] : 'All kinds'); });
    categoryEl.value = selected;
    render();
  });

  // Exposed for the tests.
  window.ToolkitPorts = Object.freeze({ describe, search, blocked: BLOCKED });
  render();
}());
