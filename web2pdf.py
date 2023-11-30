import os
import requests
import argparse
from bs4 import BeautifulSoup
from PyPDF2 import PdfFileMerger
from urllib.parse import urlparse, urljoin

import subprocess


def fetch_links(url, visited, base_url):
    print(f"fetch links Url: {url}")
    if url in visited:
        return []
    print(f"Fetching {url}")
    visited.add(url)
    
    # Use requests to get the page content
    page = requests.get(url)
    soup = BeautifulSoup(page.content, 'html.parser')

    links = []
    for a in soup.find_all('a', href=True):

        href = a['href']  # Access href like a dictionary
        if href:
            # Check if the link is relative and join with base URL
            if href.startswith('/'):
                link = urljoin(base_url, href)
                print(base_url+href)
                links.append(link)
            if href.startswith('./'):
                link = urljoin(url, href[2:])  # Remove './' before joining
                links.append(link)
            if href.startswith('http'):
            # Check if the absolute URL belongs to the base domain
                if urlparse(href).netloc == urlparse(base_url).netloc:
                    links.append(link)

    visited.add(url)            
    return links
def convert_to_pdf(url, index, screen_width='1680'):
    pdf_name = f"output_{index}.pdf"
    command = f"wkhtmltopdf --viewport-size {screen_width} {url} {pdf_name}"
    subprocess.run(command, shell=True)
    return pdf_name

def recursive_scrape(url, visited, base_url, max_depth, url_to_pdf, current_depth=0):
    print(f"Url: {url}, Current depth: {current_depth}")
    if current_depth >= max_depth or url in visited:
        return []
    
    # if url not in url_to_pdf:
    #     pdf_name = convert_to_pdf(url, len(url_to_pdf))
    #     url_to_pdf[url] = pdf_name
    # pdf_files = [url_to_pdf[url]]
    pdf_files = []
    links = fetch_links(url, visited, base_url)

    print(links)
    for link in links:
        pdf_files.extend(recursive_scrape(link, visited, base_url, max_depth, url_to_pdf, current_depth + 1))
    return pdf_files


def main(start_url, recursive):
    visited = set()
    max_depth = 100 if recursive else 0
    
    url_to_pdf = {}
    pdf_files = recursive_scrape(start_url, visited, start_url, max_depth, url_to_pdf)

    # Merging PDFs
    merger = PdfFileMerger()
    for pdf in pdf_files:
        merger.append(pdf)
    merger.write("final_output.pdf")
    merger.close()

    # Cleanup individual PDFs
    for pdf in pdf_files:
        os.remove(pdf)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Webpage to PDF converter")
    parser.add_argument("url", type=str, help="URL of the webpage to convert")
    parser.add_argument("-r", "--recursive", action="store_true", help="Recursively follow links")
    args = parser.parse_args()

    main(args.url, args.recursive)
