'use strict';

import leaflet from 'leaflet';
import _ from 'lodash';
import * as d3 from 'd3';
import polyline from '@mapbox/polyline';
import async from 'async';

import lD3SvgFactory from './ld3Svg.class.js';
import './style.scss';

const L = new lD3SvgFactory(leaflet, d3);
const mapEl = document.getElementById('map-container');
const lineDetailsEl = document.getElementById('line-details');

const leafletMap = L.map(mapEl).setView([51.10, 17.02], 12);

const TILE_URL = {
    dark: 'https://api.mapbox.com/styles/v1/amortka/cixvstzqi00152rql928bfsr2/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiYW1vcnRrYSIsImEiOiJjaW56azMwZW4wMHU0dnhseTJmdmd5MnNvIn0.ETjQqiTTrYueBpf8_aiOhg',
    osm: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
};

const directionsService = new google.maps.DirectionsService;

function initMap() {
    d3.json('./data/wroclaw.json', drawMap);
}

function drawMap(data) {

    const tileLayer = L.tileLayer(TILE_URL.dark, {
        zoomOffset: 0,
        tileSize: 256,
    }).addTo(leafletMap);

    const overlay = L.d3SvgOverlay(function(selection, projection) {


        let linesUpdate = selection.selectAll('.line');
        let lineDetailUpdate = selection.selectAll('.line-detailed');

        let lineCurveFunction = d3.line()
            .curve(d3.curveCardinal)
            .x((d) => {
                return projection.latLngToLayerPoint(d).x;
            })
            .y((d) => {
                return projection.latLngToLayerPoint(d).y;
            });


        let lineFunction = d3.line()
            .curve(d3.curveBasis)
            .x((d) => {
                return projection.latLngToLayerPoint(d).x;
            })
            .y((d) => {
                return projection.latLngToLayerPoint(d).y;
            });

        let cScale = d3.scaleOrdinal(d3.schemeCategory10);

        linesUpdate
            .attr('stroke-width', 2 / projection.scale);

        linesUpdate.data(processData(data))
            .enter()
            .append('path')
            .attr('d', (d) => {
                return lineCurveFunction(d.coords);
            })
            .attr('fill', 'none')
            // .attr('stroke', '#e74c3c')
            .attr('stroke', (d, idx) => {
                // return 'red';
                return cScale(idx);
            })
            .attr('class', 'line')
            .attr('stroke-width', 2 / projection.scale)
            .attr('opacity', 0.8)
            .style('pointer-events', 'visiblePainted')
            .on('mouseover', function() {
                selection.selectAll('.line')
                    .attr('opacity', 0.1);

                d3.select(this)
                    .attr('opacity', 0.8)
                    .attr('stroke-width', 5 / projection.scale);
            })
            .on('mouseout', function() {
                selection.selectAll('.line')
                    .attr('opacity', 0.8)
                    .attr('stroke-width', 2 / projection.scale);
            })
            .on('click', function(d) {
                console.log('e', d);
                //downloadJSON(d, 'line-134.json');
            });


        /*async.map(splitCoords(processData(data)[0].coords, 15), fetchPartLine, (err, results) => {
            console.log('results', results);
            downloadJSON(results);
        });*/

        console.log('splitCoords(processData(data)[0].coords, 15)', splitCoords(processData(data)[0].coords, 15));

        verifyLine(processData(data)[0]);


        function verifyLine(line) {
            let sections = getSectionsFromCoords(line.coords);
            let groups = splitCoords(line.coords, 15);
            console.log('sections', sections.length);

            d3.json('./data/results.json', (directions => {
                drawLineDetails(sections, directions);
            }));
        }

        function getSectionsFromCoords(inputCords) {
            let coords = [...inputCords];
            let sections = [];
            while (coords.length > 1) {
                sections.push([coords.shift(), coords[0]]);
            }

            return sections;
        }

        function fetchPartLine(part, cb) {
            var query = {
                origin: {lat: part[0].lat, lng: part[0].lon},
                destination: {lat: part[part.length - 1].lat, lng: part[part.length - 1].lon},
                travelMode: google.maps.TravelMode.DRIVING
            };

            if (part.length > 3) {
                part.pop();
                part.shift();
                query.waypoints = part.map(p => {
                    return {
                        location: {lat: p.lat, lng: p.lon},
                        stopover: true
                    };
                });
            }

            directionsService.route(query, function(response, status) {
                if (status == 'OK') {
                    cb(null, response);
                } else {
                    cb(status);
                }
            });
        }

        function drawPartLines(err, results) {
            if (err) {
                return console.log('ERROR:', err);
            }

            let waypoints = [];
            let time = 0;
            let distance = 0;

            results.forEach(result => {
                let route = result.routes[0];
                waypoints = [...waypoints, ...polyline.decode(route.overview_polyline)];

                route.legs.forEach(leg => {
                    /*sections.push({
                     duration: leg.duration.value,
                     distance: leg.distance.value
                     });*/

                    time += leg.duration.value;
                    distance += leg.distance.value;
                });

            });

            console.log('results:', results);
            console.log('time:', time);
            console.log('distance:', distance / 1000);

            // console.log('sections no', sections.length);
            // console.log('sections:', JSON.stringify(sections, false, 2));


            lineDetailUpdate.data(processData(data))
                .enter()
                .append('path')
                .attr('d', (d) => {
                    return lineFunction(waypoints);
                })
                .attr('fill', 'none')
                // .attr('stroke', '#e74c3c')
                .attr('stroke', (d, idx) => {
                    return 'red';
                    // return cScale(idx);
                })
                .attr('class', 'line-detailed')
                .attr('stroke-width', 1 / projection.scale)
                .attr('opacity', 0.8)
                .style('pointer-events', 'visiblePainted');

        }

    }).addTo(leafletMap);
}

