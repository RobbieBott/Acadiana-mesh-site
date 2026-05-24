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
| Frequency | 910.525 MHz |
| Bandwidth | 62.5 kHz |
| Spreading Factor | 9 |
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

---

## Host an Observer

Observers listen for mesh traffic and report it to the Acadiana Mesh network analyzer, helping the community track network health, coverage, and repeater status. The more observers we have, the better picture we get of the mesh. If you have a stable internet connection and a spare companion device, you can help.

### What You Need

- A MeshCore companion device (any supported hardware)
- A stable internet connection (WiFi or ethernet)
- The device placed somewhere it can hear mesh traffic — near a window or outdoors works best

### Step 1: Flash Observer Firmware

Flash your device with the **observer firmware** from [Let's Mesh](https://letsmesh.net):

[Download Observer Firmware →](https://letsmesh.net)

Select the observer/companion build for your hardware and flash it using the standard MeshCore web flasher.

### Step 2: Configure WiFi and MQTT

Connect to your device via USB or Bluetooth and run these commands in the MeshCore CLI:

**WiFi Setup:**
```
set wifi.ssid WiFi Name
set wifi.pwd WiFi Password
```

**Observer Identity:**
```
set mqtt.iata LFT
set mqtt.owner your companion public key hex
set mqtt.email your@email.com
```

**Acadiana Mesh MQTT Server:**
```
set mqtt.server mqtt.acadianamesh.com
set mqtt.port 1883
set mqtt.username Observer
set mqtt.password Uplink
set mqtt.iata LFT
reboot
```

Replace `WiFi Name` and `WiFi Password` with your network credentials. For `mqtt.owner`, enter the public key of your companion node in hex format. For `mqtt.email`, enter your email address so we can contact you if there are any issues with your observer.

### Step 3: Verify It's Working

After rebooting, your observer should connect to WiFi and begin reporting packets to the Acadiana Mesh analyzer. You can verify it's working by checking the [Network Analyzer]({{ site.analyzer_url }}) — your observer should appear in the Observers list within a few minutes.

### Alternative: Home Assistant

If you run Home Assistant, you can use the **MeshCore integration** to connect your device as an observer without needing a dedicated machine. Install the MeshCore add-on from the Home Assistant Community Store (HACS) and configure the same MQTT settings above.

### Questions?

Reach out on [Discord]({{ site.discord_url }}) — the community is happy to help you get your observer online.