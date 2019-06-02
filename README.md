```
name:         | do-dyndns
compiler:     | nodejs
version:      | v1.20, 20190602
```
# do-dyndns

## Description:

Update the domain records that are redirected and managed by Digital Ocean name servers using the API automatically. The script will periodically or once check the IP address of the running server and if it differs from the domain records in Digital Ocean it will update it using the Digital Ocean API.

## Compiled Version
You can find the compiled version in the [releases](https://github.com/cenk1cenk2/do-dyndns/releases/latest). It is compiled with [zeit/pkg](https://github.com/zeit/pkg). The script is both compiled for Windows, Linux and Macintosh platforms since it is a platform-independent simple script.

## Setup:
## Fast Setup
* In the initial run, it will generate the database while ./dyndns.json file which needs to be edited with the parameters.

### Configuration of Database
If you want to run with a saved file without any command line arguments, in the first run the script will create a database file as below.
*Example:* 
```
{
  "domainname": "mydomain.mock",
  "subdomainname": "www",
  "authtoken": "STRING_TOKEN", (please refer to: https://www.digitalocean.com/docs/api/create-personal-access-token/)
  "repeat": 36000 (in seconds)
}
```

## Run from Command Line
**If you want to run without creating any additional files at the $PWD you will have to enable both modes, making it not use a JSON file as database and SQLite file as memory. But you can enable them independently as well.**
### Arguments Needed
If you want to use it without creating any database you must use all -\[-a\]uth-token, -\[-s\]ubdomain, -\[-d\]omain flags combined with either a -\[-r\]epeat interval to repeat in given seconds or -\[-o\]nce if you want to run the script once. An example can be found in -\[-h\]elp option.
*Example:* `dyndns -a TOKENSTRING -s www -d mydomain.mock -r 36000` to repeat or `dyndns -a TOKENSTRING -s www -d mydomain.mock -o` to run once.
### Memory Option
If you want to run in memory mode so that it will not create a `./dyndns.db` SQLLITE file for making less queries to DigitalOcean API you must also enable -\[-m\]emory flag as well.
*Example:* 
  * `dyndns -a TOKENSTRING -s www -d mydomain.mock -r 36000 -m` to run repeating without creating any files.
  * `dyndns -m` to run with `dyndns.json` but not creating additional memory database for multiple operations called `./dyndns.db`.

## Running Multiple Instances
### With a Database
You can define the -\[-c\]onfig flag to set database location so for multiple instances you must define multiple databases.
*Example:*
  * `dyndns -c ./config1.json & \ dyndns -c ./config2.json &` to run two instances in background.

### From the Command Line Only
If you want to run multiple instances from the command line only you must define for each instances all -\[-a\]uth-token, -\[-s\]ubdomain, -\[-d\]omain flags combined with either a -\[-r\]epeat interval to repeat in given seconds or -\[-o\]nce if you want to run the script once.
*Example:*
  * `dyndns -a TOKENSTRING -s www -d mydomain.mock -r 36000 -m & \ dyndns -a TOKENSTRING -s sub -d mydomain.mock -r 36000 -m &` to run two instances in background repeating without creating any files.

## Command Line Options
```
Usage: dyndns [options] [flags]                                              
                                                                                
Options:                                                                        
  -r, --repeat      Override the default repeat time in the database.           
  -o, --once        Script will run once instead of the default option of       
                    repeating.                                         [boolean]
  -c, --config      Override the default database location.                     
  -a, --auth-token  Asks the user for prompt before taking action.              
  -s, --subdomain   Asks the user for prompt before taking action.              
  -d, --domain      Asks the user for prompt before taking action.              
  -m, --memory      Will disable creating SQLITE database in $PWD which is      
                    intended reduce the API queries and run from program memory 
                    instead.                                           [boolean]
  -h, --help        Show help                                          [boolean]
  -v, --version     Show version number                                [boolean]                                 
```