/**
 * @Author Zachary Roper, zachroper@gmail.com
 *
 * Synchronizes data for MongoDB with ERC-1155 contract events
 * by using web3 and Infura. to look at past completed block events
*/

// const WooCommerceAPI = require('woocommerce-api');
const abi = require('./contract_abi.json');
const getJSON = require('get-json');
const rp = require('request-promise');
const curl = new (require( 'curl-request' ))();
const Web3 = require('web3');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const Db = require('mongodb').Db;
const uri = "mongodb+srv://mzkzUser:zW0Jx7me5JkWtEaJ@mzkz-dt9ay.mongodb.net/test?retryWrites=true";
const options = {
    keepAlive: 300000, 
	connectTimeoutMS: 30000,
	useNewUrlParser: true
};
const client = new MongoClient(uri, options);
const db = new Db('mzkz', client);
const AssetCollection = db.collection("erc1155_assets");

// const WooCommerce = new WooCommerceAPI({
// 	url: 'https://mzkz.xyz',
// 	consumerKey: 'ck_8f817f528cfc911c139788bf8aa46f505a9e9c8a',
// 	consumerSecret: 'cs_497f44bcf03034a3e64be7723ae33d268e070f1a',
// 	wpAPI: true,
// 	version: 'wc/v1'
//   });

const StartingWPproductID = 70000000;



//import bodyParser from 'body-parser';

// Set up Web3 and contract connection
//const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545/'));
const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/623f293b067749b29b8d4c98c801472a'));
//let abi = fs.readFileSync('contract_abi.txt', 'utf8');
const contract = new web3.eth.Contract(abi, '0x8562c38485B1E8cCd82E44F89823dA76C98eb0Ab');

let startBlockNumber = parseInt(fs.readFileSync('StartBlock.txt', 'utf8')) - 1;
var lastBlockNumber = startBlockNumber;


const knownCreatorlist = [

];


const knownHostlist = [
	"bitcoin-hodler.net",
	"omegatechgame.com", //CiM
	"Flurbo.xyz",
	"digitaloceanspaces.com", //9Lives
	"spacepirate.io", 
	"enjin.io", 
	"cryptofights.io",
	"hexagrid.store",
	"containmentcorps",
	"mzkz.xyz",
	"forestknight",
	"PatrickMockridge", //makerverse
	"alterverse.com",
	"crypto-site" //WoC
];

const JSONtemplates = [	{
		org : "default",
		slug : "unknown",
		category : "uncategorized",
		tags : ["ERC-1155"],
		id : "1880000000000243",
		id_start : 2,
		id_stop : 18,
		index : "0000000000000001"
	},
	{
		org : "Bitcoin Hodler",
		slug : "bitcoin-hodler.net",
		category : "Games > bitcoin-hodler",
		tags : ["ERC-1155"],
		id : "1880000000000243",
		id_start : 2,
		id_stop : 18,
		index : "0000000000000001"
	},
	{
		org : "War of Crypto",
		slug : "crypto-site",
		category : "Games > woc",
		tags : ["ERC-1155"],
		id : "00800000000001e90000000000000001",
		id_start : 2,
		id_stop : 18,
		index : ""
	},
	{
		org : "Cats in Mechs",
		slug : "omegatechgame.com",
		category : "Games > cim",
		tags : ["ERC-1155"],
		id : "10800000000000e0000000000000000000000000000000000000000000000000",
		id_start : 2,
		id_stop : 65,
		index : "00000000000000000000000000000001"
	},
	{
		org : "Flurbo Billy Bird",
		slug : "flurbo.xyz",
		category : "Community Tokens",
		tags : ["ERC-1155"],
		id : "7880000000000226",
		id_start : 2,
		id_stop : 18,
		index : "0000000000000001"
	},
	{
		org : "Enjin Mintshop",
		slug : "enjin.io",
		category : "Enjin Platform",
		tags : ["ERC-1155"],
		id : "1880000000000243",
		id_start : 2,
		id_stop : 18,
		index : ""
	}
]

// Application begins here
connectToDBB(client,db);

function connectToDBB(client) {
	client.connect( function (err, client) {
		if (err) throw err;

		//syncFiles();
		startWatching();

	  }); 
};

async function syncFiles() {
	// Synchronize files to most recent database document
	var db = client.db('mzkz');
	db.collection("erc1155_assets").find({}).sort({"blockNumber":-1}).limit(1)
	.then(function (BlockToSync) {
		console.log(BlockToSync)
		fs.writeFile('StartBlock.txt', BlockToSync, (err) => {
			if (err) throw err;
		  });
	})
	.catch(function (err) {
		// request failed...
		console.log("Could not find the sync block! Will revert to default value written in StartBlock.txt.");
	});


}

//const assetID = "0x70800000000001b8000000000000000000000000000000000000000000000000";



/**
 * startWatching() is the top level function to begin
 * the contract event watching
 */
async function startWatching() {
	
	let watching = true;

	while (watching) {
		await watchEvents();
		wait(1000);
	}
}

/**
 * watchEvents() Provides top level logic to decide whether or 
 * not to update lastBlockNumber depending on the currentBlockNumber
 */

