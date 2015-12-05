<?php
/**
 * Created by PhpStorm.
 * User: dennis
 * Date: 05/11/15
 * Time: 22:03
 */


// Simplified encoding of LaTeX code pieces for transmission to server
// taken from https://github.com/wp-plugins/wp-quicklatex/blob/master/wp-quicklatex.php
function quicklatex_encode($string) {
    $string = str_replace(
        array("%", "&"),
        array("%25", "%26"),
//        array("\\", "\\\\"),
        $string
    );
    return $string;
}

function get_quicklatex_img_url($tikz) {

    $service_url = "http://www.quicklatex.com/latex3.f";

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


        // parse the response
        if (preg_match("/^([-]?\d+)\r\n(\S+)\s([-]?\d+)\s(\d+)\s(\d+)\r?\n?([\s\S]*)/",
                       $server_resp, $regs)) {

            $status = $regs[1];
            $image_url = $regs[2];
//            $image_align = $regs[3];
            $image_width = $regs[4];
            $image_height = $regs[5];
//            $error_msg = $regs[6];


            if ($status == 0) { // no errors
                return json_encode(array("url" => $image_url, "width" => $image_width, "height" => $image_height));
            } else {
                return json_encode(array("url" => "error.png", "width" => 256, "height" => 256));
            }

        } else {
            return json_encode(array("url" => "error.png", "width" => 256, "height" => 256));
        }
    }
}

// return the url of the rendered latex image
echo get_quicklatex_img_url($_POST["tikz"]);


// test function
function test() {
    $tikz = "\\usetikzlibrary{automata, positioning}
\\begin{tikzpicture}
\\node[state,initial] (0) at (0,0) {0};
\\node[state] (1) at (2,0) {1};
\\node[state] (2) at (4,0) {2};
\\node[state] (3) at (6,0) {3};
\\node[state] (4) at (8,0) {4};
\\node[state,accepting] (5) at (10,0) {5};

\\path[->]
(0) edge node [above] {\$a\$} (1)
(1) edge node [above] {\$\\varepsilon\$} (2)
(2) edge node [above] {\$b\$} (3)
(3) edge node [above] {\$\\varepsilon\$} (4)
(4) edge node [above] {\$c\$} (5)
;
\\end{tikzpicture}";
    echo get_quicklatex_img_url($tikz);
}

//test();
