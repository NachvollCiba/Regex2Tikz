import $ from 'jquery';
window.jQuery = $;
window.$ = $;

import { RegexParser, nfa2dfa, minimize } from './automaton.js';
import { CanvasController } from './canvascontrol.js';
import { convertToTikz, generateCode } from './tikzCreation.js';

import 'spectre.css/dist/spectre.min.css';
import 'spectre.css/dist/spectre-icons.min.css';


var ajaxRequests = new Set(); // most recent ajax requests
var elemData = new Map(); // contains additional data for each id

// Initialization
$(function() {
	elemData.set("nfa", {
		initialized: false,
		canvasCntrl: null,
		tikz: "",
		displ: null
	});
	elemData.set("dfa", {
		initialized: false,
		canvasCntrl: null,
		tikz: "",
		displ: null,
	});
	elemData.set("minDfa", {
		initialized: false,
		canvasCntrl: null,
		tikz: "",
		displ: null,
	});

	$("#statePrefix").on("input", function() {
		var prefixEmpty = $("#statePrefix").val().trim() == "";
		$("#cbIndexSubscript").prop("disabled", prefixEmpty);
	});

	$(".error").hide();
	$(".ui-loader").hide();
});

function submit() {
	for (var ajaxRequest of ajaxRequests) {
		ajaxRequest.abort();
	}

	var regex = $("#regex").val();
	try {
		// parse the regex and create the automatons
		var parser = new RegexParser(regex);
		var nfa = parser.parse();
		var dfa = nfa2dfa(nfa, parser.alphabet, $("#generateSink").is(":checked"));
		var minDfa = minimize(dfa);

		var showNfa = $("#showNFA").is(":checked");
		var showDfa = $("#showDFA").is(":checked");

		var nfaDiv = $("#nfa");
		var dfaDiv = $("#dfa");
		var minDfaDiv = $("#minDfa");

		if (showNfa) {
			nfaDiv.show();
			fillResult(nfaDiv, nfa);
		} else {
			nfaDiv.hide();
		}

		if (showDfa) {
			dfaDiv.show();
			fillResult(dfaDiv, dfa);
		} else {
			dfaDiv.hide();
		}

		minDfaDiv.show();
		fillResult(minDfaDiv, minDfa);

		var alpha = []
		parser.alphabet.forEach(function(s) { alpha.push(s) });
		console.log("Original regex: " + parser.origInput);
		console.log("Simplified regex: " + parser.simpleInput);
		console.log("Alphabet of the expression: {" + alpha.sort().join(", ") + "}");
		console.log("Size of the minimal DFA (# of states): " + minDfa.length);
		
		$("#result").show();
		$("#parserError").hide();
	} catch (e) {
		$("#parserError").show().find("p").html("Invalid expression: " + e.message.replace(/ /g, "&nbsp;").replace(/\n/g, "<br/>"));
		console.log(e);
	}
}

function fillResult(elem, automaton) {
	var id = elem.attr("id");
	var data = elemData.get(id);

	if (!data.initialized) {
		if (id != "minDfa") { // create the elements by cloning the min dfa prototype
			var cloned = $("#minDfa").find(".tabs").clone()

			// adjust ids and references
			cloned.find("#tikzNode").empty();
			elem.find(".tabs").replaceWith(cloned);
			elem = cloned;
		}

		// initialize the controller for this automatons canvas
		var canvas = elem.find("canvas");
		data.canvasCntrl = new CanvasController(canvas, automaton, elem.find("#canvasControl"));

		// bind the function for the render button
		var renderBtn = elem.find("#btnRender");
		var tikzDispl = elem.find(".tikzCode");
		data.displ = tikzDispl;

		tikzDispl.focus(function() { $(this).select(); });
		tikzDispl.click(function() { $(this).select(); });

		var renderImg = elem.find("img");
		data.initialized = true;
	} else {
		// simply find the (existing) elements
		tikzDispl = data.displ;
		renderImg = elem.find("img");
		renderBtn = elem.find("#btnRender");
	}

	// populate the element contents
	var tikzCode = convertToTikz(automaton);
	tikzDispl.text(tikzCode);
	data.tikz = tikzCode;
	fetchLatexRenderedPng(data.tikz, renderImg, renderBtn, elem.find(".error"));

	// update the canvas
	var cntrl = data.canvasCntrl;
	cntrl.loadAutomaton(automaton);
	cntrl.changelistener = function() {
		tikzCode = generateCode(automaton);
		tikzDispl.text(tikzCode);
		data.tikz = tikzCode;
	};

	cntrl.drawAutomaton();
}


function fetchLatexRenderedPng(tikz, img, button, errorDiv) {
	button.prop("disabled", true);
	img.attr("src", "img/loading.gif").attr("width", "128").show();
	errorDiv.hide();

	var ajaxRequest = $.ajax({
		url: encodeURI("render.php"),
		type: "POST",
		data: "tikz=" + tikz,
		mimeType: "text/plain; charset=x-user-defined",
		success: function(responseJSON) {
			// parse response
			var response = JSON.parse(responseJSON);
			var width = Math.min(.9 * $("#result").width(), response["width"]);

			// adjust DOM elements
			button.prop("disabled", false);
			if (response["status"] == "success") {
				img.attr("src", response["url"]).attr("width", width);
			} else {
				img.attr("src", "").hide();
				errorDiv.show().find("p").html("Error fetching png<br/>" + response["message"]);
			}

			ajaxRequests.delete(ajaxRequest);
		},
		error: function(jqXHR, textStatus, errorThrown) {
			img.attr("src", "").hide();
			button.prop("disabled", false);
			errorDiv.show().find("p").text("Error connecting to server (" + textStatus + ")");
			console.log(errorThrown);
			ajaxRequests.delete(ajaxRequest);
		}
	});

	ajaxRequests.add(ajaxRequest);
}


window.submit = submit;
