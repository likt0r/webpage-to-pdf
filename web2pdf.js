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

let scrapeLimit = 100;
let downloadLimit = 10;
let outputDir = "./output";
let outputFileName = "output.pdf";
let baseUrl = "";
let maxDepth = 0;
let runningScraperCounter = 0;
let scrapeUrlQueue = [];
let workingUrls = [];
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
  while (scrapeUrlQueue.length > 0 || runningScraperCounter > 0) {
    if (runningScraperCounter < scrapeLimit && scrapeUrlQueue.length > 0) {
      url = scrapeUrlQueue.shift();
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
  try {
    const { data } = await axios.get(url);
    htmlContent = data;
    workingUrls.push(url);
    const $ = cheerio.load(htmlContent);
    const links = [];

    $("a[href]").each((_, element) => {
      // console.log(`Found link ${$(element).attr("href")}`);

      noAnchor = $(element).attr("href").split("#")[0];
      console.log(noAnchor);
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
  const browser = await puppeteer.launch();
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
  // delete individual pdfs
  // for (const pdfFile of pdfFiles) {
  //   fs.unlinkSync(pdfFile);
  // }
}

const main = async (startUrl, recursive) => {
  baseUrl = startUrl;
  maxDepth = recursive ? 100 : 0;
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
};

const argv = yargs(process.argv.slice(2)).options({
  url: {
    type: "string",
    demandOption: true,
    describe: "URL of the webpage to convert",
  },
  recursive: {
    type: "boolean",
    default: false,
    describe: "Recursively follow links",
  },
}).argv;

main(argv.url, argv.recursive);
