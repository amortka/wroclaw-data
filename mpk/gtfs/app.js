import fs from 'fs';
import path from 'path';
import * as d3 from 'd3';
import _ from 'lodash';
import csv from 'fast-csv';
import async from 'async';

console.log('-----------------------------------');
const OPTIONS = process.argv.slice(2);

const FILES = {
    trips: 'trips.csv',
    stops: 'stops.csv',
    stopTimes: 'stop_times.csv',
    variants: 'variants.csv'
};

let data = {};

async.eachOf(FILES, function(val, key, cb) {
    let rows = [];

    console.log('---> started: ', val);
    csv
        .fromPath(path.resolve('../app/gtfs/' + val), {
            headers: true,
            ignoreEmpty: true
        })
        .on('data', function(data) {
            rows.push(data);
        })
        .on('end', function() {
            console.log('-->> finished: ', val);
            data[key] = rows;
            cb();
        });

}, processData);

function processData(err) {
    console.log('---- PROCESSING ....');

    if (err) {
        console.log('ERROR:', err)
    }

    let {stops, trips, stopTimes, variants} = data;

    stops = stops.map(s => ({
        stop_id: s.stop_id,
        stop_code: s.stop_code,
        stop_name: s.stop_name,
        lat: s.stop_lat,
        lon: s.stop_lon
    }));

    let stopTimesGroup = d3.nest()
        .key((trip) => {
            return trip.trip_id;
        })
        .entries(stopTimes);

    let tripGroups = d3.nest()
        .key((trip) => {
            return trip.route_id;
        })
        .entries(_.filter(trips, {
            'service_id': '6'
        }));

    let lines = tripGroups.map((tripGroup) => {

        tripGroup.values = tripGroup.values.map((trip) => {
            var variant = _.find(variants, {
                variant_id: trip.variant_id
            });

            var firstStop = _.find(stopTimesGroup, {
                key: trip.trip_id
            });

            return Object.assign(trip, {
                time: firstStop.values[0].arrival_time,
                stop_id: firstStop.values[0].stop_id,
                isMainVariant: variant.is_main === '1'
            });
        })
            .filter((trip) => (trip.isMainVariant))
            .sort((a, b) => {
                let aTime = Date.parse('01/01/2016 ' + a.time);
                let bTime = Date.parse('01/01/2016 ' + b.time);
                return aTime < bTime ? -1 : 1;
            });

        let st = _.find(stopTimesGroup, {
            key: tripGroup.values[0].trip_id
        });

        let coords = st.values.map((trip) => {
            return _.find(stops, {
                stop_id: trip.stop_id
            });
        });


        return {
            name: tripGroup.key,
            coords
        };
    });

    fs.writeFile('./output.json', JSON.stringify(lines, null, 2));
    console.log('---->> DONE');
}