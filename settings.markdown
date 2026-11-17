---
layout: page
title: Radio Settings — Acadiana Mesh Network Configuration
description: Exact radio and MQTT settings to join the Acadiana Mesh network. Includes frequency, bandwidth, spreading factor, region configuration, and recommended repeater CLI settings for MeshCore.
permalink: /settings/
---

Use these settings to join the Acadiana Mesh network. These settings must match exactly for your device to communicate with other nodes in the network.

## Radio Settings

### Companion Device

| Setting | Value |
|---|---|
| Preset | USA/Canada (Recommended) |
| Frequency | 910.525 MHz |
| Bandwidth | 62.5 kHz |
| Spreading Factor | 7 |
| Coding Rate | 5 |

### Repeater

| Setting | Value |
|---|---|
| Preset | USA/Canada (Recommended) |
| Frequency | 910.525 MHz |
| Bandwidth | 62.5 kHz |
| Spreading Factor | 7 |
| Coding Rate | 5 |

## MQTT Observer Settings

| Setting | Value |
|---|---|
| Server | mqtt.acadianamesh.com |
| Port | 1883 |
| Username | Observer |
| Password | Uplink |
| IATA Code | LFT |
| Transport | TCP |
| Use TLS | No |
| Payload Mode | Packet (LetsMesh-compatible) |

## Recommended Repeater CLI Settings

Once your repeater is online, apply these settings via the CLI:

{% highlight bash %}
set multi.acks 1
set advert.interval 240
set guest.password
set path.hash.mode 1
set loop.detect minimal
powersaving on
{% endhighlight %}

## Region Settings

Acadiana Mesh repeaters use these seven regions:

`us` · `us-la` · `us-la-lft` · `us-gc` · `us-southeast` · `us-south` · `us-east`

Apply them on your repeater's Command Line, one command at a time, then save:

{% highlight bash %}
region def us
region def us-la
region def us-la-lft
region def us-gc
region def us-southeast
region def us-south
region def us-east
region save
{% endhighlight %}

Not in the Lafayette area? Use the [Region Code Finder](/wiki/#region-finder) to get the codes for your repeater's location. Enter region codes on repeaters only, not companions, and leave `*` (unscoped) allowed. More detail is in the [Wiki](/wiki/#regions).

## Flash Your Device

[Flash Your Device →](http://flasher.meshcore.io/)