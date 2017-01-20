import fs from 'fs';
import path from 'path';
import * as d3 from 'd3';
import _ from 'lodash';
import csv from 'fast-csv';
import async from 'async';

console.log('-----------------------------------');
const OPTIONS = process.argv.slice(2);
const DIR = OPTIONS[0];
const FILES = {
    trips: 'trips.txt',
    stops: 'stops.txt',
    stopTimes: 'stop_times.txt'
}

if (!DIR) {
    console.log('!! no directory');
    process.exit(1);
}

let data = {};
async.forEachOf(FILES, function(val, key, callback) {
    console.log('---> started: ', val);

    let rows = [];
    csv
        .fromPath(path.resolve('./' + DIR + '/' + val), {
            headers: true,
            ignoreEmpty: true
        })
        .on('data', function(data) {
            rows.push(data);
        })
        .on('end', function() {
            console.log('-->> finished: ', val);
            data[key] = rows;
            callback();
        });

}, function(err) {
    if (err) console.error(err.message);

    let lines = [];

    console.log('->>> all data loaded!');

    let tripGroups = d3.nest()
        .key((trip) => {
            return trip.route_id;
        })
        .entries(data.trips);

    async.forEach(tripGroups.slice(0,2), (group, cb) => {
        console.log('--->> processing trip', group.key);

        group.values = group.values.map((trip) => {
            let stops = _.filter(data.stopTimes, {
                trip_id: trip.trip_id
            });
            trip.stops = stops;
            trip.stops_count = stops.length;
            return trip;
        });

        let mainTripCount = getMostFreq(_.map(group.values, 'stops_count'));

        group.main = _.find(group.values, {stops_count: parseInt(mainTripCount, 10)});

        lines.push({
          id: group.key,
          stops: group.main
        });

        cb();
    }, (err) => {
      console.log('processing done!');
      console.log(lines);
    });
});

function countOccurence(arr) {
    return arr.reduce((countMap, word)  => {
        countMap[word] = ++countMap[word] || 1;
        return countMap;
    }, {});
}

function getMostFreq(arr) {
	var counts = countOccurence(arr);
	return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b ));
}
