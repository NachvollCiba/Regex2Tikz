/**
 * Created by dennis on 25/10/15.
 */

const EPS = ""; // constant for epsilon

//
function nfa2dfa(nfa, alphabet) {
    // empty automaton
    if (nfa.length == 0) {
        return [];
    }

    // build the eps-closure of the start state
    var startClosure = epsClosure(nfa[0]);
    var newStart = new State(potStateName(startClosure[0]), true, startClosure[1]);
    var dfa = [newStart];

    var stack = []; // stack of state sets to work on
    var potStates = Object.create(null); // dictionary state name => state

    stack.push([startClosure[0], newStart.name]);
    potStates[newStart.name] = newStart;

    while (stack.length > 0) {
        var next = stack.shift();

        for (var symb of alphabet) {
            var symbConnected = new Set();
            var isFinal = false;

            // collect all states that are connected with the alphabet symbol
            for (var curState of next[0]) {
                isFinal |= curState.isFinal;


                curState.nextStates(symb).forEach(function (nextState) {
                    symbConnected.add(nextState);
                });
            }

            // build the eps closure of the set
            var epsConnected = new Set();
            for (var conState of symbConnected) {
                var closure = epsClosure(conState);

                for (var epsState of closure[0]) {
                    epsConnected.add(epsState);
                }

                isFinal |= closure[1];
            }

            for (var epsConState of epsConnected) {
                symbConnected.add(epsConState);
            }

            if (symbConnected.size > 0) {
                var stateName = potStateName(symbConnected);

                // create the set state if it does not exist
                var potState = null;
                if (stateName in potStates) {
                    potState = potStates[stateName];
                } else {
                    potState = new State(stateName, false, isFinal);
                    stack.push([symbConnected, stateName]);
                    potStates[stateName] = potState;
                    dfa.push(potState);
                }

                // add the transition
                var startState = potStates[next[1]];
                startState.addNextState(symb, potState);
            }
        }
    }

    // assign new names for the states
    var id = 0;
    dfa.forEach(function (state) {
        state.name = id++;
    });

    return dfa;
}

function potStateName(stateSet) {
    var stateNames = [];
    stateSet.forEach(function (state) {
        stateNames.push(state.name);
    });

    var res = "";
    stateNames.sort().forEach(function (str) {
        res += str;
    });
    return res;
}

function epsClosure(state, closure) {
    if (typeof(closure) === 'undefined') {
        closure = new Set();
    }
    var hasFinal = state.isFinal;

    closure.add(state); // every state is trivially part of its own eps-closure

    // add the eps-closure of every e-connected state
    var epsConnected = state.nextStates(EPS);
    for (var i = 0; i < epsConnected.length; i++) {
        if (!closure.has(epsConnected[i])) {
            var nextClosure = epsClosure(epsConnected[i], closure);

            for (var epsState of nextClosure[0]) {
                closure.add(epsState);
            }
            hasFinal |= nextClosure[1];
        }
    }

    return [closure, hasFinal];
}

function minimize(dfa) {
    // initialize map of equivalent states
    var eqStatesMap = new Map();
    dfa.forEach(function (state) {
        var eqStatesSet = new Set();

        dfa.forEach(function (otherState) {
            if (otherState.isFinal == state.isFinal) {
                eqStatesSet.add(otherState);
            }
        });

        eqStatesMap.set(state, eqStatesSet);
    });

    var changed = true;
    while (changed) {
        changed = false;

        dfa.forEach(function (state) {
            var eqStates = eqStatesMap.get(state);
            eqStates.forEach(function (eqState) {
                for (var symb in state.transitions) {
                    // input is a dfa -> list of next states is always of length <= 1
                    var next = state.nextStates(symb);
                    var eqNext = eqState.nextStates(symb);
                    if (eqNext.length > 0) {
                        next = next[0];
                        eqNext = eqNext[0];

                        if (!eqStatesMap.get(next).has(eqNext)) {
                            eqStates.delete(eqState);
                            eqStatesMap.get(eqState).delete(state);
                            changed = true;
                        }
                    } else {
                        eqStates.delete(eqState);
                        eqStatesMap.get(eqState).delete(state);
                        changed = true;
                    }
                }
            });
        });
    }

    // create new states
    var newStatesMap = new Map(); // old state => new state
    var newStates = new Map(); //  new state name => new state
    for (var entry of eqStatesMap.entries()) {
        var stateName = potStateName(entry[1]);
        if (typeof(newStates.get(stateName)) == "undefined") {
            var isStart = false;
            var isFinal = false;
            entry[1].forEach(function (eqState) {
                isStart |= eqState.isStart;
                isFinal |= eqState.isFinal;
            });

            newState = new State(stateName, isStart, isFinal);
            newStates.set(stateName, newState);
        } else {
            var newState = newStates.get(stateName);
        }

        newStatesMap.set(entry[0], newState);
    }

    // add transitions to the new states
    var minDFA = [];
    for (entry of newStatesMap.entries()) {
        // add all transitions
        for (var symb in entry[0].transitions) {
            entry[1].addNextState(symb, newStatesMap.get(entry[0].nextStates(symb)[0]));
        }
    }

    // assemble the new states to an dfa array
    for (var state of newStates.values()) {
        if (state.isStart) {
            minDFA.unshift(state);
        } else {
            minDFA.push(state);
        }
    }

    // rename the states
    var id = 0;
    minDFA.forEach(function (state) {
        state.name = id++;
    });

    return minDFA;
}


function listOfConnectedStates(state) {
    var conStates = new Set();
    for (var symb in state.transitions) {
        // add all next states to the conStates set
        for (y = 0; y < state.transitions[symb].length; y++) {
            var nextState = state.transitions[symb][y];
            if (nextState != state) {
                conStates.add(nextState);
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

    this.nextStates = function (symb) { // returns the list of states following after the symbol
        if (symb in this.transitions) {
            return this.transitions[symb];
        } else {
            return [];
        }
    };

    this.addNextState = function (symb, nextState) { // adds a transition under symb to nextState
        if (! (symb in this.transitions)) {
            this.transitions[symb] = [];
        }

        this.transitions[symb].push(nextState);
    };

    this.hasTransitionTo = function (otherState) {
        for (symb in this.transitions) {
            if (this.transitions[symb].indexOf(otherState) > -1) {
                return true;
            }
        }

        return false;
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
     * term -> factor term?
     * factor -> atom "*"*
     * atom -> alphanum | (regex)
     */

    this.input = regex.replace(/\s/g, ""); // remove all whitespace

    // compute the alphabet used by this regex
    this.alphabet = new Set();
    for (var i=0; i<this.input.length; i++) {
        if (validSymbol(this.input[i])) {
            this.alphabet.add(this.input[i]);
        }
    }

    this.lastID = 0; // counter for state ids

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
