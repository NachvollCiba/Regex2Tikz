/**
 * Created by dennis on 25/10/15.
 */

const EPS = ""; // constant for epsilon

//
function nfa2dfa(nfa, alphabet, withSink) {
    // empty automaton
    if (nfa.length == 0) {
        return [];
    }


    // build the eps-closure of the start state
    var startClosure = epsClosure(nfa[0]);
    var newStart = new State(powStateName(startClosure[0]), true, startClosure[1]);
    var dfa = [newStart];

    var stack = []; // stack of state sets to work on
    var potStates = new Map(); // dictionary state name => state

    stack.push([startClosure[0], newStart.name]);
    potStates.set(newStart.name, newStart);

    while (stack.length > 0) {
        var next = stack.shift();

        for (var symb of alphabet) {
            var symbConnected = new Set();
            var isFinal = false;

            // collect all states that are connected with the alphabet symbol in the original automaton
            for (var curState of next[0]) {
                curState.nextStates(symb).forEach(function (nextState) {
                    isFinal |= nextState.isFinal;
                    symbConnected.add(nextState);
                });
            }

            // build the eps closure of the set
            var epsConnected = [];
            for (var conState of symbConnected) {
                var closure = epsClosure(conState);
                epsConnected.push(closure[0]);
                isFinal |= closure[1];
            }

            // add all epsilon closures to the set of connected states
            for (var epsClosureSet of epsConnected) {
                for (var epsConnected of epsClosureSet) {
                    symbConnected.add(epsConnected);
                }
            }

            if (symbConnected.size > 0) {
                var stateName = powStateName(symbConnected);

                var potState = null;
                if (potStates.has(stateName)) { // retrieve the state
                    potState = potStates.get(stateName);
                } else { // create the state and put it on the stack
                    potState = new State(stateName, false, isFinal);
                    stack.push([symbConnected, stateName]);
                    potStates.set(stateName,potState);
                    dfa.push(potState);
                }

                // add the transition
                var startState = potStates.get(next[1]);
                startState.addNextState(symb, potState);
            }
        }
    }

    if (withSink) {
        generateSinkState(dfa, alphabet);
    }

    renameStates(dfa);
    return dfa;
}

function generateSinkState(automaton, alphabet) {
    // create sink state
    var sink = new State(automaton.length, false, false);
    for (var symb of alphabet) {
        sink.addNextState(symb, sink); // add self-loops under every symbol
    }

    // create a transition to the sink state for every symbol that has no transition in a state
    var sinkIsReached = false;
    automaton.forEach(function(state) {
        for (var symb of alphabet) {
            if (state.nextStates(symb).length === 0) {
                sinkIsReached = true;
                state.addNextState(symb, sink);
            }
        }
    });

    // add the sink state to the automaton if it is not redundant
    if (sinkIsReached) {
        automaton.push(sink);
    }
}

// build a unique name for a powerset state
function powStateName(stateSet) {
    var stateNames = [];
    stateSet.forEach(function (state) { // collect all state names in an array
        stateNames.push(state.name);
    });

    return stateNames.sort().join();
}

// compute the epsilon closure of a state
var closure;
var hasFinal;
function epsClosure(state, recursive) {
    if (typeof(recursive) === 'undefined') { // reset closure on top-level recursion call
        closure = new Set();
        hasFinal = false;
    }

    hasFinal |= state.isFinal;
    closure.add(state); // every state is trivially part of its own eps-closure

    // add the eps-closure of every e-connected state
    var epsConnected = state.nextStates(EPS);
    for (var epsConState of epsConnected) {
        if (!closure.has(epsConState)) {
            epsClosure(epsConState, closure);
        }
    }

    return [closure, hasFinal];
}

