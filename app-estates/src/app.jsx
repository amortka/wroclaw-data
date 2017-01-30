import React from 'react';
import style from './app.scss';

import './index.global.scss';

import {tsv} from 'd3';
import HexbinMap from './components/HexbinMap';
import FormLatLon from './components/FormLatLon';
import {getRandomInDistance} from './common/geoUtils';

const data = [];

export default class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            latLon: null,
            isDataLoaded: false,
            data
        }

        this.onLatLonChange = this
            .onLatLonChange
            .bind(this);

        this.loadData();
    }

    onLatLonChange(latLon) {
        this.setState({latLon})
    }

    loadData() {
        tsv('./gratka-full.tsv', (err, data) => {
            this.setState({data})
        })
    }

    render() {
        return (
            <div className={style.app}>
                <FormLatLon onChange={this.onLatLonChange}></FormLatLon>
                <HexbinMap center={this.state.latLon} data={this.state.data}/>
            </div>
        )
    }
}
