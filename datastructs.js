/**
 * Created by dennis on 09/11/15.
 */


// a class for 2-dimensional vectors
function Vector2(x, y) {
    this.x = x; this.y = y;

    this.clone = function() {
        return new Vector2(this.x, this.y);
    };

    this.len = function() {
        return Math.sqrt(this.x * this.x, this.y * this.y);
    };

    this.normalize = function() {
        var l = this.len();
        this.x /= len; this.y /= len;
        return this;
    };

    this.euclideanDistance = function(other) {
        return Math.sqrt(Math.pos(this.x - other.x, 2) + Math.pow(this.y - other.y, 2));
    };

    this.add = function(other) {
        this.x += other.x; this.y += other.y;
        return this;
    };

    this.sub = function(other) {
        this.x -= other.x; this.y -= other.y;
        return this;
    };

    this.dot = function(other) {
        return this.x * other.x + this.y * other.y;
    };

    this.angle = function(other) { // in radians
        return Math.acos(this.dot(other) / (this.len() * other.len()));
    };

    this.scalarMult = function(s) {
        this.x *= s; this.y *= s;
        return this;
    }
}

function SpatialStruct(gridWidth) {
    this.xMap = new Map();
    this.yMap = new Map();
    this.gridWidth = gridWidth;

    this.put = function(state) {
        var index = spatialIdx(state.position, this.gridWidth);
        addToSpatial(state, this.xMap, index.x[0]);
        addToSpatial(state, this.xMap, index.x[1]);

        addToSpatial(state, this.yMap, index.y[0]);
        addToSpatial(state, this.yMap, index.y[1]);

        state.spatial = index;
    };

    this.move = function(state) {
        var newIdx = spatialIdx(state.position, this.gridWidth);
        if (newIdx.x[0] != state.spatial.x[0]) {
            this.xMap.get(state.spatial.x[0]).delete(state);
            addToSpatial(state, this.xMap, newIdx.x[0]);
        }
        if (newIdx.x[1] != state.spatial.x[1]) {
            this.xMap.get(state.spatial.x[1]).delete(state);
            addToSpatial(state, this.xMap, newIdx.x[1]);
        }
        if (newIdx.y[0] != state.spatial.y[0]) {
            this.yMap.get(state.spatial.y[0]).delete(state);
            addToSpatial(state, this.yMap, newIdx.y[0]);
        }
        if (newIdx.y[1] != state.spatial.y[1]) {
            this.yMap.get(state.spatial.y[1]).delete(state);
            addToSpatial(state, this.yMap, newIdx.y[1]);
        }

        state.spatial = newIdx;
    };

    // return the closest neighbour in the same row as the state
    this.xNeighbour = function(state) {
        // find both y positions in the overlapping spatial grid
        var y1 = state.spatial.y[0];
        var y2 = state.spatial.y[1];

        // search for the closest state in both rows
        var minDis = Infinity;
        var minState = null;

        this.yMap.get(y1).forEach(function(other) {
            if (other != state) {
                var dis = Math.abs(state.position[0] - other.position[0]);

                if (dis < minDis) {
                    minDis = dis;
                    minState = other;
                }
            }
        });

        this.yMap.get(y2).forEach(function(other) {
            if (other != state) {
                var dis = Math.abs(state.position[0] - other.position[0]);

                if (dis < minDis) {
                    minDis = dis;
                    minState = other;
                }
            }
        });

        return minState;
    };

    // return the closest neighbour in the same column as the state
    this.yNeighbour = function(state) {
        // find both positions in the overlapping spatial grid
        var x1 = state.spatial.x[0];
        var x2 = state.spatial.x[1];

        // search for the closest state in both columns
        var minDis = Infinity;
        var minState = null;

        this.xMap.get(x1).forEach(function(other) {
            if (other != state) {
                var dis = Math.abs(state.position[1] - other.position[1]);

                if (dis < minDis) {
                    minDis = dis;
                    minState = other;
                }
            }
        });

        this.xMap.get(x2).forEach(function(other) {
            if (other != state) {
                var dis = Math.abs(state.position[1] - other.position[1]);

                if (dis < minDis) {
                    minDis = dis;
                    minState = other;
                }
            }
        });

        return minState;
    };


    function spatialIdx(pos, s) {
        var x1 = 2 * Math.floor(pos[0] / (2*s));
        var x2 = 2 * Math.floor((pos[0] + s) / (2*s)) - 1;

        var y1 = 2 * Math.floor(pos[1] / (2*s));
        var y2 = 2 * Math.floor((pos[1] + s) / (2*s)) - 1;

        return {x: [x1, x2], y: [y1, y2]};
    }

    function addToSpatial(state, map, idx) {
        if (!map.has(idx)) {
            map.set(idx, new Set());
        }

        map.get(idx).add(state);
    }
}