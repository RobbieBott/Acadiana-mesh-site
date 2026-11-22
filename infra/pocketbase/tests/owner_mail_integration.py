"""Exercise the owner email feature with a fresh PocketBase container and local fixtures."""

import email
import json
import os
import pathlib
import secrets
import shutil
import socketserver
import subprocess
import tempfile
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = pathlib.Path(__file__).resolve().parents[1]
IMAGE = "acadiana-owner-mail-test"
CONTAINER = "acadiana-owner-mail-test"
URL = "http://127.0.0.1:18090"
ANALYZER = "http://127.0.0.1:18091"
ROUTE = "/api/directory/owner-mail"
PASSWORD = secrets.token_hex(16)
PEOPLE = {"siteowner": "aaaaaaaaaaaaaaa", "sender": "bbbbbbbbbbbbbbb",
          "admin": "ccccccccccccccc", "member": "ddddddddddddddd"}
REPEATER = "eeeeeeeeeeeeeee"
OBSERVER = "fffffffffffffff"
ACTIVE = "1" * 64
DEVICE = "2" * 64
messages = []
signals = {"broken": False, "repeater": 30, "observer": 30}
FIXTURE = r"""
onBootstrap((e) => {
  e.next();
  const app = e.app;
  const settings = app.settings();
  const limits = JSON.parse(JSON.stringify(settings.rateLimits));
  for (const rule of limits.rules) rule.maxRequests = 100;
  unmarshal({rateLimits:limits,smtp:{enabled:true,host:"127.0.0.1",port:18025,tls:false},
    meta:{senderName:"Acadiana Mesh",senderAddress:"staging@example.com"}},settings);
  app.save(settings);
  if (app.findRecordsByFilter("users", "id = 'aaaaaaaaaaaaaaa'", "", 1, 0).length) return;

  const users = app.findCollectionByNameOrId("users");
  for (const [name,id] of Object.entries({siteowner:"aaaaaaaaaaaaaaa",sender:"bbbbbbbbbbbbbbb",admin:"ccccccccccccccc",member:"ddddddddddddddd"})) {
    const record = new Record(users);
    record.id = id;
    record.set("name",name);
    record.set("role",name === "member" ? "user" : "admin");
    record.setEmail(name+"@example.com");
    record.setVerified(true);
    record.setPassword($os.getenv("STAGE_PASSWORD"));
    app.save(record);
  }
  const repeater = new Record(app.findCollectionByNameOrId("repeaters"));
  repeater.id = "eeeeeeeeeeeeeee";
  repeater.set("name","Fixture Repeater");
  repeater.set("status","Online");
  repeater.set("owner_name","Fixture");
  repeater.set("public_key","2".repeat(64));
  repeater.set("managers",["ddddddddddddddd"]);
  app.save(repeater);
  const observer = new Record(app.findCollectionByNameOrId("managed_observers"));
  observer.id = "fffffffffffffff";
  observer.set("observer_id","test-observer");
  observer.set("observer_name","Fixture Observer");
  observer.set("managers",["ddddddddddddddd"]);
  app.save(observer);
});
routerAdd("POST", "/test/run", (e) => {
  if (e.auth.id !== "aaaaaaaaaaaaaaa") throw new ForbiddenError("Fixtures only.");
  const body = e.requestInfo().body;
  const job = body.job;
  if (job === "queue") require(__hooks + "/owner_mail.js").processQueue(e.app);
  else if (job === "age") {
    for (const state of e.app.findAllRecords("owner_offline_state")) {
      state.set("last_seen", body.lastSeen);
      e.app.save(state);
    }
  } else {
    try { require(__hooks + "/owner_offline.js").check(e.app); }
    catch (error) { return e.json(503, {message: String(error)}); }
  }
  return e.json(200,{});
}, $apis.requireAuth("users"));
"""


def last(hours):
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()


