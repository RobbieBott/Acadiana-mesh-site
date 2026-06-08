---
layout: default
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
.three-col-commands {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.three-col-commands table {
  flex: 1;
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}
.three-col-commands td {
  padding: 6px 6px;
  vertical-align: top;
  border-bottom: 1px solid #2e2e2e;
}
.three-col-commands tr:last-child td {
  border-bottom: none;
}
.three-col-commands td:first-child {
  white-space: nowrap;
  color: #f94d00;
  font-family: monospace;
  font-size: 13px;
}
.three-col-commands td:last-child {
  color: #aaaaaa;
}
@media (max-width: 768px) {
  .three-col-commands {
    flex-direction: column;
    gap: 0;
  }
  .three-col-commands table {
    width: 100%;
  }
}
</style>

<div class="page-container" style="max-width: 1200px; margin: 0 auto; padding: 0 1.5rem;">

<h1 class="page-title">Channels</h1>

<p style="color: var(--text-muted); margin-bottom: 2rem;">Channels are how groups communicate on the Acadiana Mesh network. Each channel has a shared encryption key that allows members to send and receive messages.</p> Each channel has a shared encryption key that allows members to send and receive messages.

<h2>Core Channels</h2>
<div class="channel-grid">
  <div class="channel-card">
    <div class="channel-name">Public</div>
    <p>General chat for all mesh users. Uses a well-known shared key.</p>
    <div class="channel-region-label">Key Type</div>
    <span class="channel-region">Well-known</span>
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
    <p>Severe weather updates and weather-related reports across the Acadiana Region. Use this channel to share alerts, storm reports, radar observations, and other weather information that may impact users on the network. Keeping weather discussions here helps ensure important alerts are easier for everyone to find.</p>

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
      <div class="three-col-commands">
        <table>
          <tr><td>wx</td><td>Current conditions and forecast for the Rayne/Lafayette area</td></tr>
          <tr><td>wx 70578</td><td>Forecast for a specific zip code</td></tr>
          <tr><td>wx Lafayette</td><td>Forecast for a named city</td></tr>
          <tr><td>aqi</td><td>Air quality index for the local area</td></tr>
          <tr><td>sun</td><td>Sunrise and sunset times</td></tr>
        </table>
        <table>
          <tr><td>moon</td><td>Moon phase, rise and set times</td></tr>
          <tr><td>solar</td><td>Current solar conditions</td></tr>
          <tr><td>hfcond</td><td>HF radio propagation conditions — solar flux, A-index, and K-index for amateur radio operators planning HF communications</td></tr>
          <tr><td>solarforecast</td><td>Solar energy forecast</td></tr>
          <tr><td>aurora</td><td>Aurora borealis activity level</td></tr>
        </table>
        <table>
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
      <div class="three-col-commands">
        <table>
          <tr><td>ping</td><td>Check if the bot is online</td></tr>
          <tr><td>test</td><td>Signal report — returns SNR, RSSI, and path info for your message. SNR higher is better; RSSI closer to 0 is stronger.</td></tr>
          <tr><td>help</td><td>List available commands</td></tr>
          <tr><td>channels</td><td>List active network channels</td></tr>
        </table>
        <table>
          <tr><td>cmd</td><td>Show detailed command reference</td></tr>
          <tr><td>joke</td><td>Get a random joke</td></tr>
          <tr><td>dadjoke</td><td>Get a dad joke</td></tr>
          <tr><td>momjoke</td><td>Get a mom joke</td></tr>
          <tr><td>funfact</td><td>Get a fun fact</td></tr>
        </table>
        <table>
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

</div>

<div class="page-container" style="max-width: 1200px; margin: 0 auto; padding: 0 1.5rem;">

<h2>How Channels Work</h2>

<h3>Public Channel</h3>
<p>The Public channel uses a well-known key shared across all MeshCore networks worldwide. Anyone running MeshCore can read and send messages on the Public channel.</p>

<h3>Hashtag Channels</h3>
<p>Channels starting with <code>#</code> use a key automatically derived from the channel name. Anyone who knows the channel name can join — no manual key exchange needed.</p>

<h3>Private Channels</h3>
<p>Private channels use a custom key that you set manually. Only people you share the key with can join. Use these for group communications where privacy matters.</p>

<h3>Direct Messages</h3>
<p>Direct messages are encrypted end-to-end between two nodes. Only the intended recipient can read them.</p>

<h3>Channel Regions &amp; Scopes</h3>
<p>Regions control which repeaters will forward a channel's messages. When you send a message on a scoped channel, repeaters check if they have that region configured — if not, the message stops there.</p>

<p><strong>Why this matters:</strong> Without region scoping, every message floods the entire mesh network. With regions, messages stay in their intended geographic area.</p>

<p><strong>How to read the scope:</strong> <code>gc-la-lft</code> breaks down as:</p>
<ul style="list-style: disc; padding-left: 1.5rem; color: var(--text-muted);">
  <li style="margin-bottom: 0.25rem;"><code>gc</code> — Gulf Coast (broad regional scope)</li>
  <li style="margin-bottom: 0.25rem;"><code>gc-la</code> — Louisiana (state scope)</li>
  <li style="margin-bottom: 0.25rem;"><code>gc-la-lft</code> — Lafayette (local scope)</li>
</ul>

<p><strong>Choosing the right scope:</strong></p>
<ul style="list-style: disc; padding-left: 1.5rem; color: var(--text-muted);">
  <li style="margin-bottom: 0.25rem;">Use a <strong>wider scope</strong> (<code>gc-la</code>) to reach more people across Louisiana</li>
  <li style="margin-bottom: 0.25rem;">Use a <strong>narrower scope</strong> (<code>gc-la-lft</code>) to keep traffic local to Lafayette</li>
  <li style="margin-bottom: 0.25rem;">Channels with <strong>no scope</strong> flood the entire mesh — use sparingly</li>
</ul>

<p><strong>Discovering local regions:</strong> In the MeshCore app tap <strong>Discover → Discover Regions</strong> to see what region scopes are active on nearby repeaters.</p>

<h2>Adding a Channel</h2>
<ol style="list-style: decimal; padding-left: 1.5rem; color: var(--text-muted);">
  <li style="margin-bottom: 0.25rem;">Open the MeshCore app</li>
  <li style="margin-bottom: 0.25rem;">Tap ⋮ → <strong>Add Channel</strong> → <strong>Join a Hashtag Channel</strong></li>
  <li style="margin-bottom: 0.25rem;">Enter the channel name (e.g. <code>acadiana</code>)</li>
  <li style="margin-bottom: 0.25rem;">Press <strong>Join Channel</strong></li>
</ol>
<p>Or scan the QR code on any channel card above — the app will add it automatically.</p>

<h2>Privacy</h2>
<p>All channel messages are encrypted using AES-256-CTR. With secured keys and trustworthy recipients, your data is cryptographically protected.</p>

<table style="width:100%; border-collapse: collapse; font-size: 0.9rem;">
  <thead>
    <tr>
      <th style="text-align:left; padding: 0.5rem; border-bottom: 1px solid var(--border); color: var(--accent);">Channel Type</th>
      <th style="text-align:left; padding: 0.5rem; border-bottom: 1px solid var(--border); color: var(--accent);">Privacy Level</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding: 0.5rem; color: var(--text-muted);">Public</td><td style="padding: 0.5rem; color: var(--text-muted);">🔓 Public — key is shared worldwide</td></tr>
    <tr><td style="padding: 0.5rem; color: var(--text-muted);">Hashtag channels</td><td style="padding: 0.5rem; color: var(--text-muted);">🔓 Semi-public — key derived from name</td></tr>
    <tr><td style="padding: 0.5rem; color: var(--text-muted);">Private channels</td><td style="padding: 0.5rem; color: var(--text-muted);">🔒 Private — custom secret key</td></tr>
    <tr><td style="padding: 0.5rem; color: var(--text-muted);">Direct messages</td><td style="padding: 0.5rem; color: var(--text-muted);">🔒 Private — unique per conversation</td></tr>
  </tbody>
</table>

</div>