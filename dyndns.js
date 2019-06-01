/*
 * File: \dyndns.js
 * -------------------------
 * File Created: 20190127
 * Author: Cenk Kılıç (cenk@kilic.dev)
 * -------------------------
 * Last Modified: 20190601
 * Modified By: Cenk Kılıç (cenk@kilic.dev>)
 * Changelog:----------------
 * Date          By      Ver      Comments
 * -----------   ----    ----     ---------------------------------------------------------
 * 20190601      CK      v1.20   Optimized for public release.
 * 20190219      CK      v1.10   Fully functioning.
 * 20190124      CK      v1.00   Initial Version.
 */

// Print logo
console.log(`     +-+-+-+-+-+-+-+-+-+-+-+-+
     |d|o|-|d|y|n|d|n|s| v${require('./package.json').version}
     +-+-+-+-+-+-+-+-+-+-+-+-+`)
console.log('----------------------------------------')

// parse command line arguments
const args = require('yargs')
  .usage('Usage: $0 [options] [flags]')
  .option('r')
  .alias('r', 'repeat')
  .describe('r', 'Override the default repeat time in the database.')
  .boolean('o')
  .alias('o', 'once')
  .describe('o', 'Script will run once instead of the default option of repeating.')
  .option('c')
  .alias('c', 'config')
  .describe('c', 'Override the default database location.')
  .example('$0 -c ./cfg/configuration.json', 'Override the default database location to "./cfg/configuration.json".')
  .option('a')
  .alias('a', 'auth-token')
  .describe('a', 'Asks the user for prompt before taking action.')
  .option('s')
  .alias('s', 'subdomain')
  .describe('s', 'Asks the user for prompt before taking action.')
  .option('d')
  .alias('d', 'domain')
  .describe('d', 'Asks the user for prompt before taking action.')
  .boolean('m')
  .alias('m', 'memory')
  .describe('m', 'Will disable creating SQLITE database in $PWD which is intended reduce the API queries and run from program memory instead.')
  .example('$0', 'Run with the default values in the database. Database file will be created and shall be edited with auth-token, subdomain and domain name to function.')
  .example('$0 -a AUTH_TOKEN -s MYSUBDOMAIN -d MYDOMAIN.MOCK -r 36000', 'If all the parameters are defined it will run for given details with repeat time of one hour.')
  .example('$0 -a AUTH_TOKEN -s MYSUBDOMAIN -d MYDOMAIN.MOCK -o', 'If all the parameters are defined it will run for given details once.')
  .help('h')
  .version('v')
  .alias('h', 'help')
  .alias('v', 'version')
  .epilog('For more information please visit readme file at do-dyndns@(https://srcs.kilic.dev/do-dyndns/)').argv

const fs = require('fs')
const request = require('request')
const sqlite3 = require('sqlite3')
const path = require('path')
const moment = require('moment')
// database if enabled
let databaseRelURL
if (!args.config) {
  databaseRelURL = './dyndns.json'
} else {
  console.log(`Running with config flag. Overriding default database path with provided ${args.config}s.`)
  databaseRelURL = args.config
}
let configuration = {}
if ((args['auth-token'] && args.subdomain && args.domain) && (args.repeat || args.once)) {
  configuration.authtoken = args['auth-token']
  configuration.subdomainname = args.subdomain
  configuration.domainname = args.domain
} else {
  const databaseAbsURL = getExternalFile(databaseRelURL)
  initdatabase(databaseAbsURL)
  configuration = require(databaseAbsURL)
}
// command line arguments
if (args.once) {
  // run once and terminate
  console.log(`Running with once flag. Script will run once and terminate.`)
  main()
} else if (args.repeat) {
  // run with defined period
  console.log(`Running with repeat flag. Overriding default repeat value with provided ${args.repeat}s.`)
  main().then(() => { console.log(`Sleeping for ${args.repeat} seconds.`) })
  setInterval(() => { main().then(() => { console.log(`Sleeping for ${args.repeat} seconds.`) }) }, args.repeat * 1000)
} else {
  // run with database period
  main().then(() => { console.log(`Sleeping for ${configuration.repeat} seconds.`) })
  setInterval(() => { main().then(() => { console.log(`Sleeping for ${configuration.repeat} seconds.`) }) }, configuration.repeat * 1000)
}
// define memory for the argument
if (args.memory) {
  console.log('Running in memory mode will note create a SQLITE database at $PWD.')
  var memory
}

// This is for pkg to resolve external files
function getExternalFile (relPath) {
  if (typeof process.pkg === 'undefined') {
    return relPath
  } else {
    return path.resolve(path.dirname(process.execPath), relPath)
  }
}

function initdatabase (databaseURL) {
  // default database
  let buffer = JSON.stringify({ 'domainname': 'STR_DOMAINNAME', 'subdomainname': 'STR_SUBDOMMAINNAME', 'authtoken': 'STR_DOMAINNAME', 'repeat': 'INT_INSECONDS' })
  if (!fs.existsSync(databaseURL)) {
    fs.writeFileSync(databaseURL, buffer, { flag: 'wx' })
    console.error(`Database not found initating.`)
    console.log(`Database initiated. Program will terminate.`)
    console.log(`Please edit the database for it to function properly.`)
    process.exit(10)
  } else {
    console.log(`Database exists and succesfully read.`)
  }
}