class Analyzer(BaseHTTPRequestHandler):
    def do_GET(self):
        if signals["broken"]:
            self.send_error(503)
            return
        if self.path == "/api/observers":
            data = {"observers": [{"id": "healthy", "name": "Unassigned live observer", "iata": "LFT", "last_seen": last(0)},
                                  {"id": "test-observer", "iata": "LFT", "last_seen": last(signals["observer"])}]}
        else:
            data = {"nodes": [{"role": "repeater", "public_key": ACTIVE, "last_heard": last(0)},
                              {"role": "repeater", "public_key": DEVICE, "last_heard": last(signals["repeater"])}]}
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, *_args):
        pass


class SMTP(socketserver.StreamRequestHandler):
    def handle(self):
        self.wfile.write(b"220 test SMTP\r\n")
        while line := self.rfile.readline():
            command = line.split(maxsplit=1)[0].upper()
            if command == b"DATA":
                self.wfile.write(b"354 Send data\r\n")
                raw = bytearray()
                while row := self.rfile.readline():
                    if row == b".\r\n":
                        break
                    raw.extend(row)
                messages.append(email.message_from_bytes(raw))
                self.wfile.write(b"250 Accepted\r\n")
            elif command == b"QUIT":
                self.wfile.write(b"221 Bye\r\n")
                return
            else:
                self.wfile.write(b"250 OK\r\n")


def api(path, token="", body=None, method=None, expected=200):
    headers = {"Content-Type": "application/json", "Authorization": token}
    request = Request(URL + path, headers=headers, method=method, data=None if body is None else json.dumps(body).encode())
    try:
        with urlopen(request, timeout=25) as response:
            code, raw = response.status, response.read()
    except HTTPError as exc:
        code, raw = exc.code, exc.read()
    result = json.loads(raw) if raw else None
    assert code == expected, (path, expected, code, result)
    return result


def login(name):
    return api("/api/collections/users/auth-with-password", body={
        "identity": name + "@example.com", "password": PASSWORD
    })["token"]


def docker(*args, **kwargs):
    return subprocess.run(["docker", *args], check=True, **kwargs)


