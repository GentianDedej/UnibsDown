"use strict";

const puppeteer = require('puppeteer');
const term = require("terminal-kit").terminal;
const fs = require("fs");
const yargs = require('yargs');
const request = require('request');

const argv = yargs.options({
    v: { alias:'videoUrl', type: 'array', demandOption: false },
    u: { alias:'username', type: 'string', demandOption: true, describe: 'Your user' },
    p: { alias:'password', type: 'string', demandOption: false },
    k: { alias: 'noKeyring', type: 'boolean', default: false, demandOption: false, describe: 'Do not use system keyring'},
})
    .help('h')
    .alias('h', 'help')
    .example('node $0 -u CODICEPERSONA \n', "Standard usage")
    .example('node $0 -u CODICEPERSONA -v "https://elearning.unibs.it/course/view.php?id=15476" "https://elearning.unibs.it/course/view.php?id=15506"\n', "Multiple videos download")
    .example('node $0 -u CODICEPERSONA -k\n', "Do not save the password into system keyring")
    .argv;
//console.info('\nVideo URLs: %s', argv.videoUrls);
if(typeof argv.username !== 'undefined') {console.info('Email: %s', argv.username);}


const writeStream = fs.createWriteStream('linkDownload.txt');

const pathName = writeStream.path;

async function downloadLink(email, password) {
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
                console.info(e);
                // X11 is missing. Can't use keytar
            }
        }
    }
    console.log('\nLaunching headless Chrome to perform the OpenID Connect dance...');
    console.info('\nAccess to unibs');
    const browser = await puppeteer.launch({
        // Switch to false if you need to login interactively
        executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,// --------------------------------------------------------------------------------------------------------------MODIFICA QUI PER VEDERE LO SCHERMO
        args: ['--lang=it-IT']
    });

    const page = await browser.newPage();
    console.log('Navigating to STS login page...');
    //console.info(email,password);

    await page.goto('https://elearning.unibs.it/login/index.php', {waitUntil: 'networkidle2'});
    await browser.waitForTarget(target => target.url().includes('idp.unibs.it/idp/profile/'), { timeout: 90000 });
    await unibsLogin(page,email, password);
    await browser.waitForTarget(target => target.url().includes('elearning.unibs.it/'), { timeout: 90000 });
    console.log('We are logged in. ');
//
//
//
//-----------------------------------------------------------------------------------------------QUI INIZIO A SCARICARE
//
//
//
//
    let linkCorsi = null;
    try{
        await page.waitForSelector("#label_2_10");
        await page.click("#expandable_branch_0_mycourses","left");
        await page.keyboard.press("ArrowRight", {delay:50});
        let sel = ".coursename";
        const corsi = await page.evaluate( (sel) =>
        {
            let elements = Array.from(document.querySelectorAll(sel));
            let linksCor = elements.map(element => {
                return element.lastElementChild.href
            })
            return linksCor;
        }, sel);
        const titoliCor = await page.evaluate( (sel) =>
        {
            let elements = Array.from(document.querySelectorAll(sel));
            let linksTitoli = elements.map(element => {
                return element.lastElementChild.text
            })
            return linksTitoli;
        }, sel);
        linkCorsi = corsi;
        //}
        var questTit = "\n";
        var count = 0;
        for (let i = 0; i < titoliCor.length; i++) {
             questTit = questTit + '[' + i + '] ' +  titoliCor[i] + '\n';
             count = count+1;
        }
        console.info(count)
        var corsoScelto = null;
         do {
             corsoScelto = parseInt(await promptQuestion(questTit,false));
         }while (corsoScelto > count-1 || isNaN(corsoScelto));
        console.info("Hai scelto: \t"+corsoScelto)
    } catch (err) {
        console.error(err);
    }

    let links = [];
    let testi = [];
    //--------------------------------------------------------------------------------------------------------QUI INIZIA IL CODICE CHE ESTRAE LINK
    try {
        // getting links from main page course
        console.info(linkCorsi[corsoScelto]);
        await page.goto(linkCorsi[corsoScelto]);
        await page.waitForSelector("li.activity.kalvidres.modtype_kalvidres a[href]");
        const hrefLink = await page.evaluate(
            () => Array.from(
                document.querySelectorAll("li.activity.kalvidres.modtype_kalvidres a[href]"),
                a => a.getAttribute('href')
            )
        );
        const hrefLinkDue = await page.evaluate(
            () => Array.from(
                document.querySelectorAll("li.activity.kalvidres.modtype_kalvidres a[href]"),
                a => a.text
            )
        );
        links = hrefLink;
        testi = hrefLinkDue;
        console.log(links);
    } catch (err) {
        console.error(err);
    }
    const linkJD= [];
    let lung = links.length*2;
    try {
        for (let i=0; i < lung ;i++) { //lung
            console.info(i);
            await page.goto(links[i]);
            await page.waitForSelector('#contentframe');
            const frameLink = await page.evaluate(() =>
            {
                return document.querySelector('#contentframe').ownerDocument.documentElement.querySelector(".kaltura-player-container").querySelector("iframe").ownerDocument.documentElement.querySelector(".kaltura-player-container").querySelector("iframe").src
            });
            await page.goto(frameLink);
            await page.waitForSelector("#kplayer_ifp");
            const video = await page.evaluate( () =>
            {
                return document.querySelector("#kplayer_ifp").contentDocument.documentElement.querySelector("#pid_kplayer").src
            });
            await page.goto(video);
            await sleep(200)
            let urlVideo = await page.url();
            var senzaKVR = testi[i].split(" ").slice(0, -3).join(" ")
            var senzaSpazi = senzaKVR.replace(/ /gi, "%20");
            var linkDownload = urlVideo.replace(/a.mp4/gi, senzaSpazi +".mp4");
            linkJD[i] = linkDownload;
        }

    } catch (err) {
        console.error(err);
    }
    console.info(linkJD);

     //--------------------------------------------------------------------------------------------------------QUI FINISCE IL CODICE CHE ESTRAE LINK
    console.log("\nAt this point Chrome's job is done, shutting it down...");

// write each value of the array on the file breaking line
    linkJD.forEach(value => writeStream.write(`${value}\n`));

// the finish event is emitted when all data has been flushed from the stream
    writeStream.on('finish', () => {
        console.log(`wrote all the array data to file ${pathName}`);
    });

// handle the errors on the write process
    writeStream.on('error', (err) => {
        console.error(`There is an error writing the file ${pathName} => ${err}`)
    });

// close the stream
    writeStream.end();
    await browser.close();
    term.green(`Done!\n`);

}

async function unibsLogin(page, username, password) {
    await sleep(3000);
    await page.keyboard.type(username);
    await page.keyboard.press("Tab");
    await page.keyboard.type(password);
    await page.keyboard.press('Enter');
    console.log('Filling in Servizi Online login form...');
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


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let email = typeof argv.username === 'undefined' ? null : argv.username
let psw = typeof argv.password === 'undefined' ? null : argv.password
downloadLink(email, psw);
