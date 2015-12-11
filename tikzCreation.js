/**
 * Created by dennis on 25/10/15.
 */

function convertToTikz(nfa) {
    // initialize additional state attributes
    nfa.forEach(function (state) {
        state.freeDirs = ["below", "right", "above"];
        if (!state.isStart) {
            state.freeDirs.unshift("left");
        }
        state.position = [Math.random(), Math.random()];
    });

    layoutAut(nfa);
    return generateCode(nfa);
}

function generateCode(nfa) {
    var tikz  = "\\usetikzlibrary{automata, positioning}\n";
    tikz += "\\begin{tikzpicture}\n";

    // sort the states by name
    var sortedNFA = nfa.sort(function (item1, item2) {
        return item1.name - item2.name;
    });

    // create a tikz node for each state
    for (var i = 0; i < sortedNFA.length; i++) {
        tikz += generateStateCode(sortedNFA[i]) + "\n";
    }

    // create the transitions for each state as a tikz path
    tikz += "\n\\path[->]\n";
    for (i = 0; i < sortedNFA.length; i++) {
        tikz += generateTransitionsCode(sortedNFA[i]);
    }

    tikz += ";\n\n";

    return tikz + "\\end{tikzpicture}";
}

function generateStateCode(state) {
    var name = state.name;
    var accepting = state.isFinal? ",accepting":"";
    var start = state.isStart? ",initial":"";
    return "\\node[state" + accepting + start + "] (" +toInternalID(name) +
        ") at (" + state.position[0].toFixed(2) + "," + state.position[1].toFixed(2) + ") {$" + name + "$};";
}

function generateTransitionsCode(state) {
    var fromName = toInternalID(state.name);

    // build a map: state => symbols for transitions to that state
    var stateSymbolMap = new Map();
    var hasTransition = false;
    for (symb in state.transitions) {
        hasTransition = true;
        for (var i = 0; i < state.transitions[symb].length; i++) {
            var nextState = state.transitions[symb][i];
            if (!stateSymbolMap.has(nextState)) {
                stateSymbolMap.set(nextState, new Set());
            }
            stateSymbolMap.get(nextState).add(symb);
        }
    }

    if (!hasTransition) { // no transitions to draw
        return "";
    }

    var result = "(" + fromName + ")";
    const emptyWord = $("#emptySymb").val();

    for (var entry of stateSymbolMap.entries()) {
        var toName = toInternalID(entry[0].name);

        // first, create all non-looping transitions
        if (toName != fromName) {

            // figure out in what direction the edge goes
            var pos = vecDifference(entry[0].position, state.position);
            var edgeAngle = angle([0, 1], pos);

            var fromDir, toDir;

            if (pos[0] > 0) { // right side
                if (edgeAngle < Math.PI / 4) {
                    fromDir = "above";
                    toDir = "below";
                } else if (edgeAngle > 3 * Math.PI / 4) {
                    fromDir = "below";
                    toDir = "above";
                } else {
                    fromDir = "right";
                    toDir = "left";
                }
            } else { // left side
                if (edgeAngle < Math.PI / 4) {
                    fromDir = "above";
                    toDir = "below";
                } else if (edgeAngle > 3 * Math.PI / 4) {
                    fromDir = "below";
                    toDir = "above";
                } else {
                    fromDir = "left";
                    toDir = "right";
                }
            }

            // mark the direction as occupied
            i = state.freeDirs.indexOf(fromDir);
            if (i >= 0) { // remove the direction of the outgoing transition
                state.freeDirs.splice(i, 1);
            }

            i = entry[0].freeDirs.indexOf(toDir);
            if (i >= 0) {
                entry[0].freeDirs.splice(i, 1);
            }

            // where to write the node label?
            var nodeDir;
            if (fromDir == "above") {
                nodeDir = "left";
            } else if (fromDir == "below") {
                nodeDir = "right";
            } else if (fromDir == "left") {
                nodeDir = "below";
            } else if (fromDir == "right") {
                nodeDir = "above";
            }

            if (entry[0].hasTransitionTo(state)) {
                //var dir = entry[0].name < state.name? "left" : "right";
                result += "\tedge [bend right = 30] node [" + nodeDir + "] {\$";
            } else {
                result += "\tedge node [" + nodeDir + "] {\$";
            }

            var first = true;

            for (var symb of entry[1]) {
                symb = symb === EPS ? emptyWord : symb;
                result += first ? symb : ", " + symb;
                first = false;
            }
            result += "\$} (" + toName + ")\n";
        }
    }

    // add looping transitions wherever there is space for it
    if (stateSymbolMap.has(state)) {
        var dir = state.freeDirs.length > 0 ? state.freeDirs.pop() : "left";
        result += "\tedge [loop " + dir + "] node [" + dir + "] {\$";

        first = true;
        for (var symb of stateSymbolMap.get(state)) {
            symb = symb === EPS ? empty : symb;
            result += first ? symb : ", " + symb;
            first = false;
        }

        result += "\$} ()\n";
    }

    return result;
}

