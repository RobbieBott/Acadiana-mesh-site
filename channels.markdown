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
    <div class="channel-meta">Well-known key · No region</div>
  </div>
  <div class="channel-card">
    <div class="channel-name">#test</div>
    <p>Connection testing. Send <code>test</code>, <code>ping</code>, or <code>path</code>.</p>
    <div class="channel-meta">Hashtag derived · No region</div>
  </div>
  <div class="channel-card">
    <div class="channel-name">#acadiana</div>
    <p>Acadiana Region general chat for all mesh users across South Louisiana.</p>
    <div class="channel-meta">Hashtag derived · gc-la</div>
  </div>
  <div class="channel-card">
    <div class="channel-name">#lft</div>
    <p>Lafayette area local chat for nodes in the greater Lafayette area.</p>
    <div class="channel-meta">Hashtag derived · gc-la-lft</div>
  </div>
  <div class="channel-card">
    <div class="channel-name">#emergency</div>
    <p>Emergency communications only. Please keep clear for urgent traffic.</p>
    <div class="channel-meta">Hashtag derived · gc-la</div>
  </div>
</div>

| Channel | Key Type | Region | Purpose |
|---|---|---|---|
| Public | Well-known | None | General chat for all mesh users |
| #test | Hashtag derived | None | Connection testing — send `test`, `ping`, or `path` |
| #acadiana | Hashtag derived | gc-la | Acadiana Region general chat |
| #lft | Hashtag derived | gc-la-lft | Lafayette area chat |
| #emergency | Hashtag derived | gc-la | Emergency communications only |

## How Channels Work

### Public Channel
The Public channel uses a well-known key shared across all MeshCore networks worldwide. Anyone running MeshCore can read and send messages on the Public channel.

### Hashtag Channels
Channels starting with `#` use a key automatically derived from the channel name. Anyone who knows the channel name can join — no manual key exchange needed.

### Private Channels
Private channels use a custom key that you set manually. Only people you share the key with can join. Use these for group communications where privacy matters.

### Direct Messages
Direct messages are encrypted end-to-end between two nodes. Only the intended recipient can read them.

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