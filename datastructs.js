/**
 * Created by dennis on 09/11/15.
 */

// utility function for 2d vectors, stored as arrays

const NORTH  = [ 0,-1];
const SOUTH  = [ 0, 1];
const EAST   = [ 1, 0];
const WEST   = [-1, 0];
const ORIGIN = [ 0, 0];

function normalize(vec) {
    var distance = len(vec);
    return [vec[0] / distance, vec[1] / distance];
}

function euclideanDistance(vec1, vec2) {
    return Math.sqrt(Math.pow(vec1[0] - vec2[0], 2) +
        Math.pow(vec1[1] - vec2[1], 2));
}

function len(vec) {
    return euclideanDistance([0, 0], vec);
}

function sub(vec1, vec2) {
    return [vec1[0] - vec2[0], vec1[1] - vec2[1]];
}

function subInPlace(vec, toSub) {
    vec[0] -= toSub[0]; vec[1] -= toSub[1];
}

function add(vec1, vec2) {
    return [vec1[0] + vec2[0], vec1[1] + vec2[1]];
}

function addInPlace(vec, toAdd) {
    vec[0] += toAdd[0]; vec[1] += toAdd[1];
}

function scalarMult(vec, s) {
    return [vec[0] * s, vec[1] * s];
}

function scalarMultInPlace(vec, s) {
    vec[0] *= s; vec[1] *= s;
}

function scalarDiv(vec, s) {
    return [vec[0] / s, vec[1] / s];
}

function dot(vec1, vec2) {
    return vec1[0] * vec2[0] + vec1[1] * vec2[1];
}

function angle(vec1, vec2) {
    return Math.acos(dot(vec1, vec2) / (len(vec1) * len(vec2)));
}

function rotate(vec, angle) {
    return [vec[0] * Math.cos(angle) - vec[1] * Math.sin(angle),
            vec[0] * Math.sin(angle) + vec[1] * Math.cos(angle)];
}

function round(vec) {
    return [Math.round(vec[0]), Math.round(vec[1])];
}


function discreetDirection(fromVec, toVec) {
    // figure out in what direction the edge goes
    var pos = sub(toVec, fromVec);
    var edgeAngle = angle(SOUTH, pos);
    var fromDir;

    if (pos[0] > 0) { // right side
        if (edgeAngle < Math.PI / 4) {
            fromDir = DIRECTIONS.ABOVE
        } else if (edgeAngle > 3 * Math.PI / 4) {
            fromDir = DIRECTIONS.BELOW;
        } else {
            fromDir = DIRECTIONS.RIGHT
        }
    } else { // left side
        if (edgeAngle < Math.PI / 4) {
            fromDir = DIRECTIONS.ABOVE;
        } else if (edgeAngle > 3 * Math.PI / 4) {
            fromDir = DIRECTIONS.BELOW;
        } else {
            fromDir = DIRECTIONS.LEFT;
        }
    }

    return fromDir;
}



/**
 * A datastructure that puts states in an overlapping grid.
 * @param gridWidth
 * @constructor
 */
function SpatialStruct(gridWidth) {
    // first array is for right / below, second array for left / above
    this.rows = [[], []];
    this.cols = [[], []];

    this.gridWidth = gridWidth;

    this.put = function(state) {
        var index = spatialIdx(state.position, this.gridWidth);

        addToSpatial(state, this.rows, index.x[0]);
        addToSpatial(state, this.rows, index.x[1]);

        addToSpatial(state, this.cols, index.y[0]);
        addToSpatial(state, this.cols, index.y[1]);

        state.spatial = index;
    };

    this.move = function(state) {
        var newIdx = spatialIdx(state.position, this.gridWidth);

        if (newIdx.x[0] != state.spatial.x[0]) {
            removeFromSpatial(state, this.rows, state.spatial.x[0]);
            addToSpatial(state, this.rows, newIdx.x[0]);
        }
        if (newIdx.x[1] != state.spatial.x[1]) {
            removeFromSpatial(state, this.rows, state.spatial.x[1]);
            addToSpatial(state, this.rows, newIdx.x[1]);
        }
        if (newIdx.y[0] != state.spatial.y[0]) {
            removeFromSpatial(state, this.cols, state.spatial.y[0]);
            addToSpatial(state, this.cols, newIdx.y[0]);
        }
        if (newIdx.y[1] != state.spatial.y[1]) {
            removeFromSpatial(state, this.cols, state.spatial.y[1]);
            addToSpatial(state, this.cols, newIdx.y[1]);
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

        this.getColSet(y1).forEach(function(other) {
            if (other != state) {
                var dis = Math.abs(state.position[0] - other.position[0]);

                if (dis < minDis) {
                    minDis = dis;
                    minState = other;
                }
            }
        });

        this.getColSet(y2).forEach(function(other) {
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

        this.getRowSet(x1).forEach(function(other) {
            if (other != state) {
                var dis = Math.abs(state.position[1] - other.position[1]);

                if (dis < minDis) {
                    minDis = dis;
                    minState = other;
                }
            }
        });

        this.getRowSet(x2).forEach(function(other) {
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

    this.getRowSet = function(index) {
        return index >= 0? this.rows[0][index] : this.rows[1][Math.abs(index)];
    };

    this.getColSet = function(index) {
        return index >= 0? this.cols[0][index] : this.cols[1][Math.abs(index)];
    };


    // compute the index for the spatial strucutre of a given position.
    // will return 2 x and y values for the overlapping grid structure
    function spatialIdx(pos, s) {
        var x1 = 2 * Math.floor(pos[0] / (2*s));
        var x2 = 2 * Math.floor((pos[0] + s) / (2*s)) - 1;

        var y1 = 2 * Math.floor(pos[1] / (2*s));
        var y2 = 2 * Math.floor((pos[1] + s) / (2*s)) - 1;

        return {x: [x1, x2], y: [y1, y2]};
    }

    function addToSpatial(state, arr, idx) {
        arr = idx >= 0? arr[0] : arr[1];
        idx = Math.abs(idx);

        for (var i = arr.length; i <= idx; i++) {
            arr.push(null);
        }

        if (arr[idx] == null) {
            arr[idx] = new Set();
        }

        arr[idx].add(state);
    }

    function removeFromSpatial(state, arr, idx) {
        arr = idx >= 0? arr[0] : arr[1];
        idx = Math.abs(idx);
        arr[idx].delete(state);
    }
}