var tt = 0;
async function watchEvents() {
	let currBlockNumber = await getCurrBlockNumber();
	let latestCompleteBlock = currBlockNumber - 1;
	//let genBlock = 6043439; //ERC-1155 contract creation at txn:0x6e653115cacb3b8b226f6eff9234320c4e5f4e88e0988df2957a3bbca83ccb1b
	let blockInterval = 1000;
	
	//console.log(currBlockNumber, lastBlockNumber,blockInterval);	
	
	if ((currBlockNumber - lastBlockNumber) > blockInterval) {
		let start = (startBlockNumber + (tt * blockInterval)) + 1;
		let stop = (startBlockNumber + ((tt+1) * (blockInterval)));

		console.log("Getting events from: " + start + " to " + stop);
		let [eventsCreate, eventsMelt, eventsMint, eventsSetURI, eventsTransfer, eventsUpdateName] = await checkBetweenBlocks(start, stop);
		lastBlockNumber = stop;
		tt++;

		//Write to database here
		eventsCreate.then(function(events) {
			//var collection = "erc1155Events_create";
			//console.log(events)
            //updateDDBFromEvents(db,collection,events);
            createAssetParser(events)
		 });
		
		eventsMelt.then(function(events) {
			var collection = "erc1155Events_melt";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
		 });

		 eventsMint.then(function(events) {
			var collection = "erc1155Events_mint";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
		 });

		 eventsSetURI.then(function(events) {
			var collection = "erc1155Events_setURI";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
			setURIparser(events);
		 });

		 eventsTransfer.then(function(events) {
			var collection = "erc1155Events_transfer";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
		 });

		 eventsUpdateName.then(function(events) {
			var collection = "erc1155Events_updateName";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
			// updateNameParser(events);
		 });
	}

	else if (lastBlockNumber < latestCompleteBlock) {
		let start = lastBlockNumber;
		let stop = latestCompleteBlock;
		
		console.log("Getting events from: " + start + " to " + stop);
		let [eventsCreate, eventsMelt, eventsMint, eventsSetURI, eventsTransfer, eventsUpdateName] = await checkBetweenBlocks(start, stop);
		lastBlockNumber = currBlockNumber;

		eventsCreate.then(function(events) {
			var collection = "erc1155Events_create";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
			createAssetParser(events)
		 });
		
		eventsMelt.then(function(events) {
			var collection = "erc1155Events_melt";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
		 });

		 eventsMint.then(function(events) {
			var collection = "erc1155Events_mint";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
		 });

		 eventsSetURI.then(function(events) {
			var collection = "erc1155Events_setURI";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
			setURIparser(events);
		 });

		 eventsTransfer.then(function(events) {
			var collection = "erc1155Events_transfer";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
		 });

		 eventsUpdateName.then(function(events) {
			var collection = "erc1155Events_updateName";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
			// updateNameParser(events);
		 });

	} else {
		console.log("...watching the blockchain...")
	}
}

/**
 * updateDDBFromEvents() wil update DDB given event objects
 *
 * @param events {Array of Objects} Events to sync ddb with
 */
async function createAssetParser(events) {
	let counter = 0;
		
	for (let i=0; i<events.length; i++) {
        let eventObj = events[i];
		let assetID = eventObj.topics[1];
		let typeData = await getTypeData(assetID);
		let blockNumber = eventObj.blockNumber.toString();
		// let wpProductID = StartingWPproductID + blockNumber + i * blockNumber;
		// let productString = ("product/" + wpProductID);

		let transferFeeArray = typeData._transferFeeData.map(Number);
		let transferFee = (transferFeeArray[2]/1000000000000000000).toString();

		if (transferFeeArray[0]==0) {
			transferFeeType = "None"
		}
		else if (transferFeeArray[0]==1) {
			transferFeeType = "Per Transfer"
		}
		else {
			transferFeeType = "Unknown"
		};

		if ( typeData._supplyModel.indexOf("0x03EC388fb9Aef6442C7372DB3C6b7EEd93469c0B") > -1) {
			supplyModel = "Collapsing"
		}
		else if ( typeData._supplyModel.indexOf("0x0000000000000000000000000000000000000000") > -1) {
			supplyModel = "Fixed"
		}
		else if ( typeData._supplyModel.indexOf("0XE7BB8A81F070E69EAB9AFAB0E7035614E144133A") > -1) {
			supplyModel = "Infinite"
		}
		else {
			supplyModel = "Unknown"
		};

		if (typeData._nonFungible == true) {
			fungibilityTag = "Non-Fungible Token";
			fungibilityID = 18;
			fungibilitySlug = "nft";
		}
		else {
			fungibilityTag = "Fungible Token";
			fungibilityID = 19;
			fungibilitySlug = "ft";
		};
		// console.log(fungibilityID,fungibilityTag, fungibilitySlug);

						
		// var newAssetDocument = {
		// 	"assetID" : assetID.slice(2,18),
		// 	"assetIndex" : assetID.slice(51,66),
		// 	"assetIDfull" : assetID,
		// 	"name" : typeData._name,
		// 	"meltValue" : typeData._meltValue/1000000000000000000,
		// 	"totalSupply" : typeData._totalSupply,
		// 	"circulatingSupply" : typeData._circulatingSupply,
		// 	"transferFeeData" : typeData._transferFeeData.map(Number),
		// 	"meltFeeRatio" : parseInt(typeData._meltFeeRatio),
		// 	"creator" : typeData._creator,
		// 	"nonFungible" : typeData._nonFungible,
		// 	"genBlock" : blockNumber,
		// 	"lastUpdatedAtBlock" : blockNumber
		// };
		
		name = typeData._name;
		id = assetID.slice(2,18).toString();
		price = (typeData._meltValue/1000000000000000000).toString();

		var newAssetData = {
			"name": name,
			"sku" : id,
			"stock_status": "outofstock",
			"virtual": true,
			"regular_price": price,
			"type": "simple",
			"short_description": typeData._name,
			"categories": [
				{
					"id": 109,
					"name": "Development",
					"slug": "development"
				},
				{
					"id": 16,
					"name": "Uncategorized",
					"slug": "uncategorized"
				}
			],
			"tags": [
			  {
				"id": 49,
				"name": "ERC-1155",
				"slug": "erc-1155"
			  },
			  {
				"id": fungibilityID,
				"name": fungibilityTag,
				"slug": fungibilitySlug
			  }
			],
			"attributes": [{
				"id":1,
				"name":"Melt Value",
				"position":0,
				"visible":true,
				"variation":false,
				"options":[typeData._meltValue/1000000000000000000+" ENJ"]
				},
				{
				"id":3,
				"name":"Supply Model",
				"position":1,
				"visible":true,
				"variation":false,
				"options":[supplyModel]
				},
				{
				"id":6,
				"name":"Total Supply",
				"position":2,
				"visible":true,
				"variation":false,
				"options":[typeData._totalSupply]
				},
				{
				"id":5,
				"name":"Circulating Supply",
				"position":3,
				"visible":true,
				"variation":false,
				"options":[typeData._circulatingSupply]
				},
				{
				"id":2,
				"name":"Creator",
				"position":4,
				"visible":true,
				"variation":false,
				"options":[typeData._creator]
				},
				{
				"id":9,
				"name":"Creator Melting Fee",
				"position":5,
				"visible":true,
				"variation":false,
				"options":[typeData._meltFeeRatio/100+"%"]
				},
				{
				"id":8,
				"name":"Transfer Fee",
				"position":6,
				"visible":true,
				"variation":false,
				"options":[transferFee +" ENJ"]
				},
				{
				"id":4,
				"name":"Transfer Fee Type",
				"position":7,
				"visible":true,
				"variation":false,
				"options":[transferFeeType]
				},
				{
				"id":7,
				"name":"Token ID",
				"position":8,
				"visible":true,
				"variation":false,
				"options":[assetID]
				},
				{
				"id": 10,
				"name": "Genesis Block",
				"position": 9,
				"visible": true,
				"variation": false,
				"options": [blockNumber]
				}
			],
			// "images": [
			//   {
			// 	"id": 6237024,
			// 	"src": "https:\/\/mzkz.xyz\/wp-content\/uploads\/2019\/03\/TokenInDev_Placeholder.png"
			//   }
			// ],
			"meta_data": [
				// {
				// 	"id": 834582,
				// 	"key": "fifu_image_url",
				// 	"value": "https:\/\/mzkz.xyz\/wp-content\/uploads\/2019\/03\/TokenInDev_Placeholder.png"
				// },
				{
					"id": 834583,
					"key": "_cryptocurrency_product_for_woocommerce_cryptocurrency_product_type",
					"value": "yes"
				},
				{
					"id": 834584,
					"key": "_select_cryptocurrency_option",
					"value": "ERC20"
				}
			]
		  };

		let WCuri = "https://mzkz.xyz/wp-json/wc/v3/products/";

		var options = {
			method: 'POST',
			headers: {
				'Authorization': "Basic Y2tfOGY4MTdmNTI4Y2ZjOTExYzEzOTc4OGJmOGFhNDZmNTA1YTllOWM4YTpjc180OTdmNDRiY2YwMzAzNGEzZTY0YmU3NzIzYWUzM2QyNjhlMDcwZjFh"
			},
			uri: WCuri,
			body: newAssetData,
			json: true // Automatically stringifies the body to JSON
		};
		
		rp(options)
			.then(function (parsedBody) {
				// POST succeeded...
				console.log("Success in posting product")
			})
			.catch(function (err) {
				// POST failed...
				console.log("Error: Failure in posting product")
				console.log(err)
			});


		// var db = client.db('mzkz');
		// //db.collection("erc1155_assets").insertOne(newAssetDocument);

		// WooCommerce.post('products', newAssetDocument, function(err, newAssetDocument, res) {
		// 	// console.log(res);
		//   });
		counter++;
	}
    
	console.log("Made ( " + counter + " / " + events.length + " ) insertions to Asset Collection via create()");
};

