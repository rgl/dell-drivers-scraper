// install dependencies:
//
//      bun install --frozen-lockfile
//
// execute:
//
// NB to troubleshoot uncomment $env:DEBUG and set {headless:false,dumpio:true} in main.js.
//
//      export DEBUG='puppeteer:*'
//      bun run main.js

import { log } from "./log";
import { program } from "commander";
import { browserInstall } from "./browser";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

async function getDrivers(page, product) {
    const url = `https://www.dell.com/support/home/en-us/product-support/product/${product}/drivers`;

    log(`Loading ${url}...`);
    await page.goto(url);

    log("Rejecting cookies...");
    const rejectCookiesSelector = '[aria-label="dismiss cookie message"]';
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
    const downloadsTableSelector = "#downloads-table";
    await page.waitForSelector(`${downloadsTableSelector} tr:nth-child(5)`);
    await page.waitForSelector(`${downloadsTableSelector} #paginationRow`);
    await page.click(`${downloadsTableSelector} #paginationRow`);

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
        const els = document.querySelectorAll("#downloads-table tr.main-row");
        for (const el of els) {
            const columnEls = el.querySelectorAll("td");
            if (columnEls.length < 7) {
                continue;
            }
            const name = columnEls[1].innerText.trim();
            const importance = columnEls[2].innerText.trim().toLowerCase();
            const category = columnEls[3].innerText.trim();
            const date = parseDate(columnEls[4].innerText.trim());
            const url = columnEls[5].querySelector("a.btn-download-lg").getAttribute("href").trim().replaceAll(" ", "%20");
            const driver = {
                name: name,
                category: category,
                importance: importance,
                date: date.toISOString(),
                url: url,
            };
            if (false) {
                columnEls[6].querySelector("button").click();
                const detailsEl = el.nextSibling && document.evaluate("//a[text()='View full driver details']", el.nextSibling, null, XPathResult.ANY_TYPE, null).iterateNext();
                const detailsUrl = detailsEl && detailsEl.getAttribute("href");
                columnEls[6].querySelector("button").click();
                driver.detailsUrl = detailsUrl;
            }
            data.push(driver);
        }
        return data;
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

    await browserInstall();

    log("Launching the browser...");
    const browser = await puppeteer.launch(browserConfig);
    try {
        log("Creating a new browser page...");
        const page = await browser.newPage();
        await page.setViewport({
            width: parseInt(options.viewportSize.split('x')[0], 10),
            height: parseInt(options.viewportSize.split('x')[1], 10),
            deviceScaleFactor: 1,
        });
        log(`Launched the ${await browser.version()} browser.`);

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
