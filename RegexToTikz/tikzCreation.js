/**
 * Created by dennis on 25/10/15.
 */

function convertToTikz(nfa) {
    var tikz  = "\\usetikzlibrary{automata, positioning}\n";
    tikz += "\\begin{tikzpicture}\n";

    layoutAut(nfa);

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
        ") at (" + state.position[0].toFixed(2) + "," + state.position[1].toFixed(2) + ") {" + name + "};";
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
        if (toName != fromName) {
            if (entry[0].hasTransitionTo(state)) {
                //var dir = entry[0].name < state.name? "left" : "right";
                result += "\tedge [bend right = 30] node [above] {\$";
            } else {
                result += "\tedge node [above] {\$";
            }
        } else {
            result += "\tedge [loop above] node [above] {\$";
            toName = "";
        }

        var first = true;

        for (var symb of entry[1]) {
            symb = symb === EPS ? emptyWord : symb;
            result += first ? symb : ", " + symb;
            first = false;
        }
        result += "\$} (" + toName + ")\n";
    }

    return result + "\n";
}

function toInternalID(name) {
    return name.toString().replace(/\s/g, "").replace(",",""); // remove all whitespace and punctuation;
}


function layoutAut(states) {
    const NODE_CHARGE = 1.5;
    const ITER_THRESHOLD = 100;
    const EDGE_CONST = .1;

    //// initialize all states position
    //var frak = 2 * Math.PI / states.length;
    //var r = states.length / (2 * Math.PI);
    //for (var j=0; j<states.length; j++) {
    //    states[j].position[0] = r * Math.cos(j * frak);
    //    states[j].position[1] = r * Math.sin(j * frak);
    //}

    for (var i = 0; i < ITER_THRESHOLD; i++) {
        var totalDelta = 0;
        var deltaE = 0;
        var deltaD = 0;

        // initialize movDeltas
        var movDeltas = [];
        for (var x = 0; x < states.length; x++) {
            movDeltas[x] = [0, 0];
        }

        for (x = 0; x < states.length; x++) {
            // collect all connected states (TODO only compute once)
            var conStates = listOfConnectedStates(states[x]);
            var movDelta = [0, 0];

            // calculate repulsive force for every other state
            for (var y = x + 1; y < states.length; y++) {
                var dist = euclideanDistance(states[x].position, states[y].position);
                var val = NODE_CHARGE * Math.pow(1 / dist, 3); // F = c/(r**2)
                var unit = unitVector(vecDifference(states[x].position, states[y].position));

                movDelta[0] += val * unit[0];
                movDelta[1] += val * unit[1];
                deltaE += val;

                if (states[y].name in conStates) {
                    val = -EDGE_CONST * Math.pow(dist, 1); // F = -Dx

                    movDelta[0] += val * unit[0];
                    movDelta[1] += val * unit[1];
                    deltaD = val;
                }

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
}

function unitVector(vec) {
    var distance = euclideanDistance([0, 0], vec);
    return [vec[0] / distance, vec[1] / distance];

}

function euclideanDistance(vec1, vec2) {
    return Math.sqrt(Math.pow(vec1[0] - vec2[0], 2) +
        Math.pow(vec1[1] - vec2[1], 2));
}

function vecDifference(vec1, vec2) {
    return [vec1[0] - vec2[0], vec1[1] - vec2[1]];
}