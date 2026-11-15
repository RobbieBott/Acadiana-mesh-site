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
set agc.reset.interval 500
set multi.acks 1
set advert.interval 240
set flood.advert.interval 29
set guest.password
set path.hash.mode 1
set loop.detect minimal
powersaving on
{% endhighlight %}

## Region Settings

Acadiana Mesh uses the following region hierarchy:

{% highlight bash %}
us
  └── us-southeast
        └── us-gc
              └── us-la
                    └── us-la-lft
{% endhighlight %}

Apply these region commands to your repeater:

{% highlight bash %}
region put us
region put us-southeast us
region put us-gc us-southeast
region put us-la us-gc
region put us-la-lft us-la
region allowf us
region allowf us-southeast
region allowf us-gc
region allowf us-la
region allowf us-la-lft
region save
{% endhighlight %}

## Flash Your Device

[Flash Your Device →](http://flasher.meshcore.io/)