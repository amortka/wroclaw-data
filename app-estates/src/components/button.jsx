import React from 'react';

/*
export default React.createClass({
    render() {
        return (<button>click me!</button>);
    }
})
*/

export default class Button extends React.Component {
    constructor(props) {
        super(props);

        this.onClick = this.onClick.bind(this);
    }

    onClick() {
        console.log('clicked! props:', this.props);
    }

    render() {
        return (<button onClick={() => this.onClick()}>click me!</button>);
    }
}