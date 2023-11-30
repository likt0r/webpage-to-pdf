#!/usr/bin/env node
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const yargs = require("yargs");
var async = require("async");
const linkMap = {};

let scrapeLimit = 20;
let downloadLimit = 10;
let baseUrl = "";
let maxDepth = 0;
const fetchLinks = async (url) => {
  if (linkMap[link] === true) {
    return;
  }
  console.log(`Processing link ${link}`);
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
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
    if (new URL(href).origin !== new URL(baseUrl).origin) {
      return;
    }
    if (href in linkMap) {
      return;
    }
    // console.log(`Adding link ${href}`);
    linkMap[href] = false;
    links.push(href);
  });

  return links;
};

const convertToPdf = async (url, index) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });
  const pdfName = `output_${index}.pdf`;
  await page.pdf({ path: pdfName, format: "A4" });
  await browser.close();
  return pdfName;
};

const recursiveScrape = async (url) => {
  if (currentDepth >= maxDepth || visited.has(url)) return [];
  linkMap[url] = true;
  const links = await fetchLinks(url, visited, baseUrl);
  //   const pdfFiles = [await convertToPdf(url, currentDepth)];
  pdfFiles = [];
  console.log(`Found ${links.length} links`);
  for (const link of links) {
    const childPdfs = await recursiveScrape(
      link,
      visited,
      baseUrl,
      maxDepth,
      currentDepth + 1
    );
    pdfFiles.push(...childPdfs);
  }
  return pdfFiles;
};

const main = async (startUrl, recursive) => {
  baseUrl = startUrl;
  maxDepth = recursive ? 100 : 0;
  const pdfFiles = await recursiveScrape(startUrl);

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
