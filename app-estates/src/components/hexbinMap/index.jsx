import React from 'react';

import _ from 'lodash';
import * as d3 from 'd3';
import L from '../../common/leafletExtend/';
import hexbin from '../../common/hexbin/';
import {randomCirclePoint} from '../../common/geoUtils';

import style from './styles.scss';

const URL = {
    mapbox: 'https://api.mapbox.com/styles/v1/amortka/cixvstzqi00152rql928bfsr2/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiYW1vcnRrYSIsImEiOiJjaW56azMwZW4wMHU0dnhseTJmdmd5MnNvIn0.ETjQqiTTrYueBpf8_aiOhg',
    cartodb: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png'
};

const CONFIG = {
    hexbinMinSize: 5,
    hexbinMaxSize: 20
};

const IGNORED_LATLON = [
    {
        lat: 51.1138,
        lon: 17.0412
    }, {
        lat: 51.1079,
        lon: 17.0385
    }
];

const cscale = d3
    .scaleLinear()
    .domain([4500, 6000, 8000])
    .range(['#43C660', '#43C6AC', '#FF6F00']);

let config = {
    center: [
        51.11, 17.022
    ],
    zoomControl: false,
    zoom: 13,
    scrollwheel: false,
    legends: false,
    infoControl: false,
    attributionControl: true,
    tileLayer: {
        uri: URL.mapbox,
        params: {
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
        }
    }
};

