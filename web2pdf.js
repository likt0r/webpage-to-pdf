#!/usr/bin/env node
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const yargs = require("yargs");
const path = require("path");
var async = require("async");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const urlMap = {};

let scrapeLimit = 20;
let downloadLimit = 10;
let outputDir = "./output";
let outputFileName = "output.pdf";
let baseUrl = "";
let maxDepth = 0;
let runningScraperCounter = 0;
let scrapeUrlQueue = [];
let workingUrls = [];
let keepTemp = false;
let inflate = false;
function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Directory created: ${dirPath}`);
  } else {
    console.log(`Directory already exists: ${dirPath}`);
  }
}

async function startScrape(url) {
  console.log(`Starting scrape of ${url}`);

  scrapeUrlQueue.push(url);
  urlMap[url] = true;
  while (scrapeUrlQueue.length > 0 || runningScraperCounter > 0) {
    if (runningScraperCounter < scrapeLimit && scrapeUrlQueue.length > 0) {
      url = scrapeUrlQueue.shift();
      console.log(`Scraping ${url}`);
      scrapeUrl(url);
    } else {
      await sleep(100);
    }
    // console.log(
    //   `scrapeUrlQueue ${scrapeUrlQueue.length} runningScraperCounter ${runningScraperCounter}`
    // );
  }
  console.log("Scraping done found ", workingUrls.length);
}

async function scrapeUrl(url) {
  runningScraperCounter++;
  let htmlContent = "";
  let $ = "";
  try {
    if (inflate) {
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2" });

      htmlContent = await page.content();
      await browser.close();
      $ = cheerio.load(htmlContent);
      workingUrls.push(url);
    } else {
      const { data } = await axios.get(url);
      htmlContent = data;
      workingUrls.push(url);

      $ = cheerio.load(htmlContent);
    }

    const links = [];

    $("a[href]").each((_, element) => {
      // console.log(`Found link ${$(element).attr("href")}`);

      noAnchor = $(element).attr("href").split("#")[0];

      if (!noAnchor) {
        return;
      }

      let href = noAnchor;

      if (href.startsWith("/")) {
        href = new URL(href, baseUrl).href;
      }
      if (href.startsWith(".")) {
        href = new URL(href, url).href;
      }
      if (!href.startsWith(baseUrl)) {
        // if link starts not with base url, ignore
        return;
      }
      if (href in urlMap) {
        return;
      }
      // console.log(`Adding link ${href}`);
      if (!urlMap[href]) {
        urlMap[href] = true;
        links.push(href);
      }
    });
    scrapeUrlQueue = [...scrapeUrlQueue, ...links];
  } catch (error) {
    console.log(`Error fetching ${url}  `);
  }

  runningScraperCounter--;
}

function urlToFilename(url) {
  return url
    .replace(/^https?:\/\//, "") // Remove protocol
    .replace(/[^a-zA-Z0-9]/g, "_") // Replace non-alphanumeric characters with underscores
    .replace(/__+/g, "_") // Replace multiple underscores with a single underscore
    .replace(/^_|_$/g, ""); // Remove leading and trailing underscores
}

const convertToPdf = async (url, index) => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });
  const pdfName = path.join(outputDir, `output_${urlToFilename(url)}.pdf`);
  await page.pdf({ path: pdfName, format: "A4" });
  await browser.close();
  return pdfName;
};

async function mergePdfs(pdfFiles) {
  const mergedPdf = await PDFDocument.create();

  for (const pdfFile of pdfFiles) {
    const pdfBytes = fs.readFileSync(pdfFile);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedPdfBytes = await mergedPdf.save();
  fs.writeFileSync(outputFileName, mergedPdfBytes);
  if (!keepTemp) {
    // delete individual pdfs
    for (const pdfFile of pdfFiles) {
      fs.unlinkSync(pdfFile);
    }
  }
}

async function main(
  startUrl,
  {
    recursive,
    outputFileName: outputFileName_,
    outputDir: outputDir_,
    keepTemp: keepTemp_,
    baseUrl: baseUrl_,
    inflate: inflate_,
  }
) {
  if (baseUrl_) {
    baseUrl = baseUrl_;
  } else {
    baseUrl = startUrl;
  }
  outputFileName = outputFileName_;
  outputDir = outputDir_;
  keepTemp = keepTemp_;
  maxDepth = recursive ? 100 : 0;
  inflate = inflate_;
  await startScrape(startUrl);
  console.log(`Start downloading page ...`);
  ensureDirectoryExists(outputDir);
  const pdfFiles = await async.mapLimit(
    workingUrls,
    downloadLimit,
    convertToPdf
  );
  console.log(`Combine files to one PDF ...`);
  await mergePdfs(pdfFiles);
  // For PDF merging, you might need to use an external tool or library
  // Code for merging PDFs and cleaning up individual PDFs goes here
}

const argv = yargs(process.argv.slice(2)).options({
  url: {
    type: "string",
    demandOption: true,
    describe: "URL of the webpage to convert",
  },
  outputFileName: {
    type: "string",
    demandOption: false,
    default: "output.pdf",
    describe: "Filename of the pdf file to write to",
  },
  outputDir: {
    type: "string",
    demandOption: false,
    default: "./output",
    describe: "Directory where temporary pdf files are created",
  },
  recursive: {
    type: "boolean",
    default: false,
    describe: "Recursively follow links",
  },
  keepTemp: {
    type: "boolean",
    default: false,
    describe: "Recursively follow links",
  },
  baseUrl: {
    type: "string",
    demandOption: false,
    describe: "Base url to use for relative links",
  },
  inflate: {
    type: "boolean",
    default: false,
    describe:
      "Inflate pages so javascript is rendered. Use this if it is a single page app",
  },
}).argv;

main(argv.url, {
  recursive: argv.recursive,
  outputFileName: argv.outputFileName,
  outputDir: argv.outputDir,
  keepTemp: argv.keepTemp,
  baseUrl: argv.baseUrl,
  inflate: argv.inflate,
});
