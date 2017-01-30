export function getRandomInDistance(lat, lng, d) {
    return {
        lat: lat + ((Math.round(Math.random()) * 2 - 1) * Math.random() * d),
        lng: lng + ((Math.round(Math.random()) * 2 - 1) * Math.random() * d)
    }
}

export function randomCirclePoint(x0, y0, radius) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const x = x0 + (radius * Math.sin(phi) * Math.cos(theta));
    const y = y0 + (radius * Math.sin(phi) * Math.sin(theta));
    return {x, y};
}
