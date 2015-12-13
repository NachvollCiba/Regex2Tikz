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
    this.spatial = null;
    this.moving = null;
    this.xAligned = null;
    this.yAligned = null;
    this.showGrid = false;
    this.snap = false;


    this.loadAutomaton = function(aut) {
        this.automaton = aut;
        this.buildSpatial();

        this.snap = this.control.find("#slSnap").val();
        this.showGrid = this.control.find("#cbGrid").is(":checked");
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

        for (var i = 0; i < this.automaton.length; i++) {
            var state = this.automaton[i];

            this.drawTransitions(ctx, state);

            this.drawAlignment(ctx, state);
            this.drawState(ctx, state);
        }
    };

    this.drawGrid = function(ctx) {
        var width = this.canvas[0].width; var height = this.canvas[0].height;
        var stepSize = 2* SNAP_RAD * this.camera.zoom;

        var startX = this.camera.x - Math.floor(this.camera.x / (stepSize)) * stepSize;
        var startY = this.camera.y - Math.floor(this.camera.y / (stepSize)) * stepSize;

        // draw major lines
        ctx.beginPath();
        ctx.lineWidth = 1;
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
    };

    this.drawState = function(ctx, state) {
        var realRad = STATE_RAD * this.camera.zoom;
        var posX =  state.position[0] * this.camera.zoom + this.camera.x;
        var posY = -state.position[1] * this.camera.zoom + this.camera.y;

        ctx.strokeStyle = "#000000";
        if (state == this.moving) {
            ctx.fillStyle = "#e5ecff";
            ctx.lineWidth = 1;
        } else {
            ctx.fillStyle = "#f2f2f2";
            ctx.lineWidth = 1;
        }

        ctx.beginPath();
        ctx.arc(posX, posY, realRad, 0, 2 * Math.PI);

        if (state.isFinal) {
            ctx.arc(posX, posY, Math.max(realRad - 3,0), 0, 2 * Math.PI);
        }

        ctx.fill();

        if (state.isStart) {
            ctx.moveTo(posX - 2*realRad, posY);
            ctx.lineTo(posX - realRad, posY);
        }

        ctx.stroke();

        ctx.fillStyle = "#000000";
        ctx.fillText(toInternalID(state.name), posX, posY);
    };

    this.drawTransitions = function(ctx, state) {
        var realRad = STATE_RAD * this.camera.zoom;
        var posX =  state.position[0] * this.camera.zoom + this.camera.x;
        var posY = -state.position[1] * this.camera.zoom + this.camera.y;

        ctx.beginPath();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;

        // draw transition lines
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

                //var midX = (posX + (otherX - posX) / 2);
                //var midY = (posY + (otherY - posY) / 2);
                //ctx.moveTo(midX, midY);
                //symb = symb == EPS ? "€" : symb;
                //ctx.fillText(symb, midX, midY);
            }
        }

        ctx.stroke();
    };

    this.drawAlignment = function(ctx) {
        if (this.moving == null) {
            return; // no alignment to draw
        }

        var posX =  this.moving.position[0] * this.camera.zoom + this.camera.x;
        var posY = -this.moving.position[1] * this.camera.zoom + this.camera.y;

        // draw lines to aligned states
        if (this.xAligned != null) {
            var otherX =  this.xAligned.position[0] * this.camera.zoom + this.camera.x;
            var otherY = -this.xAligned.position[1] * this.camera.zoom + this.camera.y;

            ctx.beginPath();
            ctx.lineWidth = 3;
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
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#A52A2A";
            ctx.moveTo(posX, posY);
            ctx.lineTo(otherX, otherY);
            ctx.stroke();
            ctx.strokeStyle = "#000000";
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

    // center both automaton and camera around 0,0
    this.center = function() {
        // center camera
        this.camera.x = this.canvas[0].width / 2;
        this.camera.y = this.canvas[0].height / 2;

        // center states
        var offsetX = 0; var offsetY = 0;
        this.automaton.forEach(function(state) {
            offsetX += state.position[0];
            offsetY += state.position[1];
        });

        offsetX /= this.automaton.length;
        offsetY /= this.automaton.length;
        var that = this;
        this.automaton.forEach(function(state) {
            state.position[0] -= offsetX;
            state.position[1] -= offsetY;
            that.updateStateSpatial(state);
        });

        this.drawAutomaton();
        cntrl.changelistener(selected);
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
                    minDis = dis;automaton =
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
        this.spatial = {xMap: new Map(), yMap: new Map()};

        for (var i = 0; i < this.automaton.length; i++) {
            this.updateStateSpatial(this.automaton[i]);
        }
    };

    // listener
    var cntrl = this;
    var selected = null;
    var lastMouse = {x:-1, y:-1};
    var locked = {x: false, y:false};
    var accDelta = {x:0, y:0};

    function reset() {
        if ((selected instanceof State) && cntrl.changelistener != null) {
            cntrl.changelistener(selected);
        }

        selected = null;

        cntrl.moving = null;
        cntrl.xAligned = null;
        cntrl.yAligned = null;

        locked.x = false; locked.y = false;
        accDelta.x = 0; accDelta.y = 0;

        cntrl.drawAutomaton();
    }

    this.canvasMouseUp = function(event) {
        event.preventDefault();
        reset();
    };

    function findAligned(state) {
        cntrl.xAligned = cntrl.findMinDisStateSameRow(state);
        cntrl.yAligned = cntrl.findMinDisStateSameCol(state);
    }

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
                selected.canvasPos = [selected.position[0], selected.position[1]];
                findAligned(state);
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

            if (selected instanceof State) {
                cntrl.moving = selected;

                // translate the selected state
                var movX = deltaX / cntrl.camera.zoom;
                var movY = deltaY / cntrl.camera.zoom;

                selected.canvasPos[0] += movX;
                selected.canvasPos[1] -= movY;

                if (cntrl.snap == "neighbour") {
                    if (locked.x) {
                        var distX = Math.abs(selected.canvasPos[0] - selected.position[0]);
                        if (distX > 2 * SNAP_RAD) {
                            selected.position[0] = selected.canvasPos[0];
                        }
                    } else {
                        selected.position[0] = selected.canvasPos[0];
                    }

                    if (locked.y) {
                        var distY = Math.abs(selected.canvasPos[1] - selected.position[1]);
                        if (distY > 2 * SNAP_RAD) {
                            selected.position[1] = selected.canvasPos[1];
                        }
                    } else {
                        selected.position[1] = selected.canvasPos[1];
                    }
                } else if (cntrl.snap == "grid") {
                    selected.position[0] = Math.round(selected.canvasPos[0] / SNAP_RAD) * SNAP_RAD;
                    selected.position[1] = Math.round(selected.canvasPos[1] / SNAP_RAD) * SNAP_RAD;
                } else if (cntrl.snap == "none") {
                    selected.position[0] = selected.canvasPos[0];
                    selected.position[1] = selected.canvasPos[1];
                }

                // update aligned states
                if (cntrl.updateStateSpatial(selected)) {
                    findAligned(selected);

                    if (cntrl.snap == "neighbour") {
                        if (cntrl.xAligned != null) {
                            selected.position[1] = cntrl.xAligned.position[1];
                            cntrl.updateStateSpatial(selected);
                        }

                        if (cntrl.yAligned != null) {
                            selected.position[0] = cntrl.yAligned.position[0];
                            cntrl.updateStateSpatial(selected);
                        }

                        locked = {x: cntrl.yAligned != null, y: cntrl.xAligned != null};
                    }
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
        event.preventDefault();

        if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
            cntrl.zoomIn(ZOOM_STEP);
        }
        else {
            cntrl.zoomOut(ZOOM_STEP)
        }
    };

    this.canvasMouseExit = function(event) {
        reset();
    };

    // register the listeners
    this.canvas.mouseup(this.canvasMouseUp);
    this.canvas.mousedown(this.canvasMouseDown);
    this.canvas.mousemove(this.canvasMouseMove);
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

    this.control.find("#btnCenter").click(function(event) {
        cntrl.center();
    });

    this.control.find("#slSnap").click(function(event){
        cntrl.snap = this.value;
        cntrl.drawAutomaton();
    });
}
