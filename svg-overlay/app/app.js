'use strict';
console.clear();

import leaflet from 'leaflet';
import _ from 'lodash';
import * as d3 from 'd3';

import lD3SvgFactory from './ld3Svg.class.js';
import hexbin from './hexbin';

import './style.scss';


const L = new lD3SvgFactory(leaflet, d3);
const mapEl = document.getElementById('map-container');
const leafletMap = L.map(mapEl).setView([51.10, 17.02], 12);

const coords = [
    {lat: 51.10, lng: 17.02},
];


const TILE_URL = {
    dark: 'https://api.mapbox.com/styles/v1/amortka/cixvstzqi00152rql928bfsr2/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiYW1vcnRrYSIsImEiOiJjaW56azMwZW4wMHU0dnhseTJmdmd5MnNvIn0.ETjQqiTTrYueBpf8_aiOhg',
    osm: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
};

const IGNORED_LATLON = [
    {lat: 51.1138, lon: 17.0412},
    {lat: 51.1079, lon: 17.0385}
];

const tileLayer = L.tileLayer(TILE_URL.dark, {
    zoomOffset: 0,
    tileSize: 256,
}).addTo(leafletMap);

const cscale = d3.scaleLinear().domain([4500, 6000, 8000])
    .range(['#43C660', '#43C6AC', '#FF6F00']);


d3.tsv('./gratka-full.tsv', (err, data) => {
    drawMap(data);
});

/** -------------------------------------------------------------------- */

function drawMap(data) {
    let pointsOverlay = L.d3SvgOverlay(function(selection, projection) {

        let pointsUpdate = selection.selectAll('circle').data(data);

        let r = 10 / projection.scale;

        pointsUpdate.enter()
            .append('circle')
            .attr('r', r)
            .attr('fill', 'red')
            .attr('opacity', '0.01')
            .attr('cx', d => projection.latLngToLayerPoint(d).x)
            .attr('cy', d => projection.latLngToLayerPoint(d).y)
            .attr('fill', function(d) {
                return cscale(d.rate);
            });

        pointsUpdate
            .attr('r', r);

    });

    let overlay = L.d3SvgOverlay(function(selection, projection) {

        const hexbinMinSize = 5 / projection.scale;
        const hexbinMaxSize = 15 / projection.scale;

        let c = projection.latLngToLayerPoint(projection.map.getCenter());

        let hexbinGroup = selection.select('g.hexbinGroup');
        let hexbinsData = parseData(data).map(d => {
            let p = projection.latLngToLayerPoint(d);
            return [p.x, p.y, {rate: d.rate}]
        }).sort((a, b) => {
            return a.x - b.x || a.y - b.y
        });

        let hexbinLayout = hexbin().radius(hexbinMaxSize);
        let hexbinBeans = hexbinLayout(hexbinsData);

        let hexbinScale = d3.scaleSqrt().range([hexbinMinSize, hexbinMaxSize]).clamp(false);
        let count = hexbinBeans.map(function(d) {
            return d.length;
        });
        hexbinScale.domain([0, d3.mean(count) + d3.deviation(count) * 10]);

        if (hexbinGroup.empty()) {
            console.log('creating group');
            hexbinGroup = selection.append('g')
                .attr('class', 'hexbinGroup')
        }

        let hex = hexbinGroup.selectAll('.hexagon');

        hex.data(hexbinBeans).exit().remove();

        hex.data(hexbinBeans)
            .attr('transform', function(d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            })
            .transition()
            .duration(500)
            .ease(d3.easeBounceOut)
            .attr('stroke', 'black')
            .attr('stroke-width', 1 / projection.scale)
            .attr('fill', function(d) {
                var avg = d3.mean(d, function(d) {
                    return +d[2].rate;
                });
                return cscale(avg);
            })
            .attr('opacity', 1)
            .attr('d', (d) => hexbinLayout.hexagon(hexbinScale(d.length)));
        // .attr('d', (d) => hexbinLayout.hexagon(hexbinMaxSize));

        hex.data(hexbinBeans)
            .enter()
            .append('path')
            .attr('class', 'hexagon')
            .attr('transform', function(d) {
                let p = randomCirclePoint(d.x, d.y, 100);
                return 'translate(' + p.x + ',' + p.y + ')';
            })
            .attr('stroke', 'black')
            .attr('stroke-width', 1 / projection.scale)
            .attr('fill', function(d) {
                var avg = d3.mean(d, function(d) {
                    return +d[2].rate;
                });
                return cscale(avg);
            })
            .attr('opacity', 0)
            .transition()
            .duration(500)
            .delay((d) => {
                return Math.floor(Math.sqrt((d.x - c.x) * (d.x - c.x) + (d.y - c.y) * (d.y - c.y)));
            })
            .ease(d3.easeQuadInOut)
            .attr('opacity', 1)
            .attr('transform', function(d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            })
            .attr('d', (d) => hexbinLayout.hexagon(hexbinScale(d.length)));
        // .attr('d', (d) => hexbinLayout.hexagon(hexbinMaxSize));


        /*
        let grid = hexbinBeans.map(d => ({
            x: d.x.toPrecision(3),
            y: d.y.toPrecision(3),
            rate: d3.mean(d, function(d) {
                return +d[2].rate;
            })
        }));

        let bounds = [
            [~~d3.min(_.map(grid, 'x')), ~~d3.min(_.map(grid, 'y'))],
            [~~d3.max(_.map(grid, 'x')), ~~d3.max(_.map(grid, 'y'))]
        ];

        let voronoi = d3.voronoi()
            .x(function(d) {
                return d.x;
            })
            .y(function(d) {
                return d.y;
            })
            .extent(bounds);

        selection.selectAll('.voronoi').remove();

        selection.selectAll('.voronoi')
            .data(voronoi.polygons(grid))
            .enter()
            .append('path')
            .attr('d', d => (d ? 'M' + d.join('L') + 'Z' : null))
            .attr('fill', 'none')
            // .attr('fill', function(d) {
            //     return d && d.data ? cscale(d.data.rate) : 'null';
            // })
            .attr('class', 'voronoi')
            .style('stroke-width', 0.5 / projection.scale)
            .style('stroke-dasharray','2, 2')
            .style('stroke', '#222');*/

    });
    overlay.addTo(leafletMap);
}

function getRandom(lat, lng, d) {
    return {
        lat: lat + ((Math.round(Math.random()) * 2 - 1) * Math.random() * 10 / d),
        lng: lng + ((Math.round(Math.random()) * 2 - 1) * Math.random() * 10 / d)
    }
}

function parseData(data) {
    return _.chain(data)
        .filter(function(d) {
            return !isNaN(parseFloat(d.price))
                && !isNaN(parseFloat(d.rate))
                && !isNaN(parseFloat(d.lat))
                && !isNaN(parseFloat(d.lon))
                && !_.find(IGNORED_LATLON, function(dd) {
                    return parseFloat(dd.lat).toFixed(2) === parseFloat(d.lat).toFixed(2) && parseFloat(dd.lon).toFixed(2) === parseFloat(d.lon).toFixed(2);
                });
        })
        .uniqBy('id')
        .value();
}

function randomCirclePoint(x0, y0, radius) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const x = x0 + (radius * Math.sin(phi) * Math.cos(theta));
    const y = y0 + (radius * Math.sin(phi) * Math.sin(theta));
    return {x, y};
}