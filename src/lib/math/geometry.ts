// Ray-casting point-in-polygon.
// x = cg (in), y = weight (lb)
export function pointInPolygon(x: number, y: number, poly: Array<{ x: number; y: number }>) {
    if (poly.length < 3) return false;
  
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
  
      const intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
  
      if (intersect) inside = !inside;
    }
    return inside;
  }
  