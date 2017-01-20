'use strict';

import leaflet from 'leaflet';
import _ from 'lodash';
import * as d3 from 'd3';

import lD3SvgFactory from './ld3Svg.class.js';
import './style.scss';

const L = new lD3SvgFactory(leaflet, d3);
const mapEl = document.getElementById('map-container');
const leafletMap = L.map(mapEl).setView([51.10, 17.02], 12);

const coords = [{
    lat: 51.10,
    lng: 17.02
}, ];

const TILE_URL = {
    dark: 'https://api.mapbox.com/styles/v1/amortka/cixvstzqi00152rql928bfsr2/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiYW1vcnRrYSIsImEiOiJjaW56azMwZW4wMHU0dnhseTJmdmd5MnNvIn0.ETjQqiTTrYueBpf8_aiOhg',
    osm: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
};

const tileLayer = L.tileLayer(TILE_URL.dark, {
    zoomOffset: 0,
    tileSize: 256,
}).addTo(leafletMap);


/** -------------------------------------------------------------------- */

for (let i = 0; i < 50; i++) {
    coords.push(getRandom(coords[0].lat, coords[0].lng, 0.1));
}

// drawMap(coords);

d3.queue()
    .defer(d3.csv, './gtfs/stops.csv')
    .defer(d3.csv, './gtfs/trips.csv')
    .defer(d3.csv, './gtfs/stop_times.csv')
    .defer(d3.csv, './gtfs/variants.csv')
    .await((err, stops, trips, stopTimes, variants) => {

        console.log('->> loaded data');

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

        drawMap(lines);
    });


/** -------------------------------------------------------------------- */

function drawMap(data) {
    console.log('drawing map');
    let pointsOverlay = L.d3SvgOverlay(function(selection, projection) {

        let pointsUpdate = selection.selectAll('path');
        let r = 3; // / projection.scale;

        let lineFunction = d3.line()
            .curve(d3.curveCardinal)
            .x((d) => {
                return projection.latLngToLayerPoint(d).x;
            })
            .y((d) => {
                return projection.latLngToLayerPoint(d).y;
            });

        let cScale = d3.scaleOrdinal(d3.schemeCategory10);

        pointsUpdate
            .attr('stroke-width', 2 / projection.scale);

        pointsUpdate.data(data)
            .enter()
            .append('path')
            .attr('d', (d) => {
                return lineFunction(d.coords);
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
            .style('pointer-events', 'visiblePainted');/*
            .on('mouseover', function() {
                selection.selectAll('.line')
                    .attr('opacity', 0.1);

                d3.select(this)
                    .attr('opacity', 0.8)
                    .attr('stroke-width', 5);
            })
            .on('mouseout', function() {
                selection.selectAll('.line')
                    .attr('opacity', 0.8)
                    .attr('stroke-width', 2);
            });*/

        /*.attr('r', r)
         .attr('fill', 'red')
         .attr('opacity', '1')
         .attr('cx', d => projection.latLngToLayerPoint(d).x)
         .attr('cy', d => projection.latLngToLayerPoint(d).y);*/

    }).addTo(leafletMap);
}

function getRandom(lat, lng, d) {
    return {
        lat: lat + ((Math.round(Math.random()) * 2 - 1) * Math.random() * d),
        lng: lng + ((Math.round(Math.random()) * 2 - 1) * Math.random() * d)
    }
}

function randomCirclePoint(x0, y0, radius) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const x = x0 + (radius * Math.sin(phi) * Math.cos(theta));
    const y = y0 + (radius * Math.sin(phi) * Math.sin(theta));
    return {
        x,
        y
    };
}