async function updateNameParser(events) {
	let counter = 0;
		
	for (let i=0; i<events.length; i++) {
        let eventObj = events[i];
		let assetID = eventObj.topics[1];
		let blockNumber = eventObj.blockNumber;
		let typeData = await getTypeData(assetID);
		var db = client.db('mzkz');
		var myquery = { "assetID": assetID.slice(2,18) };
		var newvalues = { $set: {
			"assetID" : assetID.slice(2,18),
			"assetIndex" : assetID.slice(51,66),
			"assetIDfull" : assetID,
			"name" : typeData._name,
			"meltValue" : typeData._meltValue/1000000000000000000,
			"totalSupply" : typeData._totalSupply,
			"circulatingSupply" : typeData._circulatingSupply,
			"transferFeeData" : typeData._transferFeeData.map(Number),
			"meltFeeRatio" : parseInt(typeData._meltFeeRatio),
			"creator" : typeData._creator,
			"nonFungible" : typeData._nonFungible,
			"lastUpdatedAtBlock" : blockNumber
		}};
		db.collection("erc1155_assets").updateOne(myquery, newvalues, function(err, res) {
		  if (err) throw err;
		  //console.log("1 document updated");
		});
		
		counter++;
	}
    
	console.log("Made ( " + counter + " / " + events.length + " ) updates to Asset Collection via updateName()");
};