function drawLineDetails(sections, directions) {

    const svg = d3.select('#line-details svg').empty() ? d3.select('#line-details').append('svg') : d3.select('#line-details svg');
    const g = svg.select('g').empty() ? svg.append('g') : svg.select('g');

    let legs = [];

    directions.forEach(direction => {
        legs = [...legs, ...direction.routes[0].legs];
    });


    let totalDistance = 0;
    let totalDuration = 0;
    legs.forEach((leg, idx) => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;

        leg.distance.curr = totalDistance;
        leg.duration.curr = totalDuration;
    });

    /*let totalDistance = legs.reduce((total, leg) => {
        return total += leg.distance.value;
    }, 0);

    let totalDuration = legs.reduce((total, leg) => {
        return total += leg.duration.value;
    }, 0);*/


    let width = svg.node().getBoundingClientRect().width * 0.9;
    let height = svg.node().getBoundingClientRect().height * 0.9;

    let x = d3.scaleLinear()
        .rangeRound([0, width]);

    let y = d3.scaleLinear()
        .rangeRound([height, 0]);

    let line = d3.line()
        .x(function(d) { return x(d.distance.curr); })
        .y(function(d) { return y(d.duration.curr); });

    console.log('sections', sections);

    x.domain([0, totalDistance]);
    y.domain([0, totalDuration]);

    /*legs.forEach(leg => {
        console.log('leg', leg.distance.value, '->', x(leg.distance.value));
        console.log('leg', leg.duration.value, '->', y(leg.duration.value));
    });*/

    g.append('path')
        .datum(legs)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', 1.5)
        .attr('d', line);

    debugger;
}

// function displayDirections(directions) {
//     let legs = [];
//
//     directions.forEach(direction => {
//         legs = [...legs, ...direction.routes[0].legs];
//     });
//
//     debugger;
// }

function splitCoords(inputArray, groupSize) {
    var parts = inputArray.map((i, idx) => {
        return idx % groupSize === 0 ? inputArray.slice(idx, idx + groupSize) : null;
    }).filter(i => !!i);

    if (parts[parts.length - 1].length < 2) {
        parts[parts.length - 2] = [...parts[parts.length - 2], ...parts[parts.length - 1]];
        parts.splice(parts.length - 1, 1);
    }

    parts = parts.map((part, idx) => {
        if (idx > 0) {
            let previousPart = parts[idx - 1];
            part.unshift(previousPart[previousPart.length - 1]);
        }

        return part;
    });

    return parts;
}

function processData(data) {
    return data
        .filter(line => {
            return line.name === '134';
        })
        .map(line => {
            line.coords = line.coords.map(c => {
                return {
                    lat: parseFloat(c.lat),
                    lon: parseFloat(c.lon)
                }
            });
            return line;
        });
}

function downloadJSON(obj, name) {
    let data = 'text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(obj));
    let aEl = document.createElement('a');
    aEl.href = 'data:' + data;
    aEl.download = name || 'data.json';
    aEl.innerHTML = 'download JSON';

    document.body.appendChild(aEl);
    aEl.click();
    document.body.removeChild(aEl);
}

initMap();
