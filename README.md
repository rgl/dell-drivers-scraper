# About

[![Build status](https://github.com/rgl/dell-drivers-scraper/workflows/build/badge.svg)](https://github.com/rgl/dell-drivers-scraper/actions?query=workflow%3Abuild)

This scrapes the Dell Product Drivers page into a JSON data file.

## Products

* [OptiPlex 7060 Desktop](https://www.dell.com/support/home/en-us/product-support/product/optiplex-7060-desktop/drivers)

## Data Files

The code in this repository creates a `data/optiplex-7060-desktop.json` file, for example:

```json
[
    {
        "name": "Dell OptiPlex 7060 System BIOS",
        "category": "BIOS",
        "importance": "critical",
        "date": "2023-01-12T00:00:00.000Z",
        "url": "https://dl.dell.com/FOLDER09328185M/1/OptiPlex_7060_1.24.0.exe"
    },
]
```

To get the BIOS and the Intel ME Windows drivers download URLs, you can use something like:

```bash
jq -r '[.[] | select(.name == "Dell OptiPlex 7060 System BIOS")] | first' data/optiplex-7060-desktop.json
jq -r '[.[] | select(.name == "Intel Management Engine Components Installer")] | first' data/optiplex-7060-desktop.json
```

## Usage

Install [Node.js](https://nodejs.org).

Execute:

```bash
npm ci
node main.js
```
