import React from 'react';
import { tsv } from 'd3';

import style from './app.scss';
import './index.global.scss';

import FormLatLon from './components/FormLatLon';
import HexbinMap from './components/HexbinMap';

export default class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            latLon: null,
            isDataLoaded: false,
            data: [],
            height: document.body.offsetHeight,
            width: document.body.offsetWidth,
        };

        this.onLatLonChange = this
            .onLatLonChange
            .bind(this);

        this.loadData();

        this.componentDidMount = this.componentDidMount.bind(this);
    }

    onLatLonChange(latLon) {
        this.setState({ latLon });
    }

    loadData() {
        tsv('./gratka-full.tsv', (err, data) => {
            this.setState({ data });
        });
    }

    componentDidMount() {
        setTimeout(() => {
            this.setState({
                height: document.body.offsetHeight,
                mounted: true,
                width: document.body.offsetWidth,
            });
        });
    }

    componentWillMount() {
        window.addEventListener('resize', () => {
            this.setState({
                height: document.body.offsetHeight,
                width: document.body.offsetWidth,
            });
        });
    }

    render() {
        if (this.state.mounted) {
            return (<div className={style.app} ref="appContainer">
                <FormLatLon onChange={this.onLatLonChange}/>
                <HexbinMap center={this.state.latLon}
                           data={this.state.data}
                           width={this.state.width}
                           height={this.state.height}/>
            </div>);
        }

        return (<div className={style.app} ref="appContainer">mounting app...</div>);
    }
}
