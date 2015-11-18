/**
 * Created by dennis on 25/10/15.
 */

function convertToTikz(nfa) {
    var tikz  = "\\usetikzlibrary{automata, positioning}\n";
    tikz += "\\begin{tikzpicture}\n";

    layoutAut(nfa);

    // create a tikz node for each state
    for(var i = 0; i < nfa.length; i++) {
        tikz += generateStateCode(nfa[i]) + "\n";
    }

    // create the transitions for each state as a tikz path
    tikz += "\n\\path[->]\n";
    for(var i = 0; i < nfa.length; i++) {
        var transitions = nfa[i].transitions;
        for(symb in transitions) {
            for(var j = 0; j < transitions[symb].length; j++) {
                tikz += generateTransitionsCode(nfa[i], symb, transitions[symb][j]) + "\n";
            }
        }
    }

    tikz += ";\n";

    return tikz + "\\end{tikzpicture}";
}

function generateStateCode(state) {
    var name = state.name;
    var accepting = state.isFinal? ",accepting":"";
    var start = state.isStart? ",initial":"";
    return "\\node[state" + accepting + start + "] (" +toInternalID(name) +
        ") at (" + state.position[0].toFixed(2) + "," + state.position[1].toFixed(2) + ") {" + name + "};";
}

function generateTransitionsCode(state, symb, nextState) {
    var fromName = toInternalID(state.name);
    var toName = toInternalID(nextState.name);

    if (symb === EPS) {
        symb = "\\varepsilon";
    }

    return "(" + fromName + ") edge node [above] {\$" +symb + "\$} (" + toName + ")";
}

function toInternalID(name) {
    return name.toString().replace(/\s/g, "").replace(",",""); // remove all whitespace and punctuation;
}