function minimize(dfa) {
    var eqStatesMap = new Map(); // maps each state to the set of (myhill-neurode) equivalent states

    // initialization: every state is equivalent to every other state with the same isFinal flag
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
                for (var symb of state.transitions.keys()) {
                    // automaton is deterministic => there is always either 0 or 1 next state for each symbol
                    var next = state.randomNextState(symb);
                    var eqNext = eqState.randomNextState(symb);

                    if (eqNext !== null) {
                        if(!eqStatesMap.get(next).has(eqNext)) {
                            // the following states are not equivalent => the starting states are not equivalent
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
        var stateName = powStateName(entry[1]);
        if (!(newStates.has(stateName))) {
            // build the new state
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
        for (var symb of entry[0].transitions.keys()) {
            var next = entry[0].randomNextState(symb);
            if (next !== null) {
                entry[1].addNextState(symb, newStatesMap.get(next));
            }
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
    renameStates(minDFA);
    return minDFA;
}

function renameStates(states) {
    var prefix = $("#statePrefix").val().trim();
    var startNum = parseInt($("#numberStart").val());

    if ($("#cbIndexSubscript").is(":checked") && prefix != "") {
        for (var i = 0; i < states.length; i++) {
            states[i].name = prefix + "_{" + (i + startNum) + "}";
        }
    } else {
        for (var i = 0; i < states.length; i++) {
            states[i].name = prefix + (i + startNum);
        }
    }
}


function listOfConnectedStates(state) { // TODO still needed?
    var allConStates = new Set();
    for (var conStates of state.transitions.values()) {
        for (var conState of conStates) {
            if (conState != state) {
                allConStates.add(conState);
            }
        }
    }

    return allConStates;
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

    this.transitions = new Map();

    this.nextStates = function (symb) { // returns the list of states following after the symbol
        if (this.transitions.has(symb)) {
            return this.transitions.get(symb);
        } else {
            return new Set();
        }
    };

    this.addNextState = function (symb, nextState) { // adds a transition under symb to nextState
        if (typeof(nextState) == "undefined") {
            throw new Error("Cannot add transition to undefined");
        }

        var stateSet = this.transitions.get(symb);
        if (! (this.transitions.has(symb))) {
            stateSet = new Set();
            this.transitions.set(symb, stateSet);
        }

        stateSet.add(nextState);
    };

    this.randomNextState = function(symb) {
        for (var state of this.nextStates(symb)) {
            return state;
        }

        return null; // state set is empty
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
     * factor -> atom ("*")*
     * atom -> alphanum | (regex)
     */

        // PARSER SETUP
    this.origInput = regex.replace(/\s/g, ""); // remove all whitespace
    this.input = rewriteExpression(this.origInput);
    this.simpleInput = this.input.slice(0);

    // compute the alphabet used by this regex
    this.alphabet = new Set();
    for (var i=0; i<this.input.length; i++) {
        if (validSymbol(this.input[i]) && this.input[i] != "$") {
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
        renameStates(nfa);

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
            error("Expected '(' or any alphanumeric character, got '" + next + "'", this.input, this.simpleInput);
        }

        // check if there is a union term following
        next = this.peekInput();
        if (this.hasInput() && next == "|") {
            this.popInput();

            next = this.peekInput();
            if (next != "(" && !validSymbol(next)) {
                error("Expected '(' or any alphanumeric character, got '" + next + "'", this.input, this.simpleInput);
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

        while (this.hasInput() && this.peekInput() == '*') {
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
        var nfa;

        if (next == '(') {
            nfa = this.regex();

            next = this.popInput();
            if (next != ")") {
                error("Expected ')', got '" + next + "'", this.input, this.simpleInput);
            }
        } else if (validSymbol(next)) {
            var _in = new State(this.lastID++);
            var out = new State(this.lastID++);

            next = next === '$'? EPS : next;

            _in.addNextState(next, out);
            nfa = [_in, out];
        } else {
            error("Expected '(' or any alphanumeric character, got '" + next + "'", this.input, this.simpleInput);
        }

        return nfa;
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

    function error(message, currentInput, origInput) {
        var pos = origInput.length - currentInput.length;
        var errorMsg = message;

        errorMsg += "\n" + origInput + "\n";
        for (i = 0; i < origInput.length; i++) {
            errorMsg += i == pos? "^" : " ";
        }

        throw (errorMsg);
    }
}



function cloneAutomaton(aut) {
    var clonedAut = [];

    aut.forEach(function(state) {
        var clonedState = $.extend(true, {}, state);
        clonedAut.push(clonedState);
    });

    return clonedAut;
}

function validSymbol(symb){
    // for now, only allow alphanumeric strings to be accepted TODO necessary?

    if (symb.length > 1) {
        return false; // no strings as symbols
    }

    var code = symb.charCodeAt(0);
    if (!(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 91) && // upper alpha (A-Z)
        !(code > 96 && code < 123) &&  // lower alpha (a-z)
        !(code == 36)) { // dollar sign ($) for the empty word
        return false;
    }
    return true;
}


function rewriteExpression(expr) { // rewrite a regex as a "simple expression" using only "|", "*" and concatenation
    var simplifiedExpr = expr.slice(0);
    var idx, startIdx, len, substr;

    while ((idx=simplifiedExpr.indexOf("?")) > -1) { // rewrite a? => (a|$)
        startIdx = findSubstring();
        len = idx - startIdx;
        substr = simplifiedExpr.substr(startIdx, len);
        simplifiedExpr =
            simplifiedExpr.substr(0, startIdx) +
            "(" + substr + "|$)" +
            simplifiedExpr.substr(startIdx + len + 1);
    }

    while ((idx=simplifiedExpr.indexOf("+")) > -1) { // rewrite a+ => aa*
        startIdx = findSubstring();
        len = idx - startIdx;
        substr = simplifiedExpr.substr(startIdx, len);
        simplifiedExpr =
            simplifiedExpr.substr(0, startIdx) +
            substr + substr + "*" +
            simplifiedExpr.substr(startIdx + len + 1);
    }

    return simplifiedExpr;

    // find the substring of an expression (either single symbol or parenthesis expr ( ... )
    function findSubstring() {
        var parCounter = 0;
        var currentIdx = idx-1;
        if (currentIdx < 0) {
            return idx;
        } else if (simplifiedExpr.charAt(currentIdx) != ")") {
            return currentIdx;
        } else {
            parCounter = 1;
            while (parCounter > 0 && --currentIdx > 0) {
                var nextChar = simplifiedExpr.charAt(currentIdx);

                if (nextChar == "(") {
                    parCounter--;
                } else if (nextChar == ")") {
                    parCounter++;
                }
            }

            return currentIdx;
        }
    }
}