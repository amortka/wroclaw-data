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
    hexbinMaxSize: 20,
    hexbinMinSize: 5
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

const config = {
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
            mounter: false,
            scale: 1
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
            .zoom({position: 'bottomleft'})
            .addTo(map);

        const tileLayer = L
            .tileLayer(config.tileLayer.uri, config.tileLayer.params)
            .addTo(map);

        const overlayLayer = L.d3SvgOverlay((selection, projection) => {
            const _self = this;
            const scale = this.lockZoom
                ? this.state.scale || 1
                : projection.scale;

            const hexbinMinSize = CONFIG.hexbinMinSize / scale;
            const hexbinMaxSize = CONFIG.hexbinMaxSize / scale;

            const c = projection.latLngToLayerPoint(projection.map.getCenter());

            let hexbinInfoGroup = selection.select('g.hexbinInfoGroup');
            let hexbinInfoSelectedGroup = selection.select('g.hexbinInfoSelectedGroup');
            let hexbinGroup = selection.select('g.hexbinGroup');
            let defs = selection.select('defs');

            const hexbinsData = parseData(this.props.data).map((d) => {
                const p = projection.latLngToLayerPoint(d);
                return [
                    p.x,
                    p.y, {
                        lat: parseFloat(d.lat),
                        lon: parseFloat(d.lon),
                        rate: d.rate
                    }
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
                0, d3.mean(count) + (d3.deviation(count) * 10)
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

            if (hexbinInfoSelectedGroup.empty()) {
                hexbinInfoSelectedGroup = selection
                    .append('g')
                    .attr('class', 'hexbinInfoSelectedGroup');
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

            hexbinInfoSelectedGroup
                .selectAll('*')
                .remove();

            const hex = hexbinGroup
                .selectAll('.hexagon')
                .data(hexbinBeans, d => d.id);

            hex
                .exit()
                .remove();

            hex
                .attr('transform', d => `translate(${d.x},${d.y})`)
                .on('mouseover', function(d) {
                    selectHexbin.call(_self, this, hexbinInfoGroup, hexbinMaxSize, scale, selection) // eslint-disable-line
                })
                .on('click', function(d) {
                    onHexbinClick.call(_self, this, hexbinGroup, hexbinInfoGroup, scale); // eslint-disable-line
                })
                .transition()
                .duration(500)
                .ease(d3.easeBounceOut)
                .attr('stroke', 'black')
                .attr('stroke-width', 1 / scale)
                .attr('fill', (dd) => {
                    const avg = d3.mean(dd, d => + d[2].rate);
                    return cscale(avg);
                })
                .attr('opacity', function(d, idx) {
                    return _self.state.selected
                        ? _self.state.selected === this ? 0.1 : 0.3
                        : 1;
                })
                .attr('d', d => hexbinLayout.hexagon(hexbinScale(d.length)))

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
                    const avg = d3.mean(dd, d => + d[2].rate);
                    return cscale(avg);
                })
                .attr('opacity', 0)
                .style('pointer-events', 'visiblePainted')
                .on('mouseover', function(d) {
                    selectHexbin.call(_self, this, hexbinInfoGroup, hexbinMaxSize, scale, selection); // eslint-disable-line
                })
                .on('mouseout', function(d) {
                    onHexbinMouseOut.call(_self, this, hexbinInfoGroup, selection); // eslint-disable-line
                })
                .on('click', function(d) {
                    onHexbinClick.call(_self, this, hexbinGroup, hexbinInfoGroup, scale); // eslint-disable-line
                })
                .on('mousemove', function(d) {
                  //  showTooltip.call(_self, this, selection);
                })
                .transition()
                .duration(500)
                .delay(d => Math.floor(Math.sqrt(((d.x - c.x) * (d.x - c.x)) + ((d.y - c.y) * (d.y - c.y)))))
                .ease(d3.easeQuadInOut)
                .attr('opacity', this.state.selected
                    ? 0.3
                    : 1)
                .attr('transform', d => `translate(${d.x}, ${d.y})`)
                .attr('d', d => hexbinLayout.hexagon(hexbinScale(d.length)));

            if (this.state.selected) {
              selectHexbin.call(_self, this.state.selected, hexbinInfoSelectedGroup, hexbinMaxSize, scale, selection, true);
            }

        }).addTo(map);

        map.invalidateSize(true);
        this.setState({map, tileLayer, overlayLayer});
    }

    render() {
        const mapStyle = {
            height: `${this.props.height}px`,
            width: `${this.props.width}px`
        };

        return (
            <div id="mapContainer" ref={el => (this.mapEl = el)} className={style.mapContainer} style={mapStyle}></div>
        );
    }
}

function parseData(data) {
    return _
        .chain(data)
        .filter(d => !isNaN(parseFloat(d.price)) && !isNaN(parseFloat(d.rate)) && !isNaN(parseFloat(d.lat)) && !isNaN(parseFloat(d.lon)) && !_.find(IGNORED_LATLON, dd => parseFloat(dd.lat).toFixed(2) === parseFloat(d.lat).toFixed(2) && parseFloat(dd.lon).toFixed(2) === parseFloat(d.lon).toFixed(2)))
        .uniqBy('id')
        .value();
}

function onHexbinClick(el, hexbinGroup, hexbinInfoGroup, scale) {
    const d3El = d3.select(el);
    const datum = d3El.datum();

    this.lockZoom = this.state.selected !== el;

    const p = [datum[0][2].lat,
        datum[0][2].lon
    ];

    const zoom = this.lockZoom ? Math.min(Math.max(this.state.map.getZoom() + 2, 18), 15) : 12;

    this
        .state
        .map
        .setView(p, zoom);

    this.setState({selected: this.lockZoom ? el : undefined, scale});

    hexbinInfoGroup
        .selectAll('*')
        .remove();
}

function selectHexbin(el, hexbinInfoGroup, size, scale, selection, force) {
    const d3El = d3.select(el);
    const datum = d3El.datum();

    if (datum.length > 0 && (this.state.selected !== el || force)) {
        let pointsData = [];

        for (let i = 0; i < datum.length; i++) {
            pointsData.push({
              x: datum[i][0],
              y: datum[i][1],
              val: datum[i][2]
            });
        }

        var pointsGroup = d3
            .nest()
            .key(d => [d.x, d.y].join(','))
            .entries(pointsData);

        const dashWidth = 1 / scale;
        const dashArray = [
            10 / scale,
            15 / scale
        ];

        const styleHexbinFrame = [style.hexbinFrame];
        if (force) {
          styleHexbinFrame.push(style['hexbinFrame--selected']);
        }

        hexbinInfoGroup
            .append('path')
            .attr('class', [...styleHexbinFrame].join(' '))
            .attr('transform', `translate(${datum.x}, ${datum.y})`)
            .attr('d', hexbin().hexagon(size))
            .style('stroke-width', dashWidth + 'px')
            .style('stroke-dasharray', dashArray.join(', '));

        hexbinInfoGroup
         .append('path')
         .attr('class', [...styleHexbinFrame, style['hexbinFrame--blur']].join(' '))
         .attr('transform', `translate(${datum.x},${datum.y})`)
         .attr('d', hexbin().hexagon(size))
         .style('stroke-width', dashWidth + 'px')
         .style('stroke-dasharray', dashArray.join(', '));

        let deElSel = hexbinInfoGroup
            .selectAll('.hexbinInfo')
            .data(pointsGroup);

        deElSel
            .enter()
            .append('circle')
            .attr('class', style.hexbinDot)
            .attr('fill', (d) => {
              const avg = d3.mean(d.values, dd => + dd.val.rate);
              return cscale(avg);
            })
            .attr('r', (force ? 1.5  : 2.5) / scale)
            .attr('cx', (d) => force ? d.key.split(',')[0] : datum.x)
            .attr('cy', (d) => force ? d.key.split(',')[1] : datum.y)
            .style('pointer-events', 'visiblePainted')
            .on('mouseover', function(d) {
              if (force) {
                const avg = d3.mean(d.values, dd => + dd.val.rate).toFixed(2);
                console.log(`${avg} (${d.values.length})`);
              }
            })
            .transition()
            .attr('cx', (d) => d.key.split(',')[0])
            .attr('cy', (d) => d.key.split(',')[1]);

        showTooltip(el, selection);
    }
}

function onHexbinMouseOut(el, hexbinInfoGroup, selection) {
    hexbinInfoGroup
        .selectAll('*')
        .remove();

    selection.select('.tooltip')
      .attr('opacity', 0);
}

function showTooltip(el, selection) {
  /*console.log(selection);
  console.log(d3.event);

  let d3TooltipEl = selection.select('.tooltip');

  if (d3TooltipEl.empty()) {
    d3TooltipEl = selection
      .append('rect')
      .attr('class', 'tooltip');
  }

    d3TooltipEl
      .attr('opacity', 1)
      .attr('x', d3.event.offsetX - 50)
      .attr('y', d3.event.offsetY - 100 - 10)
      .attr('width', 100)
      .attr('height', 100)
      .attr('fill', 'red');*/
}
