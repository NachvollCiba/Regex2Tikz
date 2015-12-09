/**
 * Created by dennis on 06/12/15.
 */


const ZOOM_STEP = 1;
const ZOOM_MAX = 100;
const STATE_RAD = .5;

function CanvasController(canvas, automaton, controlElem) {
    // class member
    this.canvas = canvas;
    this.automaton = automaton;
    this.control = controlElem;
    this.camera = {zoom:40, x:this.canvas[0].width/2, y:this.canvas[0].height/2};
    this.changelistener = null;

    // class methods
    this.drawAutomaton = function() {
        var ctx = this.canvas[0].getContext("2d");
        ctx.clearRect(0, 0, this.canvas[0].width, this.canvas[0].height);

        var fontsize = .5 * this.camera.zoom;
        ctx.font = fontsize + "px Arial";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";

        var realRad = STATE_RAD * this.camera.zoom;

        for (var i = 0; i < this.automaton.length; i++) {
            var state = this.automaton[i];
            var posX =  state.position[0] * this.camera.zoom + this.camera.x;
            var posY = -state.position[1] * this.camera.zoom + this.camera.y;

            ctx.beginPath();
            ctx.arc(posX, posY, realRad, 0, 2 * Math.PI);
            ctx.stroke();

            ctx.fillText(state.name, posX, posY);

            for (var symb in state.transitions) {
                var nextStates = state.transitions[symb];

                for (var j = 0; j < nextStates.length; j++) {
                    var otherX =  nextStates[j].position[0] * this.camera.zoom + this.camera.x;
                    var otherY = -nextStates[j].position[1] * this.camera.zoom + this.camera.y;

                    var dir = unitVector(vecDifference(nextStates[j].position, state.position));

                    var startX = posX + realRad * dir[0]; var startY = posY - realRad * dir[1];
                    var endX = otherX - realRad * dir[0]; var endY = otherY + realRad * dir[1];

                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();

                    var midX = (posX + (otherX - posX) / 2);
                    var midY = (posY + (otherY - posY) / 2);
                    ctx.moveTo(midX, midY);
                    //symb = symb == EPS ? "€" : symb;
                    //ctx.fillText(symb, midX, midY);
                }
            }
        }
    };

    this.zoomIn = function(amount) {
        this.camera.zoom += amount;
        this.camera.zoom = Math.min(this.camera.zoom, ZOOM_MAX);
        this.drawAutomaton();
    };

    this.zoomOut = function(amount) {
        this.camera.zoom -= amount;
        this.camera.zoom = Math.max(this.camera.zoom, 0);
        this.drawAutomaton();
    };


    // listener
    var cntrl = this;
    var selected = null;
    var lastMouse = {x:-1, y:-1};

    this.canvasMouseUp = function(event) {
        event.preventDefault();

        if ((selected instanceof State) && cntrl.changelistener != null) {
            cntrl.changelistener(selected);
        }

        selected = null;
    };

    this.canvasMouseDown = function(event) {
        event.preventDefault();

        // convert from screen to "world" coordinates
        var mouseX = (event.offsetX - cntrl.camera.x) / cntrl.camera.zoom;
        var mouseY = -(event.offsetY - cntrl.camera.y) / cntrl.camera.zoom;

        lastMouse.x = event.offsetX; lastMouse.y = event.offsetY;

        selected = {};
        for (var i = 0; i < cntrl.automaton.length; i++) {
            var state = cntrl.automaton[i];

            // test if clicked on one of the states
            if (euclideanDistance(state.position, [mouseX, mouseY]) < STATE_RAD) {
                selected = state;
                break;
            }
        }
    };

    this.canvasMouseMove = function(event) {
        event.preventDefault();

        if (selected != null) {
            // compute the moved mouse offset
            var deltaX = event.offsetX - lastMouse.x;
            var deltaY = event.offsetY - lastMouse.y;

            if (selected instanceof State) { // translate the selected state
                selected.position[0] += deltaX / cntrl.camera.zoom;
                selected.position[1] -= deltaY / cntrl.camera.zoom;

                // TODO live editing of the tikz code
            } else { // move the camera
                cntrl.camera.x += deltaX;
                cntrl.camera.y += deltaY;
            }

            cntrl.drawAutomaton();

            lastMouse.x = event.offsetX;
            lastMouse.y = event.offsetY;
        }
    };

    this.canvasMouseWheel = function(event) {
        if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
            cntrl.zoomIn(ZOOM_STEP);
        }
        else {
            cntrl.zoomOut(ZOOM_STEP)
        }
    };

    this.canvasMouseEnter = function(event) {
        $("body").addClass("noscroll");
    };

    this.canvasMouseExit = function(event) {
        $("body").removeClass("noscroll");
    };

    // register the listeners
    this.canvas.mouseup(this.canvasMouseUp);
    this.canvas.mousedown(this.canvasMouseDown);
    this.canvas.mousemove(this.canvasMouseMove);
    this.canvas.mouseenter(this.canvasMouseEnter);
    this.canvas.mouseleave(this.canvasMouseExit);
    this.canvas.bind('mousewheel DOMMouseScroll', this.canvasMouseWheel);

    // register listeners for the control panel
    this.control.find("#btnZoomIn").click(function(event) {
        cntrl.zoomIn(3*ZOOM_STEP);
    });

    this.control.find("#btnZoomOut").click(function(event) {
        cntrl.zoomOut(3*ZOOM_STEP);
    });

}
