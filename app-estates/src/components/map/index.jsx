import React from 'react';
import * as d3 from 'd3';
import L from 'Leaflet';
import style from './styles.scss';

const URL = {
    mapbox: 'https://api.mapbox.com/styles/v1/amortka/cixvstzqi00152rql928bfsr2/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiYW1vcnRrYSIsImEiOiJjaW56azMwZW4wMHU0dnhseTJmdmd5MnNvIn0.ETjQqiTTrYueBpf8_aiOhg' cartodb: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png'
}

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
}

export default class Map extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            map: null,
            titleLayer: null,
            geoData: null
        }

        this._mapEl = null;
    }

    componentDidMount() {
        if (!this.state.map) {
            this.init(this._mapEl);
        }
    }

    componentDidUpdate() {
        //console.log('updated', this.state);
        if (this.props.center) {
            this
                .state
                .map
                .panTo(this.props.center.split(', '));
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

        map.invalidateSize(true);
        this.setState({map, tileLayer});
    }

    render() {
        return (
            <div id="mapContainer" ref={(el) => this._mapEl = el} className={style.mapContainer}></div>
        )
    }
}
