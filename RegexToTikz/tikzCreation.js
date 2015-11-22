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

    // build a map state => symbols for transitions to that state
    var stateSymbolMap = Object.create(null);
    var hasTransition = false;
    for (symb in state.transitions) {
        hasTransition = true;
        for (var i = 0; i < state.transitions[symb].length; i++) {
            var nextState = state.transitions[symb][i];
            if (!(nextState.name in stateSymbolMap)) {
                stateSymbolMap[nextState.name] = new Set();
            }
            stateSymbolMap[nextState.name].add(symb);
        }
    }

    if (!hasTransition) { // no transitions to draw
        return "";
    }

    var result = "(" + fromName + ")";
    const emptyWord = $("#emptySymb").val();

    for (nextState in stateSymbolMap) {
        if (nextState.name != state.name) {
            result += "\tedge node [above] {\$";
        } else {
            result += "\t edge node [loop above] {";
        }

        var first = true;

        for (var symb of stateSymbolMap[nextState]) {
            symb = symb === EPS ? emptyWord : symb;
            result += first ? symb : ", " + symb;
            first = false;
        }
        result += "\$} (" + toInternalID(nextState) + ")\n";
    }

    return result + "\n";
}

function toInternalID(name) {
    return name.toString().replace(/\s/g, "").replace(",",""); // remove all whitespace and punctuation;
}