async function main () {
  // print time stamp
  console.log('-------------------------------------------')
  console.log(`New run initiated @ ${moment().format('YMMDD, HH:mm:ss')}`)
  console.log('-------------------------------------------')

  console.log('Checking whether current IP matches domain IP.')
  var lastknownip
  var db
  if (!args.memory) {
    // Connect to the database
    db = new sqlite3.Database(getExternalFile('./dyndns.db'), (err) => {
      if (!err) {
        console.log('Connected to the database.')
      } else {
        console.error(err.message)
        process.exit(10)
      }
    })
    // Init table if it does not exists
    db.run('CREATE TABLE if not exists data(key text PRIMARY KEY, value text)')

    // Get last known ip address of the machine
    lastknownip = await new Promise((resolve) => {
      db.each('SELECT value FROM data WHERE key="lastknownip"', function (err, row) {
        if (!err) {
          console.log(`Last known IP address is ${row.value}`)
          resolve(row.value)
        } else {
          db.run('INSERT INTO "data" VALUES ("lastknownip","0") ON CONFLICT(key) DO UPDATE SET value=excluded.value;')
          resolve('Last known IP address is not avaliable. Initiating database tables.')
        }
      })
    })
  } else {
    lastknownip = typeof memory !== 'undefined' ? memory : ''
  }

  // Get current ip address of the machine
  let currentip = await resolvedata({
    url: 'https://api.ipify.org?format=json',
    method: 'GET',
    headers: {
      'User-Agent': 'dyndns'
    }
  }).then((data) => {
    console.log(`Current IP address is ${data.ip}`)
    // update last known ip address database entry
    if (!args.memory) {
      db.run(`INSERT INTO "data" VALUES ("lastknownip","${data.ip}") ON CONFLICT(key) DO UPDATE SET value=excluded.value;`)
    } else {
      memory = data.ip
    }
    return (data.ip)
  }).catch((err) => {
    // do nothing
    console.log(err)
  })

  // compare last known and current ip addresses
  if (currentip && (lastknownip !== currentip)) {
    console.log('IP address has been changed since last query.')
    // get domain records from digital ocean api
    console.log('Going ahead and checking details of given domain.')
    let domainrecords = await resolvedata({
      url: `https://api.digitalocean.com/v2/domains/${configuration.domainname}/records`,
      method: 'GET',
      headers: {
        'User-Agent': 'dyndns',
        'content-type': 'application/json',
        'Authorization': `Bearer ${configuration.authtoken}`
      }
    }).then((resolve) => {
      let domainrecords = []
      resolve.domain_records.forEach(data => {
        if (data.name === 'www' && data.type === 'A') {
          domainrecords.server = data
        }
        if (data.name === configuration.subdomainname && data.type === 'A') {
          domainrecords.subdomain = data
        }
      })
      return domainrecords
    }).catch((err) => {
      // do nothing
      console.log(err)
    })

    if (domainrecords) {
      console.log(`DNS records resolves the server IP to ${domainrecords.subdomain.data}`)
      // checking if current ip is behind vpn or not
      if (currentip !== domainrecords.server.data && currentip !== domainrecords.subdomain.data) {
        console.log('Current server is not behind the VPN of dyndns server.')
        console.log('Current subdomain DNS configuration is different from the current IP address.')
        // updating the existing records for the domain.
        console.log(`Updating the existing records for subdomain ${domainrecords.subdomain.data} with id ${domainrecords.subdomain.id}`)
        resolvedata({
          url: `https://api.digitalocean.com/v2/domains/${configuration.domainname}/records/${domainrecords.subdomain.id}`,
          method: 'PUT',
          headers: {
            'User-Agent': 'dyndns',
            'content-type': 'application/json',
            'Authorization': `Bearer ${configuration.authtoken}`
          },
          body: JSON.stringify({
            'data': currentip
          })
        }).then(() => {
          console.log('Updated DNS Records with new dynamic IP address.')
        }).catch((err) => {
          // trying again
          console.error(err)
          console.error('Could not complete request trying again.')
        })
      } else {
        console.log('IP address has not changed from the existing DNS records.')
        console.log('Doing nothing till next check.')
      }
    } else {
      console.log('IP Address is the same with last known IP doing no further action.')
    }
  } else {
    console.log('IP Address has not been changed since last query.')
  }

  // Close the sqlitedb connection.
  if (!args.memory) {
    db.close()
  }
}

// resolve http request with promise
async function resolvedata (options) {
  return new Promise(function (resolve, reject) {
    request(options, function (error, res, body) {
      if (!error && res.statusCode === 200) {
        body = JSON.parse(body)
        resolve(body)
      } else {
        reject('Can not get data. API is not responding.')
      }
    })
  })
}
