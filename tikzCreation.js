/**
 * Created by dennis on 25/10/15.
 */


const DIRECTIONS = {LEFT: 1, BELOW: 2, RIGHT: 4, ABOVE: 8, ALL: 15};
const DIRECTIONS_STRINGS = [null, "left", "below", null, "right", null, null, null, "above"]; // array for reverse lookup

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
        state.freeDirs = state.isStart? DIRECTIONS.ALL - DIRECTIONS.LEFT : DIRECTIONS.ALL;
        state.loop = null;
    });
}

function computeStateMeta(nfa) {
    nfa.forEach(function (state) {
        var loopSymbols = new Set();

        for (var entry of state.transitions.entries()) {
            var symb = entry[0] == EPS? $("#emptySymb").val() : entry[0];
            //const emptyWord = typeof(eps) == "undefined"? $("#emptySymb").val() : eps;
            for (var nextState of entry[1]) {

                if (nextState == state) {
                    loopSymbols.add(symb);
                } else {
                    var dir = discreetDirection(state.position, nextState.position);
                    // add the edge to the incoming and outgoing sets
                    var outgoing = state.outgoing.get(nextState);
                    if (!state.outgoing.has(nextState)) {
                        outgoing = {symbs: symb, placement: (dir*2) % DIRECTIONS.ALL}; // next direction (anti-clockwise)
                        state.outgoing.set(nextState, outgoing);
                    } else {
                        outgoing.symbs += ", " + symb;
                    }
                    nextState.incoming.add(state);

                    // mark the direction as occupied
                    state.freeDirs &= ~dir;
                    nextState.freeDirs &= ~((dir * 4) % DIRECTIONS.ALL);
                }
            }
        }

        // add loop information, if transition was a loop
        if (loopSymbols.size > 0) {
            state.loop = {
                symbs: generateAlphabetString(loopSymbols),
                placement: freeDirection(state.freeDirs)
            };
        }
    });
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
        result += "\tedge [loop " + DIRECTIONS_STRINGS[state.loop.placement] + "] node ["
            + DIRECTIONS_STRINGS[state.loop.placement]
            + "] {\$" + state.loop.symbs +  "\$} ()\n";
    }

    // create code for all other transitions
    for (var entry of state.outgoing.entries()) {
        var toName = toInternalID(entry[0].name);

        if (state.incoming.has(entry[0])) {
            result += "\tedge [bend right = 30] node [" + DIRECTIONS_STRINGS[entry[1].placement] + "] {\$";
        } else {
            result += "\tedge node [" + DIRECTIONS_STRINGS[entry[1].placement] + "] {\$";
        }

        result +=  entry[1].symbs + "\$} (" + toName + ")\n";
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
        state.position = scalarMult(round(scalarDiv(state.position, gridWidth)), gridWidth);
    });
}

function toInternalID(name) {
    return name.toString()
        .replace(/(\s|,|\.|\{|\}|_)/g, ""); // remove whitespace, punctuation, brackets and underscores
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


    for (var i = 0; i < ITER_THRESHOLD; i++) { // TODO optimization and improvments
        var totalDelta = 0;
        var deltaE = 0;
        var deltaD = 0;

        // initialize movDeltas
        var movDeltas = [];
        for (var x = 0; x < states.length; x++) {
            movDeltas[x] = [0, 0];
        }

        var unit, val;

        // apply "gravitational" force towards center (0,0)
        for (var x = 0; x < states.length; x++) {
            var length = len(states[x].position);
            unit = normalize(states[x].position);
            val = -GRAV_CONST * Math.pow(length, 1); // F = -c*r

            addInPlace(movDeltas[x], scalarMult(unit, val));
        }

        for (var x = 0; x < states.length; x++) {
            for (var y = x + 1; y < states.length; y++) {
                var movDelta = [0, 0];

                // compute repulsive force for every other state
                var dist = euclideanDistance(states[x].position, states[y].position);
                val = NODE_CHARGE * Math.pow(1 / dist, 2); // F = c/(r**2)
                unit = normalize(sub(states[x].position, states[y].position));

                addInPlace(movDelta, scalarMult(unit, val));
                deltaE += val;

                // compute attracting force for every connected state
                if (states[x].conStates.has(states[y])) {
                    val = -EDGE_CONST * Math.pow(dist, 1); // F = -Dx
                    addInPlace(movDelta, scalarMult(unit, val));
                    deltaD = val;
                }


                // store the move deltas for the states
                addInPlace(movDeltas[x], movDelta);
                subInPlace(movDeltas[y], movDelta);

                totalDelta += euclideanDistance(ORIGIN, movDelta);
            }
        }

        // apply translations
        for (x = 0; x < states.length; x++) {
            addInPlace(states[x].position, movDeltas[x]);

        }

        // align automaton to grid
        alignAutomaton(states, SNAP_RAD);
    }
}

function removeElem(array, elem) {
    var i = array.indexOf(elem);
    if (i >= 0) {
        array.splice(i, 1);
    }
}

function freeDirection(bitVector) {
    if ((bitVector & DIRECTIONS.ABOVE) > 0) {
        return DIRECTIONS.ABOVE;
    } else if ((bitVector & DIRECTIONS.RIGHT) > 0) {
        return DIRECTIONS.RIGHT;
    } else if ((bitVector & DIRECTIONS.LEFT) > 0) {
        return DIRECTIONS.BELOW;
    } else {
        return DIRECTIONS.LEFT; // default case
    }

}
