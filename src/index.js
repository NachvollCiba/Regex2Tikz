import $ from 'jquery';
window.jQuery = $;
window.$ = $;

import 'bootstrap';

import CodeMirror from 'codemirror/lib/codemirror.js';
import 'codemirror/lib/codemirror.css';

import { RegexParser, nfa2dfa, minimize } from './automaton.js';
import { CanvasController } from './canvascontrol.js';
import { convertToTikz } from './tikzCreation.js';



var ajaxRequests = new Set(); // most recent ajax requests
var elemData = new Map(); // contains additional data for each id

// Initialization
$(function() {
	$('[data-toggle="tooltip"]').tooltip();

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
			$("#nfaDiv").show();
			fillResult(nfaDiv, nfa);
		} else {
			$("#nfaDiv").hide();
		}

		if (showDfa) {
			$("#dfaDiv").show();
			fillResult(dfaDiv, dfa);
		} else {
			$("#dfaDiv").hide();
		}

		fillResult(minDfaDiv, minDfa);
		console.log("result filled");

		if (showNfa || showDfa) {
			collapse(minDfaDiv, "hide");
			collapse(dfaDiv, "hide");
			collapse(nfaDiv, "hide");
		}

		// fill the statistics div
		var alpha = []
		parser.alphabet.forEach(function(s) { alpha.push(s) });
		
		$("#parserError").hide();
		$("#statistics").show();
		$("#alphaDisplay").text("{" + alpha.sort() + "}");
		$("#simpleRegexDisplay").text(parser.simpleInput);
		$("#origRegexDisplay").text(parser.origInput);
		$("#autSizeDisplay").text(minDfa.length);
	} catch (e) {
		$("#parserError").show().find("p").html(e.message.replace(/ /g, "&nbsp;").replace(/\n/g, "<br/>"));
	}
}

function fillResult(elem, automaton) {
	var id = elem.attr("id");
	var data = elemData.get(id);

	if (!data.initialized) {
		if (id != "minDfa") { // create the elements by cloning the min dfa prototype
			var cloned = $("#minDfa").clone().attr("id", id);

			// adjust ids and references
			cloned.find("#tikz_minDfa").attr("id", "tikz_"+id);
			cloned.find("#tikztab_minDfa").attr("id", "tikztab_"+id).attr("href", "#tikz_"+id);
			cloned.find("#latex_minDfa").attr("id", "latex_"+id);
			cloned.find("#latextab_minDfa").attr("id", "latextab_"+id).attr("href", "#latex_"+id);
			cloned.find("#structure_minDfa").attr("id", "structure_"+id);
			cloned.find("#structuretab_minDfa").attr("id", "structuretab_"+id).attr("href", "#structure_"+id);
			cloned.find("#tikzNode").empty();

			elem.replaceWith(cloned);
			elem = cloned;
		}

		// initialize the controller for this automatons canvas
		var canvas = elem.find("canvas");
		data.canvasCntrl = new CanvasController(canvas, automaton, elem.find(".canvasControll"));

		// bind the function for the render button
		var renderBtn = elem.find("#btnRender");
		var tikzDispl = CodeMirror(elem.find("#tikzNode")[0], {
			readOnly: true,
			lineNumbers: true,
		});

		tikzDispl.on("focus", function() {
			tikzDispl.execCommand("selectAll");
		});
		tikzDispl.on("blur", function() {
			tikzDispl.setCursor({line:0,ch:0}); // clear selection
		});
		data.displ = tikzDispl;

		var renderImg = elem.find("img");
		renderBtn.click(function() {
			fetchLatexRenderedPng(data.tikz, renderImg, renderBtn, elem.find(".error"));
		});

		elem.find("#btnClipboard").click(function() {
			tikzDispl.focus();
			document.execCommand("copy");
			this.focus();
		});

		elem.find("#tikztab_"+id).on("shown.bs.tab", function(e) {
			data.displ.refresh();
		});

		data.initialized = true;
	} else {
		// simply find the (existing) elements
		tikzDispl = data.displ;
		renderImg = elem.find("img");
		renderBtn = elem.find("#btnRender");
	}

	// populate the element contents
	tikzDispl.setValue(convertToTikz(automaton));
	data.tikz = tikzDispl.getValue();
	fetchLatexRenderedPng(data.tikz, renderImg, renderBtn, elem.find(".error"));

	// update the canvas
	var cntrl = data.canvasCntrl;
	cntrl.loadAutomaton(automaton);
	cntrl.changelistener = function() {
		tikzDispl.setValue(generateCode(automaton));
		data.tikz = tikzDispl.getValue();
	};

	console.log("draw");
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
		error: function() {
			img.attr("src", "").hide();
			button.prop("disabled", false);
			errorDiv.show().find("p").html("Error connecting to server");
			ajaxRequests.delete(ajaxRequest);
		}
	});

	ajaxRequests.add(ajaxRequest);
}

function toggleOptions() {
	var wrapper = $("#optionsWrapper").collapse("toggle");
	
	if (wrapper.attr("aria-expanded") == "true") {
		$("#optionsShowHide").text("[-] Hide options");
	} else {
		$("#optionsShowHide").text("[+] Show options");
	}
}

function collapse(elem, how) {
	switch (how) {
		case "toggle":
			if (elem.is(":visible")) {
				elem.hide();
				elem.parent().find("h2").text(elem.parent().find("h2").text().replace(/▲/, "▼"));
			} else {
				elem.show();
				elem.parent().find("h2").text(elem.parent().find("h2").text().replace(/▼/, "▲"));
				window.scroll(0, elem.offset().top);
				elemData.get(elem.attr("id")).displ.refresh();
			}
			break;
		case "show":
			elem.show();
			elem.parent().find("h2").text(elem.parent().find("h2").text().replace(/▼/, "▲"));
			window.scroll(0, elem.offset().top);
			elemData.get(elem.attr("id")).displ.refresh();
			break;
		case "hide":
			elem.hide();
			elem.parent().find("h2").text(elem.parent().find("h2").text().replace(/▲/, "▼"));
			break;
	}
}

window.submit = submit;
window.toggleOptions = toggleOptions;
