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
const leafletMap = L.map(mapEl).setView([51.10, 17.02], 12);

const TILE_URL = {
    dark: 'https://api.mapbox.com/styles/v1/amortka/cixvstzqi00152rql928bfsr2/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiYW1vcnRrYSIsImEiOiJjaW56azMwZW4wMHU0dnhseTJmdmd5MnNvIn0.ETjQqiTTrYueBpf8_aiOhg',
    osm: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
};

const directionsService = new google.maps.DirectionsService;

function initMap() {
  d3.json('./data/wroclaw.json', drawMap);
}

function processData(data) {
  return data.filter((line) => {
    return line.name === '134';
  })
};

function convertPolyline(polylineHash) {
  return polyline.decode(polylineHash);
}

function drawMap(data) {

    const tileLayer = L.tileLayer(TILE_URL.dark, {
        zoomOffset: 0,
        tileSize: 256,
    }).addTo(leafletMap);

    const overlay = L.d3SvgOverlay(function(selection, projection) {

        let linesUpdate = selection.selectAll('.line');
        let lineDetailUpdate = selection.selectAll('.line-detailed');

        let lineFunction = d3.line()
            .curve(d3.curveCardinal)
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

          console.log();

          async.map(splitCoords(processData(data)[0].coords, 12), fetchPartLine, drawPartLines);


        function fetchPartLine(part, cb) {
            var query = {
              origin: new google.maps.LatLng(part[0].lat, part[0].lon),
              destination: new google.maps.LatLng(part[part.length - 1].lat, part[part.length - 1].lon),
              travelMode: google.maps.TravelMode.DRIVING
            };

            if (part.length > 3) {
              part.pop();
              part.shift();
              query.waypoints = part.map(p => {
                console.log(p);
                return new google.maps.LatLng(p.lat, p.lon);
              });
            }

            console.log(JSON.stringify(query, false, 2));
            /*directionsService.route(query, function(response, status) {
              if (status == 'OK') {
                // preEl.textContent = JSON.stringify(response, false, 2);
                cb(null, response);
              } else {
                cb(status);
              }
            });*/

            // fetch(getUrlParams(query), {
            //   mode: 'cors'
            // })
            //   .then(result => {
            //     cb(null, result);
            //   });
        }

        function drawPartLines(err, results) {
            if (err) {
                return console.log('ERROR:', err);
            }

            console.log(JSON.stringify(results, false, 2));
        };

    }).addTo(leafletMap);
}

function splitCoords(inputArray, groupSize) {
  var parts = inputArray.map((i, idx) => {
    return idx % groupSize === 0 ? inputArray.slice(idx, idx + groupSize) : null;
  }).filter(i => !!i);

  if (parts[parts.length - 1].length < 2) {
    parts[parts.length - 2] = [...parts[parts.length - 2], ...parts[parts.length - 1]];
  }

  return parts;
}

function getUrlParams(params) {
  var url = 'https://maps.googleapis.com/maps/api/directions/json?';

  params = Object.assign(params, {
    key: 'AIzaSyCdCupR3V36B_2UpqLE3-jUDE81xm_5NIY'
  });

  return url + Object.keys(params).map(function(param) {
    return param + '=' + encodeURIComponent(params[param])
  }).join('&');
}

initMap();