async function setURIparser(events) {
	let counter = 0;
		
	for (let i=0; i<events.length; i++) {
		let eventObj = events[i];
		let assetID = eventObj.topics[1];
		let blockNumber = eventObj.blockNumber.toString();
		let uriJSON = await getURI(assetID);
		let [poptURI, isJSONRecognizedByURI, assetHost, assetCategory, assetTags] = populateURI(uriJSON, assetID);
		let typeData = await getTypeData(assetID);
		let poptURLcors = "http://cors.io/?u=" + encodeURIComponent( poptURI );
	
		let transferFeeArray = typeData._transferFeeData.map(Number);
		let transferFee = (transferFeeArray[2]/1000000000000000000).toString();

		if (transferFeeArray[0]==0) {
			transferFeeType = "None"
		}
		else if (transferFeeArray[0]==1) {
			transferFeeType = "Per Transfer"
		}
		else {
			transferFeeType = "Unknown"
		};

		if ( typeData._supplyModel.indexOf("0x03EC388fb9Aef6442C7372DB3C6b7EEd93469c0B") > -1) {
			supplyModel = "Collapsing"
		}
		else if ( typeData._supplyModel.indexOf("0x0000000000000000000000000000000000000000") > -1) {
			supplyModel = "Fixed"
		}
		else if ( typeData._supplyModel.indexOf("0XE7BB8A81F070E69EAB9AFAB0E7035614E144133A") > -1) {
			supplyModel = "Infinite"
		}
		else {
			supplyModel = "Unknown"
		};

		if (typeData._nonFungible == true) {
			fungibilityTag = "Non-Fungible Token";
			fungibilityID = 18;
			fungibilitySlug = "nft";
		}
		else {
			fungibilityTag = "Fungible Token";
			fungibilityID = 19;
			fungibilitySlug = "ft";
		};

		var options = {
			uri: poptURI,
			json: true // Automatically stringifies the body to JSON
		};

		
		let productLookupString = "products?sku=" + assetID.slice(2,18);
		// console.log(productLookupString);

		let wpProductIDjson = await lookupWPproudctIDbyAssetID(productLookupString);
		let wpProductID = wpProductIDjson[0].id;
		let productString = ("products/" + wpProductID);
		// console.log(productString);

		// WooCommerce.get(productLookupString, function(err, data, res) {
		// 	var obj = JSON.parse(res);
		// 	wpProductID = obj[0].id;
		// 	let productString = ("products/" + wpProductID);
		// 	// console.log(productString);


			rp(options)
			.then(function (assetJSON) {
					// Request succeeded...
					assetJSON = assetJSON;
					URIassetName = assetJSON.name;
					URIassetImageURL = assetJSON.image;
					URIassetDescription = assetJSON.description;
					URIassetProperties = assetJSON.properties; 
					
					shortDesc = ("<h3>"+typeData._name+"</h3><p>"+URIassetDescription+"</p>").toString();
					
					var newvalues = {
						// "name" : URIassetName,
						"short_description": shortDesc,
						// "description": URIassetDescription,
						// "categories": [
						// 	{
						// 		"id": 16,
						// 		"name": "Uncategorized",
						// 		"slug": "uncategorized"
						// 	}
						// ],
						// "images": [
						// 	{
						// 		"id": 6237026,
						// 	  "src": "https:\/\/mzkz.xyz\/wp-content\/uploads\/2019\/03\/TokenNeedsApproval_Placeholder.png"
						// 	}
						//   ],
						"meta_data": [
							{
								"id": 834582,
								"key": "fifu_image_url",
								"value": URIassetImageURL
							},
							{
								"id": 836863,
								"key": "_wcj_custom_product_tabs_title_local_1",
								"value": "Image URL"
							},
							{
								"id": 836864,
								"key": "_wcj_custom_product_tabs_key_local_1",
								"value": "local_1"
							},
							{
								"id": 836865,
								"key": "_wcj_custom_product_tabs_priority_local_1",
								"value": "50"
							},
							{
								"id": 836866,
								"key": "_wcj_custom_product_tabs_content_local_1",
								"value": URIassetImageURL
							},
							{
								"id": 836867,
								"key": "_wcj_custom_product_tabs_link_local_1",
								"value": ""
							},
							{
								"id": 836868,
								"key": "_wcj_custom_product_tabs_link_new_tab_local_1",
								"value": "no"
							},
							{
								"id": 836869,
								"key": "_wcj_custom_product_tabs_local_total_number",
								"value": "1"
							}
						],
						"attributes": [{
							"id":1,
							"name":"Melt Value",
							"position":0,
							"visible":true,
							"variation":false,
							"options":[typeData._meltValue/1000000000000000000+" ENJ"]
							},
							{
							"id":3,
							"name":"Supply Model",
							"position":1,
							"visible":true,
							"variation":false,
							"options":[supplyModel]
							},
							{
							"id":6,
							"name":"Total Supply",
							"position":2,
							"visible":true,
							"variation":false,
							"options":[typeData._totalSupply]
							},
							{
							"id":5,
							"name":"Circulating Supply",
							"position":3,
							"visible":true,
							"variation":false,
							"options":[typeData._circulatingSupply]
							},
							{
							"id":2,
							"name":"Creator",
							"position":4,
							"visible":true,
							"variation":false,
							"options":[typeData._creator]
							},
							{
							"id":9,
							"name":"Creator Melting Fee",
							"position":5,
							"visible":true,
							"variation":false,
							"options":[typeData._meltFeeRatio/100+"%"]
							},
							{
							"id":8,
							"name":"Transfer Fee",
							"position":6,
							"visible":true,
							"variation":false,
							"options":[transferFee +" ENJ"]
							},
							{
							"id":4,
							"name":"Transfer Fee Type",
							"position":7,
							"visible":true,
							"variation":false,
							"options":[transferFeeType]
							},
							{
							"id":7,
							"name":"Token ID",
							"position":8,
							"visible":true,
							"variation":false,
							"options":[assetID]
							},
							{
							"id": 11,
							"name": "Most Recent Update",
							"position": 10,
							"visible": true,
							"variation": false,
							"options": [blockNumber]
							}
						]
					};	


					let WCuri = "https://mzkz.xyz/wp-json/wc/v3/" + productString;

					var options = {
						method: 'PUT',
						headers: {
							'Authorization': "Basic Y2tfOGY4MTdmNTI4Y2ZjOTExYzEzOTc4OGJmOGFhNDZmNTA1YTllOWM4YTpjc180OTdmNDRiY2YwMzAzNGEzZTY0YmU3NzIzYWUzM2QyNjhlMDcwZjFh"
						},
						uri: WCuri,
						body: newvalues,
						json: true // Automatically stringifies the body to JSON
					};
					
					rp(options)
						.then(function (parsedBody) {
							// POST succeeded...
							console.log("Success in updating URI")
						})
						.catch(function (err) {
							// POST failed...
							console.log("Error: Failure in updating URI")
							console.log(err)
						});

					// WooCommerce.put(productString, newvalues, function(err, newvalues, res) {
					// 	//console.log(res);
					//   });
					
					var db = client.db('mzkz');
					var myquery = { "assetID": assetID.slice(2,18) };
					// var newvalues = { $set: {
					// 	"assetID" : assetID.slice(2,18),
					// 	"assetIndex" : assetID.slice(51,66),
					// 	"assetIDfull" : assetID,
					// 	"name" : typeData._name,
					// 	"meltValue" : typeData._meltValue/1000000000000000000,
					// 	"totalSupply" : typeData._totalSupply,
					// 	"circulatingSupply" : typeData._circulatingSupply,
					// 	"transferFeeData" : typeData._transferFeeData.map(Number),
					// 	"meltFeeRatio" : parseInt(typeData._meltFeeRatio),
					// 	"creator" : typeData._creator,
					// 	"nonFungible" : typeData._nonFungible,
					// 	"URI" : uriJSON,
					// 	"popURI" : poptURI,
					// 	"isRecognizedByURI" : isJSONRecognizedByURI,
					// 	"host" : assetHost,
					// 	"category" :assetCategory,
					// 	"tags" : assetTags,
					// 	"nameFromURI" : URIassetName,
					// 	"image" : URIassetImageURL,
					// 	"description" : URIassetDescription,
					// 	"properties" : URIassetProperties,
					// 	"lastUpdatedAtBlock" : blockNumber,
					// 	"JSONdataErr" : false,
					// 	"JSONdata" : assetJSON
					// }};
					// db.collection("erc1155_assets").updateOne(myquery, newvalues, function(err, res) {
					// 	if (err) throw err;
					//   });
	
				})
			.catch(function (err) {
				// request failed...try another method
				//console.log("Error! The function rp() failed for ", typeData._name, " with ID ", assetID, " Trying getJSON() instead.");
				getJSON(poptURI)
				.then(function(assetJSON) {
					// Request succeeded...
					assetJSON = assetJSON;
					URIassetName = assetJSON.name;
					URIassetImageURL = assetJSON.image;
					URIassetDescription = assetJSON.description;
					URIassetProperties = assetJSON.properties;  
					shortDesc = ("<h3>"+typeData._name+"</h3><p>"+URIassetDescription+"</p>").toString();
					
					var newvalues = {
						// "name" : URIassetName,
						"short_description": shortDesc,
						// "description": URIassetDescription,
						// "categories": [
						// 	{
						// 		"id": 16,
						// 		"name": "Uncategorized",
						// 		"slug": "uncategorized"
						// 	}
						// ],
						// "images": [
						// 	{
						// 		"id": 6237026,
						// 	  "src": "https:\/\/mzkz.xyz\/wp-content\/uploads\/2019\/03\/TokenNeedsApproval_Placeholder.png"
						// 	}
						//   ],
						"meta_data": [
							{
								"id": 834582,
								"key": "fifu_image_url",
								"value": URIassetImageURL
							},
							{
								"id": 836863,
								"key": "_wcj_custom_product_tabs_title_local_1",
								"value": "Image URL"
							},
							{
								"id": 836864,
								"key": "_wcj_custom_product_tabs_key_local_1",
								"value": "local_1"
							},
							{
								"id": 836865,
								"key": "_wcj_custom_product_tabs_priority_local_1",
								"value": "50"
							},
							{
								"id": 836866,
								"key": "_wcj_custom_product_tabs_content_local_1",
								"value": URIassetImageURL
							},
							{
								"id": 836867,
								"key": "_wcj_custom_product_tabs_link_local_1",
								"value": ""
							},
							{
								"id": 836868,
								"key": "_wcj_custom_product_tabs_link_new_tab_local_1",
								"value": "no"
							},
							{
								"id": 836869,
								"key": "_wcj_custom_product_tabs_local_total_number",
								"value": "1"
							}
						],
						"attributes": [{
							"id":1,
							"name":"Melt Value",
							"position":0,
							"visible":true,
							"variation":false,
							"options":[typeData._meltValue/1000000000000000000+" ENJ"]
							},
							{
							"id":3,
							"name":"Supply Model",
							"position":1,
							"visible":true,
							"variation":false,
							"options":[supplyModel]
							},
							{
							"id":6,
							"name":"Total Supply",
							"position":2,
							"visible":true,
							"variation":false,
							"options":[typeData._totalSupply]
							},
							{
							"id":5,
							"name":"Circulating Supply",
							"position":3,
							"visible":true,
							"variation":false,
							"options":[typeData._circulatingSupply]
							},
							{
							"id":2,
							"name":"Creator",
							"position":4,
							"visible":true,
							"variation":false,
							"options":[typeData._creator]
							},
							{
							"id":9,
							"name":"Creator Melting Fee",
							"position":5,
							"visible":true,
							"variation":false,
							"options":[typeData._meltFeeRatio/100+"%"]
							},
							{
							"id":8,
							"name":"Transfer Fee",
							"position":6,
							"visible":true,
							"variation":false,
							"options":[transferFee +" ENJ"]
							},
							{
							"id":4,
							"name":"Transfer Fee Type",
							"position":7,
							"visible":true,
							"variation":false,
							"options":[transferFeeType]
							},
							{
							"id":7,
							"name":"Token ID",
							"position":8,
							"visible":true,
							"variation":false,
							"options":[assetID]
							},
							{
							"id": 11,
							"name": "Most Recent Update",
							"position": 10,
							"visible": true,
							"variation": false,
							"options": [blockNumber]
							}
						]
					};		

					let WCuri = "https://mzkz.xyz/wp-json/wc/v3/" + productString;

					var options = {
						method: 'PUT',
						headers: {
							'Authorization': "Basic Y2tfOGY4MTdmNTI4Y2ZjOTExYzEzOTc4OGJmOGFhNDZmNTA1YTllOWM4YTpjc180OTdmNDRiY2YwMzAzNGEzZTY0YmU3NzIzYWUzM2QyNjhlMDcwZjFh"
						},
						uri: WCuri,
						body: newvalues,
						json: true // Automatically stringifies the body to JSON
					};
					
					rp(options)
						.then(function (parsedBody) {
							// POST succeeded...
							console.log("Success in updating URI")
						})
						.catch(function (err) {
							// POST failed...
							console.log("Error: Failure in updating URI")
							console.log(err)
						});

					// WooCommerce.put(productString, newvalues, function(err, newvalues, res) {
					// 	//console.log(res);
					//   });
					
					// var db = client.db('mzkz');
					// var myquery = { "assetID": assetID.slice(2,18) };
					// var newvalues = { $set: {
					// 	"assetID" : assetID.slice(2,18),
					// 	"assetIndex" : assetID.slice(51,66),
					// 	"assetIDfull" : assetID,
					// 	"name" : typeData._name,
					// 	"meltValue" : typeData._meltValue/1000000000000000000,
					// 	"totalSupply" : typeData._totalSupply,
					// 	"circulatingSupply" : typeData._circulatingSupply,
					// 	"transferFeeData" : typeData._transferFeeData.map(Number),
					// 	"meltFeeRatio" : parseInt(typeData._meltFeeRatio),
					// 	"creator" : typeData._creator,
					// 	"nonFungible" : typeData._nonFungible,
					// 	"URI" : uriJSON,
					// 	"popURI" : poptURI,
					// 	"isRecognizedByURI" : isJSONRecognizedByURI,
					// 	"host" : assetHost,
					// 	"category" :assetCategory,
					// 	"tags" : assetTags,
					// 	"nameFromURI" : URIassetName,
					// 	"image" : URIassetImageURL,
					// 	"description" : URIassetDescription,
					// 	"properties" : URIassetProperties,
					// 	"lastUpdatedAtBlock" : blockNumber,
					// 	"JSONdataErr" : false,
					// 	"JSONdata" : assetJSON
					// }};
					// //console.log(poptURI);
					// db.collection("erc1155_assets").updateOne(myquery, newvalues, function(err, res) {
					// 	if (err) throw err;
					// });
				}).catch(function(error) {
					//trying a third method to get the JSON data
					console.log("The function getJSON() failed for ", typeData._name, " with ID ", assetID, " Trying curl.get() instead.");
					
					curl.get(poptURLcors)
					.then(({statusCode, body, headers}) => {
										// Request succeeded...
					assetJSON = assetJSON;
					URIassetName = assetJSON.name;
					URIassetImageURL = assetJSON.image;
					URIassetDescription = assetJSON.description;
					URIassetProperties = assetJSON.properties;  
					shortDesc = ("<h3>"+typeData._name+"</h3><p>"+URIassetDescription+"</p>").toString();
					
					var newvalues = {
						// "name" : URIassetName,
						"short_description": shortDesc,
						// "description": URIassetDescription,
						// "categories": [
						// 	{
						// 		"id": 16,
						// 		"name": "Uncategorized",
						// 		"slug": "uncategorized"
						// 	}
						// ],
						// "images": [
						// 	{
						// 		"id": 6237026,
						// 	  "src": "https:\/\/mzkz.xyz\/wp-content\/uploads\/2019\/03\/TokenNeedsApproval_Placeholder.png"
						// 	}
						//   ],
						"meta_data": [
							{
								"id": 834582,
								"key": "fifu_image_url",
								"value": URIassetImageURL
							},
							{
								"id": 836863,
								"key": "_wcj_custom_product_tabs_title_local_1",
								"value": "Image URL"
							},
							{
								"id": 836864,
								"key": "_wcj_custom_product_tabs_key_local_1",
								"value": "local_1"
							},
							{
								"id": 836865,
								"key": "_wcj_custom_product_tabs_priority_local_1",
								"value": "50"
							},
							{
								"id": 836866,
								"key": "_wcj_custom_product_tabs_content_local_1",
								"value": URIassetImageURL
							},
							{
								"id": 836867,
								"key": "_wcj_custom_product_tabs_link_local_1",
								"value": ""
							},
							{
								"id": 836868,
								"key": "_wcj_custom_product_tabs_link_new_tab_local_1",
								"value": "no"
							},
							{
								"id": 836869,
								"key": "_wcj_custom_product_tabs_local_total_number",
								"value": "1"
							}
						],
						"attributes": [{
							"id":1,
							"name":"Melt Value",
							"position":0,
							"visible":true,
							"variation":false,
							"options":[typeData._meltValue/1000000000000000000+" ENJ"]
							},
							{
							"id":3,
							"name":"Supply Model",
							"position":1,
							"visible":true,
							"variation":false,
							"options":[supplyModel]
							},
							{
							"id":6,
							"name":"Total Supply",
							"position":2,
							"visible":true,
							"variation":false,
							"options":[typeData._totalSupply]
							},
							{
							"id":5,
							"name":"Circulating Supply",
							"position":3,
							"visible":true,
							"variation":false,
							"options":[typeData._circulatingSupply]
							},
							{
							"id":2,
							"name":"Creator",
							"position":4,
							"visible":true,
							"variation":false,
							"options":[typeData._creator]
							},
							{
							"id":9,
							"name":"Creator Melting Fee",
							"position":5,
							"visible":true,
							"variation":false,
							"options":[typeData._meltFeeRatio/100+"%"]
							},
							{
							"id":8,
							"name":"Transfer Fee",
							"position":6,
							"visible":true,
							"variation":false,
							"options":[transferFee +" ENJ"]
							},
							{
							"id":4,
							"name":"Transfer Fee Type",
							"position":7,
							"visible":true,
							"variation":false,
							"options":[transferFeeType]
							},
							{
							"id":7,
							"name":"Token ID",
							"position":8,
							"visible":true,
							"variation":false,
							"options":[assetID]
							},
							{
							"id": 11,
							"name": "Most Recent Update",
							"position": 10,
							"visible": true,
							"variation": false,
							"options": [blockNumber]
							}
						]
					};	

					let WCuri = "https://mzkz.xyz/wp-json/wc/v3/" + productString;

					var options = {
						method: 'PUT',
						headers: {
							'Authorization': "Basic Y2tfOGY4MTdmNTI4Y2ZjOTExYzEzOTc4OGJmOGFhNDZmNTA1YTllOWM4YTpjc180OTdmNDRiY2YwMzAzNGEzZTY0YmU3NzIzYWUzM2QyNjhlMDcwZjFh"
						},
						uri: WCuri,
						body: newvalues,
						json: true // Automatically stringifies the body to JSON
					};
					
					rp(options)
						.then(function (parsedBody) {
							// POST succeeded...
							console.log("Success in updating URI")
						})
						.catch(function (err) {
							// POST failed...
							console.log("Error: Failure in updating URI")
							console.log(err)
						});

					// WooCommerce.put(productString, newvalues, function(err, newvalues, res) {
					// 	//console.log(res);
					//   });
					
					// var db = client.db('mzkz');
					// var myquery = { "assetID": assetID.slice(2,18) };
					// var newvalues = { $set: {
					// 	"assetID" : assetID.slice(2,18),
					// 	"assetIndex" : assetID.slice(51,66),
					// 	"assetIDfull" : assetID,
					// 	"name" : typeData._name,
					// 	"meltValue" : typeData._meltValue/1000000000000000000,
					// 	"totalSupply" : typeData._totalSupply,
					// 	"circulatingSupply" : typeData._circulatingSupply,
					// 	"transferFeeData" : typeData._transferFeeData.map(Number),
					// 	"meltFeeRatio" : parseInt(typeData._meltFeeRatio),
					// 	"creator" : typeData._creator,
					// 	"nonFungible" : typeData._nonFungible,
					// 	"URI" : uriJSON,
					// 	"popURI" : poptURI,
					// 	"isRecognizedByURI" : isJSONRecognizedByURI,
					// 	"host" : assetHost,
					// 	"category" :assetCategory,
					// 	"tags" : assetTags,
					// 	"nameFromURI" : URIassetName,
					// 	"image" : URIassetImageURL,
					// 	"description" : URIassetDescription,
					// 	"properties" : URIassetProperties,
					// 	"lastUpdatedAtBlock" : blockNumber,
					// 	"JSONdataErr" : false,
					// 	"JSONdata" : assetJSON
					// }};
					// //console.log(poptURI);
					// db.collection("erc1155_assets").updateOne(myquery, newvalues, function(err, res) {
					// 	if (err) throw err;
					// });
					})
					.catch((e) => {
						// request failed...attempting to flag the document for manual update
						var db = client.db('mzkz');
						var myquery = { "assetID": assetID.slice(2,18) };
						var newvalues = { $set: {
							"JSONdataErr" : true
						}};
						db.collection("erc1155_assets").updateOne(myquery, newvalues, function(err, res) {
							if (err) throw err;
							console.log("curl.get() call failed. The document ", typeData._name, " with ID ", assetID, " was flagged for manual update");
						});
						console.log(error);
						});
				});
			// });
	

		  });

		counter++;
	};
	console.log("Made ( " + counter + " / " + events.length + " ) updates to Asset Collection via setURI()");
};

