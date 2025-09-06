"use strict";

// install dependencies:
//
//      npm install
//
// execute:
//
// NB to troubleshoot uncomment $env:DEBUG and set {headless:false,dumpio:true} in main.js.
//
//      $env:DEBUG = 'puppeteer:*'
//      node main.js

import { program } from "commander";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

function log() {
    console.log.apply(console, [new Date().toISOString(), ...arguments]);
}

async function getDrivers(page, product) {
    const url = `https://www.dell.com/support/home/en-us/product-support/product/${product}/drivers`;

    log(`Loading ${url}...`);
    await page.goto(url);

    log("Rejecting cookies...");
    const rejectCookiesSelector = '[aria-label="cookieconsent"] .cc-dismiss';
    try {
        await page.waitForSelector(rejectCookiesSelector, {timeout: 5000});
        await page.click(rejectCookiesSelector);
    } catch {
        // ignore. this is expected in countries without cookies consent.
    }

    log("Selecting the United States/English region...");
    const countrySelector = "div.mh-top div.country-selector";
    const currentCountry = await page.evaluate((countrySelector) => document.querySelector(countrySelector).innerText.trim(), countrySelector);
    if (currentCountry != "US/EN") {
        await page.hover(`${countrySelector} a`);
        await page.waitForSelector(`${countrySelector} [data-region-id="Americas"]`);
        await page.click(`${countrySelector} [data-region-id="Americas"]`);
        await page.click(`${countrySelector} a[data-locale="en-us"]`);
        await page.waitForNavigation();
    }

    log("Waiting for the downloads table...");
    await page.waitForSelector("#driver-list-table #dnd-list-tab0 div.dds__td span.dds__table__cell::-p-text(BIOS)");

    log("Getting data from the downloads table...");
    return await page.evaluate(async () => {
        // e.g. 12 Jan 2023
        const dateRe = /0?(?<day>[0-9]+) (?<month>[A-Za-z]+) (?<year>[0-9]+)/;
        const dateMonths = {
            Jan: 1,
            Feb: 2,
            Mar: 3,
            Apr: 4,
            May: 5,
            Jun: 6,
            Jul: 7,
            Aug: 8,
            Sep: 9,
            Oct: 10,
            Nov: 11,
            Dec: 12,
        }
        function parseDate(s) {
            const m = dateRe.exec(s);
            const day = parseInt(m.groups.day, 10);
            const month = dateMonths[m.groups.month];
            const year = parseInt(m.groups.year, 10);
            return new Date(Date.UTC(year, month - 1, day));
        }

        var data = [];
        const els = document.querySelectorAll("#driver-list-table #dnd-list-tab0 .dds__tbody .dds__tr");
        for (const el of els) {
            const columnEls = el.querySelectorAll(".dds__table__cell");
            if (columnEls.length != 5) {
                continue;
            }
            const name = columnEls[0].innerText.trim();
            const importance = columnEls[1].innerText.trim().toLowerCase();
            const date = parseDate(columnEls[2].innerText.trim());
            const category = columnEls[3].innerText.trim();
            const url = columnEls[4].querySelector("[href]").getAttribute("href").trim().replaceAll(" ", "%20");
            const driver = {
                name: name,
                category: category,
                importance: importance,
                date: date.toISOString(),
                url: url,
            };
            data.push(driver);
        }
        // sort by name ascending, then by date descending.
        return data.sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            const nameCompare = nameA > nameB ? 1 : nameA < nameB ? -1 : 0;
            if (nameCompare !== 0) {
                return nameCompare;
            }
            return -(a.date > b.date ? 1 : a.date < b.date ? -1 : 0);
        });
    });
}

async function main(options) {
    var browserConfig = {
        args: [
            "--start-maximized"
        ],
        headless: "new",
    };
    if (options.debug) {
        browserConfig = {
            ...browserConfig,
            headless: false,
            devtools: true,
            slowMo: 250,
            dumpio: false,
        };
    }

    log("Launching the browser...");
    const browser = await puppeteer.launch(browserConfig);
    try {
        log(`Launched the ${await browser.version()} browser.`);

        const [page] = await browser.pages();

        log("Setting the browser user agent...");
        await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36");

        log("Setting the browser viewport...");
        await page.setViewport({
            width: parseInt(options.viewportSize.split('x')[0], 10),
            height: parseInt(options.viewportSize.split('x')[1], 10),
            deviceScaleFactor: 1,
        });

        try {
            const product = "optiplex-7060-desktop";
            const scrapePath = `data/${product}.json`;

            log(`Scraping ${product}...`);
            const data = await getDrivers(page, product);

            log(`Saving to ${scrapePath}...`);
            fs.mkdirSync(path.dirname(scrapePath), {recursive: true});
            fs.writeFileSync(scrapePath, JSON.stringify(data, null, 4));
        } finally {
            log("Taking a screenshot...");
            await page.screenshot({ path: options.screenshotPath, fullPage: true });
        }
    } finally {
        await browser.close();
    }
}

program
    .option('--screenshot-path <path>', 'screenshot output path', 'screenshot.png')
    .option('--viewport-size <size>', 'browser viewport size', '1280x720')
    .option('--debug', 'run the browser in foreground', false)
    .parse(process.argv);

await main(program.opts());
