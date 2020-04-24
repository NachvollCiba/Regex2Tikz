<?php

// Simplified encoding of LaTeX code pieces for transmission to server
// taken from https://github.com/wp-plugins/wp-quicklatex/blob/master/wp-quicklatex.php
function quicklatex_encode($string) {
	$string = str_replace(
		array("%", "&"),
		array("%25", "%26"),
//		  array("\\", "\\\\"),
		$string
	);
	return $string;
}

function get_quicklatex_img_url($tikz) {

	$service_url = "https://www.quicklatex.com/latex3.f";

	// request parameters
	$fontsize = "17px";
	$formula = quicklatex_encode($tikz);
	$textcolor = "000000";
	$latexmode = "0";
	$preamble = quicklatex_encode("\\usepackage{tikz}");


	if ($formula !== "") {
		// build the body of the POST request
		$body = "formula=" . $formula;
		$body .= "&fsize=" . $fontsize;
		$body .= "&fcolor=" . $textcolor;
		$body .= "&mode=" . $latexmode;
		$body .= "&out=1&remhost=quicklatex.com";
		$body .= "&preamble=" . $preamble;
		$body .= "&errors=1";
		$body .= "&rand=" . rand(0, 100);


		// send the POST request via cUrl
		$ch = curl_init();


		curl_setopt($ch, CURLOPT_URL, $service_url);
		curl_setopt($ch, CURLOPT_POST, 1);
		curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		$server_resp = curl_exec($ch);
		curl_close($ch);

		if (!$server_resp) {
			return json_encode(array(
								   "status" => "error",
								   "message" => "Could not connect to <a href=http://www.quicklatex.com>quicklatex.com</a>"));

		}

		// parse the response
		if (preg_match("/^([-]?\d+)\r\n(\S+)\s([-]?\d+)\s(\d+)\s(\d+)\r?\n?([\s\S]*)/",
					   $server_resp, $regs)) {

			$status = $regs[1];
			$image_url = $regs[2];
//			  $image_align = $regs[3];
			$image_width = $regs[4];
			$image_height = $regs[5];
//			  $error_msg = $regs[6];


			if ($status == 0) { // no errors
				return json_encode(array("status" => "success",
									   "url" => $image_url,
									   "width" => $image_width,
									   "height" => $image_height));
			} else {
				return json_encode(array(
									   "status" => "error",
									   "message" => "LaTeX-code could not be compiled (automaton too large?)"));
			}
		} else {
			return json_encode(array(
				"status" => "error",
				"message" => "Unexpected response from quicklatex",
				"response" => $server_resp,
			));
		}
	}


	return json_encode(array(
						   "status" => "error",
						   "message" => "Encountered an unspecified error",
						   "input" => $tikz,
						   "formula" => $formula));
}

// return the url of the rendered latex image
echo get_quicklatex_img_url($_POST["tikz"]);