// TODO put all things in one regex (efficiency)
function toInternalID(name) {
    return name.toString()
        .replace(/\s/g, "") // remove whitespace,
        .replace(",","").replace(".","") // punctuation
        .replace("{","").replace("}","") // brackets
        .replace("_",""); // and underscores
}


function layoutAut(states) {
    const ITER_THRESHOLD = 1000;

    const NODE_CHARGE = 5;
    const EDGE_CONST = .15;
    const GRAV_CONST = .1;

    // put the start state to the left
    states[0].position[0] = -2 * states.length;

    // collect the set of connected states for each state
    for (var i = 0; i < states.length; i++) {
        states[i].conStates = listOfConnectedStates(states[i]);
    }


    for (var i = 0; i < ITER_THRESHOLD; i++) {
        var totalDelta = 0;
        var deltaE = 0;
        var deltaD = 0;

        // initialize movDeltas
        var movDeltas = [];
        for (var x = 0; x < states.length; x++) {
            movDeltas[x] = [0, 0];
        }

        // apply "gravitational" force towards center (0,0)
        for (var x = 0; x < states.length; x++) {
            var len = vecLen(states[x].position);
            var unit = unitVector(states[x].position);
            var val = -GRAV_CONST * Math.pow(len, 1); // F = -c*r

            movDeltas[x][0] += val * unit[0];
            movDeltas[x][1] += val * unit[1];
        }

        for (var x = 0; x < states.length; x++) {
            var movDelta = [0, 0];

            for (var y = x + 1; y < states.length; y++) {
                // compute repulsive force for every other state
                var dist = euclideanDistance(states[x].position, states[y].position);
                var val = NODE_CHARGE * Math.pow(1 / dist, 2); // F = c/(r**2)
                var unit = unitVector(vecDifference(states[x].position, states[y].position));

                movDelta[0] += val * unit[0];
                movDelta[1] += val * unit[1];
                deltaE += val;

                // compute attracting force for every connected state
                if (states[x].conStates.has(states[y])) {
                    val = -EDGE_CONST * Math.pow(dist, 1); // F = -Dx

                    movDelta[0] += val * unit[0];
                    movDelta[1] += val * unit[1];
                    deltaD = val;
                }


                // store the move deltas for the states
                movDeltas[x][0] += movDelta[0];
                movDeltas[x][1] += movDelta[1];

                movDeltas[y][0] -= movDelta[0];
                movDeltas[y][1] -= movDelta[1];

                totalDelta += euclideanDistance([0, 0], movDelta);
                movDelta = [0, 0];
            }
        }

        // apply translations
        for (x = 0; x < states.length; x++) {
            states[x].position[0] += movDeltas[x][0];
            states[x].position[1] += movDeltas[x][1];
        }
    }

    //// last step: center all states around [0,0]
    //var offsetX = 0; var offsetY = 0;
    //states.forEach(function(state) {
    //    offsetX += state.position[0];
    //    offsetY += state.position[1];
    //});
    //
    //offsetX /= states.length;
    //offsetY /= states.length;
    //console.log(offsetX + " " + offsetY);
    //states.forEach(function(state) {
    //    state.position[0] -= offsetX;
    //    state.position[1] -= offsetY;
    //});
}

function unitVector(vec) {
    var distance = vecLen(vec);
    return [vec[0] / distance, vec[1] / distance];

}

function euclideanDistance(vec1, vec2) {
    return Math.sqrt(Math.pow(vec1[0] - vec2[0], 2) +
        Math.pow(vec1[1] - vec2[1], 2));
}

function vecLen(vec) {
    return euclideanDistance([0, 0], vec);
}

function vecDifference(vec1, vec2) {
    return [vec1[0] - vec2[0], vec1[1] - vec2[1]];
}

function dot(vec1, vec2) {
    return vec1[0] * vec2[0] + vec1[1] * vec2[1];
}

function angle(vec1, vec2) {
    return Math.acos(dot(vec1, vec2) / (vecLen(vec1) * vecLen(vec2)));
}