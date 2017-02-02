import React from 'react';
import _ from 'lodash';
import * as d3 from 'd3';

import L from '../../common/leafletExtend/';
import hexbin from '../../common/hexbin/';
import { randomCirclePoint } from '../../common/geoUtils';

import style from './styles.scss';

const URL = {
    mapbox: 'https://api.mapbox.com/styles/v1/amortka/cixvstzqi00152rql928bfsr2/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiYW1vcnRrYSIsImEiOiJjaW56azMwZW4wMHU0dnhseTJmdmd5MnNvIn0.ETjQqiTTrYueBpf8_aiOhg',
    cartodb: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
};

const CONFIG = {
    hexbinMaxSize: 20,
    hexbinMinSize: 5,
};

const IGNORED_LATLON = [
    {
        lat: 51.1138,
        lon: 17.0412,
    }, {
        lat: 51.1079,
        lon: 17.0385,
    },
];

const cscale = d3
    .scaleLinear()
    .domain([4500, 6000, 8000])
    .range(['#43C660', '#43C6AC', '#FF6F00']);

const config = {
    center: [
        51.11, 17.022,
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
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        },
    },
};

export default class Map extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            map: null,
            titleLayer: null,
            geoData: null,
            mounter: false,
        };

        this.mapEl = null;
        this.lockZoom = false;
    }

    componentDidMount() {
        if (!this.state.map) {
            this.init(this.mapEl);
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
        const map = L.map(el, config);

        L
            .control
            .zoom({
                position: 'bottomleft',
            })
            .addTo(map);

        const tileLayer = L
            .tileLayer(config.tileLayer.uri, config.tileLayer.params)
            .addTo(map);

        const overlayLayer = L.d3SvgOverlay((selection, projection) => {
            const scale = this.lockZoom ? 1 : projection.scale;
            const hexbinMinSize = CONFIG.hexbinMinSize / scale;
            const hexbinMaxSize = CONFIG.hexbinMaxSize / scale;

            const c = projection.latLngToLayerPoint(projection.map.getCenter());

            let hexbinInfoGroup = selection.select('g.hexbinInfoGroup');
            let hexbinGroup = selection.select('g.hexbinGroup');
            let defs = selection.select('defs');

            const hexbinsData = parseData(this.props.data).map((d) => {
                const p = projection.latLngToLayerPoint(d);
                return [
                    p.x,
                    p.y, {
                        lat: parseFloat(d.lat),
                        lon: parseFloat(d.lon),
                        rate: d.rate,
                    },
                ];
            }).sort((a, b) => (a.x - b.x || a.y - b.y));

            const hexbinLayout = hexbin().radius(hexbinMaxSize);
            const hexbinBeans = hexbinLayout(hexbinsData);

            const hexbinScale = d3
                .scaleSqrt()
                .range([hexbinMinSize, hexbinMaxSize])
                .clamp(false);

            const count = hexbinBeans.map(d => d.length);

            hexbinScale.domain([
                0,
                d3.mean(count) + (d3.deviation(count) * 10),
            ]);

            if (hexbinGroup.empty()) {
                hexbinGroup = selection
                    .append('g')
                    .attr('class', 'hexbinGroup');
            }

            if (hexbinInfoGroup.empty()) {
                hexbinInfoGroup = selection
                    .append('g')
                    .attr('class', 'hexbinInfoGroup');
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

            const hex = hexbinGroup
                .selectAll('.hexagon')
                .data(hexbinBeans, d => d.id);

            hex
                .exit()
                .remove();

            hex.attr('transform', d => `translate(${d.x},${d.y})`)
                .transition()
                .duration(500)
                .ease(d3.easeBounceOut)
                .attr('stroke', 'black')
                .attr('stroke-width', 1 / scale)
                .attr('fill', (dd) => {
                    const avg = d3.mean(dd, d => +d[2].rate);
                    return cscale(avg);
                })
                .attr('opacity', 1)
                .attr('d', d => hexbinLayout.hexagon(hexbinScale(d.length)));

            hex
                .enter()
                .append('path')
                .attr('class', ['hexagon', style.hexbinBin].join(' '))
                .attr('transform', (d) => {
                    const p = randomCirclePoint(d.x, d.y, 100);
                    return `translate(${p.x},${p.y})`;
                })
                .attr('stroke', 'black')
                .attr('stroke-width', 1 / scale)
                .attr('fill', (dd) => {
                    const avg = d3.mean(dd, d => +d[2].rate);
                    return cscale(avg);
                })
                .attr('opacity', 0)
                .style('pointer-events', 'visiblePainted')
// .on('mouseover',
// el => onHexbinMouseOver(el, hexbinInfoGroup, hexbinMaxSize, scale)) // eslint-disable-line
// .on('mouseout',
// el => onHexbinMouseOut(el, hexbinInfoGroup)) // eslint-disable-line
                .on('click', elClicked => onHexbinClick.call(this, elClicked))
                .transition()
                .duration(500)
                .delay(d =>
                    Math.floor(Math.sqrt(
                        ((d.x - c.x) * (d.x - c.x)) +
                        ((d.y - c.y) * (d.y - c.y)))))
                .ease(d3.easeQuadInOut)
                .attr('opacity', 1)
                .attr('transform', d => `translate(${d.x}, ${d.y})`)
                .attr('d', d => hexbinLayout.hexagon(hexbinScale(d.length)));
        }).addTo(map);

        map.invalidateSize(true);
        this.setState({ map, tileLayer, overlayLayer });
    }

    render() {
        const mapStyle = {
            height: `${this.props.height}px`,
            width: `${this.props.width}px`,
        };

        return (<div id="mapContainer" ref={
                el => (this.mapEl = el)
            } className={style.mapContainer} style={mapStyle}></div>
        );
    }
}

function parseData(data) {
    return _.chain(data)
        .filter(d => !isNaN(parseFloat(d.price))
                && !isNaN(parseFloat(d.rate))
                && !isNaN(parseFloat(d.lat))
                && !isNaN(parseFloat(d.lon))
                && !_.find(IGNORED_LATLON,
            dd => parseFloat(dd.lat).toFixed(2) === parseFloat(d.lat).toFixed(2)
                && parseFloat(dd.lon).toFixed(2) === parseFloat(d.lon).toFixed(2)))
        .uniqBy('id')
        .value();
}

/* function onHexbinMouseOut(el, hexbinInfoGroup) {
    hexbinInfoGroup
        .selectAll('*')
        .remove();
}*/

function onHexbinClick(el) {
    const p = [el[0][2].lat, el[0][2].lon];

    this.lockZoom = true;
    this.state.map.setView(p, 14);
}
/*eslint-disable */
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
/*eslint-enable */
