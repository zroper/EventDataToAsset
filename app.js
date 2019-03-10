/**
 * @Author Zachary Roper, zachroper@gmail.com
 *
 * Synchronizes data for MongoDB with ERC-1155 contract events
 * by using web3 and Infura. to look at past completed block events
*/

const abi = require('./contract_abi.json');
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



//import bodyParser from 'body-parser';

// Set up Web3 and contract connection
//const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545/'));
const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/623f293b067749b29b8d4c98c801472a'));
//let abi = fs.readFileSync('contract_abi.txt', 'utf8');
const contract = new web3.eth.Contract(abi, '0x8562c38485B1E8cCd82E44F89823dA76C98eb0Ab');

let startBlockNumber = parseInt(fs.readFileSync('StartBlock.txt', 'utf8')) - 1;
var lastBlockNumber = startBlockNumber;

// client.connect();
// const changeStream = TransferCollection.watch();

// changeStream.on('change', (change) => {
//     console.log(change); // You could parse out the needed info and send only that data. 
//     io.emit('changeData', change);
// }); 


const assetID = "0x70800000000001b8000000000000000000000000000000000000000000000000";
//contract.methods.typeData(assetID).call()
//.then(console.log);

getTypeData(assetID)
.then(function(item) {
    //console.log(assetID.slice(2,18), assetName, assetMeltValue, assetTotalSupply, assetCirculatingSupply, assetTransferFeeData, assetMeltFeeRatio, assetCreator)
    var newAssetDocument = {
        "assetID" : assetID,
        "name" : item._name,
        "meltValue" : item._meltValue/1000000000000000000,
        "totalSupply" : item._totalSupply,
        "circulatingSupply" : item._circulatingSupply,
        "transferFeeData" : item._transferFeeData,
        "meltFeeRatio" : item._meltFeeRatio,
        "creator" : item._creator
    }
    console.log(newAssetDocument);
    var db = client.db('mzkz');
    db.collection("erc1155_assets").insertOne(newAssetDocument);

});


// wait getURI(assetID)
// .then(function(item) {
//     uriJSON=item;
                   
//  $.getJSON(uriJSON, function(data) {
//     console.log(data);
//      assetName = data.name;
//      assetImageURL = data.image;
//      assetDescription = data.description;
//      assetProperties = data.properties;
// });

// Application begins here
connectToDBB(client,db);
//watchCollection();

function connectToDBB(client) {
	client.connect( function (err, client) {
		if (err) throw err;
        //watchCollection();
		//startWatching();

	  }); 
};



function watchCollection() {

    db.collection('erc1155Events_transfer').watch().
    on('change', data => console.log(new Date(), data));
    //const changeStreamCursor = TransferCollection.watch();
    //watchDBBForUpdates(changeStreamCursor);
}


//this function polls a change stream and prints out each change as it comes in
function watchDBBForUpdates(cursor) {
  while (!cursor.isExhausted()) {
    if (cursor.hasNext()) {
      change = cursor.next();
      print(JSON.stringify(change));
    }
  }
  watchDBBForUpdates(cursor);
}

/**
 * startWatching() is the top level function to begin
 * the contract event watching
 */
async function startWatching() {
	let watching = true;

	while (watching) {
		await watchEvents();
		wait(2500);
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
		let [eventsCreate, eventsMelt, eventsMint, eventsSetURI, eventsTransfer] = await checkBetweenBlocks(start, stop);
		lastBlockNumber = stop;
		tt++;

		//Write to database here
		eventsCreate.then(function(events) {
			var collection = "erc1155Events_create";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
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
		 });

		 eventsTransfer.then(function(events) {
			var collection = "erc1155Events_transfer";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
		 });
	}

	else if (lastBlockNumber < latestCompleteBlock) {
		let start = lastBlockNumber;
		let stop = latestCompleteBlock;
		
		console.log("Getting events from: " + start + " to " + stop);
		let [eventsCreate, eventsMelt, eventsMint, eventsSetURI, eventsTransfer] = await checkBetweenBlocks(start, stop);
		lastBlockNumber = currBlockNumber;

		eventsCreate.then(function(events) {
			var collection = "erc1155Events_create";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
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
		 });

		 eventsTransfer.then(function(events) {
			var collection = "erc1155Events_transfer";
			//console.log(events)
			//updateDDBFromEvents(db,collection,events);
		 })		 

	} else {
		console.log("...watching the blockchain...")
	}
}

/**
 * updateDDBFromEvents() wil update DDB given event objects
 *
 * @param events {Array of Objects} Events to sync ddb with
 */
function updateDDBFromEvents(db,collection,events) {
	let counter = 0;
	var db = client.db('mzkz');
	//let petShopTable = 'pet-shop'
	
	for (let i=0; i<events.length; i++) {
        let eventObj = events[i];
        //perform actions on the collection object
        let assetID = eventObj.topics[1];

        
		//db.collection(collection).insertOne(eventObj);
		counter++;
	}
    

	console.log("Made ( " + counter + " / " + events.length + " ) updates to " + collection);
}

async function getTypeData(id) {
    return contract.methods.typeData(id).call()
};
    
async  function getURI(id) {
    return enjinMultiverse.methods.uri(id).call()
}; 


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

	return [eventsCreate, eventsMelt, eventsMint, eventsSetURI, eventsTransfer];
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

