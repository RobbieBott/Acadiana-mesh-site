---
layout: page
title: Get Connected
permalink: /connect/
---

Getting on the Acadiana Mesh network is easy and takes about 10 minutes. Follow these steps to get started.

## Step 1: Get a Device

You'll need a MeshCore compatible LoRa radio. Check out our [Devices](/devices) page for recommendations. Devices start around $30-100.

## Step 2: Flash the Firmware

Flash your device using the official MeshCore web flasher:

[Flash Your Device →](http://flasher.meshcore.io/)

- Select your device model
- Choose the correct firmware version
- Click Flash
- If first time flashing, select **Erase** before flashing

## Step 3: Configure Your Settings

Apply the Acadiana Mesh radio settings using the [MeshCore Config Tool](https://config.meshcore.dev):

| Setting | Value |
|---|---|
| Frequency | 915.0 MHz |
| Bandwidth | 250 kHz |
| Spreading Factor | 11 |
| Coding Rate | 5 |

See the full [Settings](/settings) page for more details.

## Step 4: Connect to Your Phone

- **Bluetooth** — Pair your device via the MeshCore app
- **USB** — Connect directly via USB cable
- **WiFi** — Connect over local WiFi

Download the MeshCore app:
- [iOS App](https://apps.apple.com/app/meshcore)
- [Android App](https://play.google.com/store/apps/details?id=io.meshcore.app)

## Step 5: Join the Mesh

1. Open the MeshCore app and connect to your device
2. Set your name in Settings
3. Tap **Advert** → **Send Flood Advert** to announce yourself
4. Tap **Discover** → **Discover Repeaters** to find nearby nodes
5. Send a test message on the **#test** channel

## Step 6: Join the Community

Connect with other Acadiana Mesh members:

- [Join our Discord]({{ site.discord_url }})
- [View the Live Network]({{ site.analyzer_url }})
- [Read the Docs]({{ site.docs_url }})