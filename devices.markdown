---
layout: page
title: MeshCore Compatible Devices — Acadiana Mesh
description: Recommended LoRa devices for joining the Acadiana Mesh network. Includes prebuilt options like the Seeed Wio Tracker L1 Pro, LilyGO T-Deck Plus and Pro, plus repeater hardware like the RAK WisMesh 1W and Raspberry Pi HATs.
permalink: /devices/
---

Here are the recommended devices for joining the Acadiana Mesh network. All devices listed are compatible with MeshCore firmware.

## Prebuilt Devices

These devices come ready to go out of the box — case, battery, and antenna included. No soldering or additional purchases required to get on the mesh.

### Seeed Wio Tracker L1 Pro
The best all-in-one companion device for MeshCore. Comes pre-flashed with MeshCore firmware in a tough 3D-printed enclosure with GPS, OLED display, RP-SMA antenna connector, and built-in battery — everything you need in one package.

- **Price:** ~$46.99
- **MCU:** nRF52840
- **LoRa:** SX1262
- **Connection:** USB, Bluetooth
- **Display:** Yes (OLED)
- **GPS:** Yes (built-in)
- **Battery:** Yes (included)
- **Case:** Yes (3D-printed enclosure)
- **Antenna:** Yes (3 dBi whip included)
- **Pre-flashed:** MeshCore companion firmware