function getTypeData(id) {
    return contract.methods.typeData(id).call()
};
    
function getURI(id) {
    return contract.methods.uri(id).call()
}; 

function populateURI(uriJSON, assetID) {
	[isJSONRecognizedByURI, assetHost] = checkIfKnownByURIstring(uriJSON);
	//isJSONRecognizedByCreator = checkIfKnownByCreator(uriJSON);

	if (isJSONRecognizedByURI == true) {
		var [poptURI, assetCategory, assetTags] = loadURIfromTemplate(uriJSON, assetHost, assetID);
	}
	else {
		var poptURI = uriJSON;
	};
	return [poptURI, isJSONRecognizedByURI, assetHost, assetCategory, assetTags]
}



function loadURIfromTemplate(uriJSON, assetHost, assetID) {
	var poptJSON = uriJSON;
	var host = assetHost;
	var template = JSONtemplates[0]; //set to default template

	//check the host against known uri slugs and ass the template
	for (let i=0; i<JSONtemplates.length; i++) {
		if (JSONtemplates[i].slug.indexOf(host) > -1) {
			var template = JSONtemplates[i];
		}
	}
	
	let start = template.id_start;
	let stop = template.id_stop;
	let index = template.index;
	let assetCategory = template.category;
	let assetTags = template.tags;
	
	// create the ids based on instructions
	// war of crpyto is special in this case 
	// because they use a bipartite slice
	if (host.indexOf("crypto-site") > -1) {
		let beg = assetID.slice(start,stop);
		let end = ("0000000000000001");
		id = beg+end;
		console.log(id);
	}
	else {
		id = assetID.slice(start,stop);
	}
	
	//finally populate the uri with the appropriate substrings
	if(uriJSON.indexOf("{id}") > -1) {
		poptJSON = uriJSON.replace("{id}", id);
	}
	if(uriJSON.indexOf("{index}") > -1) {
		poptJSON = poptJSON.replace("{index}", index)
	}

	console.log(poptJSON);

	return [poptJSON, assetCategory, assetTags]
}

