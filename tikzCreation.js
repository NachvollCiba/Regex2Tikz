/**
 * Created by dennis on 25/10/15.
 */

const DIRECTIONS = ["left", "below", "right", "above"];

function convertToTikz(nfa) {
    initializeStateMeta(nfa);
    layoutAut(nfa);
    computeStateMeta(nfa);
    return generateCode(nfa);
}

function initializeStateMeta(nfa) {
    nfa.forEach(function (state) {
        state.position = [Math.random(), Math.random()];
        state.incoming = new Set();
        state.outgoing = new Map();
        state.freeDirs = state.isStart? ["below", "right", "above"] : ["left", "below", "right", "above"];
        state.loop = null;
    });
}

function computeStateMeta(nfa) {
    nfa.forEach(function (state) {
        var loopSymbols = new Set();

        for (var symb in state.transitions) {
            for (var i = 0; i < state.transitions[symb].length; i++) {

                var nextState = state.transitions[symb][i];

                if (nextState == state) {
                    loopSymbols.add(symb);
                } else {
                    var dir = discreetDirection(state.position, nextState.position);

                    if (!state.outgoing.has(nextState)) {
                        state.outgoing.set(nextState, {
                            symbs: new Set(), placement: DIRECTIONS[(dir+1) % DIRECTIONS.length]});
                    }
                    state.outgoing.get(nextState).symbs.add(symb);
                    nextState.incoming.add(state);

                    // mark the direction as occupied
                    removeElem(state.freeDirs, DIRECTIONS[dir]);
                    removeElem(nextState.freeDirs, DIRECTIONS[(dir + 2) % DIRECTIONS.length]);
                }
            }
        }

        if (loopSymbols.size > 0) {
            state.loop = {
                symbs: loopSymbols,
                placement: state.freeDirs.length > 0 ? state.freeDirs.pop() : "left"
            };
        }
    });
}

function discreetDirection(fromVec, toVec) {
    // figure out in what direction the edge goes
    var pos = vecDifference(toVec, fromVec);
    var edgeAngle = angle([0, 1], pos);
    var fromDir;

    if (pos[0] > 0) { // right side
        if (edgeAngle < Math.PI / 4) {
            fromDir = 3; // above
        } else if (edgeAngle > 3 * Math.PI / 4) {
            fromDir = 1; // below
        } else {
            fromDir = 2; // right
        }
    } else { // left side
        if (edgeAngle < Math.PI / 4) {
            fromDir = 3; // above
        } else if (edgeAngle > 3 * Math.PI / 4) {
            fromDir = 1; // below
        } else {
            fromDir = 0; // left
        }
    }

    return fromDir;
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

    if (state.outgoing.size == 0 && state.loop == null) { // no transitions to draw
        return "";
    }

    var result = "(" + fromName + ")";

    // create code for loop
    if (state.loop != null) {
        result += "\tedge [loop " + state.loop.placement + "] node [" + state.loop.placement
            + "] {\$" + generateAlphabetString(state.loop.symbs) +  "\$} ()\n";
    }

    // create code for all other transitions
    for (var entry of state.outgoing.entries()) {
        var toName = toInternalID(entry[0].name);

        if (state.incoming.has(entry[0])) {
            result += "\tedge [bend right = 30] node [" + entry[1].placement + "] {\$";
        } else {
            result += "\tedge node [" + entry[1].placement + "] {\$";
        }

        result +=  generateAlphabetString(entry[1].symbs) + "\$} (" + toName + ")\n";
    }

    return result;
}

function generateAlphabetString(alphSet, eps) {
    const emptyWord = typeof(eps) == "undefined"? $("#emptySymb").val() : eps;
    var result = "";
    var first = true;

    for (var symb of alphSet) {
        symb = symb === EPS ? emptyWord : symb;
        result += first ? symb : ", " + symb;
        first = false;
    }

    return result;
}

function alignAutomaton(automaton, gridWidth) {
    automaton.forEach(function(state) {
        state.position[0] = Math.round(state.position[0] / gridWidth) * gridWidth;
        state.position[1] = Math.round(state.position[1] / gridWidth) * gridWidth;
    });
}

// TODO put all things in one regex (efficiency)
function toInternalID(name) {
    return name.toString()
        .replace(/\s/g, "") // remove whitespace,
        .replace(",","").replace(".","") // punctuation
        .replace("{","").replace("}","") // brackets
        .replace("_",""); // and underscores
}


// graph drawing algorithm
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

        // align automaton to grid
        alignAutomaton(states, SNAP_RAD);
    }
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


function removeElem(array, elem) {
    var i = array.indexOf(elem);
    if (i >= 0) {
        array.splice(i, 1);
    }
}