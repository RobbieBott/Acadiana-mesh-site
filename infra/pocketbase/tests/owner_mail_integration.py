"""Exercise the owner email feature with a fresh PocketBase container and local fixtures."""

import email
from email.utils import parseaddr
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
  else if (job === "queue-offline-fixture") require(__hooks + "/owner_mail.js").addBatch(e.app, "queued-offline-fixture", "offline", {
    subject: "Cancelled fixture email", message: "This should be cancelled.", template: "offline"
  }, {scope:"observer", emails:["member@example.com"], targets:[]});
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
                                  {"id": "edit-only", "name": "Editor fixture", "iata": "LFT", "last_seen": last(0)},
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
    assert api(ROUTE + "/access", owner)["owner"] and api(ROUTE + "/access", owner)["sender"]
    assert not api(ROUTE + "/access", admin)["owner"] and not api(ROUTE + "/access", admin)["sender"]
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

    register = "/api/directory/observers"
    listing = {"observer_id": "healthy", "display_name": "New observer listing", "notes": "A test listing"}
    api(register, body=listing, expected=401)
    api(register, member, listing, expected=403)
    api(register, owner, dict(listing, observer_id="missing"), expected=400)
    api(register, owner, dict(listing, observer_name="Spoofed"), expected=400)
    saved = api(register, owner, listing, expected=201)
    assert saved["observer_name"] == "Unassigned live observer" and saved["region"] == "LFT"
    assert saved["display_name"] == listing["display_name"] and saved["notes"] == listing["notes"]
    assert not saved["managers"]
    api(register, owner, dict(listing, display_name="Do not overwrite"), expected=400)
    assert api("/api/collections/managed_observers/records/" + saved["id"], owner)["display_name"] == listing["display_name"]

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
        dict(draft, subject="Custom test button", buttonMode="custom", buttonUrl=url, signature="Thanks,\n<Mesh Team>"),
        dict(draft, subject="Hidden test button", buttonMode="hidden", signature="Thanks,\n<Mesh Team>"),
    ]
    for payload in payloads:
        preview = api(ROUTE + "/preview", owner, payload)
        if payload["buttonMode"] == "hidden":
            assert "data-owner-mail-button" not in preview["html"]
        else:
            assert "data-owner-mail-button" in preview["html"] and "region=LFT&amp;week=2" in preview["html"]
        assert 'Thanks,<br>&lt;Mesh Team&gt;' in preview["html"]
        if payload["buttonMode"] == "custom":
            assert preview["html"].index('data-owner-mail-signature') < preview["html"].index('data-owner-mail-button')
        job = dict(payload, requestId=str(uuid.uuid4()), fingerprint=preview["fingerprint"])
        api(ROUTE + "/send", owner, dict(job, signature="changed after review"), expected=400)
        if payload["buttonMode"] == "custom":
            api(ROUTE + "/send", owner, dict(job, buttonUrl="https://example.com/changed"), expected=400)
        api(ROUTE + "/send", owner, job, expected=202)
    api("/test/run", owner, {"job": "queue"})
    for payload in payloads:
        message = next(msg for msg in messages if msg["Subject"] == payload["subject"])
        parts = {part.get_content_type(): part.get_payload(decode=True).decode()
                 for part in message.walk() if part.get_content_type() in {"text/html", "text/plain"}}
        assert 'Thanks,<br>&lt;Mesh Team&gt;' in parts["text/html"]
        assert "Thanks,\n<Mesh Team>" in parts["text/plain"].replace("\r\n","\n")
        if payload["buttonMode"] == "hidden":
            assert "data-owner-mail-button" not in parts["text/html"]
            assert "https://" not in parts["text/plain"]
        else:
            assert "region=LFT&amp;week=2" in parts["text/html"]
            assert url in parts["text/plain"]
    api(ROUTE + "/preview", owner, dict(draft, signature="x" * 501), expected=400)
    print("Verified button variants, signature placement and escaping, and final SMTP content", flush=True)

    permissions = "/api/directory/permissions"
    accounts = api(permissions, owner)["accounts"]
    assert next(row for row in accounts if row["id"] == PEOPLE["siteowner"])["owner"]
    api(permissions, admin, expected=403)
    api(permissions, member, expected=403)
    mail_only = {"id": PEOPLE["member"], "enabled": True, "previousEnabled": False, "previousRole": "user"}
    api(permissions, admin, mail_only, "PATCH", expected=403)
    api(permissions, owner, mail_only, "PATCH")
    api(permissions, owner, mail_only, "PATCH", expected=400)
    assert not api(ROUTE + "/access", member)["owner"] and api(ROUTE + "/access", member)["sender"]
    assert api(ROUTE + "/preview", member, dict(draft, scope="owners", ids=[PEOPLE["member"]]))["count"] == 1
    api("/api/directory/sync", member, {}, expected=403)
    api("/api/directory/sync", member, expected=403)
    sync_route = "/api/directory/sync"
    startup = api(sync_route, owner)["completedAt"]
    assert startup
    manual = api(sync_route, owner, {})["completedAt"]
    stored = api(sync_route, owner)["completedAt"]
    as_time = lambda value: datetime.fromisoformat(value.replace("Z", "+00:00"))
    assert as_time(stored) >= as_time(startup)
    assert abs((as_time(stored) - as_time(manual)).total_seconds()) < 2
    signals["broken"] = True
    try:
        api(sync_route, owner, {}, expected=502)
        assert api(sync_route, owner)["completedAt"] == stored
    finally:
        signals["broken"] = False
    api(permissions, member, {"id": PEOPLE["member"], "role": "admin"}, "PATCH", expected=403)
    api(permissions, owner, {"id": PEOPLE["member"], "enabled": False}, "PATCH")
    api(ROUTE, member, expected=403)

    users = "/api/collections/users/records"
    target = users + "/" + PEOPLE["member"]
    api(target, admin, {"name": "Updated directory profile"}, "PATCH")
    api(target, admin, {"role": "admin"}, "PATCH", expected=403)
    api(target, admin, {"email": "changed@example.com"}, "PATCH", expected=403)
    api(target, admin, {"verified": False}, "PATCH", expected=403)
    api(target, admin, method="DELETE", expected=403)
    api("/api/collections/repeaters/records/" + REPEATER, admin, method="DELETE", expected=403)
    api("/api/collections/managed_observers/records/" + OBSERVER, admin, method="DELETE", expected=403)
    signup = {"email": "new@example.com", "name": "New user", "role": "admin", "password": PASSWORD,
              "passwordConfirm": PASSWORD}
    api(users, admin, signup, expected=403)
    created = api(users, admin, dict(signup, role="user", verified=True))
    assert created["role"] == "user" and not created["verified"]
    assert api(permissions, owner, {"id": created["id"], "role": "admin"}, "PATCH")["accounts"]
    assert api(users + "/" + created["id"], owner)["role"] == "admin"
    api(permissions, owner, {"id": PEOPLE["siteowner"], "role": "user"}, "PATCH", expected=400)
    api(permissions, owner, {"id": PEOPLE["member"], "overrides": {"approve_observer_claims": True}}, "PATCH")
    assert api(ROUTE + "/access", member)["staff"] == ["approve_observer_claims"]
    assert api("/api/collections/users/records", member)["totalItems"] == 1
    api("/api/directory/assignment-people", member, expected=403)
    api("/api/directory/sync", member, {}, expected=403)
    repeater_claim = api("/api/collections/claims/records", body={
        "repeater": REPEATER, "name": "Guest repeater claimant", "email": "repeaterclaim@example.com"
    })
    assert api("/api/collections/claims/records", member)["totalItems"] == 0
    api("/api/directory/claims/" + repeater_claim["id"] + "/approve", member, {}, expected=403)
    observer_claim = api("/api/collections/observer_claims/records", body={
        "observer_id": "healthy", "name": "Guest observer claimant", "email": "observerclaim@example.com"
    })
    assert api("/api/collections/observer_claims/records", member)["totalItems"] == 1
    api("/api/directory/observer-claims/" + observer_claim["id"] + "/approve", member, {})
    api(permissions, owner, {"id": PEOPLE["admin"], "overrides": {"sync_corescope": False}}, "PATCH")
    api("/api/directory/sync", admin, {}, expected=403)
    assert "edit_repeaters" in api(ROUTE + "/access", admin)["staff"]
    api(permissions, owner, {"id": PEOPLE["member"], "overrides": {"assign_repeaters": True}}, "PATCH")
    roster = api("/api/directory/assignment-people", member)["people"]
    assert all("email" not in entry and "role" not in entry for entry in roster)
    api(permissions, owner, {"id": PEOPLE["member"], "overrides": {"read_prefixes": True}}, "PATCH")
    assert api(ROUTE + "/access", member)["staff"] == ["read_prefixes"]
    api(register, member, listing, expected=403)
    api(permissions, owner, {"id": PEOPLE["member"], "overrides": {"edit_observers": True}}, "PATCH")
    api(register, member, dict(listing, managers=[PEOPLE["member"]]), expected=403)
    edit_only = api(register, member, dict(listing, observer_id="edit-only"), expected=201)
    assert not edit_only["managers"] and edit_only["observer_name"] == "Editor fixture"
    print("Verified isolated observer approval, Admin blocks, narrow assignment roster, and registration access", flush=True)

    observer_record = "/api/collections/managed_observers/records/" + OBSERVER
    public_observer = "/api/collections/managed_observers_public/records/" + OBSERVER
    api(target, member, {"name": "Profile owner", "callsign": "KJ5XYZ", "phone": "555-0100", "discord": "private-name"}, "PATCH")
    api(observer_record, member, {"contact_from": PEOPLE["admin"]}, "PATCH", expected=400)
    api(observer_record, member, {"contact_from": PEOPLE["member"], "show_phone": True, "show_email": True}, "PATCH")
    public = api(public_observer)
    assert public["public_owner"] == "Profile owner" and public["owner_callsign"] == "KJ5XYZ"
    assert public["phone"] == "555-0100" and not public["discord"] and public["can_message"]
    assert "member@example.com" not in json.dumps(public) and "contact_from" not in public
    api(target, member, {"name": "Updated observer owner", "phone": "555-0123"}, "PATCH")
    public = api(public_observer)
    assert public["public_owner"] == "Updated observer owner" and public["phone"] == "555-0123"
    visitor = {"observer": OBSERVER, "name": "Fixture visitor", "email": "visitor@example.com",
               "message": "Hello, I have a question about this observer."}
    api("/api/directory/message", body=visitor)
    assert parseaddr(messages[-1]["To"])[1] == "member@example.com" and messages[-1]["Reply-To"] == "visitor@example.com"
    api(observer_record, member, {"show_phone": False, "show_email": False, "show_discord": True}, "PATCH")
    public = api(public_observer)
    assert not public["phone"] and not public["can_message"] and public["discord"] == "private-name"
    api("/api/directory/message", body=visitor, expected=400)
    api(assign, owner, {"add": [], "remove": ["test-observer"]})
    assert not api(observer_record, owner)["contact_from"]
    assert not api(public_observer)["discord"]
    print("Verified observer profile updates, visibility, private relay, and removing the linked manager", flush=True)

    activity = "/api/directory/activity"
    api(activity, expected=401)
    api(activity, member, expected=403)
    api(activity, method="DELETE", expected=401)
    api(activity, member, method="DELETE", expected=403)
    api(activity, admin, method="DELETE", expected=403)
    api(activity + "/preview-status", admin, {}, expected=403)
    api(activity + "/status-emails", admin, {"enabled": False, "previous": True}, "PATCH", expected=403)
    api(activity + "/preview-status", member, {}, expected=403)
    api(activity + "/status-emails", member, {"enabled": False, "previous": True}, "PATCH", expected=403)
    api("/api/collections/directory_activity/records", owner, expected=403)
    assert api(activity, owner)["enabled"]
    mail_before = len(messages)
    assert isinstance(api(activity + "/preview-status", owner, {})["count"], int)
    assert len(messages) == mail_before
    preview_events = api(activity + "?category=status&q=Ran%20status%20preview", owner)["events"]
    assert any(event["action"] == "Ran status preview" for event in preview_events)
    api("/test/run", owner, {"job": "queue-offline-fixture"})
    assert not api(activity + "/status-emails", owner, {"enabled": False, "previous": True}, "PATCH")["enabled"]
    api(activity + "/status-emails", owner, {"enabled": True, "previous": True}, "PATCH", expected=400)
    assert api(ROUTE, owner)["history"][0]["counts"]["cancelled"] == 1
    api("/test/run", owner, {"job": "queue"})
    assert len(messages) == mail_before
    assert api(activity + "/status-emails", owner, {"enabled": True, "previous": False}, "PATCH")["enabled"]
    api(activity + "/status-emails", owner, {"enabled": False, "previous": True}, "PATCH")

    api("/api/collections/users/request-password-reset", owner, {"email": "member@example.com"}, expected=204)
    for _ in range(40):
        if len(messages) > mail_before:
            break
        time.sleep(0.1)
    assert len(messages) == mail_before + 1
    api("/api/collections/prefixes/records", body={"code":"D13A", "label":"Fixture assignment",
        "reserved_by_name":"Fixture guest", "reserved_by_email":"guest@example.com"}, expected=200)
    for _ in range(40):
        if len(messages) > mail_before + 1:
            break
        time.sleep(0.1)
    assert len(messages) == mail_before + 2
    for msg in messages:
        html = next(part.get_payload(decode=True).decode() for part in msg.walk() if part.get_content_type() == "text/html")
        assert html.count("data-acadiana-mail") == 1, msg["Subject"]
        assert all(not key.lower().startswith("x-acadiana-internal-") for key in msg.keys()), msg.keys()

    events = api(activity + "?category=email", owner)["events"]
    assert any(e["action"] == "Owner notice email" and e["actorId"] == PEOPLE["sender"] and "Accepted" in e["detail"] for e in events)
    assert any(e["action"] == "Password setup or reset" and e["targetId"] == PEOPLE["member"] for e in events)
    assert any(e["action"] == "Prefix reservation confirmation" for e in events)
    assert any(e["action"] == "Message to device owner" for e in events)
    edits = api(activity + "?category=changes&q=phone", owner)["events"]
    assert any(e["actorId"] == PEOPLE["member"] and e["action"] == "Updated account" for e in edits)
    admin_activity = api(activity + "?category=changes&q=phone", admin)
    assert admin_activity["events"] == edits and "enabled" not in admin_activity
    serialized = json.dumps(events + edits)
    assert not any(secret in serialized for secret in ["visitor@example.com", "member@example.com", "555-0123", visitor["message"]])
    print("Verified private audit events, attribution, shared mail styling, status preview, toggle and queue cancellation", flush=True)

    delivery_history = api(ROUTE, owner)["history"]
    api(activity, owner, method="DELETE", expected=204)
    cleared = api(activity, admin)["events"]
    assert len(cleared) == 1 and cleared[0]["action"] == "Cleared activity log" and cleared[0]["actorId"] == PEOPLE["siteowner"]
    assert api(activity, owner)["enabled"] is False
    assert api(ROUTE, owner)["history"] == delivery_history
    print("Verified read-only Admin access and Site Owner-only clearing with an audit entry", flush=True)

    api(permissions + "/" + PEOPLE["member"] + "/email", admin,
        {"email": "changed@example.com", "previousEmail": "member@example.com"}, "PATCH", expected=403)
    api(permissions + "/" + PEOPLE["member"] + "/email", owner,
        {"email": "changed@example.com", "previousEmail": "member@example.com"}, "PATCH")
    changed = api(target, owner)
    assert changed["email"] == "changed@example.com" and not changed["verified"]
    api(ROUTE + "/access", member, expected=401)
    api(users + "/" + created["id"], owner, method="DELETE", expected=204)
    api("/api/collections/managed_observers/records/" + OBSERVER, owner, method="DELETE", expected=204)
    print("Verified independent email grants, Site Owner-only role and identity changes, and deletion limits", flush=True)


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
