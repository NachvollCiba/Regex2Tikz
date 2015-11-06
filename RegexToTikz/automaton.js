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

    this.transitions = {};

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

// a parser for regular expressions
function RegexParser(regex) {
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
         * Grammar for regexes:
         *
         * regex = term | term '|' term
         * term = base'*'* term?
         * base = char | (regex)
         */

        var nfa1 = this.term();

        // make decision based on next character
        if (this.input.length > 0) {
            var next = this.popInput();

            // invalid character
            if (next != "|") {
                throw ("Expected '|', got " + next);
            }

            var nfa2 = this.term();

            // retrieve in- and out states
            var in1 = nfa1[0], in2 = nfa2[0];
            var out1 = nfa1[nfa1.length-1], out2 = nfa2[nfa2.length-1];

            // create new in and out state
            var _in = new State(this.lastID++);
            var out = new State(this.lastID++);

            // merge the states
            _in.merge(in1); _in.merge(in2);
            out1.merge(out); out2.merge(out);

            // rebuild the nfa state array
            nfa1 = nfa1.concat(nfa2);
            nfa1.unshift(_in);
            nfa1.push(out);
        }

        return nfa1;
    };

    // grammar rule:
    // term = base'*'* term?
    this.term = function() {
        var nfa_base = this.base();

        var _in, out;

        while (this.input.length > 0 && this.input[0] === "*") {
            this.popInput();

            _in = nfa_base[0];
            out = nfa_base[nfa_base.length - 1];

            _in.merge(out);
            out.merge(_in);
        }

        if (this.input.length > 0 && this.input[0] !== "|") {
            var nfa_term = this.term();

            out = nfa_base[nfa_base.length - 1];
            _in = nfa_term[0];
            out.merge(_in);
            nfa_base = nfa_base.concat(nfa_term);
        }

        return nfa_base;
    };

    // grammar rule:
    // base = char | (regex)
    this.base = function() {
        var next = this.popInput();
        var nfa;

        if (next === "(") {
            nfa = this.regex();
        } else if (validSymbol(next)) {
            // build a nfa for a single character
            nfa = [new State(this.lastID++), new State(this.lastID++)];
            nfa[0].addNextState(next, nfa[1]);
        } else {
            throw ("Expected '(' or an alphanumeric character, got " + next);
        }

        if (this.input[0] === ")") {
            this.popInput();
        }

        return nfa;
    };

    // removes and returns the first char from the input string
    this.popInput = function() {
        var first = this.input[0];
        this.input = this.input.substring(1);
        return first;
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
