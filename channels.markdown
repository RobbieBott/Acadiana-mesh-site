---
layout: page
title: Channels
permalink: /channels/
---

Channels are how groups communicate on the Acadiana Mesh network. Each channel has a shared encryption key that allows members to send and receive messages.

## Core Channels
<div class="channel-grid">
  <div class="channel-card">
    <div class="channel-name">Public</div>
    <p>General chat for all mesh users. Uses a well-known shared key.</p>
    <div class="channel-region-label">Key Type</div>
    <span class="channel-region">Well-known</span>
  </div>
  <div class="channel-card">
    <div class="channel-name">#test</div>
    <p>Connection testing. Send <code>test</code>, <code>ping</code>, or <code>path</code>.</p>
    <div class="channel-region-label">Key Type</div>
    <span class="channel-region">Hashtag derived</span>
  </div>
  <div class="channel-card">
    <div class="channel-name">#acadiana</div>
    <p>Acadiana Region general chat for all mesh users across South Louisiana.</p>
    <div class="channel-region-label">Key Type</div>
    <span class="channel-region">Hashtag derived</span>
    <div class="channel-region-label">Region Scope</div>
    <span class="channel-region">gc-la</span>
  </div>
  <div class="channel-card">
    <div class="channel-name">#lafayette</div>
    <p>Lafayette area local chat for nodes in the greater Lafayette area.</p>
    <div class="channel-region-label">Key Type</div>
    <span class="channel-region">Hashtag derived</span>
    <div class="channel-region-label">Region Scope</div>
    <span class="channel-region">gc-la-lft</span>
  </div>
  <div class="channel-card">
    <div class="channel-name">#emergency</div>
    <p>Emergency communications only. Please keep clear for urgent traffic.</p>
    <div class="channel-region-label">Key Type</div>
    <span class="channel-region">Hashtag derived</span>
    <div class="channel-region-label">Region Scope</div>
    <span class="channel-region">gc-la</span>
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

## Privacy

All channel messages are encrypted using AES-256-CTR. With secured keys and trustworthy recipients, your data is cryptographically protected.

| Channel Type | Privacy Level |
|---|---|
| Public | 🔓 Public — key is shared worldwide |
| Hashtag channels | 🔓 Semi-public — key derived from name |
| Private channels | 🔒 Private — custom secret key |
| Direct messages | 🔒 Private — unique per conversation |