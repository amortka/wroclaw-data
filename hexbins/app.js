'use strict';

//**********************************************************************************
//********  LEAFLET HEXBIN LAYER CLASS *********************************************
//**********************************************************************************
L.HexbinLayer = L.Class.extend({
    includes: L.Mixin.Events,
    initialize: function(rawData, options) {
        this.levels = {};
        this.layout = d3.hexbin().radius(15);
        this.rscale = d3.scale.sqrt().range([5, 15]).clamp(false);
        this.rwData = rawData;
        this.config = options;
    },
    project: function(x) {
        var point = this.map.latLngToLayerPoint([x[1], x[0]]);
        return [point.x, point.y];
    },
    getBounds: function(d) {
        var b = d3.geo.bounds(d);
        return L.bounds(this.project([b[0][0], b[1][1]]), this.project([b[1][0], b[0][1]]));
    },
    update: function() {
        var pad = 100, xy = this.getBounds(this.rwData), zoom = this.map.getZoom();

        this.container
            .attr('width', xy.getSize().x + (2 * pad))
            .attr('height', xy.getSize().y + (2 * pad))
            .style('margin-left', (xy.min.x - pad) + 'px')
            .style('margin-top', (xy.min.y - pad) + 'px');

        if (!(zoom in this.levels)) {
            this.levels[zoom] = this.container.append('g').attr('class', 'zoom-' + zoom);
            this.genHexagons(this.levels[zoom]);
            this.levels[zoom].attr('transform', 'translate(' + -(xy.min.x - pad) + ',' + -(xy.min.y - pad) + ')');
        }
        if (this.curLevel) {
            this.curLevel.style('display', 'none');
        }
        this.curLevel = this.levels[zoom];
        this.curLevel.style('display', 'inline');
    },
    genHexagons: function(container) {
        var data = this.rwData.features.map(function(d) {
            var coords = this.project(d.geometry.coordinates);
            return [coords[0], coords[1], d.properties];
        }, this);

        var bins = this.layout(data);
        var hexagons = container.selectAll('.hexagon').data(bins);

        var counts = [];
        bins.map(function(elem) {
            counts.push(elem.length)
        });
        this.rscale.domain([0, (ss.mean(counts) + (ss.standard_deviation(counts) * 10))]);

        var path = hexagons.enter().append('path').attr('class', 'hexagon');
        this.config.style.call(this, path);

        var that = this;
        hexagons
            .attr('d', function(d) {
                return that.layout.hexagon(that.rscale(d.length));
            })
            .attr('transform', function(d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            })
            .on('mouseover', function(d) {

                var data = d.filter(function(dd) {
                    return dd.length === 3;
                }).map(function(dd) {
                    return dd[2];
                });

                that.config.mouse.call(this, data);
                d3.select('#tooltip')
                    .style('visibility', 'visible')
                    .style('top', function() {
                        return (d3.event.pageY - 130) + 'px'
                    })
                    .style('left', function() {
                        return (d3.event.pageX - 130) + 'px';
                    })
            })
            .on('mouseout', function(d) {
                d3.select('#tooltip').style('visibility', 'hidden')
            });
    },
    addTo: function(map) {
        map.addLayer(this);
        return this;
    },
    onAdd: function(map) {
        this.map = map;
        var overlayPane = this.map.getPanes().overlayPane;

        if (!this.container || overlayPane.empty) {
            this.container = d3.select(overlayPane)
                .append('svg')
                .attr('id', 'hex-svg')
                .attr('class', 'leaflet-layer leaflet-zoom-hide');
        }
        map.on({'moveend': this.update}, this);
        this.update();
    }
});

L.hexbinLayer = function(data, styleFunction) {
    return new L.HexbinLayer(data, styleFunction);
};
//**********************************************************************************
//********  IMPORT DATA AND REFORMAT ***********************************************
//**********************************************************************************
//d3.csv('coffee.csv', function(error, coffee) {

d3.csv('data.csv', function(err, data) {
//d3.tsv('gratka-full.tsv', function(error, data) {

    var ignoredLatLon = [
        {lat: 51.1138, lon: 17.0412},
        {lat: 51.1079, lon: 17.0385}
    ];

    function parseData(data) {
        return _.chain(data)
            .filter(function(d) {
                return !isNaN(parseFloat(d.price))
                    && !isNaN(parseFloat(d.rate))
                    && !isNaN(parseFloat(d.lat))
                    && !isNaN(parseFloat(d.lon))
                    && !_.find(ignoredLatLon, function(dd) {
                        return parseFloat(dd.lat).toFixed(2) === parseFloat(d.lat).toFixed(2) && parseFloat(dd.lon).toFixed(2) === parseFloat(d.lon).toFixed(2);
                    });
            })
            .uniqBy('id')
            .map(function(d) {
                return {
                    properties: {
                        rate: parseFloat(d.rate),
                        lat: parseFloat(d.lat),
                        lon: parseFloat(d.lon),
                        market: d.market,
                        area: d.area
                    },
                    type: 'Feature',
                    geometry: {
                        coordinates: [+d.lon, +d.lat],
                        type: 'Point'
                    }
                }
            })
            .value();
    }

    var geoData = {type: 'FeatureCollection', features: parseData(data)};

    //**********************************************************************************
    //********  CREATE LEAFLET MAP *****************************************************
    //**********************************************************************************
    var cscale = d3.scale.linear().domain([4500, 6000, 8000])
    // .range(['#008000','#61a400','#a1c800','#dfed00','#ffe500','#ffaf00','#ff7400','#ff0000']);
    // .range(['#008000','#5a8b00','#8d9500','#bb9d00','#e8a300','#ff9a00','#ff8200','#ff6700','#ff4700','#ff0000']);
    // .range(['#ffa500','#ff6868','#ed01a2','#8f00e0','#7900b2','#8f0028','#bb0002','#ff0000']);
    //     .range(['#00FF00', '#FFA500']);
        .range([ '#43C660', '#43C6AC','#FF6F00']);

    var leafletMap = L.mapbox.map('mapContainer', 'delimited.ge9h4ffl')
        .setView([51.11, 17.02], 12);

    var hexLayer = L.hexbinLayer(geoData, {
        style: hexbinStyle,
        mouse: showDetails
    }).addTo(leafletMap);

    function hexbinStyle(hexagons) {
        hexagons
            .attr('stroke', 'black')
            .attr('fill', function(d) {
                var avg = d3.mean(d, function(d) {
                    return +d[2].rate;
                });
                return cscale(avg);
            });
    }

    function showDetails(data) {
        var svg = d3.select('#tooltip').select('svg');

        d3.select('#tooltip').selectAll('g').remove();
        console.log('details', data);

        var mean = d3.mean(_.map(data, 'rate')).toFixed(0);

        var txt = svg
            .append('g')
            .append('text')
            //.datum(d3.mean(data).toFixed(0) + 'zł (' + data.length + ')')
            .datum(mean)
            .style('text-anchor', 'middle')
            .style('alignment-baseline', 'central')
            .attr('x', 50)
            .attr('y', 25)
            .text(function(d) {
                return d;
            });

    }


});
