/**
 * Created by dennis on 06/12/15.
 */


const ZOOM_STEP = 1;
const ZOOM_MAX = 100;
const STATE_RAD = .5;
const SNAP_RAD = .25;

function CanvasController(canvas, automaton, controlElem) {
    // class member
    this.canvas = canvas;
    this.automaton = automaton;
    this.control = controlElem;
    this.camera = {zoom:40, x:this.canvas[0].width/2, y:this.canvas[0].height/2};
    this.changelistener = null;
    this.spatial = {xMap: new Map(), yMap: new Map()};
    this.moving = null;
    this.xAligned = null;
    this.yAligned = null;
    this.showGrid = false;

    // class methods

    this.initialize = function() {
        // build the spatial data structure
        this.buildSpatial();
    };

    this.drawAutomaton = function() {
        var ctx = this.canvas[0].getContext("2d");
        ctx.clearRect(0, 0, this.canvas[0].width, this.canvas[0].height);

        if (this.showGrid) {
            this.drawGrid(ctx);
        }

        var fontsize = .5 * this.camera.zoom;
        ctx.font = fontsize + "px Arial";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";

        var realRad = STATE_RAD * this.camera.zoom;

        for (var i = 0; i < this.automaton.length; i++) {
            var state = this.automaton[i];
            var posX =  state.position[0] * this.camera.zoom + this.camera.x;
            var posY = -state.position[1] * this.camera.zoom + this.camera.y;


            if (state == this.moving) {
                ctx.beginPath();
                ctx.arc(posX, posY, realRad, 0, 2 * Math.PI);
                ctx.fillStyle = "#e5ecff";
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = "#000000";

                if (this.xAligned != null) {
                    var otherX =  this.xAligned.position[0] * this.camera.zoom + this.camera.x;
                    var otherY = -this.xAligned.position[1] * this.camera.zoom + this.camera.y;

                    ctx.beginPath();
                    ctx.strokeStyle = "#A52A2A";
                    ctx.moveTo(posX, posY);
                    ctx.lineTo(otherX, otherY);
                    ctx.stroke();
                    ctx.strokeStyle = "#000000";
                }

                if (this.yAligned != null) {
                    var otherX =  this.yAligned.position[0] * this.camera.zoom + this.camera.x;
                    var otherY = -this.yAligned.position[1] * this.camera.zoom + this.camera.y;

                    ctx.beginPath();
                    ctx.strokeStyle = "#A52A2A";
                    ctx.moveTo(posX, posY);
                    ctx.lineTo(otherX, otherY);
                    ctx.stroke();
                    ctx.strokeStyle = "#000000";
                }

            } else {
                ctx.beginPath();
                ctx.arc(posX, posY, realRad, 0, 2 * Math.PI);
                ctx.fillStyle = "#f2f2f2";
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = "#000000";
            }

            ctx.fillText(toInternalID(state.name), posX, posY);

            for (var symb in state.transitions) {
                var nextStates = state.transitions[symb];

                for (var j = 0; j < nextStates.length; j++) {
                    var otherX =  nextStates[j].position[0] * this.camera.zoom + this.camera.x;
                    var otherY = -nextStates[j].position[1] * this.camera.zoom + this.camera.y;

                    var dir = unitVector(vecDifference(nextStates[j].position, state.position));

                    var startX = posX + realRad * dir[0]; var startY = posY - realRad * dir[1];
                    var endX = otherX - realRad * dir[0]; var endY = otherY + realRad * dir[1];

                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();

                    //var midX = (posX + (otherX - posX) / 2);
                    //var midY = (posY + (otherY - posY) / 2);
                    //ctx.moveTo(midX, midY);
                    //symb = symb == EPS ? "€" : symb;
                    //ctx.fillText(symb, midX, midY);
                }
            }
        }
    };

    this.drawGrid = function(ctx) {
        var width = this.canvas[0].width; var height = this.canvas[0].height;
        var stepSize = 2* SNAP_RAD * this.camera.zoom;



        var startX = this.camera.x - Math.floor(this.camera.x / (stepSize)) * stepSize;
        var startY = this.camera.y - Math.floor(this.camera.y / (stepSize)) * stepSize;
        console.log(startX);

        // draw major lines
        ctx.beginPath();
        ctx.strokeStyle = "#000000";

        for (var x = startX; x <= width; x+= stepSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }

        for (var y = startY; y <= height; y+= stepSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }

        ctx.stroke();

        // draw minor lines
        ctx.beginPath();
        ctx.strokeStyle = "#bfbfbf";

        for (x = startX - stepSize / 2; x <= width; x+= stepSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }

        for (y = startY - stepSize / 2; y <= height; y+= stepSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }

        ctx.stroke();
        ctx.strokeStyle = "#000000";
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


    this.spatialIndex = function(state) {
        var s = SNAP_RAD;

        var x1 = 2 * Math.floor(state.position[0] / (2*s));
        var x2 = 2 * Math.floor((state.position[0] + s) / (2*s)) - 1;

        var y1 = 2 * Math.floor(state.position[1] / (2*s));
        var y2 = 2 * Math.floor((state.position[1] + s) / (2*s)) - 1;

        return {x: [x1, x2], y: [y1, y2]};
    };

    this.addToSpatial = function(state, map, idx) {
        if (!map.has(idx)) {
            map.set(idx, new Set());
        }
        map.get(idx).add(state);

    };

    this.updateStateSpatial = function(state) {
        var spatialIdx = this.spatialIndex(state);
        var changed = false;

        if (state.spatial == null) {
            state.spatial = spatialIdx;
            this.addToSpatial(state, this.spatial.xMap, spatialIdx.x[0]);
            this.addToSpatial(state, this.spatial.xMap, spatialIdx.x[1]);

            this.addToSpatial(state, this.spatial.yMap, spatialIdx.y[0]);
            this.addToSpatial(state, this.spatial.yMap, spatialIdx.y[1]);

            changed = true;
        } else {
            if (spatialIdx.x[0] != state.spatial.x[0]) {
                this.spatial.xMap.get(state.spatial.x[0]).delete(state);
                this.addToSpatial(state, this.spatial.xMap, spatialIdx.x[0]);
                changed = true;
            }
            if (spatialIdx.x[1] != state.spatial.x[1]) {
                this.spatial.xMap.get(state.spatial.x[1]).delete(state);
                this.addToSpatial(state, this.spatial.xMap, spatialIdx.x[1]);
                changed = true;
            }
            if (spatialIdx.y[0] != state.spatial.y[0]) {
                this.spatial.yMap.get(state.spatial.y[0]).delete(state);
                this.addToSpatial(state, this.spatial.yMap, spatialIdx.y[0]);
                changed = true;
            }
            if (spatialIdx.y[1] != state.spatial.y[1]) {
                this.spatial.yMap.get(state.spatial.y[1]).delete(state);
                this.addToSpatial(state, this.spatial.yMap, spatialIdx.y[1]);
                changed = true;
            }
        }

        state.spatial = spatialIdx;
        return changed;
    };

    this.findMinDisStateSameCol = function(state) {
        var x1 = state.spatial.x[0]; var x2 = state.spatial.x[1];
        var minDis = Infinity;
        var minState = null;

        this.spatial.xMap.get(x1).forEach(function(other) {
            if (other != state) {
                var dis = Math.abs(state.position[1] - other.position[1]);

                if (dis < minDis) {
                    minDis = dis;
                    minState = other;
                }
            }
        });

        this.spatial.xMap.get(x2).forEach(function(other) {
            if (other != state) {
                var dis = Math.abs(state.position[1] - other.position[1]);

                if (dis < minDis) {
                    minDis = dis;
                    minState = other;
                }
            }
        });

        return minState;
    };

    this.findMinDisStateSameRow = function(state) {
        var y1 = state.spatial.y[0]; var y2 = state.spatial.y[1];
        var minDis = Infinity;
        var minState = null;

        this.spatial.yMap.get(y1).forEach(function(other) {
            if (other != state) {
                var dis = Math.abs(state.position[0] - other.position[0]);

                if (dis < minDis) {
                    minDis = dis;
                    minState = other;
                }
            }
        });

        this.spatial.yMap.get(y2).forEach(function(other) {
            if (other != state) {
                var dis = Math.abs(state.position[0] - other.position[0]);

                if (dis < minDis) {
                    minDis = dis;
                    minState = other;
                }
            }
        });

        return minState;
    };

    this.buildSpatial = function() {
        for (var i = 0; i < this.automaton.length; i++) {
            this.updateStateSpatial(this.automaton[i]);
        }
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

        cntrl.moving = null;
        cntrl.xAligned = null;
        cntrl.yAligned = null;

        selected = null;
        cntrl.drawAutomaton();
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

    var locked = {x: false, y:false};
    var accDelta = {x:0, y:0};
    this.canvasMouseMove = function(event) {
        event.preventDefault();

        if (selected != null) {
            // compute the moved mouse offset
            var deltaX = event.offsetX - lastMouse.x;
            var deltaY = event.offsetY - lastMouse.y;

            if (selected instanceof State) {
                cntrl.moving = selected;

                // translate the selected state
                var movX = deltaX / cntrl.camera.zoom;
                var movY = deltaY / cntrl.camera.zoom;

                if (locked.x) {
                    accDelta.x += movX;
                    console.log(locked);
                    console.log(accDelta);
                    if (Math.abs(accDelta.x) > SNAP_RAD) {
                        console.log(selected.position);
                        selected.position[0] += accDelta.x;
                        console.log(selected.position);
                        accDelta.x = 0;
                    }
                } else {
                    selected.position[0] += movX;
                }

                if (locked.y) {
                    accDelta.y += movY;
                    if (Math.abs(accDelta.y) > SNAP_RAD) {
                        selected.position[1] += accDelta.y;
                        accDelta.y = 0;
                    } else {
                        selected.position[1] += movY;
                    }
                }

                // update aligned states
                if (cntrl.updateStateSpatial(selected)) {
                    cntrl.xAligned = cntrl.findMinDisStateSameRow(selected);
                    cntrl.yAligned = cntrl.findMinDisStateSameCol(selected);

                    if (cntrl.xAligned != null) {
                        selected.position[1] = cntrl.xAligned.position[1];
                    }

                    if (cntrl.yAligned != null) {
                        selected.position[0] = cntrl.yAligned.position[0];
                    }

                    locked = {x: cntrl.yAligned != null, y: cntrl.xAligned != null};
                }

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

    this.control.find("#cbGrid").click(function(event) {
        cntrl.showGrid = cntrl.control.find("#cbGrid").is(":checked");
        cntrl.drawAutomaton();
    });
}
