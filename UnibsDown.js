"use strict";

const execSync = require('child_process').execSync;
const puppeteer = require('puppeteer');
const term = require("terminal-kit").terminal;
const fs = require("fs");
var https = require('https');
const url = require('url');
const path = require("path");
const yargs = require('yargs');
const request = require('request');
const jqery = require("jquery");

const argv = yargs.options({
    v: { alias:'videoUrl', type: 'array', demandOption: true },
    u: { alias:'username', type: 'string', demandOption: true, describe: 'Your Email' },
    p: { alias:'password', type: 'string', demandOption: false },
    o: { alias:'outputDirectory', type: 'string', default: 'e:/unibs/test' },
    q: { alias: 'quality', type: 'number', demandOption: false, describe: 'Video Quality, usually [0-5]'},
    k: { alias: 'noKeyring', type: 'boolean', default: false, demandOption: false, describe: 'Do not use system keyring'},
})
    .help('h')
    .alias('h', 'help')
    .example('node $0 -u CODICEPERSONA -v "https://elearning.unibs.it/course/view.php?id=15476"\n', "Standard usage")
    .example('node $0 -u CODICEPERSONA -v "https://elearning.unibs.it/course/view.php?id=15476" "https://elearning.unibs.it/course/view.php?id=15506"\n', "Multiple videos download")
    .example('node $0 -u CODICEPERSONA -v "https://elearning.unibs.it/course/view.php?id=15476" -q 4\n', "Define default quality download to avoid manual prompt")
    .example('node $0 -u CODICEPERSONA -v "https://elearning.unibs.it/course/view.php?id=15476" -o "C:\\Lessons\\Videos"\n', "Define output directory (absoulte o relative path)")
    .example('node $0 -u CODICEPERSONA -v "https://elearning.unibs.it/course/view.php?id=15476" -k\n', "Do not save the password into system keyring")
    .argv;
console.info('\nVideo URLs: %s', argv.videoUrls);
if(typeof argv.username !== 'undefined') {console.info('Email: %s', argv.username);}
console.info('Output Directory: %s\n', argv.outputDirectory);

