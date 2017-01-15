'use strict';

import leaflet from 'leaflet';
import * as d3 from 'd3';
import lD3SvgFactory from './ld3Svg.class.js';
import hexbin from './hexbin';
import './style.scss';
import clusterMaker from 'geo-clusters';

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

// generate some dummy points around xy
for (let n = 0; n < 500; n++) {
    coords.push(getRandom(51.10, 17.02, 100));
}
const tileLayer = L.tileLayer(TILE_URL.dark, {
    zoomOffset: 0,
    tileSize: 256,
}).addTo(leafletMap);

let pointsUpdate;
let projection;
let selection;

d3.tsv('./gratka-full.tsv', (err, data) => {

    console.log('data', data.length);
    let layout = hexbin().radius(15);
    let hexbins = layout(data);

    let overlay = L.d3SvgOverlay(function(sel, proj) {
        let r = 2 / proj.scale;

        var g = clusterMaker();

        console.log('clusterMaker', g.data(coords.map(d => {
            return [d.lat, d.lng];
        })));

        selection = sel;
        projection = proj;
        pointsUpdate = sel.selectAll('circle').data(coords);

        pointsUpdate.enter()
            .append('circle')
            .attr('r', r)
            .attr('fill', 'red')
            .attr('cx', d => proj.latLngToLayerPoint(d).x)
            .attr('cy', d => proj.latLngToLayerPoint(d).y);

        pointsUpdate
            .attr('r', r);

    });
    overlay.addTo(leafletMap);

});


function getRandom(lat, lng, d) {
    return {
        lat: lat + ((Math.round(Math.random()) * 2 - 1) * Math.random() * 10 / d),
        lng: lng + ((Math.round(Math.random()) * 2 - 1) * Math.random() * 10 / d)
    }
}