def stop():
    subprocess.run(["docker", "rm", "-f", CONTAINER], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def start(folder, mode):
    stop()
    env = dict(os.environ, STAGE_PASSWORD=PASSWORD)
    docker("run", "-d", "--name", CONTAINER, "--network", "host", "-e", "STAGE_PASSWORD",
           "-e", "ANALYZER_URL=" + ANALYZER, "-e", "DIRECTORY_SITE_OWNER_ID=" + PEOPLE["siteowner"],
           "-e", "OWNER_OFFLINE_ALERTS=" + mode, "-v", f"{folder}/data:/pb/pb_data",
           "-v", f"{folder}/hooks:/pb/test_hooks:ro", IMAGE, "/pb/pocketbase", "serve",
           "--http=127.0.0.1:18090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations",
           "--hooksDir=/pb/test_hooks", "--automigrate=false", env=env, stdout=subprocess.DEVNULL)
    for _ in range(40):
        try:
            api("/api/health")
            return
        except URLError:
            time.sleep(0.25)
    raise RuntimeError("PocketBase failed to start")


def run(folder):
    start(folder, "log")
    owner, sender, admin, member = [login(name) for name in PEOPLE]
    assert api(ROUTE + "/access", owner) == {"owner": True, "sender": True}
    assert api(ROUTE + "/access", admin) == {"owner": False, "sender": False}
    api(ROUTE, admin, expected=403)
    api(ROUTE, member, expected=403)
    grant = {"id": PEOPLE["sender"], "enabled": True}
    api(ROUTE + "/permissions", admin, grant, expected=403)
    api(ROUTE + "/permissions", owner, grant)
    assert api(ROUTE + "/access", sender)["sender"]
    for target in ["siteowner", "sender"]:
        api("/api/collections/users/records/" + PEOPLE[target], admin,
            {"name": "Unauthorized edit"}, "PATCH", expected=403)
    api("/api/collections/users/records/" + PEOPLE["siteowner"], admin, method="DELETE", expected=403)
    api("/api/collections/owner_mail_deliveries/records", sender, expected=403)
    api(ROUTE + "/templates", member, expected=403)
    templates = api(ROUTE + "/templates", sender)
    assert set(templates) == {"general", "network", "maintenance"}
    assert all("acadianamesh.com/assets/images/logo.png" in html for html in templates.values())
    assert "SF9 to SF7" in templates["network"] and "antenna cable" in templates["maintenance"]
    catalog = api(ROUTE, sender)
    assert len(catalog["devices"]) == 2 and len(catalog["owners"]) == 1
    assert "@example.com" not in json.dumps(catalog)
    print("Verified permission delegation, protected accounts and private recipient addresses", flush=True)

    draft = {"scope": "all", "template": "network", "subject": "SF9 to SF7 test", "message": "<b>Literal text</b>"}
    preview = api(ROUTE + "/preview", sender, draft)
    assert preview["count"] == 1
    assert "&lt;b&gt;" in preview["html"] and "<b>Literal text</b>" not in preview["html"]
    for scope, ids in [("owners", [PEOPLE["member"]]), ("devices", ["observer:" + OBSERVER]), ("repeater", []), ("observer", [])]:
        assert api(ROUTE + "/preview", sender, dict(draft, scope=scope, ids=ids))["count"] == 1
    job = dict(draft, requestId=str(uuid.uuid4()), fingerprint=preview["fingerprint"])
    api(ROUTE + "/send", sender, dict(job, fingerprint="different"), expected=400)
    first = api(ROUTE + "/send", sender, job, expected=202)
    assert api(ROUTE + "/send", sender, job, expected=202) == first
    api("/test/run", owner, {"job": "queue"})
    assert len(messages) == 1 and messages[0]["To"] == "member@example.com"
    assert messages[0].is_multipart()
    history = api(ROUTE, owner)["history"][0]
    assert history["counts"]["accepted"] == 1 and len(history["devices"]) == 2
    api(ROUTE + "/permissions", owner, dict(grant, enabled=False))
    api(ROUTE + "/send", sender, job, expected=403)
    print("Verified every audience, safe preview, duplicate prevention, SMTP delivery and revocation", flush=True)

    api("/test/run", owner, {"job": "offline"})
    assert len(api(ROUTE, owner)["history"]) == 1
    assert len(messages) == 1
    start(folder, "send")
    owner, member = login("siteowner"), login("member")
    api("/test/run", owner, {"job": "offline"})
    assert len(api(ROUTE, owner)["history"]) == 1
    signals.update(repeater=0, observer=0)
    api("/test/run", owner, {"job": "offline"})
    pause = "/api/collections/managed_observers/records/" + OBSERVER
    api(pause, member, {"offline_pause_until": last(-4)}, "PATCH")
    signals.update(repeater=30, observer=30, broken=True)
    api("/test/run", owner, {"job": "offline"}, expected=503)
    assert len(api(ROUTE, owner)["history"]) == 1
    signals.update(broken=False)
    # Advance the time since the simulated recovery without changing the feed clock.
    api("/test/run", owner, {"job": "age", "lastSeen": last(30)})
    api("/test/run", owner, {"job": "offline"})
    api("/test/run", owner, {"job": "offline"})
    history = api(ROUTE, owner)["history"]
    assert len(history) == 2 and "Fixture Repeater" in history[0]["subject"]
    api(pause, member, {"offline_pause_until": ""}, "PATCH")
    api("/test/run", owner, {"job": "offline"})
    api("/test/run", owner, {"job": "queue"})
    assert len(messages) == 3 and any("Fixture Observer" in msg["Subject"] for msg in messages)
    print("Verified log-only mode, recovery, stale-feed suppression, maintenance pause and one alert per outage", flush=True)

    assign = "/api/directory/people/" + PEOPLE["member"] + "/observers"
    api(assign, member, {"add": ["healthy"], "remove": []}, expected=403)
    api(assign, owner, {"add": ["missing"], "remove": []}, expected=400)
    api(assign, owner, {"add": ["healthy"], "remove": []})
    api(assign, owner, {"add": ["healthy"], "remove": []})
    rows = api("/api/collections/managed_observers/records", member)["items"]
    assert len(rows) == 2
    new = next(record for record in rows if record["observer_id"] == "healthy")
    assert new["observer_name"] == "Unassigned live observer" and new["region"] == "LFT"
    assert new["managers"] == [PEOPLE["member"]]
    api("/api/directory/people/" + PEOPLE["admin"] + "/observers", owner, {"add": ["healthy"], "remove": []})
    api(assign, owner, {"add": [], "remove": ["healthy"]})
    after = api("/api/collections/managed_observers/records/" + new["id"], owner)
    assert after["managers"] == [PEOPLE["admin"]]
    print("Verified admin-only observer assignment, canonical registration, and preserving other managers", flush=True)

    url = "https://example.com/maintenance?region=LFT&week=2"
    for invalid in ["javascript:alert(1)", "//example.com", "https://example.com@wrong.example.com", "https://example.com/white space"]:
        api(ROUTE + "/preview", owner, dict(draft, buttonMode="custom", buttonUrl=invalid), expected=400)
    payloads = [
        dict(draft, subject="Custom test button", buttonMode="custom", buttonUrl=url),
        dict(draft, subject="Hidden test button", buttonMode="hidden"),
    ]
    for payload in payloads:
        preview = api(ROUTE + "/preview", owner, payload)
        if payload["buttonMode"] == "hidden":
            assert "data-owner-mail-button" not in preview["html"]
        else:
            assert "data-owner-mail-button" in preview["html"] and "region=LFT&amp;week=2" in preview["html"]
        job = dict(payload, requestId=str(uuid.uuid4()), fingerprint=preview["fingerprint"])
        if payload["buttonMode"] == "custom":
            api(ROUTE + "/send", owner, dict(job, buttonUrl="https://example.com/changed"), expected=400)
        api(ROUTE + "/send", owner, job, expected=202)
    api("/test/run", owner, {"job": "queue"})
    for payload in payloads:
        message = next(msg for msg in messages if msg["Subject"] == payload["subject"])
        parts = {part.get_content_type(): part.get_payload(decode=True).decode() for part in message.get_payload()}
        if payload["buttonMode"] == "hidden":
            assert "data-owner-mail-button" not in parts["text/html"]
            assert "https://" not in parts["text/plain"]
        else:
            assert "region=LFT&amp;week=2" in parts["text/html"]
            assert url in parts["text/plain"]
    print("Verified default, custom and hidden buttons, URL validation, and final SMTP content", flush=True)


if __name__ == "__main__":
    docker("build", "-q", "-t", IMAGE, str(ROOT))
    with tempfile.TemporaryDirectory() as tmp, ThreadingHTTPServer(("127.0.0.1", 18091), Analyzer) as feed, \
            socketserver.ThreadingTCPServer(("127.0.0.1", 18025), SMTP) as smtp:
        for server in [feed, smtp]:
            threading.Thread(target=server.serve_forever, daemon=True).start()
        folder = pathlib.Path(tmp)
        (folder / "data").mkdir()
        shutil.copytree(ROOT / "pb_hooks", folder / "hooks")
        (folder / "hooks" / "zz_owner_mail_fixture.pb.js").write_text(FIXTURE)
        try:
            docker("run", "--rm", "--network", "host", "-e", "ANALYZER_URL=" + ANALYZER,
                   "-v", f"{folder}/data:/pb/pb_data", IMAGE, "/pb/pocketbase", "migrate", "up",
                   "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks",
                   "--automigrate=false")
            run(folder)
        except Exception:
            subprocess.run(["docker", "logs", CONTAINER], check=False)
            raise
        finally:
            stop()
            feed.shutdown()
            smtp.shutdown()