function sanityChecks() {
    if (!fs.existsSync(argv.outputDirectory)) {
        if (path.isAbsolute(argv.outputDirectory) || argv.outputDirectory[0] == '~') console.log('Creating output directory: ' + argv.outputDirectory);
        else console.log('Creating output directory: ' + process.cwd() + path.sep + argv.outputDirectory);
        try {
            fs.mkdirSync(argv.outputDirectory, { recursive: true }); // use native API for nested directory. No recursive function needed, but compatible only with node v10 or later
        } catch (e) {
            term.red("Can not create nested directories. Node v10 or later is required\n");
            process.exit();
        }
    }
}
async function downloadLink(videoUrls, email, password, outputDirectory) {
    email = await handleEmail(email);
    // handle password
    const keytar = require('keytar');
    //keytar.deletePassword('MStreamDownloader', email);
    if (password === null) { // password not passed as argument
        var password = {};
        if (argv.noKeyring === false) {
            try {
                await keytar.getPassword("UnibsDown", email).then(function (result) {
                    password = result;
                });
                if (password === null) { // no previous password saved
                    password = await promptPassword("Password not saved. Please enter your password, MStreamDownloader will not ask for it next time: ");
                    await keytar.setPassword("UnibsDown", email, password);
                } else {
                    console.log("\nReusing password saved in system's keychain!")
                }
            } catch (e) {
                console.log("X11 is not installed on this system. MStreamDownloader can't use keytar to save the password.")
                password = await promptPassword("No problem, please manually enter your password: ");
            }
        } else {
            password = await promptPassword("\nPlease enter your password: ");
        }
    } else {
        if (argv.noKeyring === false) {
            try {
                await keytar.setPassword("UnibsDown", email, password);
                console.log("Your password has been saved. Next time, you can avoid entering it!");
            } catch (e) {
                // X11 is missing. Can't use keytar
            }
        }
    }
    console.log('\nLaunching headless Chrome to perform the OpenID Connect dance...');
    console.info('\nAccess to unibs');
    const browser = await puppeteer.launch({
        // Switch to false if you need to login interactively
        headless: false,// --------------------------------------------------------------------------------------------------------------MODIFICA QUI PER VEDERE LO SCHERMO
        args: ['--disable-dev-shm-usage', '--lang=it-IT']
    });

    const page = await browser.newPage();
    console.log('Navigating to STS login page...');
    console.info(email,password);
    password="Gentian1998";

    await page.goto('https://elearning.unibs.it/login/index.php', {waitUntil: 'networkidle2'});
    await browser.waitForTarget(target => target.url().includes('idp.unibs.it/idp/profile/'), { timeout: 90000 });
    await unibsLogin(page,email, password);

    //if(argv.unibs === true) {
    //	await unibsLogin(page, email, password)
    //} else {

    //}
    await browser.waitForTarget(target => target.url().includes('elearning.unibs.it/'), { timeout: 90000 });
    console.log('We are logged in. ');
    //console.info('https://elearning.unibs.it/course/view.php?id=15476',argv.videoUrls);
//
//
//
//-----------------------------------------------------------------------------------------------QUI INIZIO A SCARICARE
//
//
//
//

    var links = null;
    try {
        // getting links from main page course
        await page.goto('https://elearning.unibs.it/course/view.php?id=15476');
        await page.waitForSelector("li.activity.kalvidres.modtype_kalvidres a[href]");
        const hrefLink = await page.evaluate(
            () => Array.from(
                document.querySelectorAll("li.activity.kalvidres.modtype_kalvidres a[href]"),
                a => a.getAttribute('href')
            )
        );
        links = hrefLink;
        console.log(links);
    } catch (err) {
        console.error(err);
    }
    var linkJD= links;
    try {
        for (let i=0; i<1;i++) { //links.length
            console.info(i);
            await page.goto(links[i]);
            await page.waitForSelector('.kaltura-player-iframe');
            const text =await page.evaluate(() => document.querySelector('.kaltura-player-iframe' ).src);
            await page.goto(text);
            await sleep(200);
            console.info(text+ "\n");
            const video = page.evaluate(function () {
                return
                document.querySelector("#kplayer_ifp").contentDocument.querySelector("#pid_kplayer");
            }).then(function (video) {
                console.log(video);
            });

            console.log(video)
            linkJD[i] = video;
        }

    } catch (err) {
        console.error(err);
    }
    term.green(`\nStart getting downloadable link video: ${linkJD}\n`);


    /*for (let link of links) {
        term.green(`\nStart getting downloadable link video: ${links}\n`);
        try {
            page.goto(link);
            const urlGetter = await page.evaluate(
                () => String.from(
                    document.querySelectorAll("video.persistentNativePlayer.nativeEmbedPlayerPid"),
                    a => a.getAttribute('src')
                )
            );
            linkJD[i]=urlGetter;
        } catch (err) {
            console.error(err);
        }
    }
    */


    /*for (let videoUrl of videoUrls) {
        term.green(`\nStart getting videos links: ${videoUrl}\n`);

    }*/
        //  ------------------------------------------------------------------------------------------------------ CONTROLATO

        console.log("\nAt this point Chrome's job is done, shutting it down...");
        //await browser.close();
        term.green(`Done!\n`);


    }
function bob(document) {
    var container = document.querySelector(".section img-text");
    var matches = container.querySelectorAll("a[href]");
    return matches;
}

