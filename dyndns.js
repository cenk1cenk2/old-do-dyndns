/*
 * File: dyndns.js
 * Project: dyndns - digitalocean
 * -------------------------
 * File Created: 20190124
 * Author: Cenk Kılıç (cenk1cenk2cenk3@gmail.com)
 * -------------------------
 * Last Modified: 22:39, 20190221
 * Modified By: Cenk Kılıç (cenk1cenk2cenk3@gmail.com>)
 * -------------------------
 * Changelog:
 * Date      	By	Rev		Comments
 * ----------	---	---		---------------------------------------------------------
 * 20190219		CK	v1.1    Fully functioning.
 * 20190124		CK	v1.0    Initial Version.
 */

const request = require('request');
const sqlite3 = require('sqlite3');
const configuration = require('./dyndns.json')
const execPath = ''
// for production version enable external file read
const path = require('path');
// const execPath = path.dirname(process.execPath)
// const configuration = require(path.join(execPath, './dyndns.json'))

// variables
const domainname = configuration.domainname;
const subdomainname = configuration.subdomainname;
const authtoken = configuration.authtoken;

async function main() {
    // Greet
    console.log('########################');
    console.log('### DYNDNS');
    console.log('########################');

    console.log('Checking whether current IP matches domain IP.')

    // Connect to the database
    let db = new sqlite3.Database(path.join(execPath, './dyndns.db'), (err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Connected to the database.');
        }
    });
    // Init table if it does not exists
    db.run('CREATE TABLE if not exists data(key text PRIMARY KEY, value text)');

    // Get last known ip address of the machine
    let lastknownip = await readlastknownip(db);

    // Get current ip address of the machine
    let currentip = await resolvedata({
        url: 'https://api.ipify.org?format=json',
        method: 'GET',
        headers: {
            'User-Agent': 'dyndns'
        }
    }).then((data) => {
        console.log('Current IP address is %s', data.ip);
        // update last known ip address database entry
        db.run('INSERT INTO "data" VALUES ("lastknownip","' + data.ip + '") ON CONFLICT(key) DO UPDATE SET value=excluded.value;');
        return (data.ip)
    }).catch((err) => {
        // do nothing
        console.log(err);
    })


    // compare last known and current ip addresses
    if (currentip && (lastknownip != currentip)) {
        console.log('IP address has been changed since last query.');
        // get domain records from digital ocean api
        console.log('Going ahead and checking details of given domain.');
        let domainrecords = await resolvedata({
            url: 'https://api.digitalocean.com/v2/domains/' + domainname + '/records',
            method: 'GET',
            headers: {
                'User-Agent': 'dyndns',
                'content-type': 'application/json',
                'Authorization': 'Bearer ' + authtoken
            }
        }).then((resolve) => {
            let domainrecords = [];
            resolve.domain_records.forEach(data => {
                if (data.name == 'www' && data.type == 'A') {
                    domainrecords.server = data;
                }
                if (data.name == subdomainname && data.type == 'A') {
                    domainrecords.subdomain = data;
                }
            });
            return domainrecords
        }).catch((err) => {
            // do nothing
            console.log(err);
        })

        if (domainrecords) {
            console.log('DNS records resolves the server IP to %s', domainrecords.subdomain.data);
            // checking if current ip is behind vpn or not
            if (currentip != domainrecords.server.data && currentip != domainrecords.subdomain.data) {
                console.log('Current server is not behind the VPN of dyndns server.');
                console.log('Current subdomain DNS configuration is different from the current IP address.');
                // updating the existing records for the domain.
                console.log('Updating the existing records for subdomain %s with id %i', domainrecords.subdomain.data, domainrecords.subdomain.id);
                resolvedata({
                    url: 'https://api.digitalocean.com/v2/domains/' + domainname + '/records/' + domainrecords.subdomain.id,
                    method: 'PUT',
                    headers: {
                        'User-Agent': 'dyndns',
                        'content-type': 'application/json',
                        'Authorization': 'Bearer ' + authtoken
                    },
                    body: JSON.stringify({
                        'data': currentip
                    })
                }).then((data) => {
                    console.log('Updated DNS Records with new dynamic IP address.');
                }).catch((err) => {
                    // trying again
                    console.error(err);
                    console.log('Could not complete request trying again.');
                })
            } else {
                console.log('IP address has not changed from the existing DNS records.')
                console.log('Doing nothing till next check.');

            }
        } else {
            console.log('IP Address is the same with last known IP doing no further action.');
        }
    }

    // Close the sqlitedb connection.
    db.close();

}

// resolve http request with promise
async function resolvedata(options) {
    return new Promise(function (resolve, reject) {
        request(options, function (error, res, body) {
            if (!error && res.statusCode == 200) {
                body = JSON.parse(body);
                resolve(body);
            } else {
                reject('Error: Can not get data. API is not responding.');
            }
        });
    });
}

// read last known ip
async function readlastknownip(db) {
    return new Promise(function (resolve) {
        db.each('SELECT value FROM data WHERE key="lastknownip"', function (err, row) {
            if (!err) {
                console.log('Last known IP address is %s', row.value);
                resolve(row.value);
            } else {
                db.run('INSERT INTO "data" VALUES ("lastknownip","0") ON CONFLICT(key) DO UPDATE SET value=excluded.value;');
                resolve('Last known IP address is not avaliable. Initiating database tables.')
            }
        });
    });
}

// run main function
main();