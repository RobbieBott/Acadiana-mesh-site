---
layout: page
title: Settings
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
| Spreading Factor | 9 |
| Coding Rate | 5 |

### Repeater

| Setting | Value |
|---|---|
| Preset | USA/Canada (Recommended) |
| Frequency | 910.525 MHz |
| Bandwidth | 62.5 kHz |
| Spreading Factor | 9 |
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
gc
  └── gc-la
        └── gc-la-lft
{% endhighlight %}

Apply these region commands to your repeater:

{% highlight bash %}
region put gc
region put gc-la gc
region put gc-la-lft gc-la
region put gc-la-lft-mm gc-la
region allowf gc
region allowf gc-la
region allowf gc-la-lft
region allowf gc-la-lft-mm
region save
{% endhighlight %}

## Flash Your Device

[Flash Your Device →](http://flasher.meshcore.io/)