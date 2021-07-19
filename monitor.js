const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const cheerio = require('cheerio');
const cron = require('node-cron');
const urls = require('./urls.json');
const testUrls = require('./test_urls.json');
const config = require('./config.json');

const initBrowser = async (url) => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    if (
        url === urls.gamestop_url ||
        url === urls.best_buy_url ||
        url === urls.amazon_url ||
        url === testUrls.gamestop_url ||
        url === testUrls.best_buy_url ||
        url === testUrls.amazon_url
    ) {
        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4512.0 Safari/537.36'
        );
    }
    await page.goto(url);
    return page;
};

const sendEmail = async (url) => {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: config.google_username,
            pass: config.google_pw,
        },
    });

    let textToSend = 'Go get that PlayStation 5!';
    let htmlText = `<a href=\"${url}\">Link</a>`;

    let info = await transporter.sendMail({
        from: '"Bot Monitor" <joshwestbury@gmail.com>',
        to: config.google_username,
        subject: 'PLAYSTATION 5 IS IN STOCK',
        text: textToSend,
        html: htmlText,
    });

    console.log('Message send to: %s', info.messageId);
};

const checkStock = async (store, page, url) => {
    switch (store) {
        case 'target':
            await page.reload();
            let targetContent = await page.evaluate(
                () => document.body.innerHTML
            );
            var $ = cheerio.load(targetContent);
            var soldOut = $("div[data-test='soldOutBlock']").text();
            const shipIt = $("button[data-test='shipItButton']").text();

            if (shipIt && !soldOut) {
                await sendEmail(url);
            } else {
                console.log('Target is Sold Out');
                return false;
            }
        case 'gamestop':
            await page.reload();
            let gamestopContent = await page.evaluate(
                () => document.body.innerHTML
            );
            var $ = cheerio.load(gamestopContent);
            var availability = $('button[data-gtmdata]').text();

            if (availability === 'Add to Cart') {
                await sendEmail(url);
            } else {
                console.log('GameStop is Sold Out');
                return false;
            }
        case 'bestbuy':
            await page.reload();
            let bestbuyContent = await page.evaluate(
                () => document.body.innerHTML
            );
            var $ = cheerio.load(bestbuyContent);
            var availability = $(
                "button[class='btn btn-disabled btn-lg btn-block add-to-cart-button']"
            ).text();
            var addToCart = $(
                "button[class='btn btn-primary btn-lg btn-block btn-leading-ficon add-to-cart-button']"
            ).text();

            if (availability !== 'Sold Out' && addToCart !== 'Add to Cart') {
                console.log('Best Buy is Sold Out');
                return false;
            } else if (addToCart === 'Add to Cart') {
                await sendEmail(url);
            } else {
                console.log('Best Buy is Sold Out');
                return false;
            }
        case 'amazon':
            await page.reload();
            let amazonContent = await page.evaluate(
                () => document.body.innerHTML
            );
            var $ = cheerio.load(amazonContent);
            var availability = $(
                "span[class='a-size-medium a-color-success']"
            ).text();

            if (availability.includes('In Stock.')) {
                await sendEmail(url);
            } else {
                console.log('Amazon is Sold Out');
                return false;
            }
    }
};

const beginCronJob = (store, page, url) => {
    cron.schedule('*/15 * * * * *', () => {
        checkStock(store, page, url);
    });
};

const main = async (urls) => {
    let targetPage = await initBrowser(urls.target_url);
    beginCronJob('target', targetPage, urls.target_url);

    let amazonPage = await initBrowser(urls.amazon_url);
    beginCronJob('amazon', amazonPage, urls.amazon_url);

    let bestBuyPage = await initBrowser(urls.best_buy_url);
    beginCronJob('bestbuy', bestBuyPage, urls.best_buy_url);

    let gamestopPage = await initBrowser(urls.gamestop_url);
    beginCronJob('gamestop', gamestopPage, urls.gamestop_url);
};

main(urls);