function lookupWPproudctIDbyAssetID(productLookupString) {

	let WCuri = "https://mzkz.xyz/wp-json/wc/v3/" + productLookupString;

	var options = {
		method: 'GET',
		headers: {
			'Authorization': "Basic Y2tfOGY4MTdmNTI4Y2ZjOTExYzEzOTc4OGJmOGFhNDZmNTA1YTllOWM4YTpjc180OTdmNDRiY2YwMzAzNGEzZTY0YmU3NzIzYWUzM2QyNjhlMDcwZjFh"
		},
		uri: WCuri,
		json: true // Automatically stringifies the body to JSON
	};
	
	let wpProductIDjson = rp(options)
		.then(function (wpProductIDjson) {
			// GET succeeded...
			console.log("Success in fetching WC product")
			// console.log(wpProductIDjson)
			return wpProductIDjson
		})
		.catch(function (err) {
			// GET failed...
			console.log("Error: Failure in fetching WC product")
			// console.log(err)
		});  
	return wpProductIDjson	
}

function checkIfKnownByURIstring(uriJSON) {
	var isRecognizedJSON = false;
	var assetHost = "unrecognized";

	for (let i=0; i<knownHostlist.length; i++) {
		var host = knownHostlist[i];
		if(uriJSON.indexOf(host) > -1) {
			var isRecognizedJSON = true;
			var assetHost = host;
		}
	}
	return [isRecognizedJSON, assetHost]
}

