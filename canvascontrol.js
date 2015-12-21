/**
 * Created by dennis on 06/12/15.
 */


const ZOOM_STEP = 2;
const ZOOM_MAX = 100;
const STATE_RAD = .5;
const SNAP_RAD = .25;
const LBL_OFFSET = .15;

function CanvasController(canvas, automaton, controlElem) {
    this.changelistener = null;

    var canvas = canvas;
    var automaton = automaton;
    var control = controlElem;
    var camera = {zoom:40, x:canvas[0].width/2, y:canvas[0].height/2};
    var spatial = null;

    var moving = null;
    var xAligned = null;
    var yAligned = null;
    var showGrid = false;
    var snap = false;
    var that = this;

    this.loadAutomaton = function(aut) {
        automaton = aut;
        this.buildSpatial();

        snap = control.find("#slSnap").val();
        showGrid = control.find("#cbGrid").is(":checked");
    };

    this.drawAutomaton = function() {
        var ctx = canvas[0].getContext("2d");
        //ctx.clearRect(0, 0, canvas[0].width, canvas[0].height);
        canvas[0].width = canvas[0].width;

        if (showGrid) {
            this.drawGrid(ctx);
        }

        var fontsize = Math.round(.5 * camera.zoom);
        ctx.font = fontsize + "px Arial";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";

        this.drawStates(ctx);
        this.drawTransitions(ctx);
        this.drawAlignment(ctx);
    };

    this.drawGrid = function(ctx) {
        var width = canvas[0].width; var height = canvas[0].height;
        var stepSize = Math.round(2* SNAP_RAD * camera.zoom);

        var startX = camera.x - Math.floor(camera.x / (stepSize)) * stepSize;
        var startY = camera.y - Math.floor(camera.y / (stepSize)) * stepSize;

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

        for (x = startX - Math.round(stepSize / 2); x <= width; x+= stepSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }

        for (y = startY - Math.round(stepSize / 2); y <= height; y+= stepSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }

        ctx.stroke();
    };

    this.drawStates = function(ctx) {
        var realRad = Math.round(STATE_RAD * camera.zoom);
        var finalRad = Math.max(realRad - 3, 0);
        var width = canvas[0].width; var height = canvas[0].height;
        var posX, posY;

        // draw the actual STATES
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#f2f2f2";
        ctx.lineWidth = 1;
        ctx.beginPath();
        automaton.forEach(function(state) {
            var posX = that.screenX(state.position[0]);
            var posY = that.screenY(state.position[1]);

            if (posX < -realRad || posX > width + realRad ||
                posY < -realRad || posY > height + realRad) {
                return; // state is not visible
            }
            if (state == moving) {
                return;
            }

            ctx.moveTo(posX + realRad, posY);
            ctx.arc(posX, posY, realRad, 0, 2 * Math.PI);
            if (state.isFinal) {
                ctx.moveTo(posX + finalRad, posY);
                ctx.arc(posX, posY, finalRad, 0, 2 * Math.PI);
            }

        });
        ctx.fill();
        ctx.stroke();

        // draw the HIGHLIGHTED STATE
        if (moving !== null) {
            ctx.fillStyle = "#d14848";
            ctx.beginPath();
            posX = that.screenX(moving.position[0]);
            posY = that.screenY(moving.position[1]);
            ctx.moveTo(posX + realRad, posY);
            ctx.arc(posX, posY, realRad, 0, 2 * Math.PI);
            if (moving.isFinal) {
                ctx.moveTo(posX + finalRad, posY);
                ctx.arc(posX, posY, finalRad, 0, 2 * Math.PI);
            }
            ctx.fill();
            ctx.stroke();
        }

        // draw the STATE NAMES
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        automaton.forEach(function(state) {
            var posX = that.screenX(state.position[0]);
            var posY = that.screenY(state.position[1]);

            if (posX < -realRad || posX > width + realRad ||
                posY < -realRad || posY > height + realRad) {
                return; // state is not visible
            }
            ctx.fillText(toInternalID(state.name), posX, posY);
        });

        // draw the INCOMING LINE to the START STATE
        ctx.lineWidth = 2;
        ctx.beginPath();
        posX = that.screenX(automaton[0].position[0]);
        posY = that.screenY(automaton[0].position[1]);
        this.drawArrow(ctx, posX - 2 * realRad, posY, posX - realRad, posY);
        ctx.stroke();
    };

    function labelDir(fromState, toState) {
        return (discreetDirection(fromState.position, toState.position) * 2) % DIRECTIONS.ALL;
    }

    this.drawTransitions = function(ctx) {
        var realRad = Math.round(STATE_RAD * camera.zoom);
        var zoom = camera.zoom;
        var width = canvas[0].width; var height = canvas[0].height;
        var that = this;

        // first of all: draw arrows
        ctx.beginPath();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;

        automaton.forEach(function(state) {
            var posX = that.screenX(state.position[0]);
            var posY = that.screenY(state.position[1]);

            var startVisible =
                posX >= -realRad || posX <= width + realRad ||
                posY >= -realRad || posY <= height + realRad;

            // draw self loops
            if (state.loop != null) {
                that.drawLoopArrow(ctx, posX, posY, state.loop.placement, realRad);
            }

            // draw transition lines
            for (var entry of state.outgoing.entries()) {
                var nextState = entry[0];

                var otherX = that.screenX(nextState.position[0]);
                var otherY = that.screenY(nextState.position[1]);

                var endVisible =
                    otherX >= -realRad || otherX <= width + realRad ||
                    otherY >= -realRad || otherY <= height + realRad;

                if (!startVisible && !endVisible) {
                    return; // transition is not visible
                }

                if (state.incoming.has(nextState)) {
                    that.drawBendedArrow(ctx, state.position, nextState.position);
                } else if (!equal(state.position, nextState.position)) { // nothing to draw if both states are at the same spot
                    var dir = normalize(sub(nextState.position, state.position));

                    var startX = Math.round(posX + realRad * dir[0]);
                    var startY = Math.round(posY - realRad * dir[1]);
                    var endX = Math.round(otherX - realRad * dir[0]);
                    var endY = Math.round(otherY + realRad * dir[1]);

                    that.drawArrow(ctx, startX, startY, endX, endY);
                }
            }
        });

        ctx.stroke();

        // draw transition labels
        automaton.forEach(function(state) {
            var posX = that.screenX(state.position[0]);
            var posY = that.screenY(state.position[1]);

            var startVisible =
                posX >= -realRad || posX <= width + realRad ||
                posY >= -realRad || posY <= height + realRad;

            // draw self loops
            if (state.loop != null) {
                that.drawLoopLabel(ctx, posX, posY,
                    state.loop.placement, state.loop.symbs.replace($("#emptySymb").val(), "ε"), realRad);
            }

            for (var entry of state.outgoing.entries()) {
                var nextState = entry[0];
                var label = entry[1].symbs.replace($("#emptySymb").val(), "ε");

                var otherX = that.screenX(nextState.position[0]);
                var otherY = that.screenY(nextState.position[1]);

                var endVisible =
                    otherX >= -realRad || otherX <= width + realRad ||
                    otherY >= -realRad || otherY <= height + realRad;

                if (!startVisible && !endVisible) {
                    return; // transition is not visible
                }

                if (state.incoming.has(nextState)) {
                    that.drawBendedLabel(ctx, state.position, nextState.position, entry[1].placement, label);
                } else {
                    var midX = Math.round(posX + (otherX - posX) / 2);
                    var midY = Math.round(posY + (otherY - posY) / 2);

                    // determine position
                    const offset = Math.round(LBL_OFFSET * zoom);
                    switch (entry[1].placement) {
                        case DIRECTIONS.ABOVE:
                            midY -= offset;
                            break;
                        case DIRECTIONS.BELOW:
                            midY += offset;
                            break;
                        case DIRECTIONS.LEFT:
                            midX -= offset;
                            break;
                        case DIRECTIONS.RIGHT:
                            midX += offset;
                            break;
                    }
                    setTextAlign(ctx, entry[1].placement);
                    ctx.fillText(label, midX, midY);
                }
            }
        });
    };

    this.drawAlignment = function(ctx) {
        if (moving == null) {
            return; // no alignment to draw
        }

        var posX = this.screenX(moving.position[0]);
        var posY = this.screenY(moving.position[1]);
        var otherX, otherY;

        // draw lines to aligned states
        ctx.beginPath();
        if (xAligned != null) {
            otherX = this.screenX(xAligned.position[0]);
            otherY = this.screenY(xAligned.position[1]);

            ctx.lineWidth = 3;
            ctx.strokeStyle = "#A52A2A";
            ctx.moveTo(posX, posY);
            ctx.lineTo(otherX, otherY);
        }

        if (yAligned != null) {
            otherX = this.screenX(yAligned.position[0]);
            otherY = this.screenY(yAligned.position[1]);

            ctx.lineWidth = 3;
            ctx.strokeStyle = "#A52A2A";
            ctx.moveTo(posX, posY);
            ctx.lineTo(otherX, otherY);
        }
        ctx.stroke();
        ctx.strokeStyle = "#000000";
    };

    this.drawArrow = function (ctx, x1, y1, x2, y2){
        var angle = Math.atan2(y2 - y1, x2 - x1);

        // draw main line
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        this.drawArrowHead(ctx, x2, y2, angle);
    };

    this.drawArrowHead = function(ctx, x, y, angle) {
        var headlen = .25 * camera.zoom;
        ctx.lineTo(Math.round(x - headlen * Math.cos(angle - Math.PI/6)),
            Math.round(y - headlen * Math.sin(angle - Math.PI/6)));
        ctx.moveTo(x, y);
        ctx.lineTo(Math.round(x - headlen * Math.cos(angle + Math.PI/6)),
            Math.round(y - headlen * Math.sin(angle + Math.PI/6)));
    };

    this.drawBendedArrow = function(ctx, pos1, pos2) {
        const dis = 3*STATE_RAD;// distance in world coordinates
        const angle = 5.75959; // 30°

        var dir =  scalarMult(normalize(sub(pos2, pos1)), STATE_RAD);

        var start = add(pos1, rotate(dir,  angle));
        var end   = sub(pos2, rotate(dir, -angle));

        var midX = start[0] + (end[0] - start[0]) / 2;
        var midY = start[1] + (end[1] - start[1]) / 2;

        scalarMultInPlace(dir, dis);
        var control = [midX + dir[1], midY - dir[0]];

        // translate from world to screen coordinates
        this.toScreen(start);
        this.toScreen(end);
        this.toScreen(control);

        ctx.moveTo(start[0], start[1]);
        ctx.quadraticCurveTo(control[0], control[1], end[0], end[1]);

        this.drawArrowHead(ctx, end[0], end[1], Math.atan2(end[1]-control[1], end[0]-control[0]));
    };

    this.drawBendedLabel = function(ctx, pos1, pos2, lblDirection, label) {
        const dis = 3*STATE_RAD;// distance in world coordinates
        const angle = 5.75959; // 30°

        var dir =  scalarMult(normalize(sub(pos2, pos1)), STATE_RAD);

        var start = add(pos1, rotate(dir,  angle));
        var end   = sub(pos2, rotate(dir, -angle));

        var midX = start[0] + (end[0] - start[0]) / 2;
        var midY = start[1] + (end[1] - start[1]) / 2;

        scalarMultInPlace(dir, dis);
        var labelPos = [midX + dir[1], midY - dir[0]];
        this.toScreen(labelPos);

        // draw label
        var lblOffset = Math.round(LBL_OFFSET * camera.zoom + 10);
        switch (lblDirection) {
            case DIRECTIONS.ABOVE:
                labelPos[1] -= lblOffset;
                break;
            case DIRECTIONS.BELOW:
                labelPos[1] += lblOffset;
                break;
            case DIRECTIONS.LEFT:
                labelPos[0] -= lblOffset;
                break;
            case DIRECTIONS.RIGHT:
                labelPos[0] += lblOffset;
                break;
        }

        setTextAlign(ctx, lblDirection);
        ctx.fillText(label, labelPos[0], labelPos[1]);
    };

    this.drawLoopArrow = function(ctx, x, y, direction, realRad) {
        var loopDis = realRad;
        var loopExc = realRad;
        const angle = 0.523599; // 30°

        var dir, mid, control1, control2;
        switch(direction) {
            case DIRECTIONS.ABOVE:
                dir = [0,-realRad];
                mid = [x, y - realRad - loopDis];
                control1 = [x - loopExc, mid[1]];
                control2 = [x + loopExc, mid[1]];
                break;
            case DIRECTIONS.BELOW:
                dir = [0,realRad];
                mid = [x, y + realRad + loopDis];
                control1 = [x + loopExc, mid[1]];
                control2 = [x - loopExc, mid[1]];
                break;
            case DIRECTIONS.LEFT:
                dir = [-realRad,0];
                mid = [x - realRad - loopDis, y];
                control1 = [mid[0], y + loopExc];
                control2 = [mid[0], y - loopExc];
                break;
            case DIRECTIONS.RIGHT:
                dir = [realRad,0];
                mid = [x + realRad + loopDis, y];
                control1 = [mid[0], y - loopExc];
                control2 = [mid[0], y + loopExc];
                break;
        }

        var end = [Math.round(x + dir[0] * Math.cos(angle) - dir[1] * Math.sin(angle)),
            Math.round(y + dir[0] * Math.sin(angle) + dir[1] * Math.cos(angle))];

        var start = [Math.round(x + dir[0] * Math.cos(-angle) - dir[1] * Math.sin(-angle)),
            Math.round(y + dir[0] * Math.sin(-angle) + dir[1] * Math.cos(-angle))];

        mid = [Math.round(mid[0]), Math.round(mid[1])];
        control1 = [Math.round(control1[0]), Math.round(control1[1])];
        control2 = [Math.round(control2[0]), Math.round(control2[1])];

        ctx.moveTo(start[0], start[1]);
        ctx.quadraticCurveTo(control1[0], control1[1], mid[0], mid[1]);
        ctx.moveTo(mid[0], mid[1]);
        ctx.quadraticCurveTo(control2[0], control2[1], end[0], end[1]);
        this.drawArrowHead(ctx, end[0], end[1], Math.atan2(end[1]-control2[1], end[0]-control2[0]));
    };

    this.drawLoopLabel = function(ctx, x, y, direction, label, realRad) {
        var lblOffset = Math.round(LBL_OFFSET * camera.zoom);
        var loopDis = realRad;
        var lblPos, mid, dir;

        switch (direction) {
            case DIRECTIONS.ABOVE:
                dir = [0,-realRad];
                mid = y - realRad - loopDis;
                lblPos = [x, mid - lblOffset];
                break;
            case DIRECTIONS.BELOW:
                dir = [0,realRad];
                mid = y + realRad + loopDis;
                lblPos = [x, mid + lblOffset];
                break;
            case DIRECTIONS.LEFT:
                dir = [-realRad,0];
                mid = x - realRad - loopDis;
                lblPos = [mid - lblOffset, y];
                break;
            case DIRECTIONS.RIGHT:
                dir = [realRad,0];
                mid = x + realRad + loopDis;
                lblPos = [mid + lblOffset, y];
                break;
        }

        setTextAlign(ctx, direction);
        ctx.fillText(label, Math.round(lblPos[0]), Math.round(lblPos[1]));
    };

    function setTextAlign(ctx, direction) {
        switch(direction) {
            case DIRECTIONS.ABOVE:
                ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
                break;
            case DIRECTIONS.BELOW:
                ctx.textAlign = "center"; ctx.textBaseline = "hanging";
                break;
            case DIRECTIONS.LEFT:
                ctx.textAlign = "right"; ctx.textBaseline = "middle";
                break;
            case DIRECTIONS.RIGHT:
                ctx.textAlign = "left"; ctx.textBaseline = "middle";
                break;
        }
    }

    this.zoomIn = function(amount) {
        camera.zoom += amount;
        camera.zoom = Math.min(camera.zoom, ZOOM_MAX);
        this.drawAutomaton();
    };

    this.zoomOut = function(amount) {
        camera.zoom -= amount;
        camera.zoom = Math.max(camera.zoom, 0);
        this.drawAutomaton();
    };

    // center both automaton and camera around 0,0
    this.center = function() {
        // center camera
        camera.x = Math.round(canvas[0].width / 2);
        camera.y = Math.round(canvas[0].height / 2);

        // center states
        var offsetX = 0; var offsetY = 0;
        automaton.forEach(function(state) {
            offsetX += state.position[0];
            offsetY += state.position[1];
        });

        offsetX /= automaton.length;
        offsetY /= automaton.length;
        automaton.forEach(function(state) {
            state.position[0] -= offsetX;
            state.position[1] -= offsetY;
            that.updateStatePositional(state);
        });

        this.drawAutomaton();
        that.changelistener(selected);
    };

    function updateTransitionDirs(state) {
        state.freeDirs = state.isStart? DIRECTIONS.ALL - DIRECTIONS.LEFT : DIRECTIONS.ALL;
        var dir;

        for (var entry of state.outgoing.entries()) {
            dir = discreetDirection(state.position, entry[0].position);
            state.freeDirs &= ~dir;
        }
        for (var nextState of state.incoming) {
            dir = discreetDirection(state.position, nextState.position);
            state.freeDirs &= ~dir;
        }

        state.loop.placement = freeDirection(state.freeDirs);
    }

    this.updateStatePositional = function(state) {
        // update state labels
        for (var entry of state.outgoing.entries()) {
            entry[1].placement = labelDir(state, entry[0]);

            if (entry[0].loop != null) {
                updateTransitionDirs(entry[0]);
            }
        }
        for (var nextState of state.incoming) {
            nextState.outgoing.get(state).placement = labelDir(nextState, state);

            if (nextState.loop != null) {
                updateTransitionDirs(nextState);
            }
        }

        if (state.loop != null) {
            updateTransitionDirs(state);
        }

        // update spatial data structure
        spatial.move(state);
    };

    this.buildSpatial = function() {
        spatial = new SpatialStruct(SNAP_RAD);

        automaton.forEach(function(state) {
            spatial.put(state);
        });
    };

    this.screenX = function(worldX) {
        return Math.round(worldX * camera.zoom + camera.x);
    };

    this.screenY = function(worldY) {
        return Math.round(-worldY * camera.zoom + camera.y);
    };

    this.toScreen = function(worldVec) {
        worldVec[0] = this.screenX(worldVec[0]);
        worldVec[1] = this.screenY(worldVec[1]);
    };

    // listener
    var selected = null;
    var lastMouse = {x:-1, y:-1};
    var locked = {x: false, y:false};
    var accDelta = {x:0, y:0};

    function reset() {
        if ((selected instanceof State) && that.changelistener != null) {
            that.changelistener(selected);
        }

        selected = null;

        moving = null;
        xAligned = null;
        yAligned = null;

        locked.x = false; locked.y = false;
        accDelta.x = 0; accDelta.y = 0;

        that.drawAutomaton();
    }

    this.canvasMouseUp = function(event) {
        event.preventDefault();
        reset();
    };

    function findAligned(state) {
        xAligned = spatial.xNeighbour(state);
        yAligned = spatial.yNeighbour(state);
    }

    this.canvasMouseDown = function(event) {
        event.preventDefault();

        // convert from screen to "world" coordinates
        var mouseX = (event.offsetX - camera.x) / camera.zoom;
        var mouseY = -(event.offsetY - camera.y) / camera.zoom;

        lastMouse.x = event.offsetX; lastMouse.y = event.offsetY;

        selected = {};
        for (var i = 0; i < automaton.length; i++) {
            var state = automaton[i];

            // test if clicked on one of the states
            if (euclideanDistance(state.position, [mouseX, mouseY]) < STATE_RAD) {
                selected = state; moving = state;
                selected.canvasPos = [selected.position[0], selected.position[1]];
                findAligned(state);
                break;
            }
        }

        that.drawAutomaton();
    };

    this.canvasMouseMove = function(event) {
        event.preventDefault();

        if (selected != null) {
            // compute the moved mouse offset
            var deltaX = event.offsetX - lastMouse.x;
            var deltaY = event.offsetY - lastMouse.y;

            if (selected instanceof State) {
                // translate the selected state
                var movX = deltaX / camera.zoom;
                var movY = deltaY / camera.zoom;

                selected.canvasPos[0] += movX;
                selected.canvasPos[1] -= movY;

                if (snap == "neighbour") {
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
                } else if (snap == "grid") {
                    selected.position =
                        scalarMultInPlace(roundInPlace(scalarDiv(selected.canvasPos, SNAP_RAD)), SNAP_RAD);
                } else if (snap == "none") {
                    selected.position = clone(selected.canvasPos);
                }


                // update aligned states
                that.updateStatePositional(selected);
                findAligned(selected);

                if (snap == "neighbour") {
                    if (xAligned != null) {
                        selected.position[1] = xAligned.position[1];
                        that.updateStatePositional(selected);
                    }

                    if (yAligned != null) {
                        selected.position[0] = yAligned.position[0];
                        that.updateStatePositional(selected);
                    }

                    locked = {x: yAligned != null, y: xAligned != null};
                }
            } else { // move the camera
                camera.x += deltaX;
                camera.y += deltaY;
            }

            that.drawAutomaton();

            lastMouse.x = event.offsetX;
            lastMouse.y = event.offsetY;
        }
    };

    this.canvasMouseWheel = function(event) {
        event.preventDefault();

        if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
            that.zoomIn(ZOOM_STEP);
        }
        else {
            that.zoomOut(ZOOM_STEP)
        }
    };

    this.canvasMouseExit = function(event) {
        reset();
    };

    // register the listeners
    canvas.mouseup(this.canvasMouseUp);
    canvas.mousedown(this.canvasMouseDown);
    canvas.mousemove(this.canvasMouseMove);
    canvas.mouseleave(this.canvasMouseExit);
    canvas.bind('mousewheel DOMMouseScroll', this.canvasMouseWheel);

    // register listeners for the control panel
    control.find("#btnZoomIn").click(function() {
        that.zoomIn(3*ZOOM_STEP);
    });

    control.find("#btnZoomOut").click(function() {
        that.zoomOut(3*ZOOM_STEP);
    });

    control.find("#cbGrid").click(function() {
        showGrid = control.find("#cbGrid").is(":checked");
        that.drawAutomaton();
    });

    control.find("#btnCenter").click(function() {
        that.center();
        that.changelistener(automaton);
    });

    control.find("#btnAlign").click(function() {
        alignAutomaton(automaton, SNAP_RAD*2);
        that.drawAutomaton();
        that.changelistener(automaton);
    });

    control.find("#slSnap").click(function(){
        snap = this.value;
        that.drawAutomaton();
    });
}