export default class Map extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            map: null,
            titleLayer: null,
            geoData: null,
            mounter: false
        };

        this._mapEl = null;
        this._lockZoom = false;

    }

    componentDidMount() {
        if (!this.state.map) {
            this.init(this._mapEl);
        }
    }

    componentDidUpdate() {
        if (this.props.center) {
            this
                .state
                .map
                .panTo(this.props.center.split(', '));
        }

        if (this.state.overlayLayer) {
            this
                .state
                .overlayLayer
                .draw();
        }
    }

    init(el) {
        if (this.state.map) {
            return;
        }
        let map = L.map(el, config);

        L
            .control
            .zoom({position: "bottomleft"})
            .addTo(map);

        const tileLayer = L
            .tileLayer(config.tileLayer.uri, config.tileLayer.params)
            .addTo(map);

        const overlayLayer = L.d3SvgOverlay((selection, projection) => {

            const hexbinMinSize = CONFIG.hexbinMinSize / projection.scale;
            const hexbinMaxSize = CONFIG.hexbinMaxSize / projection.scale;

            let c = projection.latLngToLayerPoint(projection.map.getCenter());

            let hexbinInfoGroup = selection.select('g.hexbinInfoGroup');
            let hexbinGroup = selection.select('g.hexbinGroup');
            let defs = selection.select('defs');

            let hexbinsData = parseData(this.props.data).map(d => {
                let p = projection.latLngToLayerPoint(d);
                return [
                    p.x,
                    p.y, {
                        rate: d.rate
                    }
                ]
            }).sort((a, b) => {
                return a.x - b.x || a.y - b.y
            });

            let hexbinLayout = hexbin().radius(hexbinMaxSize);
            let hexbinBeans = hexbinLayout(hexbinsData);

            let hexbinScale = d3
                .scaleSqrt()
                .range([hexbinMinSize, hexbinMaxSize])
                .clamp(false);

            let count = hexbinBeans.map(function(d) {
                return d.length;
            });

            hexbinScale.domain([
                0, d3.mean(count) + d3.deviation(count) * 10
            ]);

            if (hexbinGroup.empty()) {
                hexbinGroup = selection
                    .append('g')
                    .attr('class', 'hexbinGroup')
            }

            if (hexbinInfoGroup.empty()) {
                hexbinInfoGroup = selection
                    .append('g')
                    .attr('class', 'hexbinInfoGroup')
            }

            if (defs.empty()) {
                defs = selection
                    .append('defs')
                    .append('filter')
                    .attr('id', 'blur-filter')
                    .append('feGaussianBlur')
                    .attr('in', 'SourceGraphic')
                    .attr('stdDeviation', '2');
            }

            hexbinInfoGroup
                .selectAll('.hexbinInfo')
                .remove();

            let hex = hexbinGroup
                .selectAll('.hexagon')
                .data(hexbinBeans, (d) => {
                    return d.id;
                });

            hex
                .exit()
                .remove();

            hex.attr('transform', function(d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            }).transition()
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

            hex
                .enter()
                .append('path')
                .attr('class', ['hexagon', style.hexbinBin].join(' '))
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
                .style('pointer-events', 'visiblePainted')
                // .on('mouseover', el => onHexbinMouseOver(el, hexbinInfoGroup, hexbinMaxSize, projection.scale)) //(el, hexbinInfoGroup, size, scale)
                // .on('mouseout', el => onHexbinMouseOut(el, hexbinInfoGroup))
                .on('click', el => onHexbinClick.call(this, el))
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

        }).addTo(map);

        map.invalidateSize(true);
        this.setState({map, tileLayer, overlayLayer});
    }

    render() {
        const mapStyle = {
            height: this.props.height + 'px',
            width: this.props.width + 'px'
        };

        return ( <div id="mapContainer" ref={
                (el) => this._mapEl = el
            } className={style.mapContainer} style={mapStyle}></div>
        );
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

function styleDash(selection, scale) {
    debugger;
    const width = 1 / scale;
    const dash = [10 / scale, 15 / scale];

    selection.style({
        'stroke-width': width + 'px',
        'stroke-dasharray': dash.join(', ')
    });
}

function onHexbinMouseOut(el, hexbinInfoGroup) {
    /*hexbinGroup
     .selectAll('.hexagon')
     .transition()
     .attr('opacity', 1);*/

    hexbinInfoGroup
        .selectAll('*')
        .remove();
}

function onHexbinClick(el) {
    let zoom = this.state.map.getZoom();
    this._lockZoom = !this._lockZoom;

    console.log('el', el);

    //this.state.map.setZoomAround(latlon, zoom)
    //console.log('this.map', this.state.map.getZoom());

}

function onHexbinMouseOver(el, hexbinInfoGroup, size, scale) {
    if (el.length > 0) {
        let d3El = d3.select(this);
        let pointsData = [];

        /*hexbinGroup
         .selectAll('.hexagon')
         .transition()
         .attr('opacity', 0.3);*/

        // d3El.attr('opacity', 0.75);

        for (let i = 0; i < el.length; i++) {
            pointsData.push({
                x: el[i][0], y: el[i][1], val: el[i][2]
            });
        }

        var pointsGroup = d3
            .nest()
            .key(d => [d.x, d.y].join(','))
            .entries(pointsData);

        hexbinInfoGroup
            .selectAll()
            .remove();

        const dashWidth = 1 / scale;
        const dashArray = [10 / scale, 15 / scale];

        hexbinInfoGroup
            .append('path')
            .attr('class', [style.hexbinFrame].join(' '))
            .attr('transform', function() {
                return 'translate(' + el.x + ',' + el.y + ')';
            })
            .attr('d', hexbin().hexagon(size))
            .style('stroke-width', dashWidth + 'px')
            .style('stroke-dasharray', dashArray.join(', '));

        /*hexbinInfoGroup
         .append('path')
         .attr('class', [style.hexbinFrame, style['hexbinFrame--blur']].join(' '))
         .attr('transform', function() {
         return 'translate(' + el.x + ',' + el.y + ')';
         })
         .attr('d', hexbinLayout.hexagon(hexbinMaxSize));*/


        let deElSel = hexbinInfoGroup
            .selectAll('.hexbinInfo')
            .data(pointsGroup);

        deElSel
            .enter()
            .append('circle')
            .attr('class', style.hexbinDot)
            .attr('r', 2 / scale)
            .attr('cx', el.x)
            .attr('cy', el.y)
            .transition()
            .attr('cx', (d) => d.key.split(',')[0])
            .attr('cy', (d) => d.key.split(',')[1])
    }
}