[Buy from Seeed Studio →](https://www.seeedstudio.com){:target="_blank"}

### LilyGO T-Deck Plus
A pocket-sized standalone MeshCore terminal that looks like a mini BlackBerry. Built-in QWERTY keyboard, 2.8" touchscreen, trackball, GPS, microphone, speaker, and 2000mAh battery — all in one enclosure. No smartphone required to send and receive messages.

- **Price:** ~$70-80
- **MCU:** ESP32-S3
- **LoRa:** SX1262, 915 MHz
- **Connection:** USB, WiFi, Bluetooth
- **Display:** Yes (2.8" IPS LCD touchscreen)
- **GPS:** Yes (built-in)
- **Battery:** Yes (2000mAh)
- **Case:** Yes
- **Keyboard:** Yes (QWERTY + trackball)
- **Note:** Order the **MeshCore firmware** variant when purchasing from LilyGO directly

[Buy from LilyGO →](https://lilygo.cc/products/t-deck-plus-1){:target="_blank"} · [Buy from Amazon →](https://www.amazon.com/LILYGO-ESP32-S3-Development-Meshcore-Firmware/dp/B0FYG4D54G){:target="_blank"}

### LilyGO T-Deck Pro
The premium LilyGO terminal featuring a 3.1" e-paper touchscreen for excellent sunlight readability and low power consumption. Includes 4G module, GPS, Bosch IMU, headphone jack, and QWERTY keyboard. Available pre-flashed with MeshCore firmware directly from LilyGO.

- **Price:** ~$95
- **MCU:** ESP32-S3
- **LoRa:** SX1262, 915 MHz
- **Connection:** USB, WiFi, Bluetooth, 4G
- **Display:** Yes (3.1" e-paper touchscreen)
- **GPS:** Yes (built-in)
- **Battery:** Yes (included)
- **Case:** Yes
- **Keyboard:** Yes (QWERTY)
- **Note:** Order the **MeshCore firmware** variant when purchasing from LilyGO directly

[Buy from LilyGO →](https://lilygo.cc/products/t-deck-pro){:target="_blank"}

---

## Companion Devices

These devices require a case, battery, and antenna to be purchased separately before deployment.

### Heltec T096
Ultra-compact device with a small built-in display. Great for portable use and easy to carry.

- **Price:** ~$25-35
- **Connection:** USB, Bluetooth
- **Display:** Yes (0.96" OLED)
- **Battery:** External required
- **Case:** External required

[Buy from Heltec →](https://heltec.org){:target="_blank"}

### RAK WisBlock Starter Kit
Modular development platform with LoRa capabilities. Great for custom builds.

- **Price:** ~$40-60
- **Connection:** USB, Bluetooth
- **Display:** Optional
- **Battery:** Optional
- **Case:** External required

[Buy from RAKwireless →](https://store.rakwireless.com){:target="_blank"}

### Heltec Wireless Tracker
Compact device with built-in GPS and screen. Great for mobile use.

- **Price:** ~$30-40
- **Connection:** USB, Bluetooth
- **Display:** Yes
- **GPS:** Yes
- **Case:** External required

[Buy from Heltec →](https://heltec.org){:target="_blank"}

---

## Repeater Hardware

### RAK WisMesh 1W
High-performance 1W repeater based on the nRF52840 with SX1262 LoRa radio. One of the best choices for a dedicated MeshCore repeater — excellent power efficiency and modular design makes it ideal for solar deployments.

- **Price:** ~$40-60
- **Output Power:** 1W (30 dBm)
- **Connection:** USB, Bluetooth
- **Battery:** Optional solar charging

[Buy from RAKwireless →](https://store.rakwireless.com){:target="_blank"}

### Heltec WiFi LoRa 32 V4 (No-Screen High Power Version)
The no-screen version of the Heltec V4 is the recommended choice for a fixed repeater. The circuitry is already modified for an external WiFi antenna, and the high-power version outputs 28±1 dBm for maximum range. **Make sure you purchase the no-screen, high-power version — do NOT buy the version with a screen for repeater use.**

- **Price:** ~$20-30
- **MCU:** ESP32-S3
- **LoRa:** SX1262
- **Output Power:** 28±1 dBm (high power version)
- **Connection:** USB, WiFi, Bluetooth
- **Display:** None (external WiFi antenna mod)

[Buy from Heltec →](https://heltec.org){:target="_blank"}

### Waveshare LoRa HAT for Raspberry Pi
Perfect for running a fixed repeater on a Raspberry Pi.

- **Price:** ~$30-40
- **Works with:** Raspberry Pi 3/4/5
- **Connection:** SPI

[Buy from Waveshare →](https://www.waveshare.com){:target="_blank"}

### WisMesh Pi HAT (RAK6421) with pyMC Repeater
A Raspberry Pi HAT designed for always-on MeshCore gateway and repeater deployments. Connects WisBlock LoRa radios and sensors directly to the Pi's 40-pin header — no USB adapters or loose cables. Run with pyMC Repeater for a full Linux-native MeshCore node.

- **Price:** ~$14-20 (HAT only)
- **Works with:** Raspberry Pi 4, Pi 5
- **LoRa Radio:** WisBlock module (RAK13300 or RAK13302)
- **Connection:** GPIO (HAT+)
- **Software:** pyMC Repeater

[Buy from Rokland →](https://store.rokland.com/products/wismesh-raspberry-pi-hat-rak6421-sku-610012){:target="_blank"} · [Buy from RAKwireless →](https://store.rakwireless.com/products/meshtastic-raspberry-pi-hat-rak6421){:target="_blank"}

### MeshSmith PiMesh 1W
A 1-Watt LoRa HAT from MeshSmith designed to turn your Raspberry Pi into a powerful MeshCore repeater. Features the E22-900M30S SX1262 module at 30 dBm output and includes an easy installer script.

- **Price:** Check MeshSmith store
- **Output Power:** 1W (30 dBm)
- **Works with:** Raspberry Pi 3/4/5
- **Software:** pyMC Repeater, meshtasticd

[Buy from MeshSmith →](https://shop.meshsmith.net/collections/pimesh-1w){:target="_blank"} · [GitHub →](https://github.com/MeshSmith/PiMesh-1W){:target="_blank"}

---

## Where to Buy

- [Amazon](https://amazon.com){:target="_blank"}
- [AliExpress](https://aliexpress.com){:target="_blank"}
- [Heltec Official Store](https://heltec.org){:target="_blank"}
- [RAKwireless Store](https://store.rakwireless.com){:target="_blank"}
- [Rokland (US Distributor)](https://store.rokland.com){:target="_blank"}
- [Seeed Studio](https://www.seeedstudio.com){:target="_blank"}
- [LilyGO Official Store](https://lilygo.cc){:target="_blank"}
- [MeshSmith Store](https://shop.meshsmith.net){:target="_blank"}

## Flashing Your Device

Once you have your device, head to the [Get Connected](/connect) page for flashing and setup instructions.

[Flash Your Device →](https://flasher.meshcore.io/){:target="_blank" .btn .btn-primary}