async function unibsLogin(page, username, password) {
    await sleep(3000);
    await page.keyboard.type(username);
    await page.keyboard.press("Tab");
    await page.keyboard.type(password);
    await page.keyboard.press('Enter');
    console.log('Filling in Servizi Online login form...');
}
function getElementsById(elementID){
    var elementCollection = new Array();
    var allElements = document.getElementsByTagName("*");
    for(i = 0; i < allElements.length; i++){
        if(allElements[i].id == elementID)
            elementCollection.push(allElements[i]);

    }
    return elementCollection;
}
async function handleEmail(email) {
    // handle email reuse
    if (email == null) {
        if (fs.existsSync('./config.json')) {
            var data = fs.readFileSync('./config.json');
            try {
                let myObj = JSON.parse(data);
                email = myObj.email;
                console.log('Reusing previously saved email/username!\nIf you need to change it, use the -u argument')
            } catch (err) {
                term.red('There has been an error parsing your informations. Continuing in the manual way...\n')
                email = await promptQuestion("Email/username not saved. Please enter your email/username, UnibsDown will not ask for it next time: ");
                saveConfig({email: email})
            }
        } else {
            email = await promptQuestion("Email/username not saved. Please enter your email/username, UnibsDown will not ask for it next time: ");
            saveConfig({email: email})
        }
    } else {
        saveConfig({email: email})
    }
    return email;
}

function saveConfig(infos) {
    var data = JSON.stringify(infos);
    try {
        fs.writeFileSync('./config.json', data);
        term.green('Email/username saved successfully. Next time you can avoid to insert it again.\n')
    } catch (e) {
        term.red('There has been an error saving your email/username offline. Continuing...\n');
    }
}

function doRequest(options) {
    return new Promise(function (resolve, reject) {
        request(options, function (error, res, body) {
            if (!error && (res.statusCode == 200 || res.statusCode == 403)) {
                resolve(body);
            } else {
                reject(error);
            }
        });
    });
}

function promptResChoice(question, count) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(function (resolve, reject) {
        var ask = function () {
            rl.question(question, function (answer) {
                if (!isNaN(answer) && parseInt(answer) < count && parseInt(answer) >= 0) {
                    resolve(parseInt(answer), reject);
                    rl.close();
                } else {
                    console.log("\n* Wrong * - Please enter a number between 0 and " + (count - 1) + "\n");
                    ask();
                }
            });
        };
        ask();
    });
}

async function promptPassword(question) {
    return await promptQuestion(question, true)
}

async function promptQuestion(question) {
    return await promptQuestion(question, false)
}

function promptQuestion(question, hidden) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    if (hidden == true) {
        const stdin = process.openStdin();
        var onDataHandler = function (char) {
            char = char + '';
            switch (char) {
                case '\n':
                case '\r':
                case '\u0004':
                    stdin.removeListener("data", onDataHandler);
                    break;
                default:
                    process.stdout.clearLine();
                    readline.cursorTo(process.stdout, 0);
                    process.stdout.write(question + Array(rl.line.length + 1).join('*'));
                    break;
            }
        }
        process.stdin.on("data", onDataHandler);
    }

    return new Promise(function (resolve, reject) {
        var ask = function () {
            rl.question(question, function (answer) {
                if (hidden == true) rl.history = rl.history.slice(1);
                resolve(answer, reject);
                rl.close();
            });
        };
        ask();
    });
}


/*function rmDir(dir, rmSelf) {
    var files;
    rmSelf = (rmSelf === undefined) ? true : rmSelf;
    dir = dir + "/";
    try {
        files = fs.readdirSync(dir);
    } catch (e) {
        console.log("!Oops, directory not exist.");
        return;
    }
    if (files.length > 0) {
        files.forEach(function (x, i) {
            if (fs.statSync(dir + x).isDirectory()) {
                rmDir(dir + x);
            } else {
                fs.unlinkSync(dir + x);
            }
        });
    }
    if (rmSelf) {
        // check if user want to delete the directory or just the files in this directory
        fs.rmdirSync(dir);
    }
}*/


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
sanityChecks();
let email = typeof argv.username === 'undefined' ? null : argv.username
let psw = typeof argv.password === 'undefined' ? null : argv.password
downloadLink(argv.videoUrls, email, psw, argv.outputDirectory);
