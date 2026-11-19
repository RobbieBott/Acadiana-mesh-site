/// <reference path="../pb_data/types.d.ts" />
// One-time import of the "Meshcore Repeaters" Google Sheet (Repeater Information
// and Reserved Prefixes tabs, exported 2026-11-19). The sheet had no owner or
// contact columns, so owners add those when they first edit their repeater.

const REPEATERS = [
  {
    "name": "Mire RAK 1W",
    "status": "Online",
    "prefix": "B1",
    "prefix_2byte": "B145",
    "public_key": "b1c9aa7023ce2a8c81c5c9c9c9344f7c03a261624a09fd1af17845cdc9889f59",
    "prefix_compliant": "Yes",
    "manufacturer": "RAK",
    "model": "19007 + 3401 + 13302 (1W)",
    "gps_module": "Yes",
    "screen": "No",
    "wifi_bt_antenna": "Yes",
    "firmware": "MC 1.15",
    "powersave": "Yes",
    "agc": "Auto",
    "path_hash_bytes": 2,
    "antenna_height": "40'",
    "install_date": "2026-03-15 12:00:00.000Z",
    "area": "NE of Rayne",
    "power_input": "5V External / Solar",
    "battery_type": "Cells / 18650",
    "battery_count": "4/3300 mAh",
    "panel_watts": "7W",
    "antenna_gain": "5.8 dBi",
    "antenna_swr": "1.2",
    "mppt": "Yes"
  },
  {
    "name": "Holland Road",
    "status": "Online",
    "prefix": "B2",
    "prefix_2byte": "B245",
    "public_key": "b2296e985e031cddb9412cdb4cf794dabc52b66f9c3a6141c881bc86a27e30b9",
    "prefix_compliant": "Yes",
    "manufacturer": "Heltec",
    "model": "V4 (28 ± 1dBm)",
    "gps_module": "Yes",
    "board_revision": "V4.2",
    "screen": "No",
    "wifi_bt_antenna": "Yes",
    "firmware": "MC 1.14.0",
    "powersave": "Yes",
    "agc": "Auto",
    "path_hash_bytes": 2,
    "antenna_height": "50'",
    "install_date": "2026-03-12 12:00:00.000Z",
    "area": "North of Crowley",
    "power_input": "Battery / Solar",
    "battery_type": "Cells / 18650",
    "battery_count": "4/3300 mAh",
    "panel_watts": "7W",
    "antenna_gain": "5.8 dBi",
    "antenna_swr": "1.2",
    "mppt": "Onboard",
    "notes": "Board ordered with modified circuitry to support external WiFi / Bluetooth Antenna."
  },
  {
    "name": "Hwy. 90 Rayne West",
    "status": "Online",
    "prefix": "B5",
    "prefix_2byte": "B545",
    "public_key": "b54819d41cae29a129bf7e5b9653a38a3e2ea795e18f49d37fd09c65732d9564",
    "prefix_compliant": "Yes",
    "manufacturer": "Heltec",
    "model": "V4 (28 ± 1dBm)",
    "gps_module": "No",
    "board_revision": "V4.2",
    "screen": "No",
    "wifi_bt_antenna": "Yes",
    "firmware": "MC 1.14.0",
    "powersave": "Yes",
    "agc": "Auto",
    "path_hash_bytes": 2,
    "antenna_height": "65'",
    "install_date": "2026-03-15 12:00:00.000Z",
    "area": "West of Rayne",
    "power_input": "Battery / Solar",
    "battery_type": "Pack",
    "battery_count": "1/10000 mAh",
    "panel_watts": "7W",
    "antenna_gain": "5.8 dBi",
    "antenna_swr": "1.2",
    "mppt": "Onboard",
    "notes": "Board ordered with modified circuitry to support external WiFi / Bluetooth Antenna."
  },
  {
    "name": "Pousson Road",
    "status": "Online",
    "prefix": "B9",
    "public_key": "b96ed23f4ad05728c871b31f3a4bb6ac1c8d456dfae20e051c4dc6fddab9f4de",
    "prefix_compliant": "Yes",
    "manufacturer": "RAK",
    "model": "19007 + 4631",
    "firmware": "MC 1.15",
    "agc": "Auto",
    "path_hash_bytes": 2,
    "antenna_height": "40'",
    "install_date": "2025-11-11 12:00:00.000Z",
    "area": "Egan",
    "battery_type": "Pack",
    "battery_count": "1/3000 mAh",
    "antenna_gain": "5 dBi"
  },
  {
    "name": "Harmon Rd",
    "status": "Online",
    "prefix": "F6",
    "public_key": "f6099199d387fbe45233ee02dd5404e445cb70316aed11c4ee33c4f13d8fa4bf",
    "manufacturer": "RAK",
    "model": "19007 + 4631",
    "firmware": "MC 1.13.0",
    "agc": "Auto",
    "path_hash_bytes": 1,
    "antenna_height": "54'",
    "install_date": "2026-02-26 12:00:00.000Z",
    "area": "SE of Iota",
    "battery_type": "Cells / 18650",
    "battery_count": "2/3300 mAh"
  },
  {
    "name": "Iota",
    "status": "Online",
    "prefix": "5A",
    "public_key": "5ab4340939ce425bb5429c9b0fda2a7049e09bf85a75b359726db4c9ce5cbfe6",
    "prefix_compliant": "Yes",
    "manufacturer": "RAK",
    "model": "19007 + 4631",
    "agc": "Auto",
    "path_hash_bytes": 1,
    "antenna_height": "20'",
    "install_date": "2025-11-20 12:00:00.000Z",
    "area": "Iota",
    "battery_type": "Pack",
    "battery_count": "1/3000 mAh"
  },
  {
    "name": "Crowley Repeater",
    "status": "Online",
    "prefix": "8E",
    "public_key": "8e9832f98345159a3de42a4f7dc6b16f8e2d0c981922ad8cc6b4b7dad4e8d755",
    "prefix_compliant": "Yes",
    "manufacturer": "RAK",
    "model": "19007 + 4631",
    "firmware": "MC 1.13.0",
    "agc": "Auto",
    "path_hash_bytes": 1,
    "antenna_height": "40'",
    "area": "Crowley",
    "battery_type": "Cells / 18650",
    "battery_count": "2/3300mAh"
  },
  {
    "name": "W5OHJ",
    "status": "Online",
    "prefix": "E1",
    "public_key": "20f4159fcebb166ca99a8474810a77f23b80a96bd0d6c994cd79f5d7488ab03d",
    "prefix_compliant": "No",
    "manufacturer": "RAK",
    "model": "19007 + 4631",
    "firmware": "MC 1.13.0",
    "agc": "Auto",
    "path_hash_bytes": 1,
    "antenna_height": "30'",
    "area": "Richard"
  },
  {
    "name": "Breeze Way",
    "status": "Online",
    "prefix": "4C",
    "public_key": "4cc221a4aa890c73c7753731fb50dc692d38e6f29a923e49a72888481d0fbcc6",
    "prefix_compliant": "Yes",
    "manufacturer": "RAK",
    "model": "19007 + 4631",
    "powersave": "Yes",
    "agc": "Auto",
    "path_hash_bytes": 1,
    "antenna_height": "30'",
    "area": "Egan",
    "battery_type": "Pack",
    "battery_count": "1/5000 mAh",
    "antenna_gain": "5 dBi"
  },
  {
    "name": "Lafayette SW Repeater",
    "status": "Online",
    "prefix": "A1",
    "public_key": "a1ca38b9d867f1e304c5a7ad8f487ac75d082eee05351b8527cb7c2056d384b3",
    "prefix_compliant": "Yes",
    "manufacturer": "RAK",
    "model": "19007 + 4631",
    "firmware": "MC 1.13.0",
    "powersave": "No",
    "agc": "Auto",
    "path_hash_bytes": 1,
    "antenna_height": "66''",
    "area": "E. Broussard"
  },
  {
    "name": "GNR Repeater",
    "status": "Online",
    "prefix": "F0",
    "public_key": "f0d224224facc1cd87c456a5be6daaf18f9c05d75396909a707e172e582d595e",
    "prefix_compliant": "Yes",
    "manufacturer": "RAK",
    "model": "19007 + 4631",
    "agc": "Auto",
    "path_hash_bytes": 1,
    "antenna_height": "24'",
    "area": "Indian Bayou",
    "battery_type": "Cells / 18650",
    "battery_count": "2/3300"
  },
  {
    "name": "Temp Roberts Cove Repeater",
    "status": "Online",
    "prefix": "F3",
    "public_key": "f3ef2f8a830f87d313f77317e09b6c6297218403d3c1aba89cd2a6c865eb3e59",
    "prefix_compliant": "Yes",
    "manufacturer": "RAK",
    "model": "19007 + 4631",
    "path_hash_bytes": 1
  },
  {
    "name": "RAK 4631 Repeater KJ5CYB",
    "status": "Online",
    "prefix": "7B",
    "public_key": "7b5165f938d702705151142de010b8cb58e82659bb9c4778eb031cef9e1fe9e2",
    "prefix_compliant": "Yes",
    "manufacturer": "RAK",
    "model": "19007 + 4631",
    "path_hash_bytes": 1,
    "install_date": "2026-02-07 12:00:00.000Z",
    "area": "Rayne"
  },
  {
    "name": "KI5AGS Ron TWR",
    "status": "Online",
    "prefix": "94",
    "public_key": "94bfad249e826803cd042df8f97ba12c4d3e841c3f7fae7f5586628d42273353",
    "manufacturer": "RAK",
    "model": "19007 + 4631",
    "firmware": "MC 1.15",
    "powersave": "No",
    "agc": "Auto",
    "path_hash_bytes": 2,
    "antenna_height": "30'",
    "install_date": "2026-02-25 12:00:00.000Z",
    "area": "Lafayette",
    "battery_type": "Cells / 18650",
    "battery_count": "3/3300 mAh",
    "panel_watts": "7W"
  },
  {
    "name": "LGMC",
    "status": "Built Waiting For Install",
    "prefix": "B845",
    "prefix_2byte": "B845",
    "public_key": "b8450d2dfaa52cd18143d372b60c053e8aa085e2fee59f6c0a95ad83202a0324",
    "prefix_compliant": "Yes",
    "manufacturer": "Heltec",
    "model": "V4 (28 ± 1dBm)",
    "board_revision": "V4.3",
    "screen": "No",
    "wifi_bt_antenna": "Yes",
    "firmware": "MC 1.15",
    "powersave": "No",
    "agc": "Auto",
    "path_hash_bytes": 2,
    "area": "Lafayette",
    "power_input": "Battery / Solar",
    "battery_type": "Cells / 21700",
    "battery_count": "8/5500 mAh",
    "panel_watts": "12V/13W",
    "mppt": "Yes",
    "notes": "Board ordered with modified circuitry to support external WiFi / Bluetooth Antenna. New Samsung batteries, not recovered batteries."
  },
  {
    "name": "Hwy. 35 Rayne North",
    "status": "Online",
    "prefix_2byte": "4121",
    "public_key": "4121fb89487a17e9be6273126508c38f588c570469ecdb5b905b15025cb46899",
    "prefix_compliant": "No",
    "manufacturer": "Heltec",
    "model": "V3",
    "screen": "No",
    "wifi_bt_antenna": "Onboard",
    "firmware": "MC 1.15",
    "powersave": "No",
    "agc": "Auto",
    "path_hash_bytes": 2,
    "antenna_height": "30'",
    "install_date": "2026-04-25 12:00:00.000Z",
    "area": "Rayne",
    "power_input": "Battery / Solar",
    "battery_type": "Cells / 18650",
    "battery_count": "3",
    "mppt": "Yes",
    "notes": "Prebuilt setup."
  },
  {
    "name": "Jacob's Spare",
    "status": "Built Waiting For Install",
    "public_key": "08b250fbf8ff0254a2acf631236bade281715bdf843c641fa42ea9bc64863574",
    "manufacturer": "Heltec",
    "model": "V4 (28 ± 1dBm)",
    "screen": "No",
    "wifi_bt_antenna": "Yes",
    "firmware": "MC 1.15",
    "powersave": "No",
    "agc": "Auto",
    "path_hash_bytes": 2,
    "power_input": "Battery / Solar",
    "battery_type": "Cells / 18650",
    "battery_count": "3/2000 mAh",
    "mppt": "Onboard"
  }
];

