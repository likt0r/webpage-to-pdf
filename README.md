Script to create a pdf out of a website


## How to use:
```bash
./web2pdf --recursive --url https://example.com
```

## Options:
```
Optionen:
  --help            Hilfe anzeigen                                     [boolean]
  --version         Version anzeigen                                   [boolean]
  --url             URL of the webpage to convert        [string] [erforderlich]
  --outputFileName  Filename of the pdf file to write to
                                               [string] [Standard: "output.pdf"]
  --outputDir       Directory where temporary pdf files are created
                                                 [string] [Standard: "./output"]
  --recursive       Recursively follow links         [boolean] [Standard: false]
  --keepTemp        Recursively follow links         [boolean] [Standard: false]
  --baseUrl         Base url to use for relative links                  [string]
  --inflate         Inflate pages so javascript is rendered. Use this if it is a
                    single page app                  [boolean] [Standard: false]

```
