const fetch = require('node-fetch');
const $ = require('cheerio');
const mongoose = require('mongoose');
const categories = require('./categories.json');
const regions = require('./region.json');
const logger = require('./logger');
const ItemModel = require('./models/item');
const helpers = require('./helpers');


process.on('unhandledRejection', error => {
    console.log(JSON.stringify(error, null, '\t'));
});

class App {
    listUrl = 'https://www.list.am';
    dbUrl = 'mongodb://localhost:27017/list';
    startDate = new Date();
    endDate;

    init() {
        mongoose.connect(this.dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
        this.db = mongoose.connection;

        this.db.on('error', console.error.bind(console, 'connection error:'));
        this.db.once('open', this.onDBOpen.bind(this));
    }

    onDBOpen = async () => {
        // we're connected!
        console.log("starting scrapping");
        await this.scrapEachCategoryItems();
        this.finishExecution();
    }

    scrapEachCategoryItems = async () => {
        for (const category of categories) {
            console.log("scrapping category " + category);
            const requests = regions.map(region => {
                console.log("fetching items for region " + region.value);
                return this.fetchItemsForCategoryByRegion(category, region.value);
            });

            await Promise.all(requests);
        }
    }

    fetchItemsForCategoryByRegion = async (category, region) => {
        const baseUrl = this.listUrl + category + "/%pageNum?n=" + region;

        let page = 1;

        // Process each page of a category
        while (true) {
            let url = baseUrl.replace("%pageNum", page);
            
            try {
                const body = await this.fetchPage(url);
                const elements = this.getPageItems(body);

                this.pushItems(elements);

                if (! this.nextPageExists(body, page)) {
                    break;
                }
            } catch (e) {
                logger.error("Error while processing url: " + url);
                logger.error(e);
                console.log("Error while processing url: " + url);
                console.log(e);
            }

            await this.sleep(100);

            ++page;
        }
    }

    nextPageExists(body, p) {
        // Check to find if there is next page
        if ( $('link[rel="next"]', body).length !== 0) {
            const href = $('link[rel="next"]', body).attr().href;
            const nextPageNum = href.split('/')[href.split('/').length - 1];

            if (parseInt(nextPageNum) >= p)
                return true;
        }

        return false;
    }

    fetchPage = async (url) => {
        try {
            const response = await fetch(url);

            if (response.ok) {
                return response.text();
            }

            logger.error("Bad Request. URL: " + url);
            console.log("Bad Request. URL: " + url);
            return null;
        } catch (e) {
            logger.error("Network Problems");
            logger.error(e);
            console.log("Network Problems");
            console.log(e);
            return null;
        }
    }

    getPageItems(body) {
        return $('.gl > a', body);
    }

    pushItems = async (elements) => {
        const items = [].slice.call(elements).map(element => ({
            price: $(".p", element).text().trim(),
            url: this.listUrl + element.attribs.href,
        })).filter(item => item.price !== '');

        const existingItems = helpers.keyBy(await ItemModel.aggregate( [
            {
                $match: { url: { $in: items.map(i => i.url) } }
            },

            {
                $sort: { url: 1, date: 1 }
            },

            {
                $group: {
                    _id: '$url',
                    date: { $last: '$date' },
                    price: { $last: '$price' }
                }
            },

            {
                $project: {
                    _id: 0,
                    url: '$_id',
                    date: '$date',
                    price: '$price'
                }
            }
        ] ), 'url');

        const modifiedItems = items.filter(item => {
            const existingItem = existingItems[item.url];

            return (typeof existingItem === 'undefined') || (existingItem.price !== item.price);
        });

        await ItemModel.insertMany(modifiedItems);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    finishExecution() {
        this.db.close().then(() => {
            this.endDate = new Date();
            console.log("The programm took " + (this.endDate - this.startDate) / (1000 * 60) + " minutes to complete");
            logger.info("The programm took " + (this.endDate - this.startDate) / (1000 * 60) + " minutes to complete");
        });
    }
}

const app = new App();

app.init();