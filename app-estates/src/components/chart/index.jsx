import React from 'react';
import * as d3 from 'd3';

export default class Button extends React.Component {
    constructor(props) {
        super(props);
    }

    componentDidMount() {
        console.log('componentDidMount');
        var el = this.refs.chart;

        this.svg = d3
            .select(el)
            .attr('width', 500)
            .attr('height', 500);

        this.updateChart();
    }

    componentDidUpdate() {
        console.log('componentDidUpdate()');
        this.updateChart();
    }

    updateChart() {
        console.log('update with', this.props.data);

        let x = d3
            .scaleLinear()
            .domain([0, 10])
            .range([0, 100]);
        let dataBind = this
            .svg
            .selectAll('.rect')
            .data(this.props.data, (d) => (d.id));

        dataBind
            .enter()
            .insert('rect')
            .attr('class', 'rect')
            .attr('width', 10)
            .attr('height', (d) => (d.val * 10))
            .attr('x', (d, idx) => (x(idx + 1) - 0.5))
            .attr('y', (d) => (100 - d.val * 10))
            .transition()
            .attr('x', (d, idx) => (x(idx) - 0.5))
        // .attr('y', (d) => (100 - d*10))
        // .attr('width', 10)
        // .attr('height', (d) => (d * 10));

        dataBind
            .transition()
            .attr('x', (d, idx) => (x(idx) - 0.5))

        dataBind
            .exit()
            .transition()
            .attr('x', 100)
            .style('opacity', 0)
            .attr('fill', 'blue')
            .remove();

    }

    render() {
        return (<svg ref="chart"/>);
    }
}