const PREFIXES = [
  {
    "code": "A0",
    "label": "Mire Repeater"
  },
  {
    "code": "B5",
    "label": "Hwy. 90 Rayne Repeater"
  },
  {
    "code": "B1",
    "label": "Mire RAK 1W"
  },
  {
    "code": "B2",
    "label": "Roberts Cove Repeater / Piney Woods"
  },
  {
    "code": "B4",
    "label": "Crowley Historic District Repeater"
  },
  {
    "code": "B7",
    "label": "K5KEB Repeater"
  },
  {
    "code": "B8",
    "label": "North Crowley"
  },
  {
    "code": "BA",
    "label": "K5KEB2"
  },
  {
    "code": "BC",
    "label": "K5KEB3"
  },
  {
    "code": "BD",
    "label": "Breezeway Repeater"
  },
  {
    "code": "BE",
    "label": "Iota Repeater"
  },
  {
    "code": "A1",
    "label": "South Lafayette (E. Broussard)"
  },
  {
    "code": "E1",
    "label": "South Eunice"
  },
  {
    "code": "F0",
    "label": "Indian Bayou"
  }
];

migrate((app) => {
  const repeaters = app.findCollectionByNameOrId("repeaters");
  for (const data of REPEATERS) {
    const rec = new Record(repeaters);
    for (const key in data) rec.set(key, data[key]);
    app.save(rec);
  }
  const prefixes = app.findCollectionByNameOrId("prefixes");
  for (const data of PREFIXES) {
    const rec = new Record(prefixes);
    rec.set("code", data.code);
    rec.set("label", data.label);
    app.save(rec);
  }
}, (app) => {
  for (const data of REPEATERS) {
    try { app.delete(app.findFirstRecordByData("repeaters", "public_key", data.public_key)); } catch (_) {}
  }
  for (const data of PREFIXES) {
    try { app.delete(app.findFirstRecordByData("prefixes", "code", data.code)); } catch (_) {}
  }
});
