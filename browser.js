import { log } from "./log";
import { PUPPETEER_REVISIONS } from "puppeteer-core/internal/revisions.js";
import * as browsers from "@puppeteer/browsers";
import os from "os";

// ensure the browser is installed.
// NB this is required because Bun does not execute arbitrary dependencies
//    lifecycle scripts, such as postinstall. even if it did, currently,
//    puppeteer assumes node is being used, so that would not work either.
//    see https://github.com/puppeteer/puppeteer/blob/puppeteer-v21.1.1/packages/puppeteer/package.json#L43
//    see https://bun.sh/docs/cli/install#trusted-dependencies
export async function browserInstall() {
    let installed = false;
    const chromeVersion = PUPPETEER_REVISIONS.chrome;
    await browsers.install({
        browser: "chrome",
        buildId: chromeVersion,
        cacheDir: `${os.homedir()}/.cache/puppeteer`,
        downloadProgressCallback: (downloadedBytes, totalBytes) => {
            if (!installed) {
                installed = true;
                log(`Downloading the browser Chrome/${chromeVersion}...`);
            }
        },
    });
}
