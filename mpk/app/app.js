'use strict';

import leaflet from 'leaflet';
import _ from 'lodash';
import * as d3 from 'd3';

import lD3SvgFactory from './ld3Svg.class.js';
import './style.scss';

const L = new lD3SvgFactory(leaflet, d3);
const mapEl = document.getElementById('map-container');
const leafletMap = L.map(mapEl).setView([51.10, 17.02], 12);

const TILE_URL = {
    dark: 'https://api.mapbox.com/styles/v1/amortka/cixvstzqi00152rql928bfsr2/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiYW1vcnRrYSIsImEiOiJjaW56azMwZW4wMHU0dnhseTJmdmd5MnNvIn0.ETjQqiTTrYueBpf8_aiOhg',
    osm: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
};

d3.json('./data/wroclaw.json', drawMap);

function drawMap(data) {

    const tileLayer = L.tileLayer(TILE_URL.dark, {
        zoomOffset: 0,
        tileSize: 256,
    }).addTo(leafletMap);

    const overlay = L.d3SvgOverlay(function(selection, projection) {

        let pointsUpdate = selection.selectAll('path');

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
            .style('pointer-events', 'visiblePainted')
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
            })
            .on('click', function(d) {
                console.log('e', d);
            });


    }).addTo(leafletMap);
}
