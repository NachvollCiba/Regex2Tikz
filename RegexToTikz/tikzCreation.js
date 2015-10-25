/**
 * Created by dennis on 25/10/15.
 */

function convertToTikz(nfa) {
    var tikz  = "\\usetikzlibrary{automata, positioning}\n";
    tikz += "\\begin{tikzpicture}\n";

    // create a tikz node for each state
    for(var i = 0; i < nfa.length; i++) {
        tikz += generateStateCode(nfa[i], 2*i, 0) + "\n";
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

function generateStateCode(state, posX, posY) {
    var name = state.name;
    var accepting = state.isFinal? ",accepting":"";
    var start = state.isStart? ",initial":"";
    return "\\node[state" + accepting + start + "] (" + name +
        ") at (" + posX + "," + posY + ") {" + name + "};";
}

function generateTransitionsCode(state, symb, nextState) {
    var fromName = state.name;
    var toName = nextState.name;

    if (symb === EPS) {
        symb = "\\varepsilon";
    }

    return "(" + fromName + ") edge node [above] {\$" +symb + "\$} (" + toName + ")";
}