/**
 * Created by dennis on 25/10/15.
 */

var EPS = ""; // constant for epsilon

//
function nfa2dfa(states) {
    // empty automaton
    if (states.length == 0) {
        return [];
    }

    states.forEach(function (state) {

    });
}

function epsClosure(state) {
    var closure = new Set();
    closure.put(state); // every state is trivially part of its own eps-closure

    // add the eps-closure of every e-connected state
    var epsConnected = state.transition[EPS];
    for (var i = 0; i < epsConnected.length; i++) {
        if (!closure.isElem(epsConnected[i])) {
            closure.putAll(epsClosure(epsConnected[i]))
        }
    }

    return closure;
}

function minimize(dfa) {
    // TODO implement
}

function layoutAut(states) {
    const NODE_CHARGE = .1;
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
            // collect all connected states
            var conStates = listOfConnectedStates(states[x]);
            var movDelta = [0, 0];

            // calculate repulsive force for every other state
            for (var y = x + 1; y < states.length; y++) {
                var dist = euclideanDistance(states[x].position, states[y].position);
                var val = NODE_CHARGE * Math.pow(1 / dist, 2); // F = c/(r**2)
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

function listOfConnectedStates(state) {
    var conStates = [];
    for (var symb in state.transitions) {
        // add all next states to the conStates set
        for (y = 0; y < state.transitions[symb].length; y++) {
            var nextState = state.transitions[symb][y];
            if (nextState != state) {
                conStates[nextState.name] = true;
            }
        }
    }
    return conStates;
}

// class for NFA states
function State(name, isStart, isFinal) {
    if (typeof(isStart)==='undefined') {
        isStart = false;
    }
    if (typeof(isFinal)==='undefined') {
        isFinal = false;
    }

    this.name = name;
    this.isStart = isStart;
    this.isFinal = isFinal;

    this.transitions = Object.create(null);

    this.position = [Math.random(), Math.random()]; // used for graph drawing

    this.nextStates = function(symb) {
        if (symb in this.transitions) {
            return this.transitions;
        } else {
            return [];
        }
    };

    this.addNextState = function(symb, nextState) {
        if (! (symb in this.transitions)) {
            this.transitions[symb] = [];
        }

        this.transitions[symb].push(nextState);
    };

    this.merge = function(state) {
        this.addNextState(EPS, state);
    };
}


function RegexParser(regex) {
    /**
     * This class implements a simple LL(1) - Parser for regular expressions.
     * Will compile the regex into an nondeterministic finite automaton (NFA)
     *
     *  LL(1) - Grammar for regexes:
     *
     * regex -> term | term "|" regex
     * term -> factor term
     * factor -> atom "*"*
     * atom -> alphanum | (regex)
     */

    this.input = regex.replace(/\s/g, ""); // remove all whitespace
    this.lastID = 0;

    // parses the function and returns an nfa if the regex is valid
    this.parse = function() {
        var nfa = this.regex();

        // set the first state as start and the last state as accepting
        nfa[0].isStart = true;
        nfa[nfa.length-1].isFinal = true;

        return nfa;
    };

    this.regex = function() {
        /**
         * Corresponding grammar rule:
         * regex -> term | term "|" regex
         */

        var next = this.peekInput();
        if (this.hasInput() && (next == "(" || validSymbol(next))) {
            var nfa = this.term();
        } else {
            throw ("Expected '(' or any alphanumeric character, got " + next);
        }

        // check if there is a union term following
        next = this.peekInput();
        if (this.hasInput() && next == "|") {
            this.popInput();

            next = this.peekInput();
            if (next != "(" && !validSymbol(next)) {
                throw ("Expected '(' or any alphanumeric character, got " + next);
            }

            var nfa2 = this.regex();

            // retrieve in- and out states
            var in1 = nfa[0], in2 = nfa2[0];
            var out1 = nfa[nfa.length - 1], out2 = nfa2[nfa2.length - 1];

            // create new in and out state
            var _in = new State(this.lastID++);
            var out = new State(this.lastID++);

            // merge the states
            _in.merge(in1); _in.merge(in2);
            out1.merge(out); out2.merge(out);

            // rebuild the nfa state array
            nfa = nfa.concat(nfa2);
            nfa.unshift(_in);
            nfa.push(out);
        }

        return nfa;
    };

    this.term = function () {
        /**
         * Corresponding grammar rule:
         * term -> factor term?
         */

        var nfa = this.factor();

        var next = this.peekInput();
        if (this.hasInput() && (next == "(" || validSymbol(next))) {

            var nfa2 = this.term();

            // concatenate the nfas with an epsilon-transition
            var out = nfa[nfa.length - 1];
            var _in = nfa2[0];
            out.merge(_in);

            // merge the arrays
            nfa = nfa.concat(nfa2);
        }

        return nfa;
    };

    this.factor = function () {
        /**
         * Corresponding grammar rule:
         * factor -> atom "*"*
         */

        var nfa = this.atom();

        while (this.hasInput() && this.peekInput() == "*") {
            this.popInput(); // remove "*" from input

            var nfaIn = nfa[0];
            var nfaOut = nfa[nfa.length - 1];

            var _in = new State(this.lastID++);
            var out = new State(this.lastID++);

            // add epsilon transitions
            _in.merge(nfaIn);
            nfaOut.merge(out);

            _in.merge(out);
            nfaOut.merge(nfaIn);

            // add the states to the nfa array
            nfa.unshift(_in);
            nfa.push(out);
        }

        return nfa;
    };

    this.atom = function () {
        /**
         * Corresponding grammar rule:
         * atom -> alphanum | (regex)
         */

        var next = this.popInput();
        if (next == "(") {
            var nfa = this.regex();

            next = this.popInput();
            if (next != ")") {
                throw ("Expected ')', got " + next);
            }

            return nfa;
        } else if (validSymbol(next)) {
            var _in = new State(this.lastID++);
            var out = new State(this.lastID++);

            _in.addNextState(next, out);
            return [_in, out];
        } else {
            throw ("Expected '(' or any alphanumeric character, got " + next);
        }
    };

    // removes and returns the first char from the input string
    this.popInput = function() {
        if (!this.hasInput()) {
            return null;
        }

        var first = this.input[0];
        this.input = this.input.substring(1);
        return first;
    };

    this.peekInput = function () {
        if (!this.hasInput()) {
            return null;
        }

        return this.input[0];
    };

    this.hasInput = function () {
        return this.input.length > 0;
    };
}

function validSymbol(symb){
    // for now, only allow alphanumeric strings to be accepted

    if (symb.length > 1) {
        return false; // no strings as symbols
    }

    var code = symb.charCodeAt(0);
    if (!(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 91) && // upper alpha (A-Z)
        !(code > 96 && code < 123)) { // lower alpha (a-z)
        return false;
    }
    return true;
}
