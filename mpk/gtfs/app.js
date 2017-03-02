import fs from 'fs';
import path from 'path';
import * as d3 from 'd3';
import _ from 'lodash';
import csv from 'fast-csv';
import async from 'async';

console.log('-----------------------------------');
const OPTIONS = process.argv.slice(2);

const FIXED_DATE = '01/01/2016';

const TIME_TABLE = [
    Date.parse(`${FIXED_DATE} 07:00`),
    Date.parse(`${FIXED_DATE} 13:00`),
    Date.parse(`${FIXED_DATE} 15:30`)
];

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

    let tripGroups = d3.nest()
        .key((trip) => {
            return trip.route_id;
        })
        .entries(_.filter(trips, {
            'service_id': '6'
        }));

    let lines = tripGroups
        /*.filter(l => {
            return !!~['134', '206'].indexOf(l.key);
        })*/
        .map((tripGroup) => {
            let line = {};
            let maxStops = 0;

            let mainTrips = tripGroup.values.filter((trip) => {
                var variant = _.find(variants, {
                    variant_id: trip.variant_id
                });

                return variant.is_main === '1';
            }).map(trip => trip.trip_id);

            let trips = mainTrips.map(tripId => {

                let trips = stopTimes.filter(stopTime => {
                    return tripId === stopTime.trip_id;
                }).map((stopTime, idx, stops) => {
                    stopTime.arrival_time = reformatTime(stopTime.arrival_time);
                    stopTime.departure_time = reformatTime(stopTime.departure_time);
                    stopTime.stop_sequence = parseInt(stopTime.stop_sequence, 10);

                    stopTime.time = Date.parse(`${FIXED_DATE} ${stopTime.arrival_time}`);
                    stopTime.timeOffset = idx > 0 ? Math.ceil(stopTime.time - stops[idx - 1].time) / 1000 : 0;

                    return stopTime;
                }).sort((a, b) => {
                    return a.stop_sequence < b.stop_sequence ? -1 : 1;
                });

                maxStops = Math.max(maxStops, trips.length);

                return trips;
            });

            trips = trips.filter(trip => {
                return trip.length === maxStops;
            });

            /* ------------------------------------- */

            line.name = tripGroup.key;

            line.trips = TIME_TABLE.map(timePoint => {
                return trips.reduce((currTrip, prevTrip) => {
                    return Math.abs(currTrip[0].time - timePoint) < Math.abs(prevTrip[0].time - timePoint) ? currTrip : prevTrip;
                });
            });

            line.coords = trips[0].map(trip => {
                return trip.stop_id;
            }).map(stopId => {
                return stops.find(stop => {
                    return stop.stop_id === stopId;
                });
            });

            return line;

            /*let mainTrips = tripGroup.values.filter((trip) => {
                var variant = _.find(variants, {
                    variant_id: trip.variant_id
                });

                return variant.is_main === '1';
            });

            let trips = mainTrips.map((trip) => {
                var firstStop = _.find(stopTimesGroup, {
                    key: trip.trip_id
                });

                return Object.assign(trip, {
                    time: reformatTime(firstStop.values[0].arrival_time),
                    stop_id: firstStop.values[0].stop_id
                });
            })
                .sort((a, b) => {
                    let aTime = Date.parse(`${FIXED_DATE} ${a.time}`);
                    let bTime = Date.parse(`${FIXED_DATE} ${b.time}`);
                    return aTime < bTime ? -1 : 1;
                });

            let st = _.find(stopTimesGroup, {
                key: trips[0].trip_id
            });

            let coords = st.values.map((trip) => {
                return _.find(stops, {
                    stop_id: trip.stop_id
                });
            });

            let fullTimeTable = mainTrips.map(trip => {
                return _.find(stopTimesGroup, {
                    key: trip.trip_id
                }).values.map(time => {
                    return {
                        time: Date.parse(`${FIXED_DATE} ${reformatTime(time.arrival_time)}`),
                        arrival_time: reformatTime(time.arrival_time),
                        departure_time: reformatTime(time.departure_time),
                        stop_sequence: time.stop_sequence
                    }
                });
            })
            .filter(trip => {
                return trip.length === st.values.length;
            })
            .sort((a, b) => {
                let aTime = Date.parse(`${FIXED_DATE} ${reformatTime(a[0].arrival_time)}`);
                let bTime = Date.parse(`${FIXED_DATE} ${reformatTime(b[0].arrival_time)}`);
                return aTime < bTime ? -1 : 1;
            });

            let timeTable = TIME_POINTS.map(tp => {
                var closest = fullTimeTable.reduce((curr, prev) => {
                    return Math.abs(Date.parse(`${FIXED_DATE} ${reformatTime(curr[0].arrival_time)}`) - tp) < Math.abs(Date.parse(`${FIXED_DATE} ${reformatTime(prev[0].arrival_time)}`) - tp) ? curr : prev;
                });

                return {
                    timePoint: tp,//new Date(tp).toLocaleTimeString(),
                    found: closest
                };
            }).map(tp => {
                let startTime = tp.found[0].time;

                tp.found = tp.found.map(f => {
                    f.time = Math.abs(f.time - startTime) / 1000;
                   return f;
                });

                return tp;
            });

            return {
                name: tripGroup.key,
                coords,
                timeTable,
            };*/
        });

    /*lines.forEach(line => {
        console.log('saving line:', line.name);
        fs.writeFile('./output/line_' + line.name + '.json', JSON.stringify(_.omit(line, 'coords'), null, 2));
    });*/

    /*fs.writeFile('./output.json', JSON.stringify(lines.map(line => {
        return _.omit(line, 'timeTable');
    }), null, 2))*/

    fs.writeFile('./output.json', JSON.stringify(lines, null, 2));

    console.log('---->> DONE');

}

function reformatTime(input) {
    var hhmm = input.split(':');
    hhmm[0] = parseInt(hhmm[0], 10) > 23 ? parseInt(hhmm[0], 10) - 24 : hhmm[0];

    return ('00:00:00' + hhmm.join(':')).slice(-8);
}