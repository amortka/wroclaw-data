'use strict';

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

// generate some dummy points around xy
for (let n = 0; n < 500; n++) {
    coords.push(getRandom(51.10, 17.02, 100));
}

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

        let zoom = projection.getZoom();
        let c = projection.latLngToLayerPoint(projection.map.getCenter());

        let hexbinGroup = selection.select('g.hexbinGroup');
        let hexbinsData = parseData(data).map(d => {
            let p = projection.latLngToLayerPoint(d);
            return [p.x, p.y, {rate: d.rate}]
        }).sort((a, b) => {
            return a.x - b.x || a.y - b.y
        });

        let hexbinLayout = hexbin().radius(15 / projection.scale);
        let hexbinBeans = hexbinLayout(hexbinsData);

        let hexbinScale = d3.scaleSqrt().range([5 / projection.scale, 15 / projection.scale]).clamp(false);
        let count = hexbinBeans.map(function(d) {
            return d.length;
        });
        hexbinScale.domain([0, d3.mean(count) + d3.deviation(count) * 10]);

        if (hexbinGroup.empty()) {
            console.log('creating group');
            hexbinGroup = selection.append('g')
                .attr('class', 'hexbinGroup')
        }

        // console.log('hexbinBeans', hexbinBeans.slice(0,10).sort((a,b) => {
        //  return (b.x - a.x) && (b.y - a.y);
        //  }));

        let hex = hexbinGroup.selectAll('.hexagon');

        hex.data(hexbinBeans).exit().remove();

        hex.data(hexbinBeans)
            .attr('transform', function(d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            })
            .transition()
            .duration(250)
            .ease(d3.easeQuadInOut)
            .attr('stroke', 'black')
            .attr('stroke-width', 1 / projection.scale)
            .attr('fill', function(d) {
                var avg = d3.mean(d, function(d) {
                    return +d[2].rate;
                });
                return cscale(avg);
            })
            .attr('d', (d) => hexbinLayout.hexagon(hexbinScale(d.length)))

        hex.data(hexbinBeans)
            .enter()
            .append('path')
            .attr('class', 'hexagon')
            .attr('transform', function(d) {
                return 'translate(' + d.x + ',' + d.y + ')';
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
            .attr('d', (d) => hexbinLayout.hexagon(hexbinScale(d.length)))
            /*.attr('transform', function(d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            });*/

        console.log('hexbinBeans array #', hexbinBeans.length);
        console.log('hexbinBeans real  #', hexbinGroup.selectAll('.hexagon').size());


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