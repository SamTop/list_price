const fetch = require('node-fetch');
const $ = require('cheerio');
const mongoose = require('mongoose');
const categories = require('./categories.json');
const carMakes = require('./car_makes.json');
const regions = require('./region.json');
const { async } = require('regenerator-runtime');
const fs = require('fs');

class App {
    listUrl = 'https://www.list.am';
    dbUrl = 'mongodb://localhost:27017/item';
    allItems = [];

    ItemModel = mongoose.model('Item', new mongoose.Schema({
        url: { type: String },
        price: { type: String },
        date: { type: Date, min: '2000-01-01', max: '2100-01-01' },
    }));

    todayDate = new Date().toISOString().slice(0, 10);    
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
        await this.scrapEachCategoryItems();
        this.insertItemsToDB();
        console.log('end');
    }

    insertItemsToDB() {
        let me = this;
        this.ItemModel.insertMany(this.allItems).then(function() {
            console.log(me.allItems.length + " elements inserted to db.");
            me.finishExecution();
        }).catch(function(error){
            console.log(error);
            me.finishExecution();
        });
    }

    scrapEachCategoryItems = async () => {
        for (const category of categories) {
            const requests = regions.map(region => {
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
            console.log(page)
            // if (page % 10 === 0)
            //     console.log(`Processing page => ${page} of ${region} of category => ${category}`);

            let url = baseUrl.replace("%pageNum", page);
            
            const body = await this.fetchPage(url);
            
            const elements = this.getPageItems(body);

            this.pushItems(elements);

        
            if (! this.nextPageExists(body, page)) {
                //console.log(page, body);
            }

            if (! this.nextPageExists(body, page)) {
                //console.log('Done Processing ' + url);
                break;
            }

            ++page;
        }

        return await Promise.resolve(0);
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

            console.log("Bad Request");
            return null;
        } catch (e) {
            console.log("Network Problems");
            console.log(e);
            return null;
        }
    }

    getPageItems(body) {
        return $('.gl > a', body);
    }

    pushItems =  (elements) => {
        // Push elements to array
        for (let i = 0; i < elements.length; i++) {
            if ( $(".p", elements[i]).text() ) {
                // Check if such an item already exists in the db and the price has not changed
                //let item = await this.ItemModel.find({url: this.listUrl + elements[i].attribs.href}).sort({date: -1}).limit(1);

                //if (item.length === 0 || (item[0] && item[0].price !== $(".p", elements[i]).text()))
                    this.allItems.push({ url: this.listUrl + elements[i].attribs.href, price: $(".p", elements[i]).text(), date: this.todayDate });
            }
        }
    }


    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    finishExecution() {
        this.db.close();
        this.endDate = new Date();
        console.log("the programm took " + (this.endDate - this.startDate) / (1000 * 60) + " minutes to complete");

        // fs.writeFile('test.txt', JSON.stringify(this.allItems), function (err) {
        //     if (err) return console.log(err);
        // });  
    }
}

const app = new App();

app.init();