function checkIfKnownByCreator(creator) {
	for (let i=0; i<knownCreatorlist.length; i++) {
		var creator = knownCreatorlist[i];
		if(uriJSON.indexOf(org) > -1) {
			isRecognizedJSON = true;
		}
		else {
			isRecognizedJSON = false;
		}
	}
	return isRecognizedJSON
}


// function getJSON(url, req, res) {

//     request(url, (error, response, body)=> {
//         if (!error && response.statusCode === 200) {
//             //const uriResponse = JSON.parse(body);
//             //console.log("Got a response: ", uriResponse, url);
//             return body;
//         } else {
//             console.log("Got an error requesting JSON file: ", url);
//         };
//     });
// };

function readEventsFromDBB(db) {
	  
	var db = client.db('mzkz');
	
	db.collection('erc1155').findOne({}, function (findErr, result) {
		if (findErr) throw findErr;
		console.log(result);
	});
};

function getAssetbyTopic(db, collection, topicIndex, assetID) {
    
    var db = client.db('mzkz');
    let query = ("topics." + topicIndex);
	
	db.collection(collection).find({"topics.1":assetID}, function (findErr, result) {
		if (findErr) throw findErr;
		console.log(result);
	});
};

/**
 * getCurrBlockNumber() uses web3 to fetch the latest 
 * block number
 *
 * @return {Int} Current Ethereum block number
 */
