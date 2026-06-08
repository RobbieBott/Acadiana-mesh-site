---
layout: page
title: Channels — Acadiana Mesh Communication Groups
description: Browse Acadiana Mesh channels including #acadiana, #lafayette, #emergency, and #wx. Learn how MeshCore hashtag channels, region scopes, and encrypted messaging work.
permalink: /channels/
---

<style>
.channel-qr {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #2e2e2e;
  text-align: center;
}
.channel-qr img {
  background: #ffffff;
  padding: 6px;
  border-radius: 6px;
  width: 130px;
  height: 130px;
  display: block;
  margin: 0 auto 6px;
}
.channel-qr-label {
  font-size: 11px;
  color: #666666;
  letter-spacing: 0.3px;
}
.channel-commands {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #2e2e2e;
}
.channel-commands-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888888;
  margin-bottom: 8px;
}
.channel-commands table {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}
.channel-commands td {
  padding: 4px 6px;
  vertical-align: top;
}
.channel-commands td:first-child {
  white-space: nowrap;
  color: #f94d00;
  font-family: monospace;
  font-size: 13px;
}
.channel-commands td:last-child {
  color: #aaaaaa;
}
.channel-note {
  font-size: 12px;
  color: #666666;
  margin-top: 8px;
  font-style: italic;
}
.wx-examples {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #2e2e2e;
}
.wx-examples-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888888;
  margin-bottom: 8px;
}
.wx-example {
  font-family: monospace;
  font-size: 12px;
  color: #cccccc;
  background: #111111;
  border-radius: 4px;
  padding: 5px 8px;
  margin-bottom: 5px;
}
.channel-card-full {
  grid-column: 1 / -1;
}
.two-col-commands {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.two-col-commands table {
  flex: 1;
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}
.two-col-commands td {
  padding: 4px 6px;
  vertical-align: top;
}
.two-col-commands td:first-child {
  white-space: nowrap;
  color: #f94d00;
  font-family: monospace;
  font-size: 13px;
}
.two-col-commands td:last-child {
  color: #aaaaaa;
}
</style>

Channels are how groups communicate on the Acadiana Mesh network. Each channel has a shared encryption key that allows members to send and receive messages.

## Core Channels
<div class="channel-grid">
  <div class="channel-card">
    <div class="channel-name">Public</div>
    <p>General chat for all mesh users. Uses a well-known or built in shared key.</p>
    <div class="channel-region-label">Key Type</div>
    <span class="channel-region">Built-In</span>
    <div class="channel-region-label">Region Scope</div>
    <span class="channel-region">No Region Scope</span>
    <div class="channel-qr">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=meshcore%3A%2F%2Fchannel%2Fadd%3Fname%3DPublic%26secret%3D8b3387e9c5cdea6ac9e5edbaa115cd72" alt="QR code for Public channel" />
      <div class="channel-qr-label">Scan to add channel</div>
    </div>
  </div>
  <div class="channel-card">
    <div class="channel-name">#test</div>
    <p>Connection testing. Send <code>test</code>, <code>ping</code>, or <code>path</code>.</p>
    <div class="channel-region-label">Key Type</div>
    <span class="channel-region">Hashtag derived</span>
    <div class="channel-region-label">Region Scope</div>
    <span class="channel-region">No Region Scope</span>
    <div class="channel-qr">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=meshcore%3A%2F%2Fchannel%2Fadd%3Fname%3Dtest%26secret%3D9cd8fcf22a47333b591d96a2b848b73f" alt="QR code for #test channel" />
      <div class="channel-qr-label">Scan to add channel</div>
    </div>
  </div>
  <div class="channel-card">
    <div class="channel-name">#acadiana</div>
    <p>Acadiana Region general chat for all mesh users across South Louisiana.</p>
    <div class="channel-region-label">Key Type</div>
    <span class="channel-region">Hashtag derived</span>
    <div class="channel-region-label">Region Scope</div>
    <span class="channel-region">gc-la-lft</span>
    <div class="channel-qr">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=meshcore%3A%2F%2Fchannel%2Fadd%3Fname%3Dacadiana%26secret%3D119b05421c38402cc96a5c31533ecd75" alt="QR code for #acadiana channel" />
      <div class="channel-qr-label">Scan to add channel</div>
    </div>
  </div>
  <div class="channel-card">
    <div class="channel-name">#lafayette</div>
    <p>Lafayette area local chat for nodes in the greater Lafayette area.</p>
    <div class="channel-region-label">Key Type</div>
    <span class="channel-region">Hashtag derived</span>
    <div class="channel-region-label">Region Scope</div>
    <span class="channel-region">gc-la-lft</span>
    <div class="channel-qr">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=meshcore%3A%2F%2Fchannel%2Fadd%3Fname%3Dlafayette%26secret%3D64b5b9f12eac952a069ecda90366dceb" alt="QR code for #lafayette channel" />
      <div class="channel-qr-label">Scan to add channel</div>
    </div>
  </div>
  <div class="channel-card channel-card-full">
    <div class="channel-name">#wx</div>
    <p>Severe weather updates and weather-related reports across the Acadiana Region. Use this channel to share alerts, storm reports, radar observations, and other weather information that may impact users on the mesh. Keeping weather discussions here helps ensure important alerts are easier for everyone to find.</p>

    <div class="channel-region-label">Key Type</div>
    <span class="channel-region">Hashtag derived</span>

    <div class="channel-region-label">Region Scope</div>
    <span class="channel-region">gc-la-lft</span>

    <div class="wx-examples">
      <div class="wx-examples-label">Example Reports</div>
      <div class="wx-example">Storm report: Heavy rain + gusty winds, Youngsville, 4:30pm</div>
      <div class="wx-example">Road flooding on Ambassador at Johnston</div>
      <div class="wx-example">NWS Tornado Watch issued for Lafayette Parish</div>
      <div class="wx-example">Rotation on radar near Broussard, stay safe</div>
    </div>

    <div class="channel-commands">
      <div class="channel-commands-label">AcadianaWX Bot Commands</div>
      <div class="two-col-commands">
        <table>
          <tr><td>wx</td><td>Current conditions and forecast for the Rayne/Lafayette area</td></tr>
          <tr><td>wx 70578</td><td>Forecast for a specific zip code</td></tr>
          <tr><td>wx Lafayette</td><td>Forecast for a named city</td></tr>
          <tr><td>aqi</td><td>Air quality index for the local area</td></tr>
          <tr><td>sun</td><td>Sunrise and sunset times</td></tr>
          <tr><td>moon</td><td>Moon phase, rise and set times</td></tr>
          <tr><td>solar</td><td>Current solar conditions</td></tr>
        </table>
        <table>
          <tr><td>hfcond</td><td>HF radio propagation conditions</td></tr>
          <tr><td>solarforecast</td><td>Solar energy forecast</td></tr>
          <tr><td>aurora</td><td>Aurora borealis activity level</td></tr>
          <tr><td>satpass 25544</td><td>Next ISS pass overhead. Use NORAD ID — ISS is 25544, SO-50 is 27607</td></tr>
          <tr><td>ping</td><td>Check if the bot is online</td></tr>
          <tr><td>help</td><td>List available commands</td></tr>
        </table>
      </div>
      <div class="channel-note">⏱ Rate limited — wait for a response before sending another command. Daily forecast posts automatically at 7:00 AM.</div>
    </div>

    <div class="channel-qr">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=meshcore%3A%2F%2Fchannel%2Fadd%3Fname%3Dwx%26secret%3D472dd8595b8fd0ab542b3e86a379a620" alt="QR code for #wx channel" />
      <div class="channel-qr-label">Scan to add channel</div>
    </div>
  </div>

  <div class="channel-card channel-card-full">
    <div class="channel-name">#bot</div>
    <p>Interact with AcadianaBot — fun commands, jokes, sports scores, and network info. Messages are rate limited — wait for a response before sending another command.</p>
    <div class="channel-region-label">Key Type</div>
    <span class="channel-region">Hashtag derived</span>
    <div class="channel-region-label">Region Scope</div>
    <span class="channel-region">gc-la-lft</span>
    <div class="channel-commands">
      <div class="channel-commands-label">AcadianaBot Commands</div>
      <div class="two-col-commands">
        <table>
          <tr><td>ping</td><td>Check if the bot is online</td></tr>
          <tr><td>test</td><td>Signal report — returns SNR, RSSI, and path info. Example: <code>ack @[YourName] | Direct | SNR: 10.75 dB | RSSI: -14 dBm | Received at: 11:29:50</code>. SNR higher is better (above 5 dB good, above 10 dB excellent). RSSI closer to 0 is stronger.</td></tr>
          <tr><td>help</td><td>List available commands</td></tr>
          <tr><td>hfcond</td><td>Returns current shortwave radio propagation conditions including solar flux, A-index, and K-index.</td></tr>
          <tr><td>channels</td><td>List active network channels</td></tr>
          <tr><td>cmd</td><td>Show detailed command reference</td></tr>
          <tr><td>joke</td><td>Get a random joke</td></tr>
        </table>
        <table>
          <tr><td>dadjoke</td><td>Get a dad joke</td></tr>
          <tr><td>momjoke</td><td>Get a mom joke</td></tr>
          <tr><td>funfact</td><td>Get a fun fact</td></tr>
          <tr><td>sports inter miami</td><td>MLS scores — works for all MLS teams. Try <code>sports dynamo</code>, <code>sports crew</code>, <code>sports timbers</code>, etc.</td></tr>
          <tr><td>sports liverpool</td><td>Premier League scores — try <code>sports arsenal</code>, <code>sports chelsea</code>, <code>sports man city</code>, <code>sports man united</code></td></tr>
          <tr><td>prefix XX</td><td>Look up the repeater with that 2-character path prefix — e.g. <code>prefix b1</code></td></tr>
        </table>
      </div>
      <div class="channel-note">⏱ Rate limited — wait 5 seconds after receiving a response before sending another command.</div>
    </div>
    <div class="channel-qr">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=meshcore%3A%2F%2Fchannel%2Fadd%3Fname%3Dbot%26secret%3Deb50a1bcb3e4e5d7bf69a57c9dada211" alt="QR code for #bot channel" />
      <div class="channel-qr-label">Scan to add channel</div>
    </div>
  </div>
</div>

## How Channels Work

### Public Channel
The Public channel uses a well-known key shared across all MeshCore networks worldwide. Anyone running MeshCore can read and send messages on the Public channel.

### Hashtag Channels
Channels starting with `#` use a key automatically derived from the channel name. Anyone who knows the channel name can join — no manual key exchange needed.

### Private Channels
Private channels use a custom key that you set manually. Only people you share the key with can join. Use these for group communications where privacy matters.

### Direct Messages
Direct messages are encrypted end-to-end between two nodes. Only the intended recipient can read them.

### Channel Regions & Scopes

Regions control which repeaters will forward a channel's messages. When you send a message on a scoped channel, repeaters check if they have that region configured — if not, the message stops there.

**Why this matters:** Without region scoping, every message floods the entire mesh network. With regions, messages stay in their intended geographic area.

**How to read the scope:** `gc-la-lft` breaks down as:
- `gc` — Gulf Coast (broad regional scope)
- `gc-la` — Louisiana (state scope)  
- `gc-la-lft` — Lafayette (local scope)

**Choosing the right scope:**
- Use a **wider scope** (`gc-la`) to reach more people across Louisiana
- Use a **narrower scope** (`gc-la-lft`) to keep traffic local to Lafayette
- Channels with **no scope** flood the entire mesh — use sparingly

**Discovering local regions:** In the MeshCore app tap **Discover → Discover Regions** to see what region scopes are active on nearby repeaters.

## Adding a Channel

1. Open the MeshCore app
2. Tap ⋮ → **Add Channel** → **Join a Hashtag Channel**
3. Enter the channel name (e.g. `acadiana`)
4. Press **Join Channel**

Or scan the QR code on any channel card above — the app will add it automatically.

## Privacy

All channel messages are encrypted using AES-256-CTR. With secured keys and trustworthy recipients, your data is cryptographically protected.

| Channel Type | Privacy Level |
|---|---|
| Public | 🔓 Public — key is shared worldwide |
| Hashtag channels | 🔓 Semi-public — key derived from name |
| Private channels | 🔒 Private — custom secret key |
| Direct messages | 🔒 Private — unique per conversation |