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

const PADDING = {
  left: 50,
  top: 20
}

const TILE_URL = {
    dark: 'https://api.mapbox.com/styles/v1/amortka/cixvstzqi00152rql928bfsr2/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiYW1vcnRrYSIsImEiOiJjaW56azMwZW4wMHU0dnhseTJmdmd5MnNvIn0.ETjQqiTTrYueBpf8_aiOhg',
    osm: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
};

const GRADIENTS = [
  ['#92fe9d', '#00c9ff'],
  ['#FFC371', '#ff9068'],
  ['#B24592', '#F15F79'],
  ['#e96443', '#904e95'],
  ['#9be15d', '#00e3ae'],
];

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
                console.log('e', d.name);
                verifyLine(d);
            });


        // verifyLine(processData(data)[0]);

        function verifyLine(line) {
            let input = reduceArray(line.coords);

            d3.queue()
                .defer(d3.json, `./data/lines/line_${line.name}.json`)
                .defer(fetchPartLine, input)
                .await((err, lineDetails, directions,) => {
                    drawLineDetails(lineDetails, directions);
                });
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

    }).addTo(leafletMap);
}

function drawLineDetails(lineDetails, directions) {

    const containerEl =  d3.select('#line-details svg');
    containerEl.attr('class', 'open');

    const svg = d3.select('#line-details svg').empty() ? d3.select('#line-details').append('svg') : d3.select('#line-details svg');
    svg.selectAll('*').remove();

    let legs = directions.routes[0].legs;

    legs.unshift({
        distance: {
            text: '0',
            value: 0
        },
        duration: {
            text: '0',
            value: 0
        },
    });

    let totalDistance = 0;
    let totalDuration = 0;

    let timeTable = lineDetails.timeTable.map(tp => {
        return reduceArray(tp.found);
    });

    legs = legs.map((leg, idx) => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;

        leg.distance.curr = totalDistance;
        leg.duration.curr = totalDuration;

        leg.times = {
            t1: {
                time: timeTable[0][idx].time,
                arrival_time: timeTable[0][idx].arrival_time
            },
            t2: {
                time: timeTable[1][idx].time,
                arrival_time: timeTable[1][idx].arrival_time
            },
            t3: {
                time: timeTable[2][idx].time,
                arrival_time: timeTable[2][idx].arrival_time
            },
        };

        return leg;
    });

    let totalDurationMax = Math.max(
        legs[legs.length - 1].duration.curr,
        legs[legs.length - 1].times.t1.time,
        legs[legs.length - 1].times.t2.time,
        legs[legs.length - 1].times.t3.time
    );

    let width = svg.node().getBoundingClientRect().width * 0.9;
    let height = svg.node().getBoundingClientRect().height * 0.6;

    let x = d3.scaleLinear()
        .rangeRound([0, width]);

    let y = d3.scaleLinear()
        .rangeRound([height, 0]);

    x.domain([0, totalDistance]);
    y.domain([0, totalDurationMax]);

    var xAxis = d3.axisBottom(x)
        .tickSize(-height, ',.0f');

    var yAxis = d3.axisLeft(y)
        .ticks(10)
        .tickFormat(formatMinutes)
        .tickSize(-width)
        .tickValues(y.ticks(5).concat( y.domain() ));

    let line = d3.line()
        .x(function(d) { return x(d.distance.curr); })
        .y(function(d) { return y(d.duration.curr); });

    let lineB = d3.line()
        .x(function(d) { return x(d.distance.curr); })
        .y(function(d) { return y(d.times.t3.time); });

    var areaA = d3.area()
        .x0(x(0))
        .y0(y(0))
        .x(d => x(d.distance.curr))
        .y1(d => y(d.duration.curr));

    var areaB = d3.area()
        .x0(x(0))
        .y0(y(0))
        .x(d => x(d.distance.curr))
        .y1(d => y(d.times.t3.time));

    let colorA = GRADIENTS[4];
    let colorB = GRADIENTS[1];

    var areaGradientA = svg.append('defs')
      .append('linearGradient')
      .attr('id','areaGradientA')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');

    areaGradientA.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', colorA[0])
      .attr('stop-opacity', 0.9);
    areaGradientA.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', colorA[1])
      .attr('stop-opacity', 0.5);

    var areaGradientB = svg.append('defs')
        .append('linearGradient')
        .attr('id','areaGradientB')
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '0%').attr('y2', '100%');

    areaGradientB.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', colorB[0])
        .attr('stop-opacity', 0.9);
    areaGradientB.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', colorB[1])
        .attr('stop-opacity', 0.5);

    svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(' + PADDING.left + ', ' + (height + PADDING.top) + ')')
      .call(xAxis);

    svg.append('g')
      .attr('class', 'y axis')
      .attr('transform', 'translate(' + PADDING.left + ', ' + PADDING.top + ')')
      .call(yAxis);


    svg.append('g')
        .attr('transform', 'translate(' + PADDING.left + ', ' + PADDING.top + ')')
        .append('path')
        .style('fill', 'url(#areaGradientA)')
        .datum(legs)
        .attr('d', areaA);

    svg.append('g')
      .attr('transform', 'translate(' + PADDING.left + ', ' + PADDING.top + ')')
      .append('path')
      .datum(legs)
      .attr('class', 'path')
      .attr('fill', 'none')
      .attr('stroke', colorA[0])
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('stroke-width', 2)
      .attr('d', line);

    svg.append('g')
      .attr('transform', 'translate(' + PADDING.left + ', ' + PADDING.top + ')')
      .append('path')
      .datum(legs)
      .attr('class', 'path')
      .attr('fill', 'none')
      .attr('stroke', colorB[0])
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('stroke-width', 2)
      .attr('d', lineB);
}

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
        // .filter(line => {
        //     return line.name === '134';
        // })
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

function formatMinutes(d) {
    var hours = Math.floor(d / 3600),
        minutes = Math.floor((d - (hours * 3600)) / 60),
        seconds = d - (minutes * 60);
    var output = seconds + 's';
    if (minutes) {
        output = minutes + 'm ' + output;
    }
    if (hours) {
        output = hours + 'h ' + output;
    }
    return output;
};

function reduceArray(input) {
    let ratio = Math.ceil(input.length / 20);

    return input.filter((val, idx) =>{
        return (idx % ratio == 0);
    });
}

initMap();