function getCurrBlockNumber() {
	let currBlockNumber = web3.eth.getBlockNumber(function(error, result) {
		return result;
	});

	return currBlockNumber;
}

/**
 * checkBetweenBlocks() looks for events between two blocks and
 * returns them
 *
 * @param fromBlock {Int} Beginning block 
 * @param toBlock {Int} End block 
 * @return {Array of Objects} All found events 
 */
function checkBetweenBlocks(fromBlock, toBlock) {
	fs.writeFile('LastBlock.txt', fromBlock, (err) => {
	  if (err) throw err;
	});

	let eventsCreate= web3.eth.getPastLogs({
		fromBlock: fromBlock,
		toBlock: toBlock,
		address: "0x8562c38485B1E8cCd82E44F89823dA76C98eb0Ab",
		topics: ["0x250ed6814ddcc5fc06eec40c015c413d3aa7bfc4e1df91ed205e0d71f0a9408f"]
		}, function (error, eventsCreate) {
			//console.log("Checked for Create events between blocks");
			return eventsCreate;
		});	
	wait(100);	
	let eventsMelt = web3.eth.getPastLogs({
		fromBlock: fromBlock,
		toBlock: toBlock,
		address: "0x8562c38485B1E8cCd82E44F89823dA76C98eb0Ab",
		topics: ["0xba6a480970167b03ed2f35b55c48a436cd01efe96abdf846d1a64da47df0e6d9"]
		}, function (error, eventsMelt) {
			//console.log("Checked for Melt events between blocks");
			return eventsMelt;
		});	
	wait(100);
	let eventsMint = web3.eth.getPastLogs({
		fromBlock: fromBlock,
		toBlock: toBlock,
		address: "0x8562c38485B1E8cCd82E44F89823dA76C98eb0Ab",
		topics: ["0xcc9c58b575eabd3f6a1ee653e91fcea3ff546867ffc3782a3bbca1f9b6dbb8df"]
		}, function (error, eventsMint) {
			//console.log("Checked for Mint events between blocks");
			return eventsMint;
		});
	wait(100);
	let eventsSetURI = web3.eth.getPastLogs({
		fromBlock: fromBlock,
		toBlock: toBlock,
		address: "0x8562c38485B1E8cCd82E44F89823dA76C98eb0Ab",
		topics: ["0xee1bb82f380189104b74a7647d26f2f35679780e816626ffcaec7cafb7288e46"]
		}, function (error, eventsSetURI) {
			//console.log("Checked for SetURI events between blocks");
			return eventsSetURI;
		});	
	wait(100);
	let eventsTransfer = web3.eth.getPastLogs({
		fromBlock: fromBlock,
		toBlock: toBlock,
		address: "0x8562c38485B1E8cCd82E44F89823dA76C98eb0Ab",
		topics: ["0xf2dbd98d79f00f7aff338b824931d607bfcc63d47307162470f25a055102d3b0"]
		}, function (error, eventsTransfer) {
			//console.log("Checked for Transfer events between blocks");
			return eventsTransfer;
		});		
	wait(100);
	let eventsUpdateName = web3.eth.getPastLogs({
		fromBlock: fromBlock,
		toBlock: toBlock,
		address: "0x8562c38485B1E8cCd82E44F89823dA76C98eb0Ab",
		topics: ["0x28bce0e23786df7a86b305fe801506dbf59150e2f634d23d4b6d702f99e60b87"]
		}, function (error, eventsUpdateName) {
			//console.log("Checked for Name Updates events between blocks");
			return eventsUpdateName;
		});	

	return [eventsCreate, eventsMelt, eventsMint, eventsSetURI, eventsTransfer, eventsUpdateName];
}
	
/**
 * wait() will consecutively wait corresponding time given
 * rather than putting the code to sleep
 *
 * @param ms {Int} Amount of ms to wait
 */
function wait(ms){
  	var start = new Date().getTime();
   	var end = start;

   	while(end < start + ms) {
    	end = new Date().getTime();
  	}
}
